-- 023 — Davet sahipliği. 021/022 değiştirilmez; mevcut yazma ve MFA kapıları korunur.
-- Yalnız staff.invite: kendi davetleri. staff.invite + staff.manage (all): bütün davetler.
-- Aktör auth.users kimliğidir; API oturumundan gelir. Fonksiyonlar yalnız service_role'a açıktır.
-- BEGIN/COMMIT yok: uygulayan araç dosyayı TEK işlemde çalıştırır (kayıtlı uygulama betiği ya da psql --single-transaction); düz psql -f ile uygulanmaz.

CREATE INDEX admin_invitations_creator_page_idx
  ON public.admin_invitations (created_by, created_at DESC, id DESC);

CREATE FUNCTION public.admin_can_manage_invitation(p_actor uuid, p_creator uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH held AS (
    SELECT p FROM jsonb_array_elements(public.admin_effective_permissions(p_actor)->'permissions') p
  )
  SELECT EXISTS (SELECT 1 FROM held WHERE p->>'key' = 'staff.invite' AND p->'scopes' @> '[{"kind":"all"}]'::jsonb)
    AND (p_creator = p_actor OR EXISTS (
      SELECT 1 FROM held WHERE p->>'key' = 'staff.manage' AND p->'scopes' @> '[{"kind":"all"}]'::jsonb
    ));
$$;
REVOKE ALL ON FUNCTION public.admin_can_manage_invitation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_can_manage_invitation(uuid, uuid) TO service_role;

-- Her iki işlemde sahiplik, satır kilidi alındıktan sonra ve durum bilgisi açılmadan denetlenir.
CREATE OR REPLACE FUNCTION public.resend_admin_invitation(p_actor uuid, p_id uuid, p_token_hash text, p_expires_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.admin_invitations;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'staff.invite') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.admin_invitations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.admin_can_manage_invitation(p_actor, v_row.created_by) THEN
    RAISE EXCEPTION 'invitation_missing' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'invitation_unusable' USING ERRCODE = '55000'; END IF;
  UPDATE public.admin_invitations
     SET token_hash = p_token_hash, expires_at = p_expires_at, last_sent_at = now(), sent_count = sent_count + 1
   WHERE id = p_id RETURNING * INTO v_row;
  PERFORM public.admin_audit(p_actor, 'UPDATE', 'admin_invitation', p_id::text,
    jsonb_build_object('action', 'resend', 'sentCount', v_row.sent_count, 'expiresAt', p_expires_at));
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_admin_invitation(p_actor uuid, p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.admin_invitations;
BEGIN
  IF NOT public.admin_has_permission(p_actor, 'staff.invite') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.admin_invitations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.admin_can_manage_invitation(p_actor, v_row.created_by) THEN
    RAISE EXCEPTION 'invitation_missing' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'invitation_unusable' USING ERRCODE = '55000'; END IF;
  UPDATE public.admin_invitations SET status = 'revoked', revoked_at = now(), revoked_by = p_actor
   WHERE id = p_id AND status = 'pending' RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_unusable' USING ERRCODE = '55000'; END IF;
  PERFORM public.admin_audit(p_actor, 'UPDATE', 'admin_invitation', p_id::text, jsonb_build_object('action', 'revoke'));
  RETURN to_jsonb(v_row);
END $$;

REVOKE ALL ON FUNCTION public.resend_admin_invitation(uuid, uuid, text, timestamptz),
  public.revoke_admin_invitation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resend_admin_invitation(uuid, uuid, text, timestamptz),
  public.revoke_admin_invitation(uuid, uuid) TO service_role;
