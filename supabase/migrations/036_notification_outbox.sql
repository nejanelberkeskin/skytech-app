-- Transactional commerce notifications. Only service_role can read PII or run workers.
-- Provider acceptance is not proof of inbox delivery. Unknown acceptance is never
-- retried beyond Resend's retention window (23h locally, 24h at the provider).
CREATE TABLE public.order_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.release_orders(id) ON DELETE RESTRICT,
  template text NOT NULL CHECK (template IN ('release_order_confirm','release_order_notify','release_withdrawal_receipt','release_withdrawal_notify','release_certificate','release_video')),
  source jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','leased','sent','needs_review','dismissed')),
  body text,
  body_sha256 text,
  claim_token uuid,
  lease_until timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  first_network_at timestamptz,
  provider_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(order_id,template),
  CHECK ((body IS NULL) = (body_sha256 IS NULL))
);
ALTER TABLE public.order_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_notification_outbox FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.order_notification_outbox TO service_role;
CREATE INDEX order_notification_due_idx ON public.order_notification_outbox(next_attempt_at,id) WHERE state IN ('pending','leased');

-- Keep only fields required by notification templates; no invoice, phone, user ID,
-- payment token/metadata, IP hash, user agent, consent data or internal batch notes.
CREATE FUNCTION public.notification_order_source(p_order public.release_orders) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(p_order))
  WHERE key=ANY(ARRAY['id','order_no','locale','land_id','site_snapshot','quantity','total_kurus',
    'certificate_name','certificate_code','buyer_type','buyer_first_name','buyer_last_name',
    'buyer_email','is_test','created_at','performance_deadline','withdrawal_deadline',
    'withdrawal_requested_at','released_at']);
$$;
REVOKE ALL ON FUNCTION public.notification_order_source(public.release_orders) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.enqueue_order_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE templates text[] := '{}'; t text; seed jsonb;
BEGIN
  seed := public.notification_order_source(NEW);
  IF OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL THEN
    templates := templates || ARRAY['release_order_confirm','release_order_notify'];
  END IF;
  IF OLD.withdrawal_requested_at IS NULL AND NEW.withdrawal_requested_at IS NOT NULL THEN
    templates := templates || ARRAY['release_withdrawal_receipt','release_withdrawal_notify'];
  END IF;
  IF OLD.certificate_code IS NULL AND NEW.certificate_code IS NOT NULL AND NEW.certificate_cancelled_at IS NULL THEN
    templates := templates || ARRAY['release_certificate'];
  END IF;
  FOREACH t IN ARRAY templates LOOP
    INSERT INTO public.order_notification_outbox(order_id,template,source) VALUES(NEW.id,t,jsonb_build_object('order',seed)) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER release_order_notifications AFTER UPDATE ON public.release_orders FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_notification();

CREATE FUNCTION public.enqueue_video_notifications() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.video_published_at IS NULL AND NEW.video_published_at IS NOT NULL THEN
    INSERT INTO public.order_notification_outbox(order_id,template,source)
      SELECT o.id,'release_video',jsonb_build_object('order',public.notification_order_source(o),'batch',jsonb_build_object('id',NEW.id,'released_on',NEW.released_on,'video_url',NEW.video_url))
      FROM public.release_orders o WHERE o.batch_id=NEW.id AND o.status IN ('released','monitoring','completed') AND o.video_notified_at IS NULL
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER release_video_notifications AFTER UPDATE ON public.release_batches FOR EACH ROW EXECUTE FUNCTION public.enqueue_video_notifications();

-- Historical missing logs cannot prove non-delivery. Never replay ambiguous old mail.
INSERT INTO public.order_notification_outbox(order_id,template,source,state,provider_id,sent_at,last_error)
 SELECT o.id,k.template,jsonb_build_object('order',public.notification_order_source(o)),
   CASE WHEN sent.provider_id IS NOT NULL THEN 'sent' ELSE 'needs_review' END,sent.provider_id,sent.created_at,
   CASE WHEN sent.provider_id IS NULL THEN 'legacy_delivery_unknown' END
 FROM public.release_orders o
 CROSS JOIN LATERAL (VALUES
   ('release_order_confirm',o.paid_at IS NOT NULL),('release_order_notify',o.paid_at IS NOT NULL),
   ('release_withdrawal_receipt',o.withdrawal_requested_at IS NOT NULL),('release_withdrawal_notify',o.withdrawal_requested_at IS NOT NULL),
   ('release_certificate',o.certificate_code IS NOT NULL),
   ('release_video',EXISTS(SELECT 1 FROM public.release_batches b WHERE b.id=o.batch_id AND b.video_published_at IS NOT NULL))
 ) k(template,eligible)
 LEFT JOIN LATERAL (SELECT e.data->>'id' provider_id,e.created_at FROM public.order_events e WHERE e.order_id=o.id AND e.type='email_sent' AND e.data->>'template'=k.template AND length(trim(coalesce(e.data->>'id','')))>0 AND e.data->>'id'<>'skipped-no-api-key' ORDER BY e.created_at DESC LIMIT 1) sent ON true
 WHERE k.eligible ON CONFLICT DO NOTHING;

CREATE FUNCTION public.claim_order_notification(p_templates text[] DEFAULT NULL,p_order uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.order_notification_outbox; at timestamptz := clock_timestamp();
BEGIN
  UPDATE public.order_notification_outbox SET state='needs_review',last_error='idempotency_window_elapsed',claim_token=NULL,lease_until=NULL
    WHERE state IN ('pending','leased') AND first_network_at <= at-interval '23 hours' AND (state='pending' OR lease_until<=at);
  SELECT * INTO r FROM public.order_notification_outbox
    WHERE ((state='pending' AND next_attempt_at<=at) OR (state='leased' AND lease_until<=at))
      AND (p_templates IS NULL OR template=ANY(p_templates)) AND (p_order IS NULL OR order_id=p_order)
    ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.order_notification_outbox SET state='leased',claim_token=gen_random_uuid(),lease_until=at+interval '2 minutes',attempt_count=attempt_count+1
    WHERE id=r.id RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;

-- Private settlement is shared by a lease owner and an operator with verified evidence.
CREATE FUNCTION public.settle_order_notification(p_id uuid,p_provider_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.order_notification_outbox; at timestamptz := clock_timestamp(); payload jsonb;
BEGIN
  IF p_provider_id IS NULL OR length(trim(p_provider_id))=0 OR p_provider_id='skipped-no-api-key' THEN RAISE EXCEPTION 'invalid_provider_id'; END IF;
  SELECT * INTO STRICT r FROM public.order_notification_outbox WHERE id=p_id FOR UPDATE;
  IF r.state='sent' THEN RETURN; END IF;
  UPDATE public.order_notification_outbox SET state='sent',provider_id=p_provider_id,sent_at=at,claim_token=NULL,lease_until=NULL,last_error=NULL WHERE id=p_id;
  INSERT INTO public.order_events(order_id,type,actor,data) VALUES(r.order_id,'email_sent','system',jsonb_build_object('template',r.template,'id',p_provider_id,'outboxId',p_id));
  IF r.body IS NOT NULL THEN
    payload:=r.body::jsonb;
    INSERT INTO public.email_logs(template,recipient_email,subject,related_id,resend_id,status)
      VALUES(r.template,payload->'to'->>0,payload->>'subject',r.order_id::text,p_provider_id,'sent');
  END IF;
  IF r.template='release_video' THEN
    UPDATE public.release_orders SET video_notified_at=coalesce(video_notified_at,at),
      status=CASE WHEN status IN ('released','monitoring') THEN 'completed' ELSE status END,
      completed_at=CASE WHEN status IN ('released','monitoring') THEN coalesce(completed_at,at) ELSE completed_at END WHERE id=r.order_id;
    INSERT INTO public.order_events(order_id,type,actor,data) VALUES(r.order_id,'video_notified','system',jsonb_build_object('outboxId',p_id));
  END IF;
END $$;

CREATE FUNCTION public.advance_order_notification(p_id uuid,p_claim uuid,p_action text,p_body text DEFAULT NULL,p_provider_id text DEFAULT NULL,p_error text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.order_notification_outbox; at timestamptz := clock_timestamp(); payload jsonb;
BEGIN
  SELECT * INTO r FROM public.order_notification_outbox WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR r.state<>'leased' OR r.claim_token IS DISTINCT FROM p_claim OR r.lease_until<=at THEN RETURN NULL; END IF;
  IF p_action='refresh' THEN
    -- Before freezing video content, pick up an operator's corrected link. Never
    -- modify a body that may already have reached the provider.
    IF r.body IS NOT NULL OR r.template<>'release_video' THEN RAISE EXCEPTION 'notification_already_prepared'; END IF;
    SELECT jsonb_build_object('id',b.id,'released_on',b.released_on,'video_url',b.video_url) INTO payload
      FROM public.release_batches b JOIN public.release_orders o ON o.batch_id=b.id
      WHERE o.id=r.order_id AND b.video_published_at IS NOT NULL AND b.video_url IS NOT NULL;
    IF payload IS NULL THEN
      UPDATE public.order_notification_outbox SET state='needs_review',last_error='video_source_unavailable',claim_token=NULL,lease_until=NULL WHERE id=p_id;
      RETURN NULL;
    END IF;
    UPDATE public.order_notification_outbox SET source=jsonb_set(source,'{batch}',payload) WHERE id=p_id;
  ELSIF p_action='freeze' THEN
    IF p_body IS NULL OR octet_length(p_body)>40000000 THEN RAISE EXCEPTION 'invalid_notification_body'; END IF;
    payload:=p_body::jsonb;
    IF jsonb_typeof(payload)<>'object' OR jsonb_typeof(payload->'to') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'to')<>1 OR coalesce(payload->>'from','')='' OR coalesce(payload->>'subject','')='' OR coalesce(payload->>'html','')='' THEN RAISE EXCEPTION 'invalid_notification_body'; END IF;
    IF r.body IS NOT NULL AND r.body<>p_body THEN RAISE EXCEPTION 'notification_body_frozen'; END IF;
    UPDATE public.order_notification_outbox SET body=p_body,body_sha256=encode(sha256(convert_to(p_body,'UTF8')),'hex') WHERE id=p_id;
  ELSIF p_action='begin' THEN
    -- Re-check after payload freeze, including retries. This prevents a cancellation
    -- committed before this check from sending obsolete certificate/video content.
    -- A cancellation after this check cannot be atomic with an external HTTP call.
    IF (r.template='release_certificate' AND NOT EXISTS (
      SELECT 1 FROM public.release_orders o WHERE o.id=r.order_id
        AND o.certificate_code=r.source->'order'->>'certificate_code'
        AND o.certificate_cancelled_at IS NULL AND o.status IN ('released','monitoring','completed')
    )) OR (r.template='release_video' AND NOT EXISTS (
      SELECT 1 FROM public.release_orders o JOIN public.release_batches b ON b.id=o.batch_id
      WHERE o.id=r.order_id AND o.status IN ('released','monitoring','completed')
        AND b.id::text=r.source->'batch'->>'id' AND b.video_published_at IS NOT NULL
        AND b.video_url=r.source->'batch'->>'video_url'
        AND b.released_on::text=r.source->'batch'->>'released_on'
    )) THEN
      UPDATE public.order_notification_outbox SET state='needs_review',last_error='notification_no_longer_eligible',claim_token=NULL,lease_until=NULL WHERE id=p_id;
      RETURN NULL;
    END IF;
    IF r.body IS NULL THEN RAISE EXCEPTION 'notification_not_prepared'; END IF;
    IF r.first_network_at IS NOT NULL AND r.first_network_at<=at-interval '23 hours' THEN
      UPDATE public.order_notification_outbox SET state='needs_review',last_error='idempotency_window_elapsed',claim_token=NULL,lease_until=NULL WHERE id=p_id;
      RETURN NULL;
    END IF;
    UPDATE public.order_notification_outbox SET first_network_at=coalesce(first_network_at,at) WHERE id=p_id;
  ELSIF p_action='sent' THEN
    IF r.first_network_at IS NULL THEN RAISE EXCEPTION 'notification_not_started'; END IF;
    PERFORM public.settle_order_notification(p_id,p_provider_id);
  ELSIF p_action IN ('retry','review') THEN
    UPDATE public.order_notification_outbox SET state=CASE WHEN p_action='review' THEN 'needs_review' ELSE 'pending' END,
      last_error=left(coalesce(p_error,'delivery_failed'),100),claim_token=NULL,lease_until=NULL,
      next_attempt_at=at+least(3600,30*power(2,least(r.attempt_count,7))) * interval '1 second' WHERE id=p_id;
    INSERT INTO public.order_events(order_id,type,actor,data) VALUES(r.order_id,'email_failed','system',jsonb_build_object('template',r.template,'outboxId',p_id,'reason',left(coalesce(p_error,'delivery_failed'),100)));
  ELSE RAISE EXCEPTION 'invalid_notification_action'; END IF;
  SELECT * INTO r FROM public.order_notification_outbox WHERE id=p_id;
  RETURN to_jsonb(r);
END $$;

-- No blind reset/new idempotency key: an operator may only record verified acceptance
-- or explicitly dismiss an ambiguous notification. Evidence must not contain PII/secrets.
CREATE FUNCTION public.review_order_notification(p_id uuid,p_action text,p_evidence text,p_provider_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.order_notification_outbox;
BEGIN
  IF p_evidence IS NULL OR length(trim(p_evidence))<10 OR length(p_evidence)>500 THEN RAISE EXCEPTION 'review_evidence_required'; END IF;
  SELECT * INTO r FROM public.order_notification_outbox WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR r.state<>'needs_review' THEN RETURN false; END IF;
  IF p_action='confirm_sent' THEN PERFORM public.settle_order_notification(p_id,p_provider_id);
  ELSIF p_action='dismiss' THEN UPDATE public.order_notification_outbox SET state='dismissed' WHERE id=p_id;
  ELSE RAISE EXCEPTION 'invalid_review_action'; END IF;
  INSERT INTO public.order_events(order_id,type,actor,data) VALUES(r.order_id,'notification_reviewed','system',jsonb_build_object('outboxId',p_id,'action',p_action,'evidence',p_evidence));
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.enqueue_order_notification(),public.enqueue_video_notifications(),public.settle_order_notification(uuid,text),public.claim_order_notification(text[],uuid),public.advance_order_notification(uuid,uuid,text,text,text,text),public.review_order_notification(uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.claim_order_notification(text[],uuid),public.advance_order_notification(uuid,uuid,text,text,text,text),public.review_order_notification(uuid,text,text,text) TO service_role;

-- Operational counters only; no recipient, signed URL, body or document content.
CREATE FUNCTION public.order_notification_health() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'pending',count(*) FILTER (WHERE state='pending'),
    'leased',count(*) FILTER (WHERE state='leased'),
    'needsReview',count(*) FILTER (WHERE state='needs_review'),
    'oldestPendingAt',min(created_at) FILTER (WHERE state IN ('pending','leased'))
  ) FROM public.order_notification_outbox;
$$;
REVOKE ALL ON FUNCTION public.order_notification_health() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.order_notification_health() TO service_role;
