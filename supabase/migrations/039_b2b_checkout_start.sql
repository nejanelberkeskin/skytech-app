-- Requires 034/035/037. Apply in one transaction with B2B disabled and old workers stopped.
-- This lease fences a LOCAL dispatch permit, never the lifetime of a provider session.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public.b2b_checkout_starts (
 payment_id uuid PRIMARY KEY REFERENCES public.payments(id),
 state text NOT NULL DEFAULT 'prepared' CHECK (state IN ('prepared','dispatched','ready','unknown','not_started')),
 origin text NOT NULL DEFAULT 'not_started' CHECK (origin IN ('not_started','provider_response','unknown')),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '2 minutes',
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.b2b_checkout_starts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.b2b_checkout_starts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.b2b_checkout_starts TO service_role;
ALTER FUNCTION public.claim_b2b_checkout(uuid,uuid,numeric,integer,boolean) RENAME TO claim_b2b_checkout_core;
REVOKE ALL ON FUNCTION public.claim_b2b_checkout_core(uuid,uuid,numeric,integer,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.claim_b2b_checkout(p_quote uuid,p_user uuid,p_amount numeric,p_seeds integer,p_is_test boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.corporate_quotes; p public.payments; s public.b2b_checkout_starts; answer jsonb;
BEGIN
 SELECT * INTO q FROM public.corporate_quotes WHERE id=p_quote FOR UPDATE;
 IF NOT FOUND OR p_user IS NULL OR q.user_id IS DISTINCT FROM p_user THEN RETURN jsonb_build_object('status','rejected'); END IF;
 IF q.status IS DISTINCT FROM 'QUOTED' OR q.payment_id IS NOT NULL THEN RETURN jsonb_build_object('status','closed'); END IF;
 IF p_is_test IS NULL OR p_amount IS NULL OR p_seeds IS NULL OR q.approved_price IS DISTINCT FROM p_amount OR q.approved_seed_count IS DISTINCT FROM p_seeds THEN
  RETURN jsonb_build_object('status','quote_changed'); END IF;
 IF EXISTS(SELECT 1 FROM public.b2b_payment_holds WHERE quote_id=q.id AND resolved_at IS NULL) THEN RETURN jsonb_build_object('status','checkout_unavailable'); END IF;
 SELECT * INTO p FROM public.payments WHERE order_id=q.order_id AND metadata->>'quote_id'=q.id::text AND metadata->>'checkout_type'='b2b' AND status='pending' FOR UPDATE;
 IF FOUND THEN
  SELECT * INTO s FROM public.b2b_checkout_starts WHERE payment_id=p.id FOR UPDATE;
  IF s.state='prepared' AND s.expires_at<=clock_timestamp()
    AND p.provider='iyzico' AND p.metadata->'is_test'=to_jsonb(p_is_test) AND p.user_id=q.user_id
    AND p.iyzico_payment_id IS NULL AND NOT (p.metadata ? 'iyzico_token')
    AND NOT EXISTS(SELECT 1 FROM public.b2b_payment_observations WHERE payment_id=p.id)
    AND NOT EXISTS(SELECT 1 FROM public.b2b_resolution_operations WHERE payment_id=p.id AND state='pending') THEN
   -- Once this commits, begin_b2b_checkout_start can never grant this old dispatch permit.
   UPDATE public.orders SET status='cancelled',updated_at=now() WHERE id=p.order_id AND user_id=q.user_id AND status='pending' AND payment_status='pending';
   IF NOT FOUND THEN RETURN jsonb_build_object('status','checkout_unavailable'); END IF;
   UPDATE public.payments SET status='cancelled',metadata=metadata||'{"retry_release":"verified","init_not_started":true}'::jsonb,updated_at=now() WHERE id=p.id;
   UPDATE public.b2b_checkout_starts SET state='not_started',updated_at=clock_timestamp() WHERE payment_id=p.id;
   UPDATE public.corporate_quotes SET order_id=NULL WHERE id=q.id;
   INSERT INTO public.b2b_payment_observations(payment_id,result,disposition,reason)
    VALUES(p.id,'{"origin":"not_started"}','review','init_not_started');
  ELSE
   IF s.payment_id IS NOT NULL AND p.metadata->'is_test'=to_jsonb(p_is_test)
      AND coalesce(p.metadata->>'payment_review_required','false')='false'
      AND NOT EXISTS(SELECT 1 FROM public.b2b_reconciliation_queue WHERE payment_id=p.id AND state='needs_review') THEN
    RETURN jsonb_build_object('status','checkout_pending');
   END IF;
   RETURN jsonb_build_object('status','checkout_unavailable');
  END IF;
 END IF;
 answer:=public.claim_b2b_checkout_core(p_quote,p_user,p_amount,p_seeds,p_is_test);
 IF answer->>'status'='claimed' THEN INSERT INTO public.b2b_checkout_starts(payment_id) VALUES((answer->>'payment_id')::uuid); END IF;
 RETURN answer;
END $$;

CREATE FUNCTION public.begin_b2b_checkout_start(p_payment uuid,p_user uuid,p_is_test boolean,p_locale text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.payments; q public.corporate_quotes; s public.b2b_checkout_starts;
BEGIN
 SELECT * INTO p FROM public.payments WHERE id=p_payment;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','rejected'); END IF;
 SELECT * INTO q FROM public.corporate_quotes WHERE id::text=p.metadata->>'quote_id' FOR UPDATE;
 SELECT * INTO p FROM public.payments WHERE id=p_payment FOR UPDATE;
 SELECT * INTO s FROM public.b2b_checkout_starts WHERE payment_id=p_payment FOR UPDATE;
 IF s.state IS DISTINCT FROM 'prepared' OR s.expires_at<=clock_timestamp()
   OR p_user IS NULL OR p.user_id IS DISTINCT FROM p_user OR q.user_id IS DISTINCT FROM p_user
   OR p_is_test IS NULL OR p.metadata->'is_test' IS DISTINCT FROM to_jsonb(p_is_test)
   OR p.provider IS DISTINCT FROM 'iyzico' OR p.status IS DISTINCT FROM 'pending' OR p.metadata->>'checkout_type' IS DISTINCT FROM 'b2b'
   OR q.status IS DISTINCT FROM 'QUOTED' OR q.order_id IS DISTINCT FROM p.order_id OR q.payment_id IS NOT NULL
   OR q.approved_price IS DISTINCT FROM p.amount
   OR EXISTS(SELECT 1 FROM public.b2b_payment_holds WHERE quote_id=q.id AND resolved_at IS NULL)
   OR EXISTS(SELECT 1 FROM public.b2b_payment_observations WHERE payment_id=p.id)
   OR NOT EXISTS(SELECT 1 FROM public.orders WHERE id=p.order_id AND user_id=p_user AND status='pending' AND payment_status='pending' AND total_price=p.amount AND total_seeds=q.approved_seed_count)
 THEN RETURN jsonb_build_object('status','rejected'); END IF;
 UPDATE public.b2b_checkout_starts SET state='dispatched',origin='unknown',updated_at=clock_timestamp() WHERE payment_id=p.id;
 UPDATE public.payments SET metadata=metadata||jsonb_build_object('ui_locale',CASE WHEN p_locale IN ('en','ru') THEN p_locale ELSE 'tr' END),updated_at=now() WHERE id=p.id;
 -- Discover uncertain attempts even if the process dies before recording the response.
 INSERT INTO public.b2b_reconciliation_queue(payment_id,next_check_at) VALUES(p.id,now()+interval '10 minutes') ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('status','dispatch');
END $$;

CREATE FUNCTION public.finish_b2b_checkout_start(p_payment uuid,p_user uuid,p_is_test boolean,p_origin text,p_token text,p_form_ready boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.payments; q public.corporate_quotes; s public.b2b_checkout_starts; next_state text;
BEGIN
 IF p_origin IS NULL OR p_origin NOT IN ('unknown','provider_response') OR (p_token IS NOT NULL AND p_token !~ '^[A-Za-z0-9._~-]{8,200}$')
   OR (p_token IS NOT NULL AND p_origin<>'provider_response') THEN RETURN jsonb_build_object('status','rejected'); END IF;
 SELECT * INTO p FROM public.payments WHERE id=p_payment;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','rejected'); END IF;
 SELECT * INTO q FROM public.corporate_quotes WHERE id::text=p.metadata->>'quote_id' FOR UPDATE;
 SELECT * INTO p FROM public.payments WHERE id=p_payment FOR UPDATE;
 SELECT * INTO s FROM public.b2b_checkout_starts WHERE payment_id=p_payment FOR UPDATE;
 IF s.state IS DISTINCT FROM 'dispatched' OR p_user IS NULL OR p.user_id IS DISTINCT FROM p_user
   OR p_is_test IS NULL OR p.metadata->'is_test' IS DISTINCT FROM to_jsonb(p_is_test) THEN RETURN jsonb_build_object('status','stale'); END IF;
 next_state:=CASE WHEN p_origin='provider_response' AND p_token IS NOT NULL AND p_form_ready IS TRUE THEN 'ready' ELSE 'unknown' END;
 UPDATE public.b2b_checkout_starts SET state=next_state,origin=p_origin,updated_at=clock_timestamp() WHERE payment_id=p.id;
 -- Merge, never replace metadata: preserve concurrent observations/review flags and locale.
 IF p_token IS NOT NULL THEN
  UPDATE public.payments SET metadata=metadata||jsonb_build_object('iyzico_token',p_token),updated_at=now() WHERE id=p.id;
 END IF;
 IF next_state='ready' AND (p.status<>'pending' OR q.status<>'QUOTED' OR q.user_id IS DISTINCT FROM p_user OR q.order_id IS DISTINCT FROM p.order_id OR q.payment_id IS NOT NULL
    OR q.approved_price IS DISTINCT FROM p.amount OR coalesce(p.metadata->>'payment_review_required','false')<>'false'
    OR EXISTS(SELECT 1 FROM public.b2b_payment_holds WHERE quote_id=q.id AND resolved_at IS NULL)) THEN next_state:='unknown'; END IF;
 RETURN jsonb_build_object('status',next_state);
END $$;
REVOKE ALL ON FUNCTION public.claim_b2b_checkout(uuid,uuid,numeric,integer,boolean),public.begin_b2b_checkout_start(uuid,uuid,boolean,text),public.finish_b2b_checkout_start(uuid,uuid,boolean,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.claim_b2b_checkout(uuid,uuid,numeric,integer,boolean),public.begin_b2b_checkout_start(uuid,uuid,boolean,text),public.finish_b2b_checkout_start(uuid,uuid,boolean,text,text,boolean) TO service_role;

-- Same bounded queue/attempt budget as 035; a missing token selects paymentConversationId.
CREATE OR REPLACE FUNCTION public.claim_b2b_reconciliation(p_is_test boolean)
RETURNS TABLE(payment_id uuid,token text,attempt integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_is_test IS NULL THEN RETURN; END IF;
 INSERT INTO public.b2b_reconciliation_queue(payment_id)
  SELECT p.id FROM public.payments p LEFT JOIN public.b2b_checkout_starts s ON s.payment_id=p.id
  WHERE p.status='pending' AND p.provider='iyzico' AND p.metadata->>'checkout_type'='b2b' AND p.metadata->'is_test'=to_jsonb(p_is_test)
   AND (s.payment_id IS NULL OR s.state IN ('dispatched','ready','unknown'))
   AND NOT EXISTS(SELECT 1 FROM public.b2b_reconciliation_queue q WHERE q.payment_id=p.id)
  ORDER BY p.created_at,p.id LIMIT 100 ON CONFLICT DO NOTHING;
 RETURN QUERY
  WITH candidates AS (
   SELECT q.payment_id FROM public.b2b_reconciliation_queue q JOIN public.payments p ON p.id=q.payment_id
   LEFT JOIN public.b2b_checkout_starts s ON s.payment_id=p.id
   WHERE q.state='open' AND q.attempts<8 AND q.next_check_at<=now() AND p.status='pending'
    AND p.provider='iyzico' AND p.metadata->>'checkout_type'='b2b' AND p.metadata->'is_test'=to_jsonb(p_is_test)
    AND (s.payment_id IS NULL OR s.state IN ('dispatched','ready','unknown'))
   ORDER BY q.next_check_at,q.payment_id LIMIT 2 FOR UPDATE OF q SKIP LOCKED
  ), leased AS (
   UPDATE public.b2b_reconciliation_queue q SET attempts=q.attempts+1,next_check_at=now()+interval '10 minutes',
    state=CASE WHEN q.attempts+1=8 THEN 'needs_review' ELSE 'open' END,updated_at=now()
   FROM candidates c WHERE q.payment_id=c.payment_id RETURNING q.payment_id,q.attempts
  ) SELECT l.payment_id,CASE WHEN p.metadata->>'iyzico_token' ~ '^[A-Za-z0-9._~-]{8,200}$' THEN p.metadata->>'iyzico_token' ELSE NULL END,l.attempts
    FROM leased l JOIN public.payments p ON p.id=l.payment_id;
END $$;
