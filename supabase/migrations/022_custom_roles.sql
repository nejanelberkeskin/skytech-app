-- 022 — Özel roller, rol etki önizlemesi ve kapsam kimliklerinin doğrulanması.
--
-- 021'e bağlıdır; 021 dosyası DEĞİŞTİRİLMEZ (uygulanmış olabilir).
-- Sözleşme: web-brifler/21-OZEL-ROLLER-API-SOZLESMESI.md.
-- Sistem rolleri salt okunur; rol silme bu dilimde yoktur (atanmış rol sessizce kaybolmaz).
--
-- Eşzamanlılık: rol düzenlemesi rol satırını FOR UPDATE ile kilitler. Atama, atama güncelleme ve
-- davet oluşturma aynı satırı FOR SHARE ile kilitledikten SONRA yetki denetimi yapar (§7); böylece
-- ya düzenleme bekler ve parmak izi yeni kaydı görür (usage_changed), ya da atama bekler ve rolün
-- GÜNCEL izinleriyle denetlenir. Bayat bir önizleme onayı uygulanamaz.
BEGIN;

ALTER TABLE public.admin_roles
  ADD COLUMN created_by uuid,
  ADD COLUMN updated_by uuid;

-- ── 1. Sistem rolleri salt okunur (doğrudan SQL dahil) ──────────────────────
CREATE FUNCTION public.protect_system_roles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_system THEN RAISE EXCEPTION 'system_role_readonly' USING ERRCODE = '55000'; END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER protect_system_roles BEFORE UPDATE OR DELETE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_roles();

-- ── 2. İzin sözlüğü (SQL tarafındaki tek kaynak; TS listesiyle test karşılaştırır) ──
CREATE FUNCTION public.admin_permission_keys() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'orders.read','orders.note','orders.assign','orders.cancel','orders.documents.read','orders.export',
    'customers.contact.read','customers.tax.read','customers.export',
    'refunds.request','refunds.approve','refunds.execute','invoices.read','invoices.manage','finance.read',
    'sites.read','sites.edit','sites.publish','sites.capacity.manage',
    'batches.read','batches.plan','batches.assign','batches.release',
    'monitoring.edit','monitoring.review','monitoring.publish','certificates.read_private','certificates.resend',
    'requests.read','requests.assign','requests.update','messages.send',
    'content.edit','content.publish','media.upload','legal.edit','legal.publish',
    'staff.invite','staff.manage','roles.manage','audit.read',
    'sales.pause','sales.resume','sales.pricing.manage','system.readiness.read','system.jobs.run'];
$$;

-- ── 3. Kapsam kimlikleri ve kapsamla sınırlanamayan izinler ─────────────────
-- Var olmayan saha kimliklerini döner; boş dizi = kapsam geçerli.
CREATE FUNCTION public.missing_scope_sites(p_scope jsonb) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(array_agg(s), ARRAY[]::text[])
    FROM jsonb_array_elements_text(CASE WHEN p_scope->>'kind' = 'sites' THEN p_scope->'siteIds' ELSE '[]'::jsonb END) s
   WHERE NOT EXISTS (SELECT 1 FROM public.lands l WHERE l.id::text = s);
$$;

-- Atama ve davet yollarının hepsinde (doğrudan SQL dahil) geçerli iki kural:
--  • saha kimlikleri veritabanında aranır; arayüzün ya da RPC'nin gönderdiği listeye güvenilmez;
--  • kapsamla sınırlanamayan izin taşıyan rol yalnız "tüm kayıtlar" kapsamıyla CANLI tutulabilir
--    (021 admin_can_grant kuralının yedeği: rol sonradan genişlese de dar kapsamlı kayıt kalmaz).
CREATE FUNCTION public.check_role_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_missing text[]; v_live boolean;
BEGIN
  -- Saha kimliği yalnız kapsam YAZILIRKEN denetlenir: sonradan silinen bir saha, kaydın kaldırılmasını
  -- (atama iptali, davet iptali/kabulü) hiçbir zaman engellememeli.
  IF TG_OP = 'INSERT' OR NEW.scope IS DISTINCT FROM OLD.scope THEN
    v_missing := public.missing_scope_sites(NEW.scope);
    IF array_length(v_missing, 1) > 0 THEN
      RAISE EXCEPTION 'invalid_scope' USING ERRCODE = '22023', DETAIL = array_to_string(v_missing, ',');
    END IF;
  END IF;
  -- Her tablo kendi alanlarıyla (PL/pgSQL alanı ifade çalışmadan çözer; tek CASE iki tabloda kullanılamaz).
  IF TG_TABLE_NAME = 'admin_role_assignments' THEN
    v_live := NEW.revoked_at IS NULL AND (NEW.ends_at IS NULL OR NEW.ends_at > now());
  ELSE
    v_live := NEW.status = 'pending';
  END IF;
  IF v_live AND NEW.scope->>'kind' <> 'all'
     AND EXISTS (SELECT 1 FROM public.admin_roles r, unnest(r.permissions) k
                  WHERE r.id = NEW.role_id AND public.global_only_permission(k)) THEN
    RAISE EXCEPTION 'escalation_blocked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_role_scope BEFORE INSERT OR UPDATE OF scope, role_id, revoked_at, ends_at ON public.admin_role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.check_role_scope();
CREATE TRIGGER check_role_scope BEFORE INSERT OR UPDATE OF scope, role_id, status, expires_at ON public.admin_invitations
  FOR EACH ROW EXECUTE FUNCTION public.check_role_scope();

-- ── 4. Rol kullanımı ve parmak izi ──────────────────────────────────────────
-- Sürüm metni: UTC, mikro saniye hassasiyetinde ISO. JS Date'ten GEÇİRİLMEZ; milisaniyeye kırpılan
-- sürüm geri geldiğinde `updated_at` ile eşleşmez ve her kaydetme version_changed olurdu.
CREATE FUNCTION public.admin_iso(p timestamptz) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT to_char(p AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
$$;

-- Parmak izi, önizleme ile kaydetme arasında etkilenen kümenin HERHANGİ bir değişikliğini yakalar:
-- yeni/kaldırılan atama, kapsam, başlangıç/bitiş, atama sürümü, personelin aktifliği; bekleyen davetin
-- kapsamı, erişim bitişi, geçerlilik süresi. İleri tarihli atamalar ve süresi geçmiş ama yeniden
-- gönderilebilecek bekleyen davetler de dahildir. Zaman damgaları saat diliminden bağımsız yazılır.
CREATE FUNCTION public.admin_role_usage(p_role uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH live AS (
    SELECT a.*, u.is_active AS staff_active, (a.starts_at <= now()) AS started
      FROM public.admin_role_assignments a JOIN public.admin_users u ON u.id = a.admin_user_id
     WHERE a.role_id = p_role AND a.revoked_at IS NULL AND (a.ends_at IS NULL OR a.ends_at > now())
  ),
  pending AS (
    SELECT i.* FROM public.admin_invitations i WHERE i.role_id = p_role AND i.status = 'pending'
  )
  SELECT jsonb_build_object(
    'activeAssignments', (SELECT count(*) FROM live WHERE started AND staff_active IS TRUE),
    'scheduledAssignments', (SELECT count(*) FROM live WHERE NOT started AND staff_active IS TRUE),
    'staffCount', (SELECT count(DISTINCT admin_user_id) FROM live WHERE staff_active IS TRUE),
    'pendingInvitations', (SELECT count(*) FROM pending WHERE expires_at > now()),
    'fingerprint', md5(
      COALESCE((SELECT string_agg(concat_ws(':', id, extract(epoch FROM updated_at), scope::text,
                                             extract(epoch FROM starts_at), COALESCE(extract(epoch FROM ends_at)::text, '-'),
                                             COALESCE(staff_active::text, '-')), ',' ORDER BY id) FROM live), '') || '|' ||
      COALESCE((SELECT string_agg(concat_ws(':', id, scope::text, COALESCE(extract(epoch FROM access_ends_at)::text, '-'),
                                             extract(epoch FROM expires_at)), ',' ORDER BY id) FROM pending), ''))
  );
$$;

CREATE FUNCTION public.admin_role_detail(p_actor uuid, p_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.admin_roles;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'roles.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.admin_roles WHERE key = p_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'role_missing' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'key', r.key, 'label', r.label, 'description', r.description, 'permissions', to_jsonb(r.permissions),
    'isSystem', r.is_system, 'version', public.admin_iso(r.updated_at), 'createdAt', public.admin_iso(r.created_at),
    'updatedBy', CASE WHEN r.updated_by IS NULL THEN NULL ELSE jsonb_build_object('adminId', r.updated_by,
      'label', COALESCE((SELECT COALESCE(NULLIF(full_name, ''), email) FROM public.admin_users WHERE user_id = r.updated_by), 'Yönetici')) END,
    'usage', public.admin_role_usage(r.id));
END $$;

-- ── 5. Ortak denetimler ─────────────────────────────────────────────────────
-- Aktör, role eklediği her izni KENDİSİ, "tüm kayıtlar" kapsamında ve SÜRESİZ bir atamayla taşımalı.
-- Rol düzenlemesi o rolü taşıyan herkese kalıcı etki eder; yarın bitecek bir yetkiyle başkalarına
-- kalıcı izin eklenemez (021'deki süre kuralının rol düzeyindeki karşılığı).
CREATE FUNCTION public.admin_missing_grantable(p_actor uuid, p_permissions text[]) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
    FROM unnest(p_permissions) k
   WHERE NOT EXISTS (
     SELECT 1 FROM public.admin_role_assignments a
       JOIN public.admin_users u ON u.id = a.admin_user_id
       JOIN public.admin_roles r ON r.id = a.role_id
      WHERE u.user_id = p_actor AND u.is_active IS TRUE AND a.revoked_at IS NULL
        AND a.starts_at <= now() AND a.ends_at IS NULL AND a.scope->>'kind' = 'all'
        AND k = ANY (r.permissions));
$$;

CREATE FUNCTION public.admin_unknown_permissions(p_permissions text[]) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
    FROM unnest(p_permissions) k WHERE NOT (k = ANY (public.admin_permission_keys()));
$$;

-- Aktör bu rolü kendi üzerinde taşıyor mu? Taşıyorsa rolü düzenleyerek kendi erişimini değiştiremez.
-- İleri tarihli (henüz başlamamış) atama da sayılır: bugün düzenleyip yarın kendisine genişletemesin.
CREATE FUNCTION public.admin_holds_role(p_actor uuid, p_role uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_role_assignments a JOIN public.admin_users u ON u.id = a.admin_user_id
     WHERE a.role_id = p_role AND u.user_id = p_actor AND a.revoked_at IS NULL
       AND (a.ends_at IS NULL OR a.ends_at > now()));
$$;

-- Yeni izin kümesi kapsamla sınırlanamayan izin içeriyorsa, rolün dar kapsamlı CANLI kayıtları
-- (ileri tarihli ve pasif personelin atamaları, süresi geçmiş ama yeniden gönderilebilir davetler dahil)
-- çakışmadır. Boşsa NULL döner; doluysa {permissions, assignments, invitations}.
CREATE FUNCTION public.admin_global_scope_conflict(p_role uuid, p_permissions text[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH g AS (SELECT array_agg(k ORDER BY k) AS keys FROM unnest(p_permissions) k WHERE public.global_only_permission(k)),
  c AS (
    SELECT (SELECT count(*) FROM public.admin_role_assignments a
             WHERE a.role_id = p_role AND a.revoked_at IS NULL AND (a.ends_at IS NULL OR a.ends_at > now())
               AND a.scope->>'kind' <> 'all') AS assignments,
           (SELECT count(*) FROM public.admin_invitations i
             WHERE i.role_id = p_role AND i.status = 'pending' AND i.scope->>'kind' <> 'all') AS invitations
  )
  SELECT CASE WHEN g.keys IS NULL OR (c.assignments + c.invitations) = 0 THEN NULL
              ELSE jsonb_build_object('permissions', to_jsonb(g.keys), 'assignments', c.assignments, 'invitations', c.invitations) END
    FROM g, c;
$$;

CREATE FUNCTION public.admin_valid_role_text(p_label text, p_description text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_label IS NOT NULL AND char_length(btrim(p_label)) NOT BETWEEN 2 AND 80 THEN 'invalid_label'
    WHEN p_description IS NOT NULL AND char_length(btrim(p_description)) > 500 THEN 'invalid_description'
  END;
$$;

-- ── 6. Özel rol oluşturma ───────────────────────────────────────────────────
CREATE FUNCTION public.create_admin_role(p_actor uuid, p_key text, p_label text, p_description text,
                                         p_permissions text[], p_copy_from text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_permissions text[] := p_permissions; v_missing text[]; v_unknown text[]; v_row public.admin_roles; v_text text;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'roles.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_key IS NULL OR p_key !~ '^[a-z][a-z0-9_]{2,40}$' THEN RAISE EXCEPTION 'invalid_key' USING ERRCODE = '22023'; END IF;
  v_text := public.admin_valid_role_text(COALESCE(p_label, ''), p_description);
  IF v_text IS NOT NULL THEN RAISE EXCEPTION '%', v_text USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.admin_roles WHERE key = p_key) THEN RAISE EXCEPTION 'role_exists' USING ERRCODE = '55000'; END IF;
  IF (v_permissions IS NULL OR array_length(v_permissions, 1) IS NULL) AND p_copy_from IS NOT NULL THEN
    SELECT permissions INTO v_permissions FROM public.admin_roles WHERE key = p_copy_from;
    IF v_permissions IS NULL THEN RAISE EXCEPTION 'role_missing' USING ERRCODE = 'P0002'; END IF;
  END IF;
  IF v_permissions IS NULL OR array_length(v_permissions, 1) IS NULL OR array_length(v_permissions, 1) > 100 THEN
    RAISE EXCEPTION 'invalid_permissions' USING ERRCODE = '22023';
  END IF;
  SELECT ARRAY(SELECT DISTINCT unnest(v_permissions) ORDER BY 1) INTO v_permissions;
  v_unknown := public.admin_unknown_permissions(v_permissions);
  IF array_length(v_unknown, 1) > 0 THEN
    RAISE EXCEPTION 'invalid_permissions' USING ERRCODE = '22023', DETAIL = array_to_string(v_unknown, ',');
  END IF;
  v_missing := public.admin_missing_grantable(p_actor, v_permissions);
  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'escalation_blocked' USING ERRCODE = '42501', DETAIL = array_to_string(v_missing, ',');
  END IF;
  BEGIN
    INSERT INTO public.admin_roles (key, label, description, permissions, is_system, created_by, updated_by)
    VALUES (p_key, btrim(p_label), COALESCE(btrim(p_description), ''), v_permissions, false, p_actor, p_actor)
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'role_exists' USING ERRCODE = '55000';   -- aynı anahtarla eşzamanlı oluşturma
  END;
  PERFORM public.admin_audit(p_actor, 'CREATE', 'admin_role', v_row.key,
    jsonb_build_object('permissions', to_jsonb(v_permissions), 'copyFrom', p_copy_from, 'label', v_row.label));
  RETURN public.admin_role_detail(p_actor, v_row.key);
END $$;

-- ── 7. Özel rol düzenleme (sürüm + etkilenen küme parmak izi + kilit) ───────
-- Sürüm ve parmak izi ZORUNLUDUR: NULL gönderilirse uyuşmazlık sayılır (bayat onayla yazma olmaz).
CREATE FUNCTION public.update_admin_role(p_actor uuid, p_key text, p_label text, p_description text,
                                         p_permissions text[], p_expected_version timestamptz,
                                         p_expected_fingerprint text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.admin_roles; v_permissions text[]; v_missing text[]; v_unknown text[]; v_added text[]; v_removed text[];
  v_conflict jsonb; v_text text; v_label text; v_description text;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'roles.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'note_required' USING ERRCODE = '22023';
  END IF;
  v_text := public.admin_valid_role_text(p_label, p_description);
  IF v_text IS NOT NULL THEN RAISE EXCEPTION '%', v_text USING ERRCODE = '22023'; END IF;
  -- Kilit: bu noktadan sonra rolün atama/davet kümesi değişemez (yazıcılar FOR SHARE bekler).
  SELECT * INTO r FROM public.admin_roles WHERE key = p_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'role_missing' USING ERRCODE = 'P0002'; END IF;
  IF r.is_system THEN RAISE EXCEPTION 'system_role_readonly' USING ERRCODE = '55000'; END IF;
  IF public.admin_holds_role(p_actor, r.id) THEN RAISE EXCEPTION 'self_assignment' USING ERRCODE = '42501'; END IF;
  IF p_expected_version IS NULL OR r.updated_at IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'version_changed' USING ERRCODE = '40001';
  END IF;
  IF p_expected_fingerprint IS NULL
     OR p_expected_fingerprint IS DISTINCT FROM (public.admin_role_usage(r.id)->>'fingerprint') THEN
    RAISE EXCEPTION 'usage_changed' USING ERRCODE = '40001';
  END IF;

  v_permissions := COALESCE(p_permissions, r.permissions);
  SELECT ARRAY(SELECT DISTINCT unnest(v_permissions) ORDER BY 1) INTO v_permissions;
  IF array_length(v_permissions, 1) IS NULL OR array_length(v_permissions, 1) > 100 THEN
    RAISE EXCEPTION 'invalid_permissions' USING ERRCODE = '22023';
  END IF;
  v_unknown := public.admin_unknown_permissions(v_permissions);
  IF array_length(v_unknown, 1) > 0 THEN
    RAISE EXCEPTION 'invalid_permissions' USING ERRCODE = '22023', DETAIL = array_to_string(v_unknown, ',');
  END IF;
  SELECT ARRAY(SELECT unnest(v_permissions) EXCEPT SELECT unnest(r.permissions) ORDER BY 1) INTO v_added;
  SELECT ARRAY(SELECT unnest(r.permissions) EXCEPT SELECT unnest(v_permissions) ORDER BY 1) INTO v_removed;
  v_missing := public.admin_missing_grantable(p_actor, v_added);
  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'escalation_blocked' USING ERRCODE = '42501', DETAIL = array_to_string(v_missing, ',');
  END IF;
  v_conflict := public.admin_global_scope_conflict(r.id, v_permissions);
  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'global_scope_conflict' USING ERRCODE = '55000', DETAIL = v_conflict::text;
  END IF;

  v_label := COALESCE(NULLIF(btrim(p_label), ''), r.label);
  v_description := COALESCE(btrim(p_description), r.description);
  UPDATE public.admin_roles
     SET label = v_label, description = v_description, permissions = v_permissions,
         updated_by = p_actor, updated_at = now()
   WHERE id = r.id;
  PERFORM public.admin_audit(p_actor, 'UPDATE', 'admin_role', r.key,
    jsonb_build_object('before', jsonb_build_object('permissions', to_jsonb(r.permissions), 'label', r.label, 'description', r.description),
                       'after', jsonb_build_object('permissions', to_jsonb(v_permissions), 'label', v_label, 'description', v_description),
                       'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed), 'reason', btrim(p_reason),
                       'usage', public.admin_role_usage(r.id)));
  RETURN public.admin_role_detail(p_actor, r.key);
END $$;

-- ── 8. Yazma YAPMAYAN etki önizlemesi ───────────────────────────────────────
-- Kilit almaz, satır yazmaz, denetim kaydı üretmez. `blocked.code` kaydetmede dönecek kodla aynıdır.
CREATE FUNCTION public.preview_admin_role_change(p_actor uuid, p_key text, p_permissions text[],
                                                 p_label text, p_description text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.admin_roles; v_permissions text[]; v_added text[]; v_removed text[]; v_blocked text;
  v_missing text[]; v_details jsonb; v_conflict jsonb; v_text text;
BEGIN
  -- Yetkisiz kişi etkilenen personel listesini de görmemeli: engel olarak değil, hata olarak döner.
  IF NOT public.admin_has_permission(p_actor, 'roles.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.admin_roles WHERE key = p_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'role_missing' USING ERRCODE = 'P0002'; END IF;
  v_permissions := COALESCE(p_permissions, r.permissions);
  SELECT ARRAY(SELECT DISTINCT unnest(v_permissions) ORDER BY 1) INTO v_permissions;
  SELECT ARRAY(SELECT unnest(v_permissions) EXCEPT SELECT unnest(r.permissions) ORDER BY 1) INTO v_added;
  SELECT ARRAY(SELECT unnest(r.permissions) EXCEPT SELECT unnest(v_permissions) ORDER BY 1) INTO v_removed;
  v_missing := public.admin_missing_grantable(p_actor, v_added);
  v_text := public.admin_valid_role_text(p_label, p_description);

  -- Sıra update_admin_role ile aynıdır (sürüm/parmak izi/gerekçe önizlemede sorulmaz).
  IF v_text IS NOT NULL THEN v_blocked := v_text;
  ELSIF r.is_system THEN v_blocked := 'system_role_readonly';
  ELSIF public.admin_holds_role(p_actor, r.id) THEN v_blocked := 'self_assignment';
  ELSIF array_length(v_permissions, 1) IS NULL OR array_length(v_permissions, 1) > 100 THEN v_blocked := 'invalid_permissions';
  ELSIF array_length(public.admin_unknown_permissions(v_permissions), 1) > 0 THEN
    v_blocked := 'invalid_permissions'; v_details := jsonb_build_object('unknown', to_jsonb(public.admin_unknown_permissions(v_permissions)));
  ELSIF array_length(v_missing, 1) > 0 THEN
    v_blocked := 'escalation_blocked'; v_details := jsonb_build_object('missing', to_jsonb(v_missing));
  ELSE
    v_conflict := public.admin_global_scope_conflict(r.id, v_permissions);
    IF v_conflict IS NOT NULL THEN v_blocked := 'global_scope_conflict'; v_details := v_conflict; END IF;
  END IF;

  RETURN jsonb_build_object(
    'role', jsonb_build_object('key', r.key, 'label', r.label, 'isSystem', r.is_system, 'version', public.admin_iso(r.updated_at)),
    'next', jsonb_build_object('label', COALESCE(NULLIF(btrim(p_label), ''), r.label),
                               'description', COALESCE(btrim(p_description), r.description),
                               'permissions', to_jsonb(v_permissions)),
    'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed),
    'unchanged', (SELECT count(*) FROM (SELECT unnest(v_permissions) INTERSECT SELECT unnest(r.permissions)) x),
    'usage', public.admin_role_usage(r.id),
    -- Kişi listesi: yalnız kimlik ve ad; iletişim bilgisi yok. En çok 20.
    'affectedStaff', COALESCE((SELECT jsonb_agg(s) FROM (
        SELECT jsonb_build_object('id', u.id, 'fullName', COALESCE(NULLIF(u.full_name, ''), 'Personel'),
                                  'activeAssignments', count(*) FILTER (WHERE a.starts_at <= now()),
                                  'scheduledAssignments', count(*) FILTER (WHERE a.starts_at > now())) AS s
          FROM public.admin_role_assignments a JOIN public.admin_users u ON u.id = a.admin_user_id
         WHERE a.role_id = r.id AND a.revoked_at IS NULL AND u.is_active IS TRUE
           AND (a.ends_at IS NULL OR a.ends_at > now())
         GROUP BY u.id, u.full_name ORDER BY u.full_name, u.id LIMIT 20) t), '[]'::jsonb),
    -- E-posta maskelenir: rol yöneticisi davet listesini okuma yetkisi taşımayabilir.
    'affectedInvitations', COALESCE((SELECT jsonb_agg(i) FROM (
        SELECT jsonb_build_object('id', id, 'status', status,
                 'email', left(email, 1) || '***@' || split_part(email, '@', 2)) AS i
          FROM public.admin_invitations WHERE role_id = r.id AND status = 'pending' AND expires_at > now()
         ORDER BY created_at DESC, id LIMIT 20) t2), '[]'::jsonb),
    'blocked', CASE WHEN v_blocked IS NULL THEN NULL
                    ELSE jsonb_build_object('code', v_blocked, 'details', v_details) END);
END $$;

-- ── 9. 021 yazıcıları: rol satırını FOR SHARE ile kilitledikten sonra denetler ──
-- Gövdeler 021 ile BİREBİR aynıdır; yalnız rol okuması kilitli yapılır (test farkı doğrular).
-- Böylece admin_can_grant, eşzamanlı bir rol düzenlemesinin bayat izin listesiyle değil güncel
-- listesiyle çalışır.
CREATE OR REPLACE FUNCTION public.assign_admin_role(p_actor uuid, p_admin uuid, p_role_key text, p_scope jsonb,
                                         p_ends_at timestamptz, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role public.admin_roles; v_target public.admin_users; v_row public.admin_role_assignments;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'roles.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_target FROM public.admin_users WHERE id = p_admin FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'staff_missing' USING ERRCODE = 'P0002'; END IF;
  IF v_target.user_id = p_actor THEN RAISE EXCEPTION 'self_assignment' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_role FROM public.admin_roles WHERE key = p_role_key FOR SHARE;
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

CREATE OR REPLACE FUNCTION public.update_admin_assignment(p_actor uuid, p_assignment uuid, p_scope jsonb,
                                               p_ends_at timestamptz, p_expected_updated_at timestamptz, p_reason text,
                                               p_admin uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.admin_role_assignments; v_before jsonb;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'roles.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.admin_role_assignments WHERE id = p_assignment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'assignment_missing' USING ERRCODE = 'P0002'; END IF;
  PERFORM 1 FROM public.admin_roles WHERE id = v_row.role_id FOR SHARE;
  -- Adresteki personel ile kaydın sahibi eşleşmeli: yanlış kişinin ataması düzenlenemez.
  IF p_admin IS NOT NULL AND v_row.admin_user_id <> p_admin THEN RAISE EXCEPTION 'assignment_missing' USING ERRCODE = 'P0002'; END IF;
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

CREATE OR REPLACE FUNCTION public.create_admin_invitation(p_actor uuid, p_email text, p_role_key text, p_scope jsonb,
                                               p_access_ends_at timestamptz, p_token_hash text, p_expires_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role public.admin_roles; v_row public.admin_invitations; v_email text := lower(btrim(p_email));
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'staff.invite') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_role FROM public.admin_roles WHERE key = p_role_key FOR SHARE;
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

REVOKE ALL ON FUNCTION public.protect_system_roles(), public.admin_permission_keys(), public.admin_iso(timestamptz), public.missing_scope_sites(jsonb),
  public.check_role_scope(), public.admin_role_usage(uuid), public.admin_role_detail(uuid, text),
  public.admin_missing_grantable(uuid, text[]), public.admin_unknown_permissions(text[]), public.admin_holds_role(uuid, uuid),
  public.admin_global_scope_conflict(uuid, text[]), public.admin_valid_role_text(text, text),
  public.create_admin_role(uuid, text, text, text, text[], text),
  public.update_admin_role(uuid, text, text, text, text[], timestamptz, text, text),
  public.preview_admin_role_change(uuid, text, text[], text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_role_detail(uuid, text), public.admin_role_usage(uuid),
  public.create_admin_role(uuid, text, text, text, text[], text),
  public.update_admin_role(uuid, text, text, text, text[], timestamptz, text, text),
  public.preview_admin_role_change(uuid, text, text[], text, text) TO service_role;

COMMIT;
