-- ═════════════════════════════════════════════════════════════════════════════
-- 014 — Talep toplama (service_requests) + email_logs + profil otomasyonu
--
-- Ödeme almadan toplanan talepler: tohum talebi, arazime ekim başvurusu,
-- açık araziye tohum talebi. Yazma yalnız service_role (API route) üzerinden;
-- istemci için tek policy: giriş yapmış kullanıcı kendi taleplerini OKUR
-- (yalnız güvenli sütunlar — ip_hash, admin_note vb. sütun yetkisi dışında).
--
-- DİKKAT: Supabase, public şemadaki yeni tablolara anon/authenticated için
-- varsayılan olarak TÜM yetkileri verir; RLS tek bariyer olmasın diye
-- yetkiler açıkça geri alınıyor (REVOKE) ve gereken kadarı veriliyor.
--
-- Ayrıca:
--   • email_logs tablosu (migration 004'te tanımlı ama canlıda yoktu —
--     lib/mail.ts logEmail() sessizce düşüyordu).
--   • auth.users INSERT → public.profiles satırı (istemcideki profiles.insert
--     e-posta doğrulama açıkken oturum olmadığı için RLS'e takılıyordu;
--     canlıda 8 kullanıcı / 0 profil).
--
-- Uygulama: Supabase MCP apply_migration · ad: service_requests_email_logs_profiles_trigger
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. service_requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no      TEXT NOT NULL UNIQUE,                         -- "TLP-A3K9PX"
  client_token    UUID UNIQUE,                                  -- idempotency: istemci üretir, tekrar gönderimde aynı
  type            TEXT NOT NULL
                  CHECK (type IN ('seed_purchase', 'land_application', 'open_land_seeding')),
  status          TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'contacted', 'quoted', 'converted', 'closed', 'spam')),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,   -- giriş yapmışsa oturumdan
  contact_name    TEXT NOT NULL CHECK (char_length(contact_name) BETWEEN 1 AND 120),
  email           TEXT CHECK (email IS NULL OR char_length(email) <= 254),   -- küçük harfe normalize
  phone           TEXT CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'), -- E.164 normalize
  company         TEXT CHECK (company IS NULL OR char_length(company) <= 160),
  locale          TEXT NOT NULL DEFAULT 'tr' CHECK (locale IN ('tr', 'en', 'ru')),
  land_id         UUID REFERENCES public.lands(id) ON DELETE SET NULL,  -- açık arazi talebinde
  total_seeds     INTEGER CHECK (total_seeds IS NULL OR (total_seeds > 0 AND total_seeds <= 1000000)),
  seed_items      JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(seed_items) = 'array'),  -- [{slug,name,quantity}]
  details         JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),   -- türe özel doğrulanmış alanlar
  message         TEXT CHECK (message IS NULL OR char_length(message) <= 2000),
  consent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_version TEXT NOT NULL DEFAULT '2026-09',
  ip_hash         TEXT,                                          -- SHA-256(gizli tuz + ip); ham IP saklanmaz
  user_agent      TEXT,
  source_path     TEXT,
  admin_note      TEXT,
  handled_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_requests_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

COMMENT ON TABLE public.service_requests IS
  'Ödeme alınmadan toplanan talepler (tohum / arazime ekim / açık arazi). Yazma yalnız service_role.';

CREATE INDEX IF NOT EXISTS idx_service_requests_status_created ON public.service_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_type           ON public.service_requests (type);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at     ON public.service_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id        ON public.service_requests (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_requests_ip_hash        ON public.service_requests (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_requests_email          ON public.service_requests (lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Varsayılan yetkileri geri al; sahibe yalnız güvenli sütunlarda SELECT ver.
REVOKE ALL ON TABLE public.service_requests FROM anon, authenticated;
GRANT SELECT (
  id, request_no, type, status, user_id, contact_name, email, phone, company, locale,
  land_id, total_seeds, seed_items, details, message, consent_at, created_at, updated_at
) ON public.service_requests TO authenticated;

-- Kullanıcı yalnız kendi (user_id bağlı) taleplerini görür; anon hiçbir şey göremez.
-- INSERT/UPDATE/DELETE için istemci policy'si bilinçli olarak YOK — service_role RLS'i atlar.
DROP POLICY IF EXISTS "Users can view own requests" ON public.service_requests;
CREATE POLICY "Users can view own requests"
  ON public.service_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_service_requests_updated_at ON public.service_requests;
CREATE TRIGGER trg_service_requests_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. email_logs (004'ten; canlıda eksikti) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  template        TEXT NOT NULL,
  subject         TEXT NOT NULL,
  related_id      TEXT,
  status          TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  resend_id       TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_related_id ON public.email_logs (related_id) WHERE related_id IS NOT NULL;

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_logs FROM anon, authenticated;
-- Policy yok: yalnız service_role okur/yazar.

-- ── 3. auth.users → public.profiles ────────────────────────────────────────
-- Kayıt anında profil satırı sunucu tarafında açılır; e-posta doğrulama açık
-- olsa da (oturum yokken) çalışır. Hata olursa kayıt akışını KESMEZ.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'contact_person', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[handle_new_user] profil oluşturulamadı (%): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Mevcut (profili olmayan) kullanıcılar için geriye dönük doldurma
INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, u.email,
       NULLIF(trim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'contact_person', '')), '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
