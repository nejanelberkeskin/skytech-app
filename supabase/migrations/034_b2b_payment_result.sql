-- Local draft; requires the existing orders/payments schema and 004 or D1-b/032.
-- No capacity, data cleanup, provider calls or automatic refund. Apply only with the matching code.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.b2b_payment_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id),
  provider_payment_id text,
  result jsonb NOT NULL,
  disposition text NOT NULL CHECK (disposition IN ('review', 'applied')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX b2b_payment_observations_payment_idx ON public.b2b_payment_observations(payment_id);
ALTER TABLE public.b2b_payment_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.b2b_payment_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.b2b_payment_observations TO service_role;

CREATE FUNCTION public.record_b2b_payment_result(p_payment uuid, p_is_test boolean, p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.payments%ROWTYPE;
  q public.corporate_quotes%ROWTYPE;
  o public.orders%ROWTYPE;
  observation_id uuid;
  quote_id uuid;
  reason text;
  price bigint;
  paid bigint;
  provider_id text := nullif(p_result->>'payment_id', '');
  safe_result jsonb;
BEGIN
  -- Serialize an identical provider receipt across different local quotes too.
  IF provider_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('b2b-receipt:' || provider_id,0)); END IF;
  -- Order of locks is quote -> payment -> order, shared by all calls for that quote.
  SELECT * INTO p FROM public.payments WHERE id = p_payment;
  IF NOT FOUND OR p.metadata->>'checkout_type' IS DISTINCT FROM 'b2b' THEN
    RETURN jsonb_build_object('status','rejected');
  END IF;
  BEGIN quote_id := (p.metadata->>'quote_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('status','rejected'); END;
  SELECT * INTO q FROM public.corporate_quotes WHERE id = quote_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','rejected'); END IF;
  SELECT * INTO p FROM public.payments WHERE id = p_payment FOR UPDATE;
  SELECT * INTO o FROM public.orders WHERE id = p.order_id FOR UPDATE;
  IF NOT FOUND OR p.metadata->>'quote_id' IS DISTINCT FROM quote_id::text
     OR p.metadata->>'checkout_type' IS DISTINCT FROM 'b2b'
     OR p.provider IS DISTINCT FROM 'iyzico' OR p_is_test IS NULL
     OR p.metadata->'is_test' IS DISTINCT FROM to_jsonb(p_is_test) THEN
    RETURN jsonb_build_object('status','rejected');
  END IF;

  -- Terminal records are never revived, including after cancellation/refund.
  IF p.status = 'success' THEN
    RETURN jsonb_build_object('status', CASE WHEN o.payment_status = 'paid'
      AND o.status::text IN ('confirmed','paid') AND q.status = 'PAID' AND q.payment_id = p.id
      THEN 'already_paid' ELSE 'closed' END);
  END IF;
  IF p.status IS DISTINCT FROM 'pending' THEN RETURN jsonb_build_object('status','closed'); END IF;

  -- Reject invalid numbers without lossy casts; JSON from service role is still validated.
  IF jsonb_typeof(p_result->'price_kurus') = 'number' AND p_result->>'price_kurus' ~ '^[0-9]{1,16}$'
    THEN price := (p_result->>'price_kurus')::bigint; END IF;
  IF jsonb_typeof(p_result->'paid_kurus') = 'number' AND p_result->>'paid_kurus' ~ '^[0-9]{1,16}$'
    THEN paid := (p_result->>'paid_kurus')::bigint; END IF;
  IF p_result->>'status' IS DISTINCT FROM 'success' OR p_result->>'payment_status' IS DISTINCT FROM 'SUCCESS' THEN reason := 'unverified_result';
  ELSIF provider_id IS NULL OR length(provider_id) > 200 THEN reason := 'missing_payment_id';
  ELSIF p_result->>'basket_id' IS DISTINCT FROM p.order_id::text THEN reason := 'basket_mismatch';
  ELSIF nullif(p_result->>'conversation_id','') IS NOT NULL AND p_result->>'conversation_id' <> p.id::text THEN reason := 'conversation_mismatch';
  ELSIF p_result->>'currency' IS DISTINCT FROM 'TRY' OR p.currency IS DISTINCT FROM 'TRY' THEN reason := 'currency_mismatch';
  ELSIF price IS NULL OR paid IS NULL OR price <= 0 OR paid <= 0 OR price > 9007199254740991 OR paid > 9007199254740991
     OR price::numeric <> p.amount * 100 OR paid::numeric <> p.amount * 100 THEN reason := 'amount_mismatch';
  ELSIF p_result->'fraud_status' IS DISTINCT FROM '1'::jsonb THEN reason := 'fraud_review';
  ELSIF q.status IS DISTINCT FROM 'QUOTED' OR q.order_id IS DISTINCT FROM o.id OR q.payment_id IS NOT NULL
     OR o.status::text IS DISTINCT FROM 'pending' OR o.payment_status IS DISTINCT FROM 'pending'
     OR p.user_id IS DISTINCT FROM q.user_id OR o.user_id IS DISTINCT FROM q.user_id
     OR q.approved_price IS DISTINCT FROM p.amount OR o.total_price IS DISTINCT FROM p.amount
     OR q.approved_seed_count IS DISTINCT FROM o.total_seeds THEN reason := 'state_mismatch';
  ELSIF EXISTS (SELECT 1 FROM public.payments WHERE iyzico_payment_id = provider_id AND id <> p.id) THEN reason := 'duplicate_provider_payment';
  END IF;

  safe_result := jsonb_build_object('status',left(p_result->>'status',30), 'payment_status',left(p_result->>'payment_status',30),
    'payment_id',left(provider_id,200), 'basket_id',left(p_result->>'basket_id',200), 'conversation_id',left(p_result->>'conversation_id',200),
    'currency',left(p_result->>'currency',10), 'price_kurus',price, 'paid_kurus',paid, 'fraud_status',p_result->'fraud_status');
  INSERT INTO public.b2b_payment_observations(payment_id, provider_payment_id, result, disposition, reason)
    VALUES(p.id,left(provider_id,200),safe_result,'review',coalesce(reason,'validated')) RETURNING id INTO observation_id;
  IF reason IS NOT NULL THEN
    UPDATE public.payments SET metadata = coalesce(metadata,'{}') || jsonb_build_object('payment_review_required',true), updated_at=now() WHERE id=p.id;
    RETURN jsonb_build_object('status','review');
  END IF;

  -- All three writes and the observation commit together. Any constraint/write error rolls all back.
  UPDATE public.payments SET status='success', iyzico_payment_id=provider_id, payment_method='credit_card',
    metadata=coalesce(metadata,'{}') || jsonb_build_object('payment_review_required',false), updated_at=now() WHERE id=p.id;
  UPDATE public.orders SET payment_status='paid', status='confirmed', updated_at=now() WHERE id=o.id;
  UPDATE public.corporate_quotes SET status='PAID', paid_at=now(), payment_id=p.id WHERE id=q.id;
  UPDATE public.b2b_payment_observations SET disposition='applied', reason='paid', updated_at=now() WHERE id=observation_id;
  RETURN jsonb_build_object('status','paid');
END;
$$;
REVOKE ALL ON FUNCTION public.record_b2b_payment_result(uuid,boolean,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_b2b_payment_result(uuid,boolean,jsonb) TO service_role;

-- Claim before any SDK call. Unknown/abandoned sessions require reconciliation, never automatic replacement.
CREATE FUNCTION public.claim_b2b_checkout(p_quote uuid, p_user uuid, p_amount numeric, p_seeds integer, p_is_test boolean)
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
  IF q.order_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.payments WHERE metadata->>'quote_id'=q.id::text AND metadata->>'checkout_type'='b2b') THEN
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
COMMIT;
