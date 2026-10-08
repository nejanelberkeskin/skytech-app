-- C1 local-only draft; requires 021/022 permissions and 034/035. Apply in one recorded transaction.
-- No provider calls, automatic timeout release, refund, deletion or permission grants.
CREATE TABLE public.b2b_payment_holds (
 payment_id uuid PRIMARY KEY REFERENCES public.payments(id),
 quote_id uuid NOT NULL REFERENCES public.corporate_quotes(id),
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 resolved_at timestamptz
);
CREATE TABLE public.b2b_resolution_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payment_id uuid NOT NULL REFERENCES public.payments(id),
 actor uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('refresh','release')),
 evidence text NOT NULL CHECK(length(trim(evidence)) BETWEEN 10 AND 500),
 session_closed boolean NOT NULL DEFAULT false,
 snapshot text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','done','stale')),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '2 minutes',
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX b2b_resolution_active ON public.b2b_resolution_operations(payment_id) WHERE state='pending';
ALTER TABLE public.b2b_payment_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_resolution_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.b2b_payment_holds,public.b2b_resolution_operations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.b2b_payment_holds,public.b2b_resolution_operations TO service_role;

-- Both read and dedicated resolution authority must cover all records (catalog 038).
CREATE FUNCTION public.b2b_can_resolve(p_actor uuid,p_verified_at timestamptz) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_actor IS NOT NULL AND p_verified_at IS NOT NULL
 AND p_verified_at BETWEEN now()-interval '15 minutes' AND now()+interval '30 seconds'
 AND NOT EXISTS (SELECT 1 FROM unnest(ARRAY['finance.read','finance.b2b_payment.resolve']) required
 WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.admin_effective_permissions(p_actor)->'permissions') p
 WHERE p->>'key'=required AND EXISTS(SELECT 1 FROM jsonb_array_elements(p->'scopes') s WHERE s->>'kind'='all')));
$$;

-- Retain original verified-payment logic, but never expose its bypass to service clients.
ALTER FUNCTION public.record_b2b_payment_result(uuid,boolean,jsonb) RENAME TO record_b2b_payment_result_core;
REVOKE ALL ON FUNCTION public.record_b2b_payment_result_core(uuid,boolean,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.record_b2b_payment_result(p_payment uuid,p_is_test boolean,p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.payments; q public.corporate_quotes; answer jsonb; safe jsonb; why text; qid uuid; pid text:=nullif(p_result->>'payment_id','');
BEGIN
 IF pid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('b2b-receipt:'||pid,0)); END IF;
 SELECT * INTO p FROM public.payments WHERE id=p_payment;
 IF NOT FOUND OR p.metadata->>'checkout_type' IS DISTINCT FROM 'b2b' THEN RETURN jsonb_build_object('status','rejected'); END IF;
 BEGIN qid:=(p.metadata->>'quote_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('status','rejected'); END;
 SELECT * INTO q FROM public.corporate_quotes WHERE id=qid FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','rejected'); END IF;
 SELECT * INTO p FROM public.payments WHERE id=p_payment FOR UPDATE;
 IF p.provider IS DISTINCT FROM 'iyzico' OR p_is_test IS NULL OR p.metadata->'is_test' IS DISTINCT FROM to_jsonb(p_is_test) THEN RETURN jsonb_build_object('status','rejected'); END IF;
 IF p.status IN ('failed','cancelled') AND p_result->>'status'='success' AND p_result->>'payment_status'='SUCCESS'
   AND pid IS NOT NULL AND p_result->>'basket_id'=p.order_id::text THEN why:='late_success_after_release';
 ELSIF p.status='pending' AND EXISTS(SELECT 1 FROM public.b2b_payment_holds WHERE quote_id=q.id AND payment_id<>p.id AND resolved_at IS NULL) THEN why:='other_attempt_on_hold'; END IF;
 IF why IS NOT NULL THEN
   SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO safe FROM jsonb_each(p_result)
     WHERE key=ANY(ARRAY['status','payment_status','payment_id','basket_id','conversation_id','currency','price_kurus','paid_kurus','fraud_status']);
   IF NOT EXISTS(SELECT 1 FROM public.b2b_payment_observations WHERE payment_id=p.id AND reason=why AND result=safe) THEN
     INSERT INTO public.b2b_payment_observations(payment_id,provider_payment_id,result,disposition,reason) VALUES(p.id,left(pid,200),safe,'review',why);
   END IF;
   INSERT INTO public.b2b_payment_holds(payment_id,quote_id,reason) VALUES(p.id,q.id,why)
     ON CONFLICT(payment_id) DO UPDATE SET reason=excluded.reason,resolved_at=NULL;
   UPDATE public.payments SET metadata=coalesce(metadata,'{}')||'{"payment_review_required":true}'::jsonb,updated_at=now() WHERE id=p.id;
   RETURN jsonb_build_object('status','review');
 END IF;
 answer:=public.record_b2b_payment_result_core(p_payment,p_is_test,p_result);
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.record_b2b_payment_result(uuid,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_b2b_payment_result(uuid,boolean,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_b2b_checkout(p_quote uuid, p_user uuid, p_amount numeric, p_seeds integer, p_is_test boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE q public.corporate_quotes%ROWTYPE; new_order_id uuid; new_payment_id uuid; email text;
BEGIN
  SELECT * INTO q FROM public.corporate_quotes WHERE id=p_quote FOR UPDATE;
  IF NOT FOUND OR p_user IS NULL OR q.user_id IS DISTINCT FROM p_user THEN RETURN jsonb_build_object('status','rejected'); END IF;
  IF q.status IS DISTINCT FROM 'QUOTED' OR q.payment_id IS NOT NULL THEN RETURN jsonb_build_object('status','closed'); END IF;
  IF p_is_test IS NULL OR p_amount IS NULL OR p_seeds IS NULL OR p_amount <= 0 OR p_amount*100 <> trunc(p_amount*100)
     OR p_amount > 9999999999.99 OR p_seeds <= 0 OR q.approved_price IS DISTINCT FROM p_amount
     OR q.approved_seed_count IS DISTINCT FROM p_seeds THEN RETURN jsonb_build_object('status','quote_changed'); END IF;
  -- The historical order pointer is also a hold: do not replace unknown older attempts.
  IF q.order_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.b2b_payment_holds WHERE quote_id=q.id AND resolved_at IS NULL) OR EXISTS(SELECT 1 FROM public.payments WHERE metadata->>'quote_id'=q.id::text AND metadata->>'checkout_type'='b2b' AND NOT (status IN ('failed','cancelled') AND metadata->>'retry_release' IS NOT DISTINCT FROM 'verified')) THEN
    RETURN jsonb_build_object('status','checkout_in_progress');
  END IF;
  email := nullif(trim(q.corporate_email),'');
  IF email IS NULL THEN RETURN jsonb_build_object('status','buyer_incomplete'); END IF;
  INSERT INTO public.orders(user_id,buyer_email,order_type,status,total_seeds,total_price)
    VALUES(p_user,email,'reservation','pending',p_seeds,p_amount) RETURNING id INTO new_order_id;
  INSERT INTO public.payments(order_id,user_id,amount,status,currency,provider,description,metadata)
    VALUES(new_order_id,p_user,p_amount,'pending','TRY','iyzico','B2B teklif',jsonb_build_object('checkout_type','b2b','quote_id',q.id,'is_test',p_is_test)) RETURNING id INTO new_payment_id;
  UPDATE public.corporate_quotes SET order_id=new_order_id WHERE id=q.id;
  RETURN jsonb_build_object('status','claimed','order_id',new_order_id,'payment_id',new_payment_id);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_b2b_checkout(uuid,uuid,numeric,integer,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_b2b_checkout(uuid,uuid,numeric,integer,boolean) TO service_role;

CREATE FUNCTION public.begin_b2b_resolution(p_payment uuid,p_actor uuid,p_verified_at timestamptz,p_action text,p_evidence text,p_session_closed boolean,p_is_test boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.payments; q public.corporate_quotes; op public.b2b_resolution_operations; qid uuid;
BEGIN
 IF public.b2b_can_resolve(p_actor,p_verified_at) IS NOT TRUE THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('refresh','release') OR p_evidence IS NULL OR length(trim(p_evidence)) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'invalid_evidence'; END IF;
 IF p_action='release' AND p_session_closed IS DISTINCT FROM true THEN RAISE EXCEPTION 'terminal_evidence_required'; END IF;
 SELECT * INTO p FROM public.payments WHERE id=p_payment;
 IF NOT FOUND OR p.metadata->>'checkout_type' IS DISTINCT FROM 'b2b' THEN RETURN jsonb_build_object('status','missing'); END IF;
 BEGIN qid:=(p.metadata->>'quote_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('status','missing'); END;
 SELECT * INTO q FROM public.corporate_quotes WHERE id=qid FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','missing'); END IF;
 SELECT * INTO p FROM public.payments WHERE id=p_payment FOR UPDATE;
 IF p.provider IS DISTINCT FROM 'iyzico' OR p_is_test IS NULL OR p.metadata->'is_test' IS DISTINCT FROM to_jsonb(p_is_test) THEN RETURN jsonb_build_object('status','environment_mismatch'); END IF;
 UPDATE public.b2b_resolution_operations SET state='stale' WHERE payment_id=p.id AND state='pending' AND expires_at<=clock_timestamp();
 IF EXISTS(SELECT 1 FROM public.b2b_resolution_operations WHERE payment_id=p.id AND state='pending') THEN RETURN jsonb_build_object('status','busy'); END IF;
 INSERT INTO public.b2b_resolution_operations(payment_id,actor,action,evidence,session_closed,snapshot)
 VALUES(p.id,p_actor,p_action,trim(p_evidence),coalesce(p_session_closed,false),md5(to_jsonb(p)::text||to_jsonb(q)::text)) RETURNING * INTO op;
 RETURN jsonb_build_object('status','started','operationId',op.id,'token',p.metadata->>'iyzico_token','paymentId',p.id);
END $$;

CREATE FUNCTION public.finish_b2b_resolution(p_operation uuid,p_actor uuid,p_verified_at timestamptz,p_is_test boolean,p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE op public.b2b_resolution_operations; p public.payments; q public.corporate_quotes; answer jsonb; qid uuid; pid text:=nullif(p_result->>'payment_id','');
BEGIN
 IF public.b2b_can_resolve(p_actor,p_verified_at) IS NOT TRUE THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO op FROM public.b2b_resolution_operations WHERE id=p_operation AND actor=p_actor;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','missing'); END IF;
 IF pid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('b2b-receipt:'||pid,0)); END IF;
 SELECT * INTO p FROM public.payments WHERE id=op.payment_id;
 qid:=(p.metadata->>'quote_id')::uuid;
 SELECT * INTO q FROM public.corporate_quotes WHERE id=qid FOR UPDATE;
 SELECT * INTO p FROM public.payments WHERE id=op.payment_id FOR UPDATE;
 SELECT * INTO op FROM public.b2b_resolution_operations WHERE id=p_operation FOR UPDATE;
 IF op.state='done' THEN RETURN op.result; END IF;
 IF op.state<>'pending' OR op.expires_at<=clock_timestamp() OR op.snapshot IS DISTINCT FROM md5(to_jsonb(p)::text||to_jsonb(q)::text) THEN
   UPDATE public.b2b_resolution_operations SET state='stale' WHERE id=op.id;
   RETURN jsonb_build_object('status','stale');
 END IF;
 IF p.provider IS DISTINCT FROM 'iyzico' OR p_is_test IS NULL OR p.metadata->'is_test' IS DISTINCT FROM to_jsonb(p_is_test) THEN RETURN jsonb_build_object('status','environment_mismatch'); END IF;
 IF op.action='release' AND op.session_closed AND p.status='pending' AND q.status='QUOTED' AND q.order_id=p.order_id AND q.payment_id IS NULL
   AND NOT EXISTS(SELECT 1 FROM public.b2b_payment_holds WHERE quote_id=q.id AND resolved_at IS NULL)
   AND p_result->>'status'='success' AND p_result->>'payment_status'='FAILURE'
   AND p_result->>'basket_id'=p.order_id::text AND p_result->>'conversation_id'=p.id::text
   AND p_result->>'currency'=p.currency AND p.currency='TRY'
   AND jsonb_typeof(p_result->'price_kurus')='number' AND p_result->'price_kurus'=to_jsonb(p.amount*100)
   AND p.user_id=q.user_id AND q.approved_price=p.amount
   AND EXISTS(SELECT 1 FROM public.orders o WHERE o.id=p.order_id AND o.user_id=q.user_id AND o.total_price=p.amount AND o.total_seeds=q.approved_seed_count)
   AND (p_result->'fraud_status' IS NULL OR p_result->'fraud_status'='null'::jsonb OR p_result->'fraud_status'='-1'::jsonb)
   AND (p_result->'paid_kurus' IS NULL OR p_result->'paid_kurus'='null'::jsonb OR p_result->'paid_kurus'='0'::jsonb)
   AND NOT EXISTS(SELECT 1 FROM public.payments WHERE iyzico_payment_id=pid AND id<>p.id)
   AND NOT EXISTS(SELECT 1 FROM public.b2b_payment_observations WHERE payment_id=p.id AND result->>'payment_status'='SUCCESS') THEN
   UPDATE public.payments SET status='failed',metadata=coalesce(metadata,'{}')||'{"retry_release":"verified","payment_review_required":false}'::jsonb,updated_at=now() WHERE id=p.id;
   UPDATE public.orders SET status='cancelled',updated_at=now() WHERE id=p.order_id AND status='pending' AND payment_status='pending';
   IF NOT FOUND THEN RAISE EXCEPTION 'state_changed'; END IF;
   UPDATE public.corporate_quotes SET order_id=NULL WHERE id=q.id;
   UPDATE public.b2b_reconciliation_queue SET state='done',last_outcome='closed',updated_at=now() WHERE payment_id=p.id;
   INSERT INTO public.b2b_payment_observations(payment_id,provider_payment_id,result,disposition,reason)
   VALUES(p.id,left(pid,200),jsonb_build_object('status','success','payment_status','FAILURE','basket_id',p.order_id,'conversation_id',p.id,'currency',p.currency),'review','verified_terminal_release');
   answer:=jsonb_build_object('status','released');
 ELSE
   answer:=public.record_b2b_payment_result(p.id,p_is_test,p_result);
   IF op.action='release' AND answer->>'status' NOT IN ('paid','already_paid') THEN answer:=jsonb_build_object('status','review'); END IF;
 END IF;
 PERFORM public.admin_audit(p_actor,'UPDATE','b2b_payment_resolution',p.id::text,jsonb_build_object('operationId',op.id,'action',op.action,'result',answer->>'status','evidence',op.evidence,'sessionClosedConfirmed',op.session_closed));
 UPDATE public.b2b_resolution_operations SET state='done',result=answer WHERE id=op.id;
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.b2b_can_resolve(uuid,timestamptz),public.begin_b2b_resolution(uuid,uuid,timestamptz,text,text,boolean,boolean),public.finish_b2b_resolution(uuid,uuid,timestamptz,boolean,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.begin_b2b_resolution(uuid,uuid,timestamptz,text,text,boolean,boolean),public.finish_b2b_resolution(uuid,uuid,timestamptz,boolean,jsonb) TO service_role;
