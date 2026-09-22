-- 020 — İade mutabakatı, tek finans hesabı, zamanlanmış iş kayıtları.
--
-- 019'a bağlıdır (refund_operations, claim/finish_refund_operation). 019'dan SONRA, bu dosyayı kullanan
-- uygulama sürümünden ÖNCE uygulanır. Müşteri kaydı silmez, ödeme sağlayıcısını ve e-postayı çağırmaz.
--
-- Sözleşme: web-brifler/17-IADE-MUTABAKAT-API-SOZLESMESI.md (iade), 18 (finans + zamanlanmış iş).
--
--   İade durumu:  started ─sonuç→ provider_succeeded | failed | needs_review
--                 failed ─retry→ started (attempt+1)          needs_review ─resolve→ provider_succeeded | failed
--                 provider_succeeded ─finish (019)→ completed
--   Sonucu belirsiz (unknown) deneme ASLA kendiliğinden tekrarlanmaz. Geç gelen sonuç durumu değiştirmez;
--   geçmişe yazılır ve `attention` işaretlenir.
BEGIN;

-- ── 1. İade işlemi: deneme numarası, dikkat işareti, mutabakat kaydı ─────────
ALTER TABLE public.refund_operations
  ADD COLUMN attempt_no integer NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
  ADD COLUMN attempt_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN attention boolean NOT NULL DEFAULT false,
  ADD COLUMN resolution jsonb;
UPDATE public.refund_operations SET attempt_started_at = created_at;
ALTER TABLE public.refund_operations DROP CONSTRAINT refund_operations_state_check;
ALTER TABLE public.refund_operations ADD CONSTRAINT refund_operations_state_check
  CHECK (state IN ('started', 'needs_review', 'failed', 'provider_succeeded', 'completed'));
CREATE INDEX refund_operations_order_idx ON public.refund_operations (order_id);
CREATE INDEX refund_operations_open_idx ON public.refund_operations (state, attempt_started_at) WHERE state <> 'completed';

CREATE FUNCTION public.refund_actor_allowed(p_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = p_actor AND is_active IS TRUE AND role IN ('SUPER_ADMIN', 'FINANCE')
  );
$$;

-- Deneme sonucunu kaydeder. Yalnız o denemedeki `started` işlem değişir; aksi hâlde geç sonuçtur.
CREATE FUNCTION public.record_refund_result(p_id uuid, p_attempt integer, p_result jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  op public.refund_operations;
  v_outcome text := p_result->>'outcome';
  v_refund text := NULLIF(btrim(COALESCE(p_result->>'refundId', '')), '');
  v_clean jsonb;
  v_late boolean := false;
BEGIN
  IF v_outcome IS NULL OR v_outcome NOT IN ('succeeded', 'rejected', 'unknown', 'not_sent') THEN
    RAISE EXCEPTION 'invalid_outcome' USING ERRCODE = '22023';
  END IF;
  IF v_outcome = 'succeeded' AND v_refund IS NULL THEN
    RAISE EXCEPTION 'invalid_refund_id' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO op FROM public.refund_operations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_missing' USING ERRCODE = 'P0002'; END IF;

  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'ok', v_outcome = 'succeeded',
    'outcome', v_outcome,
    'refundId', left(v_refund, 100),
    'method', CASE WHEN p_result->>'method' IN ('refund', 'cancel') THEN p_result->>'method' END,
    'errorCode', left(p_result->>'errorCode', 60),
    'error', left(p_result->>'error', 300),
    'attempt', p_attempt,
    'at', now()
  ));

  IF op.state = 'started' AND op.attempt_no = p_attempt THEN
    UPDATE public.refund_operations
       SET state = CASE v_outcome WHEN 'succeeded' THEN 'provider_succeeded'
                                  WHEN 'unknown' THEN 'needs_review'
                                  ELSE 'failed' END,
           result = v_clean,
           updated_at = now()
     WHERE id = op.id
    RETURNING * INTO op;
    INSERT INTO public.order_events (order_id, type, actor, data)
    VALUES (op.order_id, 'refund_attempt_result', 'system',
            v_clean || jsonb_build_object('operationId', op.id, 'paymentId', op.payment_id, 'duplicate', op.duplicate));
  ELSE
    v_late := true;
    UPDATE public.refund_operations SET attention = true, updated_at = now() WHERE id = op.id RETURNING * INTO op;
    INSERT INTO public.order_events (order_id, type, actor, data)
    VALUES (op.order_id, 'refund_late_result', 'system',
            v_clean || jsonb_build_object('operationId', op.id, 'paymentId', op.payment_id, 'duplicate', op.duplicate,
                                          'currentAttempt', op.attempt_no, 'currentState', op.state));
  END IF;
  RETURN to_jsonb(op) || jsonb_build_object('late', v_late);
END $$;

-- Kesin reddedilmiş ya da mutabakatla "iade yapılmadı" denmiş işlemi yeniden başlatır.
CREATE FUNCTION public.retry_refund_operation(p_id uuid, p_actor uuid, p_expected_attempt integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE op public.refund_operations; o public.release_orders;
BEGIN
  IF NOT public.refund_actor_allowed(p_actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO op FROM public.refund_operations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_missing' USING ERRCODE = 'P0002'; END IF;
  IF op.attempt_no <> p_expected_attempt THEN RAISE EXCEPTION 'attempt_changed' USING ERRCODE = '40001'; END IF;
  IF op.state <> 'failed' THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000'; END IF;
  -- Geç/çelişen sonuç varken yeniden denenmez: önce mutabakat.
  IF op.attention THEN RAISE EXCEPTION 'attention_required' USING ERRCODE = '55000'; END IF;
  SELECT * INTO o FROM public.release_orders WHERE id = op.order_id FOR UPDATE;
  IF NOT op.duplicate AND (o.status NOT IN ('withdrawal_requested', 'cancelled_by_seller')
      OR o.total_kurus <> op.amount_kurus OR o.payment_id IS DISTINCT FROM op.payment_id) THEN
    RAISE EXCEPTION 'order_not_refundable' USING ERRCODE = '55000';
  END IF;
  UPDATE public.refund_operations
     SET state = 'started', attempt_no = attempt_no + 1, attempt_started_at = now(),
         actor = p_actor, result = NULL, updated_at = now()
   WHERE id = op.id
  RETURNING * INTO op;
  INSERT INTO public.order_events (order_id, type, actor, data)
  VALUES (op.order_id, 'refund_retry', 'admin:' || p_actor,
          jsonb_build_object('operationId', op.id, 'attempt', op.attempt_no, 'paymentId', op.payment_id,
                             'duplicate', op.duplicate, 'amountKurus', op.amount_kurus));
  INSERT INTO public.admin_audit_logs (admin_id, admin_email, action, entity, entity_id, details)
  SELECT p_actor, email, 'UPDATE', 'refund_operation', op.id::text,
         jsonb_build_object('action', 'retry', 'attempt', op.attempt_no, 'orderId', op.order_id)
    FROM public.admin_users WHERE user_id = p_actor;
  RETURN to_jsonb(op) || jsonb_build_object('fresh', true);
END $$;

-- Mutabakat: sonucu belirsiz işlem için sağlayıcıda görülen sonucu gerekçe ve kanıt kaynağıyla kaydeder.
CREATE FUNCTION public.resolve_refund_operation(
  p_id uuid, p_actor uuid, p_expected_attempt integer, p_outcome text,
  p_refund_id text, p_source text, p_reference text, p_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  op public.refund_operations;
  v_note text := btrim(COALESCE(p_note, ''));
  v_ref text := NULLIF(btrim(COALESCE(p_refund_id, '')), '');
  v_reference text := NULLIF(btrim(COALESCE(p_reference, '')), '');
  v_available timestamptz;
  v_resolution jsonb;
  v_email text;
BEGIN
  IF NOT public.refund_actor_allowed(p_actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('provider_succeeded', 'failed') THEN
    RAISE EXCEPTION 'invalid_outcome' USING ERRCODE = '22023';
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('provider_panel', 'provider_query', 'bank_statement')
     OR char_length(COALESCE(v_reference, '')) > 200 THEN
    RAISE EXCEPTION 'evidence_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_note) < 10 OR char_length(v_note) > 1000 THEN
    RAISE EXCEPTION 'note_required' USING ERRCODE = '22023';
  END IF;
  IF p_outcome = 'provider_succeeded'
     AND (v_ref IS NULL OR char_length(v_ref) > 100 OR v_ref !~ '^[A-Za-z0-9._:-]+$') THEN
    RAISE EXCEPTION 'invalid_refund_id' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO op FROM public.refund_operations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_missing' USING ERRCODE = 'P0002'; END IF;
  IF op.attempt_no <> p_expected_attempt THEN RAISE EXCEPTION 'attempt_changed' USING ERRCODE = '40001'; END IF;
  IF NOT (op.state = 'needs_review'
          OR (op.state = 'started' AND op.attempt_started_at <= now() - interval '15 minutes')
          OR (op.state = 'failed' AND op.attention)) THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000';
  END IF;
  -- "İade yapılmadı" kararı için sağlayıcıya süre tanınır; kısa süreli panel görünümü kanıt sayılmaz.
  IF p_outcome = 'failed' THEN
    v_available := op.attempt_started_at + interval '30 minutes';
    IF now() < v_available THEN
      RAISE EXCEPTION 'too_early' USING ERRCODE = '55000',
        DETAIL = to_char(v_available AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    END IF;
  END IF;

  SELECT email INTO v_email FROM public.admin_users WHERE user_id = p_actor;
  v_resolution := jsonb_strip_nulls(jsonb_build_object(
    'outcome', p_outcome, 'by', p_actor, 'at', now(), 'source', p_source, 'reference', v_reference,
    'note', v_note, 'refundId', v_ref, 'attempt', op.attempt_no, 'previousState', op.state
  ));
  UPDATE public.refund_operations
     SET state = CASE WHEN p_outcome = 'provider_succeeded' THEN 'provider_succeeded' ELSE 'failed' END,
         result = CASE WHEN p_outcome = 'provider_succeeded'
                       THEN jsonb_build_object('ok', true, 'outcome', 'succeeded', 'refundId', v_ref,
                                               'method', 'reconciled', 'attempt', op.attempt_no, 'at', now())
                       ELSE COALESCE(result, '{}'::jsonb) || jsonb_build_object('ok', false, 'reconciled', true) END,
         resolution = v_resolution,
         attention = false,
         updated_at = now()
   WHERE id = op.id
  RETURNING * INTO op;
  INSERT INTO public.order_events (order_id, type, actor, data)
  VALUES (op.order_id, 'refund_resolved', 'admin:' || p_actor,
          (v_resolution - 'by') || jsonb_build_object('operationId', op.id, 'paymentId', op.payment_id, 'duplicate', op.duplicate));
  INSERT INTO public.admin_audit_logs (admin_id, admin_email, action, entity, entity_id, details)
  VALUES (p_actor, COALESCE(v_email, 'unknown'), 'UPDATE', 'refund_operation', op.id::text,
          jsonb_build_object('action', 'resolve', 'outcome', p_outcome, 'source', p_source,
                             'attempt', op.attempt_no, 'orderId', op.order_id));
  RETURN to_jsonb(op);
END $$;

REVOKE ALL ON FUNCTION public.refund_actor_allowed(uuid),
  public.record_refund_result(uuid, integer, jsonb),
  public.retry_refund_operation(uuid, uuid, integer),
  public.resolve_refund_operation(uuid, uuid, integer, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_refund_result(uuid, integer, jsonb),
  public.retry_refund_operation(uuid, uuid, integer),
  public.resolve_refund_operation(uuid, uuid, integer, text, text, text, text, text)
  TO service_role;

-- ── 2. Tek finans hesabı (Genel Bakış + Finans) ────────────────────────────
-- Tutarlar kuruş, KDV dahil (tahsil edilen para). Deneme siparişleri hariç. Dönem: Europe/Istanbul takvim ayı.
-- Satır sınırına bağlı değildir; toplama veritabanında yapılır.
CREATE FUNCTION public.admin_finance_overview(p_now timestamptz DEFAULT now(), p_months integer DEFAULT 6) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_local_month timestamp := date_trunc('month', p_now AT TIME ZONE 'Europe/Istanbul');
  v_from timestamptz := v_local_month AT TIME ZONE 'Europe/Istanbul';
  v_to timestamptz := (v_local_month + interval '1 month') AT TIME ZONE 'Europe/Istanbul';
  v_months integer := LEAST(GREATEST(COALESCE(p_months, 6), 1), 24);
  v jsonb;
BEGIN
  WITH real_orders AS (
    SELECT * FROM public.release_orders WHERE NOT is_test
  ),
  dup_charges AS (
    SELECT DISTINCT ON (e.order_id, e.data->>'paymentId')
           e.order_id, e.data->>'paymentId' AS payment_id,
           CASE WHEN e.data->>'paidKurus' ~ '^[0-9]{1,15}$' THEN (e.data->>'paidKurus')::bigint ELSE 0 END AS kurus,
           e.created_at
      FROM public.order_events e JOIN real_orders o ON o.id = e.order_id
     WHERE e.type = 'payment_succeeded' AND e.data->>'duplicate' = 'true' AND e.data->>'paymentId' IS NOT NULL
     ORDER BY e.order_id, e.data->>'paymentId', e.created_at
  ),
  dup_refunds AS (
    SELECT DISTINCT ON (e.order_id, e.data->>'paymentId')
           e.order_id, e.data->>'paymentId' AS payment_id,
           CASE WHEN e.data->>'amountKurus' ~ '^[0-9]{1,15}$' THEN (e.data->>'amountKurus')::bigint ELSE 0 END AS kurus,
           e.created_at
      FROM public.order_events e JOIN real_orders o ON o.id = e.order_id
     WHERE e.type = 'refund_succeeded' AND e.data->>'duplicate' = 'true' AND e.data->>'paymentId' IS NOT NULL
     ORDER BY e.order_id, e.data->>'paymentId', e.created_at
  ),
  order_refunds_done AS (
    SELECT r.order_id, r.amount_kurus AS kurus, r.completed_at
      FROM public.order_refunds r JOIN real_orders o ON o.id = r.order_id
     WHERE r.status = 'succeeded' AND r.completed_at IS NOT NULL
  ),
  months AS (
    SELECT m AS local_month
      FROM generate_series(v_local_month - make_interval(months => v_months - 1), v_local_month, interval '1 month') AS m
  ),
  monthly AS (
    SELECT to_char(mo.local_month, 'YYYY-MM') AS key,
           COALESCE((SELECT sum(o.total_kurus) FROM real_orders o
                      WHERE o.paid_at IS NOT NULL AND date_trunc('month', o.paid_at AT TIME ZONE 'Europe/Istanbul') = mo.local_month), 0) AS order_collections,
           COALESCE((SELECT sum(o.quantity) FROM real_orders o
                      WHERE o.paid_at IS NOT NULL AND date_trunc('month', o.paid_at AT TIME ZONE 'Europe/Istanbul') = mo.local_month), 0) AS paid_quantity,
           COALESCE((SELECT sum(d.kurus) FROM dup_charges d
                      WHERE date_trunc('month', d.created_at AT TIME ZONE 'Europe/Istanbul') = mo.local_month), 0) AS duplicate_charges,
           COALESCE((SELECT sum(r.kurus) FROM order_refunds_done r
                      WHERE date_trunc('month', r.completed_at AT TIME ZONE 'Europe/Istanbul') = mo.local_month), 0) AS order_refunds,
           COALESCE((SELECT sum(d.kurus) FROM dup_refunds d
                      WHERE date_trunc('month', d.created_at AT TIME ZONE 'Europe/Istanbul') = mo.local_month), 0) AS duplicate_refunds
      FROM months mo
  )
  SELECT jsonb_build_object(
    'definitionsVersion', 1,
    'timeZone', 'Europe/Istanbul',
    'generatedAt', p_now,
    'currentMonth', (
      SELECT jsonb_build_object(
        'key', to_char(v_local_month, 'YYYY-MM'), 'from', v_from, 'to', v_to,
        'orderCollectionsKurus', m.order_collections,
        'duplicateChargesKurus', m.duplicate_charges,
        'orderRefundsKurus', m.order_refunds,
        'duplicateRefundsKurus', m.duplicate_refunds,
        'netCashKurus', m.order_collections + m.duplicate_charges - m.order_refunds - m.duplicate_refunds,
        'paidQuantity', m.paid_quantity,
        'paidOrderCount', (SELECT count(*) FROM real_orders o WHERE o.paid_at >= v_from AND o.paid_at < v_to)
      ) FROM monthly m WHERE m.key = to_char(v_local_month, 'YYYY-MM')
    ),
    'allTime', jsonb_build_object(
      'heldOrderValueKurus', (SELECT COALESCE(sum(total_kurus), 0) FROM real_orders
                              WHERE status IN ('paid', 'confirmed', 'scheduled', 'released', 'monitoring', 'completed')),
      'heldOrderCount', (SELECT count(*) FROM real_orders
                         WHERE status IN ('paid', 'confirmed', 'scheduled', 'released', 'monitoring', 'completed')),
      'releasedQuantity', (SELECT COALESCE(sum(quantity), 0) FROM real_orders WHERE status IN ('released', 'monitoring', 'completed')),
      'refundedOrderCount', (SELECT count(*) FROM real_orders WHERE status = 'refunded')
    ),
    'liabilities', jsonb_build_object(
      'orderRefundLiabilityKurus', (SELECT COALESCE(sum(total_kurus), 0) FROM real_orders
                                    WHERE status IN ('withdrawal_requested', 'cancelled_by_seller')),
      'orderRefundLiabilityCount', (SELECT count(*) FROM real_orders WHERE status IN ('withdrawal_requested', 'cancelled_by_seller')),
      'duplicateLiabilityKurus', (SELECT COALESCE(sum(c.kurus), 0) FROM dup_charges c
                                  WHERE NOT EXISTS (SELECT 1 FROM dup_refunds r WHERE r.order_id = c.order_id AND r.payment_id = c.payment_id)),
      'duplicateLiabilityCount', (SELECT count(*) FROM dup_charges c
                                  WHERE NOT EXISTS (SELECT 1 FROM dup_refunds r WHERE r.order_id = c.order_id AND r.payment_id = c.payment_id)),
      'overdueRefundCount', (SELECT count(*) FROM real_orders
                             WHERE (status = 'withdrawal_requested' AND withdrawal_requested_at < p_now - interval '14 days')
                                OR (status = 'cancelled_by_seller' AND cancelled_at < p_now - interval '14 days'))
    ),
    'pending', jsonb_build_object(
      'payableKurus', (SELECT COALESCE(sum(total_kurus), 0) FROM real_orders
                       WHERE status = 'awaiting_payment' AND payment_expires_at > p_now),
      'payableCount', (SELECT count(*) FROM real_orders WHERE status = 'awaiting_payment' AND payment_expires_at > p_now)
    ),
    'operations', jsonb_build_object(
      'awaitingBatchCount', (SELECT count(*) FROM real_orders WHERE status = 'confirmed' AND batch_id IS NULL)
    ),
    'months', (SELECT jsonb_agg(jsonb_build_object(
                 'key', key,
                 'orderCollectionsKurus', order_collections,
                 'duplicateChargesKurus', duplicate_charges,
                 'refundsKurus', order_refunds + duplicate_refunds,
                 'netCashKurus', order_collections + duplicate_charges - order_refunds - duplicate_refunds,
                 'paidQuantity', paid_quantity) ORDER BY key) FROM monthly)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.admin_finance_overview(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finance_overview(timestamptz, integer) TO service_role;

-- ── 3. Zamanlanmış iş kayıtları (sağlık görünümü + tek çalışma kilidi) ─────
CREATE TABLE public.job_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job         text NOT NULL CHECK (job ~ '^[a-z0-9-]{1,40}$'),
  trigger     text NOT NULL CHECK (trigger IN ('cron', 'admin')),
  scope       text NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'status')),
  actor       uuid,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok          boolean,
  report      jsonb,
  error       text
);
CREATE INDEX job_runs_job_idx ON public.job_runs (job, started_at DESC);
-- Aynı iş aynı anda bir kez çalışır (cron ile elle çalıştırma çakışmaz).
CREATE UNIQUE INDEX job_runs_one_running_idx ON public.job_runs (job) WHERE finished_at IS NULL;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_runs FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.start_job_run(p_job text, p_trigger text, p_scope text, p_actor uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  -- Yarıda kalmış (süre sınırında kesilmiş) çalışma kilidi tutmaz.
  UPDATE public.job_runs SET finished_at = now(), ok = false, error = 'abandoned'
   WHERE job = p_job AND finished_at IS NULL AND started_at < now() - interval '10 minutes';
  BEGIN
    INSERT INTO public.job_runs (job, trigger, scope, actor) VALUES (p_job, p_trigger, p_scope, p_actor) RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'job_running' USING ERRCODE = '55000';
  END;
  RETURN v_id;
END $$;

CREATE FUNCTION public.finish_job_run(p_id uuid, p_ok boolean, p_report jsonb, p_error text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.job_runs
     SET finished_at = now(), ok = p_ok, report = p_report, error = left(p_error, 500)
   WHERE id = p_id AND finished_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.start_job_run(text, text, text, uuid), public.finish_job_run(uuid, boolean, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_job_run(text, text, text, uuid), public.finish_job_run(uuid, boolean, jsonb, text)
  TO service_role;

COMMIT;
