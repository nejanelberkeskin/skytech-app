-- 021 — Yetki çekirdeği: izinler, rol şablonları, kapsamlı/süreli atamalar, davet yaşam döngüsü.
--
-- 019 ve 020'ye bağlıdır. Sözleşme: web-brifler/19-YETKI-CEKIRDEGI-API-SOZLESMESI.md.
-- Mevcut dört rolün erişimi korunur; kimse silinmez, kimseye yeni erişim verilmez.
-- Bütün yetki kararları sunucuda bu tablolardan hesaplanır; verilmeyen izin kapalıdır.
BEGIN;

-- En az bir aktif sahip olmadan yetki modeli taşınmaz.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE role = 'SUPER_ADMIN' AND is_active) THEN
    RAISE EXCEPTION 'no_active_owner';
  END IF;
END $$;

-- ── 1. Kapsam ve rol şablonları ─────────────────────────────────────────────
-- Kapsam: bütün kayıtlar | belirli sahalar | kişiye atanmış işler.
CREATE FUNCTION public.valid_admin_scope(s jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(s) = 'object' AND (
    (s->>'kind' IN ('all', 'assigned') AND NOT s ? 'siteIds')
    OR (s->>'kind' = 'sites' AND jsonb_typeof(s->'siteIds') = 'array'
        AND jsonb_array_length(s->'siteIds') BETWEEN 1 AND 200)
  );
$$;

CREATE TABLE public.admin_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{2,40}$'),
  label       text NOT NULL,
  description text NOT NULL DEFAULT '',
  permissions text[] NOT NULL CHECK (array_length(permissions, 1) BETWEEN 1 AND 100),
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_role_assignments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id      uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  role_id            uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE RESTRICT,
  scope              jsonb NOT NULL DEFAULT '{"kind":"all"}'::jsonb CHECK (public.valid_admin_scope(scope)),
  -- İade tutar sınırı: bu dilimde yalnız saklanır; uygulaması iade onay dilimindedir.
  refund_limit_kurus bigint CHECK (refund_limit_kurus IS NULL OR refund_limit_kurus > 0),
  starts_at          timestamptz NOT NULL DEFAULT now(),
  ends_at            timestamptz,
  granted_by         uuid,
  reason             text CHECK (reason IS NULL OR char_length(reason) <= 500),
  revoked_at         timestamptz,
  revoked_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX admin_role_assignments_user_idx ON public.admin_role_assignments (admin_user_id) WHERE revoked_at IS NULL;

CREATE TABLE public.admin_invitations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL CHECK (email = lower(email) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role_id          uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE RESTRICT,
  scope            jsonb NOT NULL DEFAULT '{"kind":"all"}'::jsonb CHECK (public.valid_admin_scope(scope)),
  access_ends_at   timestamptz,
  -- Ham belirteç YALNIZ e-postada bulunur; burada SHA-256 özeti saklanır.
  token_hash       text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_by       uuid NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  last_sent_at     timestamptz NOT NULL DEFAULT now(),
  sent_count       integer NOT NULL DEFAULT 1 CHECK (sent_count BETWEEN 1 AND 20),
  accepted_at      timestamptz,
  accepted_user_id uuid,
  revoked_at       timestamptz,
  revoked_by       uuid
);
-- Aynı e-posta için aynı anda tek bekleyen davet.
CREATE UNIQUE INDEX admin_invitations_one_pending ON public.admin_invitations (email) WHERE status = 'pending';

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_roles, public.admin_role_assignments, public.admin_invitations FROM PUBLIC, anon, authenticated;

-- Yeni rollerin eski rol kolonunda karşılığı yoksa 'NONE' yazılır: eski rol listesine dayanan uçlar
-- bu kişilere kapalı kalır, yalnız izin tabanlı uçlar açılır.
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('SUPER_ADMIN', 'FINANCE', 'OPERATIONS', 'ENGINEER', 'NONE'));

-- ── 2. Sistem rolleri (brif 12 §5) ──────────────────────────────────────────
INSERT INTO public.admin_roles (key, label, description, permissions, is_system) VALUES
  ('owner', 'Sistem sahibi', 'Tüm modüller, personel ve politika yönetimi.', ARRAY[
    'orders.read','orders.note','orders.assign','orders.cancel','orders.documents.read','orders.export',
    'customers.contact.read','customers.tax.read','customers.export',
    'refunds.request','refunds.approve','refunds.execute','invoices.read','invoices.manage','finance.read',
    'sites.read','sites.edit','sites.publish','sites.capacity.manage',
    'batches.read','batches.plan','batches.assign','batches.release',
    'monitoring.edit','monitoring.review','monitoring.publish','certificates.read_private','certificates.resend',
    'requests.read','requests.assign','requests.update','messages.send',
    'content.edit','content.publish','media.upload','legal.edit','legal.publish',
    'staff.invite','staff.manage','roles.manage','audit.read',
    'sales.pause','sales.resume','sales.pricing.manage','system.readiness.read','system.jobs.run'], true),
  ('business_manager', 'İşletme yöneticisi', 'Günlük iş kuyrukları, atamalar, operasyon koordinasyonu.', ARRAY[
    'orders.read','orders.note','orders.assign','customers.contact.read','finance.read','invoices.read',
    'sites.read','batches.read','batches.plan','batches.assign','monitoring.edit','monitoring.review',
    'certificates.resend','requests.read','requests.assign','requests.update','audit.read','system.readiness.read'], true),
  ('finance', 'Finans ve muhasebe', 'Tahsilat, fatura, iade ve finans raporları.', ARRAY[
    'orders.read','orders.documents.read','customers.contact.read','customers.tax.read',
    'refunds.request','refunds.approve','refunds.execute','invoices.read','invoices.manage','finance.read',
    'requests.read','audit.read'], true),
  ('operations', 'Operasyon sorumlusu', 'Partiler, sahalar ve sipariş operasyonu.', ARRAY[
    'orders.read','orders.note','sites.read','batches.read','batches.plan','batches.assign','batches.release',
    'monitoring.edit','requests.read','requests.update','certificates.resend','system.readiness.read'], true),
  ('engineer', 'Orman mühendisi', 'Sahalar, kapasite, tür bilgisi ve izleme.', ARRAY[
    'sites.read','sites.edit','sites.capacity.manage','batches.read','monitoring.edit','monitoring.review',
    'orders.read','system.readiness.read'], true),
  ('customer_support', 'Müşteri hizmetleri', 'Talepler, iletişim ve sipariş takibi.', ARRAY[
    'orders.read','orders.note','customers.contact.read','requests.read','requests.assign','requests.update',
    'messages.send','refunds.request','certificates.resend'], true),
  ('content_editor', 'İçerik editörü', 'Sayfa, SSS, çeviri ve medya taslakları.', ARRAY[
    'content.edit','media.upload','sites.read'], true),
  ('read_only', 'İnceleyici (salt okuma)', 'Yalnız okuma; yazma ve dışa aktarma yok.', ARRAY[
    'orders.read','sites.read','batches.read','requests.read','invoices.read','audit.read'], true);

-- ── 3. Mevcut personelin taşınması (erişim daralmadan) ──────────────────────
INSERT INTO public.admin_role_assignments (admin_user_id, role_id, scope, reason)
SELECT u.id, r.id, '{"kind":"all"}'::jsonb, 'migration:021'
  FROM public.admin_users u
  JOIN public.admin_roles r ON r.key = CASE u.role
        WHEN 'SUPER_ADMIN' THEN 'owner'
        WHEN 'FINANCE' THEN 'finance'
        WHEN 'OPERATIONS' THEN 'operations'
        WHEN 'ENGINEER' THEN 'engineer' END
 WHERE u.is_active;

-- ── 4. Etkili yetki ─────────────────────────────────────────────────────────
-- Kapsamlar izin bazında birleşir: all > sites (birleşim) > assigned.
CREATE FUNCTION public.admin_effective_permissions(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH me AS (
    SELECT id FROM public.admin_users WHERE user_id = p_user AND is_active IS TRUE
  ),
  active AS (
    SELECT a.*, r.key AS role_key, r.label AS role_label, r.permissions
      FROM public.admin_role_assignments a
      JOIN me ON me.id = a.admin_user_id
      JOIN public.admin_roles r ON r.id = a.role_id
     WHERE a.revoked_at IS NULL AND a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())
  ),
  granted AS (
    SELECT unnest(a.permissions) AS key, a.scope, a.refund_limit_kurus FROM active a
  ),
  -- Kapsamlar izin bazında KAYIPSIZ birleşir: 'all' varsa tek eleman, yoksa sites birleşimi ve/veya assigned.
  merged AS (
    SELECT g.key,
           CASE WHEN bool_or(g.scope->>'kind' = 'all') THEN jsonb_build_array('{"kind":"all"}'::jsonb)
                ELSE COALESCE(
                  CASE WHEN bool_or(g.scope->>'kind' = 'sites') THEN jsonb_build_array(jsonb_build_object('kind', 'sites', 'siteIds',
                    (SELECT jsonb_agg(DISTINCT s) FROM granted g2, jsonb_array_elements_text(g2.scope->'siteIds') s
                      WHERE g2.key = g.key AND g2.scope->>'kind' = 'sites'))) ELSE '[]'::jsonb END
                  || CASE WHEN bool_or(g.scope->>'kind' = 'assigned') THEN jsonb_build_array('{"kind":"assigned"}'::jsonb) ELSE '[]'::jsonb END,
                  '[]'::jsonb)
           END AS scopes
      FROM granted g GROUP BY g.key
  )
  SELECT jsonb_build_object(
    'adminId', (SELECT id FROM me),
    'permissions', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', key, 'scopes', scopes) ORDER BY key) FROM merged), '[]'::jsonb),
    'roles', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', role_key, 'label', role_label, 'scope', scope,
                                                           'assignmentId', id, 'version', updated_at, 'endsAt', ends_at) ORDER BY role_key) FROM active), '[]'::jsonb),
    -- Tutar sınırı yalnız saklanır; hiçbir uç uygulamaz (web-brifler/19 §6).
    'limits', jsonb_build_object('refundKurus', (SELECT max(refund_limit_kurus) FROM active), 'enforced', false)
  );
$$;

CREATE FUNCTION public.admin_has_permission(p_user uuid, p_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.admin_effective_permissions(p_user)->'permissions') p
     WHERE p->>'key' = p_permission
  );
$$;

-- Eski rol kolonunun aynası: yeni rollerin eski karşılığı yoksa 'NONE'.
CREATE FUNCTION public.admin_legacy_role(p_admin uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(
    (SELECT CASE
              WHEN bool_or(r.key = 'owner') THEN 'SUPER_ADMIN'
              WHEN bool_or(r.key = 'finance') THEN 'FINANCE'
              WHEN bool_or(r.key = 'operations') THEN 'OPERATIONS'
              WHEN bool_or(r.key = 'engineer') THEN 'ENGINEER'
              ELSE 'NONE' END
       FROM public.admin_role_assignments a JOIN public.admin_roles r ON r.id = a.role_id
      WHERE a.admin_user_id = p_admin AND a.revoked_at IS NULL AND a.starts_at <= now()
        -- Yalnız kapsamı 'all' ve süresiz atamalar eski rol alanına yansır: dar kapsam eski uçlarda genişlemez.
        AND a.ends_at IS NULL AND a.scope->>'kind' = 'all'),
    'NONE');
$$;

-- ── 5. Ortak denetimler ─────────────────────────────────────────────────────
-- Yetki yükseltme yasağı: kimse kendisinde olmayan izni atayamaz; dar kapsamlı izin geniş kapsamla verilemez.
-- Küresel yönetim izinleri kapsamla sınırlanamaz: saha kapsamı denetimsiz personel yetkisine dönüşmemeli.
CREATE FUNCTION public.global_only_permission(p_key text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  -- Personel/rol/davet yönetimi kapsamla sınırlanamaz. Diğer küresel uçlar (denetim, satış ayarı,
  -- zamanlanmış iş) kapsam süzmesi uygulamadıkları için uç düzeyinde 'all' ister (19 §1).
  SELECT p_key IN ('staff.invite', 'staff.manage', 'roles.manage');
$$;

CREATE FUNCTION public.admin_can_grant(p_actor uuid, p_role uuid, p_scope jsonb, p_ends_at timestamptz DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE mine jsonb := public.admin_effective_permissions(p_actor)->'permissions'; perm text; own jsonb;
  v_all boolean; v_sites jsonb; v_actor_ends timestamptz;
BEGIN
  -- Atayanın kendi erişimi ne zaman bitiyorsa, verdiği erişim onu aşamaz.
  SELECT max(COALESCE(a.ends_at, 'infinity'::timestamptz)) INTO v_actor_ends
    FROM public.admin_role_assignments a JOIN public.admin_users u ON u.id = a.admin_user_id
   WHERE u.user_id = p_actor AND a.revoked_at IS NULL AND a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now());
  IF v_actor_ends IS NOT NULL AND v_actor_ends <> 'infinity'::timestamptz
     AND (p_ends_at IS NULL OR p_ends_at > v_actor_ends) THEN
    RETURN false;
  END IF;
  FOR perm IN SELECT unnest(permissions) FROM public.admin_roles WHERE id = p_role LOOP
    IF public.global_only_permission(perm) AND p_scope->>'kind' <> 'all' THEN RETURN false; END IF;
    SELECT p->'scopes' INTO own FROM jsonb_array_elements(mine) p WHERE p->>'key' = perm;
    IF own IS NULL OR jsonb_array_length(own) = 0 THEN RETURN false; END IF;
    v_all := EXISTS (SELECT 1 FROM jsonb_array_elements(own) s WHERE s->>'kind' = 'all');
    IF v_all THEN CONTINUE; END IF;                              -- her kapsamı verebilir
    IF p_scope->>'kind' = 'all' THEN RETURN false; END IF;       -- kendisinde olmayan genişlik
    IF p_scope->>'kind' = 'sites' THEN
      SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb) INTO v_sites
        FROM jsonb_array_elements(own) s, jsonb_array_elements_text(s->'siteIds') x WHERE s->>'kind' = 'sites';
      -- Hedef sahaların hepsi kendi kapsamında olmalı.
      IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_scope->'siteIds') t
                  WHERE NOT (v_sites @> to_jsonb(t))) THEN RETURN false; END IF;
    END IF;
  END LOOP;
  RETURN true;
END $$;

CREATE FUNCTION public.admin_audit(p_actor uuid, p_action text, p_entity text, p_entity_id text, p_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (admin_id, admin_email, action, entity, entity_id, details)
  SELECT COALESCE(p_actor, '00000000-0000-0000-0000-000000000000'::uuid),
         COALESCE((SELECT email FROM public.admin_users WHERE user_id = p_actor), 'system/database'),
         p_action, p_entity, p_entity_id, p_details;
END $$;

-- Son aktif sahip korunur (019 tetikleyicisine ek: atama yoluyla da düşürülemez).
-- Süresi dolan atama bir UPDATE olmadığı için tetikleyiciyle yakalanamaz: en az bir SÜRESİZ (kalıcı)
-- sahip bulunmasını şart koşarız. p_excluding: sayımdan çıkarılacak atama (kaldırma/süre verme denemesi).
CREATE FUNCTION public.admin_owner_count(p_excluding uuid DEFAULT NULL, p_permanent boolean DEFAULT true) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(DISTINCT a.admin_user_id)::integer
    FROM public.admin_role_assignments a
    JOIN public.admin_roles r ON r.id = a.role_id
    JOIN public.admin_users u ON u.id = a.admin_user_id
   WHERE r.key = 'owner' AND u.is_active IS TRUE AND a.revoked_at IS NULL
     AND a.starts_at <= now()
     AND (CASE WHEN p_permanent THEN a.ends_at IS NULL ELSE (a.ends_at IS NULL OR a.ends_at > now()) END)
     AND (p_excluding IS NULL OR a.id <> p_excluding);
$$;

-- ── 6. Atama işlemleri ──────────────────────────────────────────────────────
CREATE FUNCTION public.assign_admin_role(p_actor uuid, p_admin uuid, p_role_key text, p_scope jsonb,
                                         p_ends_at timestamptz, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role public.admin_roles; v_target public.admin_users; v_row public.admin_role_assignments;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'roles.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_target FROM public.admin_users WHERE id = p_admin FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'staff_missing' USING ERRCODE = 'P0002'; END IF;
  IF v_target.user_id = p_actor THEN RAISE EXCEPTION 'self_assignment' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_role FROM public.admin_roles WHERE key = p_role_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'role_missing' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.valid_admin_scope(p_scope) THEN RAISE EXCEPTION 'invalid_scope' USING ERRCODE = '22023'; END IF;
  IF NOT public.admin_can_grant(p_actor, v_role.id, p_scope, p_ends_at) THEN RAISE EXCEPTION 'escalation_blocked' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.admin_role_assignments (admin_user_id, role_id, scope, ends_at, granted_by, reason)
  VALUES (p_admin, v_role.id, p_scope, p_ends_at, p_actor, p_reason) RETURNING * INTO v_row;
  UPDATE public.admin_users SET role = public.admin_legacy_role(p_admin), updated_at = now() WHERE id = p_admin;
  PERFORM public.admin_audit(p_actor, 'CREATE', 'admin_assignment', v_row.id::text,
    jsonb_build_object('adminId', p_admin, 'role', p_role_key, 'scope', p_scope, 'endsAt', p_ends_at, 'reason', p_reason));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.update_admin_assignment(p_actor uuid, p_assignment uuid, p_scope jsonb,
                                               p_ends_at timestamptz, p_expected_updated_at timestamptz, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.admin_role_assignments; v_before jsonb;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'roles.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.admin_role_assignments WHERE id = p_assignment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'assignment_missing' USING ERRCODE = 'P0002'; END IF;
  IF v_row.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'assignment_revoked' USING ERRCODE = '55000'; END IF;
  IF (SELECT user_id FROM public.admin_users WHERE id = v_row.admin_user_id) = p_actor THEN
    RAISE EXCEPTION 'self_assignment' USING ERRCODE = '42501';
  END IF;
  IF v_row.updated_at <> p_expected_updated_at THEN RAISE EXCEPTION 'version_changed' USING ERRCODE = '40001'; END IF;
  IF NOT public.valid_admin_scope(p_scope) THEN RAISE EXCEPTION 'invalid_scope' USING ERRCODE = '22023'; END IF;
  IF NOT public.admin_can_grant(p_actor, v_row.role_id, p_scope, p_ends_at) THEN RAISE EXCEPTION 'escalation_blocked' USING ERRCODE = '42501'; END IF;
  -- Son kalıcı sahibin atamasına bitiş tarihi konulamaz ve kapsamı daraltılamaz.
  IF (SELECT key FROM public.admin_roles WHERE id = v_row.role_id) = 'owner'
     AND (p_ends_at IS NOT NULL OR p_scope->>'kind' <> 'all')
     AND public.admin_owner_count(p_assignment) = 0 THEN
    RAISE EXCEPTION 'last_active_owner' USING ERRCODE = '23514';
  END IF;
  v_before := jsonb_build_object('scope', v_row.scope, 'endsAt', v_row.ends_at);
  UPDATE public.admin_role_assignments SET scope = p_scope, ends_at = p_ends_at, reason = COALESCE(p_reason, reason), updated_at = now()
   WHERE id = p_assignment RETURNING * INTO v_row;
  -- Kapsam daraltma ya da süre verme eski rol aynasını da değiştirir: aynı transaction'da yenilenir,
  -- yoksa eski rol listesine dayanan uçlar geniş erişimi kabul etmeye devam eder.
  UPDATE public.admin_users SET role = public.admin_legacy_role(v_row.admin_user_id), updated_at = now()
   WHERE id = v_row.admin_user_id;
  PERFORM public.admin_audit(p_actor, 'UPDATE', 'admin_assignment', v_row.id::text,
    jsonb_build_object('adminId', v_row.admin_user_id, 'before', v_before,
                       'after', jsonb_build_object('scope', v_row.scope, 'endsAt', v_row.ends_at), 'reason', p_reason));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.revoke_admin_assignment(p_actor uuid, p_assignment uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.admin_role_assignments; v_key text;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'roles.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.admin_role_assignments WHERE id = p_assignment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'assignment_missing' USING ERRCODE = 'P0002'; END IF;
  IF v_row.revoked_at IS NOT NULL THEN RETURN to_jsonb(v_row); END IF;
  IF (SELECT user_id FROM public.admin_users WHERE id = v_row.admin_user_id) = p_actor THEN
    RAISE EXCEPTION 'self_assignment' USING ERRCODE = '42501';
  END IF;
  SELECT key INTO v_key FROM public.admin_roles WHERE id = v_row.role_id;
  IF v_key = 'owner' AND public.admin_owner_count(p_assignment) = 0 THEN
    RAISE EXCEPTION 'last_active_owner' USING ERRCODE = '23514';
  END IF;
  UPDATE public.admin_role_assignments SET revoked_at = now(), revoked_by = p_actor, reason = COALESCE(p_reason, reason), updated_at = now()
   WHERE id = p_assignment RETURNING * INTO v_row;
  UPDATE public.admin_users SET role = public.admin_legacy_role(v_row.admin_user_id), updated_at = now() WHERE id = v_row.admin_user_id;
  PERFORM public.admin_audit(p_actor, 'DELETE', 'admin_assignment', v_row.id::text,
    jsonb_build_object('adminId', v_row.admin_user_id, 'role', v_key, 'reason', p_reason));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.set_admin_active(p_actor uuid, p_admin uuid, p_active boolean, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.admin_users;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'staff.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.admin_users WHERE id = p_admin FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'staff_missing' USING ERRCODE = 'P0002'; END IF;
  IF v_row.user_id = p_actor THEN RAISE EXCEPTION 'self_assignment' USING ERRCODE = '42501'; END IF;
  -- Son sahip 019 tetikleyicisiyle de korunur; burada anlaşılır hata veriyoruz.
  IF NOT p_active AND public.admin_owner_count(NULL) <= 1
     AND EXISTS (SELECT 1 FROM public.admin_role_assignments a JOIN public.admin_roles r ON r.id = a.role_id
                  WHERE a.admin_user_id = p_admin AND r.key = 'owner' AND a.revoked_at IS NULL AND a.ends_at IS NULL) THEN
    RAISE EXCEPTION 'last_active_owner' USING ERRCODE = '23514';
  END IF;
  UPDATE public.admin_users SET is_active = p_active, updated_at = now() WHERE id = p_admin RETURNING * INTO v_row;
  PERFORM public.admin_audit(p_actor, 'UPDATE', 'admin_user', p_admin::text,
    jsonb_build_object('isActive', p_active, 'reason', p_reason));
  RETURN to_jsonb(v_row);
END $$;

-- ── 7. Davet yaşam döngüsü ──────────────────────────────────────────────────
CREATE FUNCTION public.create_admin_invitation(p_actor uuid, p_email text, p_role_key text, p_scope jsonb,
                                               p_access_ends_at timestamptz, p_token_hash text, p_expires_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role public.admin_roles; v_row public.admin_invitations; v_email text := lower(btrim(p_email));
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'staff.invite') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_role FROM public.admin_roles WHERE key = p_role_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'role_missing' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.admin_can_grant(p_actor, v_role.id, p_scope, p_access_ends_at) THEN RAISE EXCEPTION 'escalation_blocked' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE lower(email) = v_email AND is_active) THEN
    RAISE EXCEPTION 'already_staff' USING ERRCODE = '55000';
  END IF;
  IF p_expires_at <= now() OR p_expires_at > now() + interval '30 days' THEN RAISE EXCEPTION 'invalid_expiry' USING ERRCODE = '22023'; END IF;
  BEGIN
    INSERT INTO public.admin_invitations (email, role_id, scope, access_ends_at, token_hash, created_by, expires_at)
    VALUES (v_email, v_role.id, p_scope, p_access_ends_at, p_token_hash, p_actor, p_expires_at) RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'invitation_exists' USING ERRCODE = '55000';
  END;
  PERFORM public.admin_audit(p_actor, 'CREATE', 'admin_invitation', v_row.id::text,
    jsonb_build_object('email', v_email, 'role', p_role_key, 'scope', p_scope, 'expiresAt', p_expires_at));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.resend_admin_invitation(p_actor uuid, p_id uuid, p_token_hash text, p_expires_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.admin_invitations;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'staff.invite') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.admin_invitations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_missing' USING ERRCODE = 'P0002'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'invitation_unusable' USING ERRCODE = '55000'; END IF;
  UPDATE public.admin_invitations
     SET token_hash = p_token_hash, expires_at = p_expires_at, last_sent_at = now(), sent_count = sent_count + 1
   WHERE id = p_id RETURNING * INTO v_row;
  PERFORM public.admin_audit(p_actor, 'UPDATE', 'admin_invitation', p_id::text,
    jsonb_build_object('action', 'resend', 'sentCount', v_row.sent_count, 'expiresAt', p_expires_at));
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.revoke_admin_invitation(p_actor uuid, p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.admin_invitations;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'staff.invite') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.admin_invitations SET status = 'revoked', revoked_at = now(), revoked_by = p_actor
   WHERE id = p_id AND status = 'pending' RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_unusable' USING ERRCODE = '55000'; END IF;
  PERFORM public.admin_audit(p_actor, 'UPDATE', 'admin_invitation', p_id::text, jsonb_build_object('action', 'revoke'));
  RETURN to_jsonb(v_row);
END $$;

-- Daveti kabul eden kişinin kendisidir: yetki kontrolü yok, kimlik e-posta eşleşmesiyle yapılır.
CREATE FUNCTION public.accept_admin_invitation(p_token_hash text, p_user uuid, p_email text, p_full_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_inv public.admin_invitations; v_admin public.admin_users; v_email text := lower(btrim(p_email)); v_assignment uuid;
BEGIN
  SELECT * INTO v_inv FROM public.admin_invitations WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_missing' USING ERRCODE = 'P0002'; END IF;
  IF v_inv.status <> 'pending' OR v_inv.expires_at <= now() THEN RAISE EXCEPTION 'invitation_unusable' USING ERRCODE = '55000'; END IF;
  IF v_inv.email <> v_email THEN
    PERFORM public.admin_audit(NULL, 'UPDATE', 'admin_invitation', v_inv.id::text,
      jsonb_build_object('action', 'accept_rejected', 'reason', 'email_mismatch'));
    RAISE EXCEPTION 'invitation_email_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_admin FROM public.admin_users WHERE user_id = p_user FOR UPDATE;
  IF FOUND THEN
    UPDATE public.admin_users SET is_active = true, full_name = COALESCE(NULLIF(btrim(p_full_name), ''), full_name), updated_at = now()
     WHERE id = v_admin.id RETURNING * INTO v_admin;
  ELSE
    INSERT INTO public.admin_users (user_id, email, full_name, role, is_active)
    VALUES (p_user, v_email, COALESCE(NULLIF(btrim(p_full_name), ''), v_email), 'NONE', true) RETURNING * INTO v_admin;
  END IF;
  INSERT INTO public.admin_role_assignments (admin_user_id, role_id, scope, ends_at, granted_by, reason)
  VALUES (v_admin.id, v_inv.role_id, v_inv.scope, v_inv.access_ends_at, v_inv.created_by, 'invitation:' || v_inv.id)
  RETURNING id INTO v_assignment;
  UPDATE public.admin_users SET role = public.admin_legacy_role(v_admin.id), updated_at = now() WHERE id = v_admin.id RETURNING * INTO v_admin;
  UPDATE public.admin_invitations SET status = 'accepted', accepted_at = now(), accepted_user_id = p_user WHERE id = v_inv.id;
  PERFORM public.admin_audit(v_inv.created_by, 'CREATE', 'admin_user', v_admin.id::text,
    jsonb_build_object('via', 'invitation', 'invitationId', v_inv.id, 'assignmentId', v_assignment, 'acceptedBy', p_user));
  RETURN jsonb_build_object('admin', to_jsonb(v_admin), 'assignmentId', v_assignment, 'invitationId', v_inv.id);
END $$;

-- ── 8. Geçiş fark raporu ────────────────────────────────────────────────────
CREATE FUNCTION public.admin_migration_report() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'adminId', u.id, 'email', u.email, 'legacyRole', u.role, 'isActive', u.is_active,
    'roles', COALESCE((SELECT jsonb_agg(r.key ORDER BY r.key) FROM public.admin_role_assignments a
                        JOIN public.admin_roles r ON r.id = a.role_id
                       WHERE a.admin_user_id = u.id AND a.revoked_at IS NULL), '[]'::jsonb),
    'permissionCount', COALESCE((SELECT jsonb_array_length(public.admin_effective_permissions(u.user_id)->'permissions')), 0),
    'narrowed', NOT EXISTS (SELECT 1 FROM public.admin_role_assignments a WHERE a.admin_user_id = u.id AND a.revoked_at IS NULL)
  ) ORDER BY u.created_at), '[]'::jsonb) FROM public.admin_users u;
$$;

-- Dönüşüm sonrası: her aktif personelin ataması olmalı (sessiz daralma yok) ve en az bir kalıcı sahip kalmalı.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_users u WHERE u.is_active
              AND NOT EXISTS (SELECT 1 FROM public.admin_role_assignments a WHERE a.admin_user_id = u.id)) THEN
    RAISE EXCEPTION 'migration_would_narrow_access';
  END IF;
  IF public.admin_owner_count(NULL) < 1 THEN RAISE EXCEPTION 'no_permanent_owner_after_migration'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.valid_admin_scope(jsonb), public.admin_effective_permissions(uuid), public.admin_has_permission(uuid, text),
  public.admin_legacy_role(uuid), public.admin_can_grant(uuid, uuid, jsonb, timestamptz), public.global_only_permission(text), public.admin_audit(uuid, text, text, text, jsonb),
  public.admin_owner_count(uuid, boolean), public.assign_admin_role(uuid, uuid, text, jsonb, timestamptz, text),
  public.update_admin_assignment(uuid, uuid, jsonb, timestamptz, timestamptz, text),
  public.revoke_admin_assignment(uuid, uuid, text), public.set_admin_active(uuid, uuid, boolean, text),
  public.create_admin_invitation(uuid, text, text, jsonb, timestamptz, text, timestamptz),
  public.resend_admin_invitation(uuid, uuid, text, timestamptz), public.revoke_admin_invitation(uuid, uuid),
  public.accept_admin_invitation(text, uuid, text, text), public.admin_migration_report()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_effective_permissions(uuid), public.admin_has_permission(uuid, text),
  public.assign_admin_role(uuid, uuid, text, jsonb, timestamptz, text),
  public.update_admin_assignment(uuid, uuid, jsonb, timestamptz, timestamptz, text),
  public.revoke_admin_assignment(uuid, uuid, text), public.set_admin_active(uuid, uuid, boolean, text),
  public.create_admin_invitation(uuid, text, text, jsonb, timestamptz, text, timestamptz),
  public.resend_admin_invitation(uuid, uuid, text, timestamptz), public.revoke_admin_invitation(uuid, uuid),
  public.accept_admin_invitation(text, uuid, text, text), public.admin_migration_report() TO service_role;

COMMIT;
