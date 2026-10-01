-- Requires 034. The applying tool owns the transaction, including migration history.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public.b2b_reconciliation_queue (
  payment_id uuid PRIMARY KEY REFERENCES public.payments(id),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  next_check_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','done','needs_review')),
  last_outcome text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.b2b_reconciliation_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.b2b_reconciliation_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.b2b_reconciliation_queue TO service_role;

CREATE FUNCTION public.claim_b2b_reconciliation(p_is_test boolean)
RETURNS TABLE(payment_id uuid, token text, attempt integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_is_test IS NULL THEN RETURN; END IF;
  -- Bounded discovery; missing tokens/mode are manual reconciliation, never fabricated.
  INSERT INTO public.b2b_reconciliation_queue(payment_id)
    SELECT p.id FROM public.payments p
    WHERE p.status='pending' AND p.provider='iyzico' AND p.metadata->>'checkout_type'='b2b'
      AND p.metadata->'is_test'=to_jsonb(p_is_test)
      AND p.metadata->>'iyzico_token' ~ '^[A-Za-z0-9._~-]{8,200}$'
      AND NOT EXISTS(SELECT 1 FROM public.b2b_reconciliation_queue q WHERE q.payment_id=p.id)
    ORDER BY p.created_at,p.id LIMIT 100 ON CONFLICT DO NOTHING;
  RETURN QUERY
    WITH candidates AS (
      SELECT q.payment_id FROM public.b2b_reconciliation_queue q JOIN public.payments p ON p.id=q.payment_id
      WHERE q.state='open' AND q.attempts<8 AND q.next_check_at<=now() AND p.status='pending'
        AND p.provider='iyzico' AND p.metadata->>'checkout_type'='b2b' AND p.metadata->'is_test'=to_jsonb(p_is_test)
        AND p.metadata->>'iyzico_token' ~ '^[A-Za-z0-9._~-]{8,200}$'
      ORDER BY q.next_check_at,q.payment_id LIMIT 2 FOR UPDATE OF q SKIP LOCKED
    ), leased AS (
      UPDATE public.b2b_reconciliation_queue q SET attempts=q.attempts+1, next_check_at=now()+interval '10 minutes',
        state=CASE WHEN q.attempts+1=8 THEN 'needs_review' ELSE 'open' END, updated_at=now()
      FROM candidates c WHERE q.payment_id=c.payment_id RETURNING q.payment_id,q.attempts
    ) SELECT l.payment_id,p.metadata->>'iyzico_token',l.attempts FROM leased l JOIN public.payments p ON p.id=l.payment_id;
END;
$$;
CREATE FUNCTION public.finish_b2b_reconciliation(p_payment uuid,p_attempt integer,p_outcome text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('paid','already_paid','closed','review','rejected','provider_unavailable','record_unavailable') THEN
    RAISE EXCEPTION 'invalid_reconciliation_outcome';
  END IF;
  UPDATE public.b2b_reconciliation_queue SET last_outcome=p_outcome,
    state=CASE WHEN p_outcome IN ('paid','already_paid','closed') THEN 'done' WHEN attempts>=8 OR p_outcome='rejected' THEN 'needs_review' ELSE 'open' END,
    updated_at=now()
    WHERE payment_id=p_payment AND attempts=p_attempt AND state<>'done';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_b2b_reconciliation(boolean),public.finish_b2b_reconciliation(uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_b2b_reconciliation(boolean),public.finish_b2b_reconciliation(uuid,integer,text) TO service_role;

CREATE FUNCTION public.b2b_reconciliation_summary()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'needsReview',(SELECT count(*) FROM public.b2b_reconciliation_queue WHERE state='needs_review'),
    'unlinked',(SELECT count(*) FROM public.payments p WHERE p.status='pending' AND p.metadata->>'checkout_type'='b2b'
      AND (jsonb_typeof(p.metadata->'is_test') IS DISTINCT FROM 'boolean' OR coalesce(p.metadata->>'iyzico_token','') !~ '^[A-Za-z0-9._~-]{8,200}$'))
  );
$$;
REVOKE ALL ON FUNCTION public.b2b_reconciliation_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.b2b_reconciliation_summary() TO service_role;
