-- Audit fixes. Apply before deploying the corresponding application version.
-- No customer records are removed and no payment provider is invoked by this migration.
BEGIN;

-- A single counter row serializes concurrent owner removals, including direct SQL.
LOCK TABLE public.admin_users IN SHARE ROW EXCLUSIVE MODE;
UPDATE public.admin_users SET is_active = false WHERE is_active IS NULL;
ALTER TABLE public.admin_users ALTER COLUMN is_active SET NOT NULL;
CREATE TABLE public.admin_owner_guard (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  active_count integer NOT NULL CHECK (active_count >= 0)
);
INSERT INTO public.admin_owner_guard SELECT true, count(*) FROM public.admin_users WHERE role = 'SUPER_ADMIN' AND is_active;
ALTER TABLE public.admin_owner_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_owner_guard FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.protect_admin_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE was_owner boolean := false; is_owner boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN was_owner := (OLD.role = 'SUPER_ADMIN') IS TRUE AND OLD.is_active IS TRUE; END IF;
  IF TG_OP <> 'DELETE' THEN is_owner := (NEW.role = 'SUPER_ADMIN') IS TRUE AND NEW.is_active IS TRUE; END IF;
  IF was_owner AND NOT is_owner THEN
    UPDATE public.admin_owner_guard SET active_count = active_count - 1 WHERE singleton AND active_count > 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'last_active_super_admin' USING ERRCODE = '23514'; END IF;
  ELSIF is_owner AND NOT was_owner THEN
    UPDATE public.admin_owner_guard SET active_count = active_count + 1 WHERE singleton;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_admin_owner BEFORE INSERT OR UPDATE OR DELETE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_owner();

-- A durable audit row is part of every personnel mutation's transaction.
CREATE FUNCTION public.audit_admin_user_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid; actor_email text; target jsonb;
BEGIN
  actor := COALESCE(NULLIF(current_setting('app.admin_actor', true), '')::uuid, auth.uid());
  SELECT email INTO actor_email FROM public.admin_users WHERE user_id = actor;
  target := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  INSERT INTO public.admin_audit_logs(admin_id, admin_email, action, entity, entity_id, details)
    VALUES (COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(actor_email, 'system/database'),
      CASE TG_OP WHEN 'INSERT' THEN 'CREATE' WHEN 'DELETE' THEN 'DELETE' ELSE 'UPDATE' END,
      'admin_user', target->>'id', jsonb_build_object('databaseTransaction', true, 'role', target->>'role', 'is_active', target->'is_active',
        'before', CASE WHEN TG_OP='INSERT' THEN NULL ELSE jsonb_build_object('role',OLD.role,'is_active',OLD.is_active) END,
        'after', CASE WHEN TG_OP='DELETE' THEN NULL ELSE jsonb_build_object('role',NEW.role,'is_active',NEW.is_active) END));
  RETURN NULL;
END $$;
CREATE TRIGGER audit_admin_user_change AFTER INSERT OR UPDATE OR DELETE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_user_change();

CREATE FUNCTION public.mutate_admin_user(p_actor uuid, p_id uuid, p_patch jsonb, p_delete boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=p_actor AND role='SUPER_ADMIN' AND is_active) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('app.admin_actor', p_actor::text, true);
  IF p_delete THEN
    DELETE FROM public.admin_users WHERE id=p_id RETURNING to_jsonb(admin_users.*) INTO result;
  ELSE
    UPDATE public.admin_users SET
      role=COALESCE((jsonb_populate_record(NULL::public.admin_users,p_patch)).role, role),
      is_active=COALESCE((p_patch->>'is_active')::boolean, is_active),
      full_name=COALESCE(p_patch->>'full_name', full_name)
      WHERE id=p_id RETURNING to_jsonb(admin_users.*) INTO result;
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.mutate_admin_user(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_admin_user(uuid,uuid,jsonb,boolean) TO service_role;

CREATE FUNCTION public.create_admin_user(p_actor uuid,p_user uuid,p_email text,p_name text,p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_actor AND role='SUPER_ADMIN' AND is_active) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('app.admin_actor',p_actor::text,true);
  INSERT INTO public.admin_users(user_id,email,full_name,role,is_active)
    SELECT p_user,p_email,p_name,typed.role,true FROM jsonb_populate_record(NULL::public.admin_users,jsonb_build_object('role',p_role)) typed
    RETURNING to_jsonb(admin_users.*) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.create_admin_user(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_user(uuid,uuid,text,text,text) TO service_role;

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can read audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id=auth.uid() AND a.is_active
    AND (a.role='SUPER_ADMIN' OR admin_audit_logs.admin_id=auth.uid()))
);

-- One provider call per payment. Uncertain calls NEVER expire into automatic retries.
-- provider_succeeded is a durable recovery checkpoint: retry only local finalization.
CREATE TABLE public.refund_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.release_orders(id) ON DELETE CASCADE,
  provider text NOT NULL,
  payment_id text NOT NULL,
  duplicate boolean NOT NULL,
  amount_kurus bigint NOT NULL CHECK(amount_kurus>0),
  actor uuid NOT NULL,
  state text NOT NULL DEFAULT 'started' CHECK(state IN ('started','needs_review','provider_succeeded','completed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,payment_id)
);
ALTER TABLE public.refund_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refund_operations FROM PUBLIC,anon,authenticated;
GRANT SELECT, INSERT, UPDATE ON public.refund_operations TO service_role;

CREATE FUNCTION public.claim_refund_operation(p_order uuid,p_provider text,p_payment text,p_amount bigint,p_duplicate boolean,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE op public.refund_operations; fresh boolean; o public.release_orders;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_actor AND is_active AND role IN ('SUPER_ADMIN','FINANCE')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  SELECT * INTO o FROM public.release_orders WHERE id=p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_missing'; END IF;
  IF p_duplicate THEN
    IF p_payment=o.payment_id OR NOT EXISTS (
      SELECT 1 FROM public.order_events e WHERE e.order_id=p_order AND e.type='payment_succeeded'
        AND e.data->>'paymentId'=p_payment AND (e.data->>'duplicate')::boolean=true
        AND (e.data->>'paidKurus')::bigint=p_amount
    ) THEN RAISE EXCEPTION 'invalid_duplicate'; END IF;
    IF EXISTS(SELECT 1 FROM public.order_events e WHERE e.order_id=p_order AND e.type='refund_succeeded' AND e.data->>'paymentId'=p_payment) THEN
      RETURN jsonb_build_object('state','completed','fresh',false);
    END IF;
    -- Pre-migration attempts may have reached the provider. Reconcile them manually first.
    IF NOT EXISTS(SELECT 1 FROM public.refund_operations WHERE provider=p_provider AND payment_id=p_payment)
       AND EXISTS(SELECT 1 FROM public.order_events e WHERE e.order_id=p_order AND e.type='refund_started' AND e.data->>'paymentId'=p_payment) THEN
      RETURN jsonb_build_object('state','needs_review','fresh',false);
    END IF;
  ELSE
    IF o.status NOT IN ('withdrawal_requested','cancelled_by_seller') OR o.payment_id IS DISTINCT FROM p_payment
      OR o.payment_provider IS DISTINCT FROM p_provider OR o.total_kurus<>p_amount THEN RAISE EXCEPTION 'invalid_state'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.refund_operations WHERE provider=p_provider AND payment_id=p_payment)
       AND EXISTS(SELECT 1 FROM public.order_refunds WHERE order_id=p_order AND (provider_ref IS NOT NULL OR status='succeeded')) THEN
      RETURN jsonb_build_object('state','needs_review','fresh',false);
    END IF;
  END IF;
  INSERT INTO public.refund_operations(order_id,provider,payment_id,amount_kurus,duplicate,actor)
    VALUES(p_order,p_provider,p_payment,p_amount,p_duplicate,p_actor) ON CONFLICT(provider,payment_id) DO NOTHING RETURNING * INTO op;
  fresh := FOUND;
  IF NOT fresh THEN SELECT * INTO op FROM public.refund_operations WHERE provider=p_provider AND payment_id=p_payment; END IF;
  IF op.order_id<>p_order OR op.amount_kurus<>p_amount OR op.duplicate<>p_duplicate THEN RAISE EXCEPTION 'refund_conflict'; END IF;
  IF fresh THEN
    INSERT INTO public.order_events(order_id,type,actor,data) VALUES(p_order,'refund_started','admin:'||p_actor,
      jsonb_build_object('duplicate',p_duplicate,'paymentId',p_payment,'amountKurus',p_amount,'operationId',op.id));
    INSERT INTO public.admin_audit_logs(admin_id,admin_email,action,entity,entity_id,details)
      SELECT p_actor,email,'CREATE','refund_operation',op.id::text,jsonb_build_object('orderId',p_order) FROM public.admin_users WHERE user_id=p_actor;
  END IF;
  RETURN to_jsonb(op)||jsonb_build_object('fresh',fresh);
END $$;

CREATE FUNCTION public.finish_refund_operation(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE op public.refund_operations; o public.release_orders; at_time timestamptz:=now();
BEGIN
  SELECT * INTO op FROM public.refund_operations WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_missing'; END IF;
  SELECT * INTO o FROM public.release_orders WHERE id=op.order_id FOR UPDATE;
  IF op.state='completed' THEN RETURN to_jsonb(o); END IF;
  IF op.state<>'provider_succeeded' OR NOT COALESCE((op.result->>'ok')::boolean,false) OR op.result->>'refundId' IS NULL THEN
    RAISE EXCEPTION 'provider_result_missing';
  END IF;
  IF NOT op.duplicate THEN
    IF o.status NOT IN ('withdrawal_requested','cancelled_by_seller') THEN RAISE EXCEPTION 'invalid_refund_state'; END IF;
    UPDATE public.order_refunds SET status='succeeded',provider_ref=op.result->>'refundId',completed_at=at_time,error=NULL
      WHERE order_id=o.id AND status='pending';
    IF NOT FOUND THEN
      INSERT INTO public.order_refunds(order_id,amount_kurus,reason,status,provider,provider_ref,requested_by,completed_at)
        VALUES(o.id,op.amount_kurus,CASE WHEN o.status='withdrawal_requested' THEN 'withdrawal' ELSE 'seller_cancellation' END,
          'succeeded',op.provider,op.result->>'refundId','admin:'||op.actor,at_time);
    END IF;
    IF COALESCE(o.payment_meta->>'capacityHeld','true')<>'false' THEN
      PERFORM public.release_reserved_capacity(o.land_id,o.quantity);
    END IF;
    IF o.certificate_code IS NOT NULL AND o.certificate_cancelled_at IS NULL THEN
      INSERT INTO public.order_events(order_id,type,actor,data) VALUES(o.id,'certificate_cancelled','system',jsonb_build_object('code',o.certificate_code,'reason','refund'));
    END IF;
    UPDATE public.release_orders SET status='refunded',refunded_at=at_time,
      certificate_cancelled_at=CASE WHEN certificate_code IS NOT NULL THEN COALESCE(certificate_cancelled_at,at_time) ELSE certificate_cancelled_at END
      WHERE id=o.id RETURNING * INTO o;
    UPDATE public.order_invoices SET status='cancelled' WHERE order_id=o.id AND kind='sale' AND status='pending';
    IF EXISTS(SELECT 1 FROM public.order_invoices WHERE order_id=o.id AND kind='sale' AND status='issued')
       AND NOT EXISTS(SELECT 1 FROM public.order_invoices WHERE order_id=o.id AND kind='refund' AND status IN ('pending','issued')) THEN
      INSERT INTO public.order_invoices(order_id,kind,provider,status,created_by) VALUES(o.id,'refund','manual','pending','system');
    END IF;
  END IF;
  INSERT INTO public.order_events(order_id,type,actor,data) VALUES(o.id,'refund_succeeded','admin:'||op.actor,
    jsonb_build_object('duplicate',op.duplicate,'paymentId',op.payment_id,'refundId',op.result->>'refundId','method',op.result->>'method','amountKurus',op.amount_kurus,'operationId',op.id));
  INSERT INTO public.admin_audit_logs(admin_id,admin_email,action,entity,entity_id,details)
    VALUES(op.actor,COALESCE((SELECT email FROM public.admin_users WHERE user_id=op.actor),'former-admin'),
      'UPDATE','refund_operation',op.id::text,jsonb_build_object('state','completed','orderId',o.id));
  UPDATE public.refund_operations SET state='completed',updated_at=at_time WHERE id=op.id;
  RETURN to_jsonb(o);
END $$;
REVOKE ALL ON FUNCTION public.claim_refund_operation(uuid,text,text,bigint,boolean,uuid), public.finish_refund_operation(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_refund_operation(uuid,text,text,bigint,boolean,uuid), public.finish_refund_operation(uuid) TO service_role;

-- Persisted, atomic contact-form quota shared by all server instances. Only hashes are stored.
CREATE TABLE public.contact_rate_limits (key text PRIMARY KEY, hits integer NOT NULL, resets_at timestamptz NOT NULL);
ALTER TABLE public.contact_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_rate_limits FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.consume_contact_quota(p_key text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.contact_rate_limits;
BEGIN
  DELETE FROM public.contact_rate_limits WHERE resets_at < now() - interval '1 day';
  INSERT INTO public.contact_rate_limits VALUES(p_key,1,now()+interval '10 minutes') ON CONFLICT(key) DO UPDATE SET
    hits=CASE WHEN contact_rate_limits.resets_at<=now() THEN 1 ELSE contact_rate_limits.hits+1 END,
    resets_at=CASE WHEN contact_rate_limits.resets_at<=now() THEN now()+interval '10 minutes' ELSE contact_rate_limits.resets_at END RETURNING * INTO r;
  RETURN CASE WHEN r.hits>5 THEN GREATEST(1,ceil(extract(epoch FROM r.resets_at-now()))::integer) ELSE 0 END;
END $$;
REVOKE ALL ON FUNCTION public.consume_contact_quota(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_contact_quota(text) TO service_role;
COMMIT;
