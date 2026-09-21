-- ═══════════════════════════════════════════════════════════════════════════
-- 016 — Tohum topu bıraktırma siparişleri (yeni satış modeli)
-- ═══════════════════════════════════════════════════════════════════════════
-- TASLAK: canlı veritabanına yalnız onayla uygulanır.
--
-- Eski sipariş alanı (orders, order_allocations, payments, certificates) doğrudan
-- tohum satıyordu, tutarı istemciden alıyordu; onay kaydı, sözleşme ve iade
-- yoktu. Yeni model o tablolara DOKUNMAZ, temiz bir alan kurar:
--
--   sales_settings     fiyat, adet sınırları, KDV, fatura zamanı, hazırlık payı (tek satır)
--   release_batches    saha + sezon bazlı bırakma partisi (tarih, video, izleme raporu)
--   release_orders     sipariş: alıcı, fatura, saha anlık görüntüsü, tutar (KURUŞ), onaylar,
--                      ödeme, cayma/ifa tarihleri, sertifika
--   order_documents    siparişe özel üretilen hukuki metinlerin DEĞİŞMEZ kopyası + SHA-256
--   order_events       denetim izi (eklenir, değişmez)
--   order_refunds      iadeler
--   order_invoices     faturalar ('manual' ya da entegratör)
--
-- Güvenlik kalıbı (014 ile aynı): RLS açık; anon/authenticated için tablo yetkisi
-- KAPALI; üye yalnız kendi siparişini, yalnız izin verilen SÜTUNLARLA okur. Yazma
-- yalnız service_role (API). Kapasite ayırma satır kilidiyle tek fonksiyonda.
--
-- Geri alma: en alttaki "GERİ ALMA" bölümü.
-- Not: sipariş, belge ve olay satırları tetikleyiciyle silinmeye karşı korunur. Açılış
-- öncesi deneme kayıtlarını temizlemek gerekirse bunu yalnız veritabanı sahibi, ilgili
-- tetikleyicileri geçici olarak devre dışı bırakarak yapabilir (bilinçli bir sürtünme).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Türler ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'release_order_status') THEN
    CREATE TYPE public.release_order_status AS ENUM (
      'draft', 'awaiting_payment', 'payment_failed', 'expired',
      'paid', 'confirmed', 'scheduled', 'released', 'monitoring', 'completed',
      'withdrawal_requested', 'cancelled_by_seller', 'refunded'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'release_buyer_type') THEN
    CREATE TYPE public.release_buyer_type AS ENUM ('individual', 'corporate');
  END IF;
END $$;

-- ── 1. Satış ayarları (tek satır) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_settings (
  id                boolean PRIMARY KEY DEFAULT true CHECK (id),      -- tek satır garantisi
  unit_price_kurus  integer  NOT NULL DEFAULT 1000  CHECK (unit_price_kurus > 0),          -- 10,00 TL, KDV dâhil
  min_quantity      integer  NOT NULL DEFAULT 20    CHECK (min_quantity >= 1),
  max_quantity      integer  NOT NULL DEFAULT 100000 CHECK (max_quantity >= min_quantity),
  quantity_presets  integer[] NOT NULL DEFAULT '{50,100,200,500,5000}',
  vat_rate          numeric(5,2) NOT NULL DEFAULT 20.00 CHECK (vat_rate >= 0 AND vat_rate < 100), -- [MM] teyit bekliyor
  invoice_timing    text     NOT NULL DEFAULT 'on_performance'
                    CHECK (invoice_timing IN ('on_payment', 'on_performance')),             -- [MM] teyit bekliyor
  prep_days         integer  NOT NULL DEFAULT 21    CHECK (prep_days BETWEEN 15 AND 120),   -- cayma (14) + hazırlık
  payment_ttl_minutes integer NOT NULL DEFAULT 45   CHECK (payment_ttl_minutes BETWEEN 10 AND 1440),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid
);
INSERT INTO public.sales_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ── 2. Bırakma partileri ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.release_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  land_id         uuid NOT NULL REFERENCES public.lands(id) ON DELETE RESTRICT,
  season_label    text NOT NULL CHECK (season_label ~ '^[0-9]{4}-[0-9]{4}$'),
  title           text,
  planned_on      date,
  released_on     date,
  video_url       text CHECK (video_url IS NULL OR video_url ~ '^https://'),
  video_published_at timestamptz,
  monitoring_report_url text CHECK (monitoring_report_url IS NULL OR monitoring_report_url ~ '^https://'),
  notes           text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS release_batches_land_season_idx ON public.release_batches (land_id, season_label);

-- ── 3. Siparişler ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.release_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no        text NOT NULL UNIQUE CHECK (order_no ~ '^SG-[0-9]{4}-[A-HJKMNP-Z2-9]{6}$'),
  status          public.release_order_status NOT NULL DEFAULT 'draft',
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,   -- misafir siparişinde NULL
  locale          text NOT NULL DEFAULT 'tr' CHECK (locale IN ('tr', 'en', 'ru')),
  client_token    uuid UNIQUE,                                          -- idempotency

  -- saha
  land_id         uuid NOT NULL REFERENCES public.lands(id) ON DELETE RESTRICT,
  site_snapshot   jsonb NOT NULL CHECK (jsonb_typeof(site_snapshot) = 'object'),
  season_label    text NOT NULL CHECK (season_label ~ '^[0-9]{4}-[0-9]{4}$'),
  batch_id        uuid REFERENCES public.release_batches(id) ON DELETE SET NULL,

  -- adet ve tutar — para KURUŞ cinsinden tam sayı; toplam veritabanında da doğrulanır
  quantity          integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  unit_price_kurus  integer NOT NULL CHECK (unit_price_kurus > 0),
  total_kurus       bigint  NOT NULL,
  vat_rate          numeric(5,2) NOT NULL CHECK (vat_rate >= 0 AND vat_rate < 100),
  currency          text NOT NULL DEFAULT 'TRY' CHECK (currency = 'TRY'),
  CONSTRAINT release_orders_total_check CHECK (total_kurus = quantity::bigint * unit_price_kurus),

  -- sertifika
  certificate_name        text NOT NULL CHECK (char_length(certificate_name) BETWEEN 2 AND 60),
  certificate_code        text UNIQUE CHECK (certificate_code IS NULL OR certificate_code ~ '^SG-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$'),
  certificate_issued_at   timestamptz,
  certificate_cancelled_at timestamptz,

  -- alıcı ve fatura
  buyer_type        public.release_buyer_type NOT NULL,
  buyer_first_name  text NOT NULL,
  buyer_last_name   text NOT NULL,
  buyer_email       text NOT NULL,
  buyer_phone       text NOT NULL,
  invoice           jsonb NOT NULL CHECK (jsonb_typeof(invoice) = 'object'),   -- adres, TCKN/VKN, unvan…

  -- onaylar: { preInfo: {granted, at, version}, contract: {…}, kvkkRead: {…}, marketing: {…}, corporateAuthority: {…} }
  consents          jsonb NOT NULL CHECK (jsonb_typeof(consents) = 'object'),
  marketing_consent boolean NOT NULL DEFAULT false,
  iys_synced_at     timestamptz,                                          -- ticari ileti izni İYS'ye işlendi
  documents_version text NOT NULL,
  ip_hash           text,
  user_agent        text,
  source_path       text,

  -- ödeme (kart verisi ASLA saklanmaz; yalnız sağlayıcı kimlikleri)
  payment_provider  text,
  payment_token     text,                                                 -- sağlayıcının oturum belirteci
  payment_id        text,
  payment_meta      jsonb NOT NULL DEFAULT '{}'::jsonb,                   -- 3DS sonucu, BIN, son 4, taksit…
  payment_started_at timestamptz,
  payment_expires_at timestamptz,
  paid_at           timestamptz,

  -- takvim
  withdrawal_deadline  timestamptz,                                       -- cayma hakkının son anı
  performance_deadline date,                                              -- sözleşmedeki kesin son tarih
  confirmed_at      timestamptz,
  scheduled_at      timestamptz,
  released_at       timestamptz,
  completed_at      timestamptz,
  video_notified_at timestamptz,

  -- cayma / iptal / iade
  withdrawal_requested_at timestamptz,
  withdrawal_channel      text CHECK (withdrawal_channel IS NULL OR withdrawal_channel IN ('form', 'account', 'email', 'phone', 'admin')),
  cancelled_at      timestamptz,
  cancel_reason     text,
  refunded_at       timestamptz,

  admin_note        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT release_orders_paid_check
    CHECK (status IN ('draft', 'awaiting_payment', 'payment_failed', 'expired') OR paid_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS release_orders_user_idx      ON public.release_orders (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS release_orders_status_idx    ON public.release_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS release_orders_land_idx      ON public.release_orders (land_id, season_label);
CREATE INDEX IF NOT EXISTS release_orders_batch_idx     ON public.release_orders (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS release_orders_email_idx     ON public.release_orders (lower(buyer_email));
CREATE INDEX IF NOT EXISTS release_orders_expiry_idx    ON public.release_orders (payment_expires_at)
  WHERE status IN ('draft', 'awaiting_payment', 'payment_failed');
CREATE INDEX IF NOT EXISTS release_orders_withdrawal_idx ON public.release_orders (withdrawal_deadline) WHERE status = 'paid';

-- ── 4. Belgeler (değişmez) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES public.release_orders(id) ON DELETE RESTRICT,
  kind             text NOT NULL CHECK (kind IN ('pre_info', 'contract', 'withdrawal_form', 'kvkk_notice')),
  template_version text NOT NULL,
  locale           text NOT NULL CHECK (locale IN ('tr', 'en', 'ru')),
  title            text NOT NULL,
  html             text NOT NULL,
  sha256           text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, kind)
);

-- ── 5. Olaylar (denetim izi; değişmez) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES public.release_orders(id) ON DELETE RESTRICT,
  type        text NOT NULL,
  actor       text NOT NULL CHECK (actor = 'customer' OR actor = 'system' OR actor ~ '^admin:[0-9a-f-]{36}$'),
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON public.order_events (order_id, created_at);

-- ── 6. İadeler ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_refunds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.release_orders(id) ON DELETE RESTRICT,
  amount_kurus  bigint NOT NULL CHECK (amount_kurus > 0),
  reason        text NOT NULL CHECK (reason IN ('withdrawal', 'seller_cancellation', 'non_performance', 'other')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  provider      text,
  provider_ref  text,
  error         text,
  requested_by  text NOT NULL,                       -- 'customer' | 'system' | 'admin:<uuid>'
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS order_refunds_order_idx ON public.order_refunds (order_id);
-- Aynı siparişte aynı anda yalnız bir bekleyen iade olabilir (çift iade koruması).
CREATE UNIQUE INDEX IF NOT EXISTS order_refunds_one_pending_idx ON public.order_refunds (order_id) WHERE status = 'pending';

-- ── 7. Faturalar ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_invoices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.release_orders(id) ON DELETE RESTRICT,
  kind        text NOT NULL DEFAULT 'sale' CHECK (kind IN ('sale', 'refund')),
  provider    text NOT NULL DEFAULT 'manual',
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'cancelled', 'failed')),
  invoice_no  text,
  ettn        text,
  pdf_path    text,                                   -- özel depolama yolu (herkese açık değil)
  issued_at   timestamptz,
  sent_at     timestamptz,
  error       text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_invoices_order_idx ON public.order_invoices (order_id);
CREATE INDEX IF NOT EXISTS order_invoices_queue_idx ON public.order_invoices (status, created_at) WHERE status = 'pending';

-- ── 8. updated_at tetikleyicileri (işlev 001'den beri mevcut) ──────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales_settings', 'release_batches', 'release_orders', 'order_invoices'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_set_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      t || '_set_updated_at', t);
  END LOOP;
END $$;

-- ── 9. Değişmezlik: belgeler ve olaylar güncellenemez, silinemez ───────────
CREATE OR REPLACE FUNCTION public.forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '% tablosundaki kayıtlar değiştirilemez ve silinemez (yasal saklama).', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END $$;

DROP TRIGGER IF EXISTS order_documents_immutable ON public.order_documents;
CREATE TRIGGER order_documents_immutable BEFORE UPDATE OR DELETE ON public.order_documents
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

DROP TRIGGER IF EXISTS order_events_immutable ON public.order_events;
CREATE TRIGGER order_events_immutable BEFORE UPDATE OR DELETE ON public.order_events
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Siparişler de silinemez (10 yıl saklama); durum değişir ama satır kalır.
CREATE OR REPLACE FUNCTION public.forbid_order_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Sipariş kayıtları silinemez (yasal saklama süresi).'
    USING ERRCODE = 'integrity_constraint_violation';
END $$;

DROP TRIGGER IF EXISTS release_orders_no_delete ON public.release_orders;
CREATE TRIGGER release_orders_no_delete BEFORE DELETE ON public.release_orders
  FOR EACH ROW EXECUTE FUNCTION public.forbid_order_delete();

-- ── 10. Kapasite: ayır / geri ver / kesinleştir (satır kilidiyle) ──────────
-- Sahalarda kapasite yalnız iç kullanım içindir; vitrine hiçbir yoldan çıkmaz.
CREATE OR REPLACE FUNCTION public.reserve_release_capacity(p_land_id uuid, p_quantity integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_land public.lands%ROWTYPE;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_land FROM public.lands WHERE id = p_land_id FOR UPDATE;
  IF NOT FOUND OR NOT v_land.is_public OR v_land.status <> 'open' THEN
    RETURN false;
  END IF;
  IF v_land.capacity_seeds - v_land.filled_seeds - v_land.reserved_seeds < p_quantity THEN
    RETURN false;
  END IF;

  UPDATE public.lands SET reserved_seeds = reserved_seeds + p_quantity WHERE id = p_land_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.release_reserved_capacity(p_land_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.lands
     SET reserved_seeds = GREATEST(reserved_seeds - p_quantity, 0)
   WHERE id = p_land_id;
END $$;

-- Bırakma yapıldığında: ayrılan adet "bırakılan"a geçer.
CREATE OR REPLACE FUNCTION public.commit_reserved_capacity(p_land_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.lands
     SET reserved_seeds = GREATEST(reserved_seeds - p_quantity, 0),
         filled_seeds   = filled_seeds + p_quantity
   WHERE id = p_land_id;
END $$;

REVOKE ALL ON FUNCTION public.reserve_release_capacity(uuid, integer)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_reserved_capacity(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_reserved_capacity(uuid, integer)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.forbid_mutation()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.forbid_order_delete()  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_release_capacity(uuid, integer)  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_reserved_capacity(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_reserved_capacity(uuid, integer)  TO service_role;

-- ── 11. RLS ve yetkiler ────────────────────────────────────────────────────
-- Supabase, public şemadaki yeni tablolara anon/authenticated için varsayılan
-- olarak TÜM yetkileri verir; burada açıkça geri alınır.
ALTER TABLE public.sales_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_refunds    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_invoices   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sales_settings, public.release_batches, public.release_orders,
              public.order_documents, public.order_events, public.order_refunds, public.order_invoices
  FROM anon, authenticated;

-- Üye kendi siparişini okur — yalnız aşağıdaki sütunlarla. Dışarıda kalanlar:
-- ip_hash, user_agent, source_path, client_token, payment_token, payment_meta,
-- admin_note, consents (ham kayıt), iys_synced_at.
DROP POLICY IF EXISTS release_orders_select_own ON public.release_orders;
CREATE POLICY release_orders_select_own ON public.release_orders
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- (user_id listede: politika ifadeleri sorguyu çalıştıran kullanıcının sütun yetkisiyle değerlendirilir.)
GRANT SELECT (
  id, user_id, order_no, status, locale, land_id, site_snapshot, season_label, batch_id,
  quantity, unit_price_kurus, total_kurus, vat_rate, currency,
  certificate_name, certificate_code, certificate_issued_at, certificate_cancelled_at,
  buyer_type, buyer_first_name, buyer_last_name, buyer_email, buyer_phone, invoice,
  marketing_consent, documents_version, paid_at, withdrawal_deadline, performance_deadline,
  confirmed_at, scheduled_at, released_at, completed_at, video_notified_at,
  withdrawal_requested_at, cancelled_at, refunded_at, created_at, updated_at
) ON public.release_orders TO authenticated;

-- Üye kendi siparişinin belgelerini okur.
DROP POLICY IF EXISTS order_documents_select_own ON public.order_documents;
CREATE POLICY order_documents_select_own ON public.order_documents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.release_orders o WHERE o.id = order_id AND o.user_id = (SELECT auth.uid())));
GRANT SELECT (id, order_id, kind, template_version, locale, title, html, sha256, created_at)
  ON public.order_documents TO authenticated;

-- Partinin herkese açık olabilecek kısmı (tarih, video) sipariş sahibine görünür.
DROP POLICY IF EXISTS release_batches_select_own ON public.release_batches;
CREATE POLICY release_batches_select_own ON public.release_batches
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.release_orders o WHERE o.batch_id = release_batches.id AND o.user_id = (SELECT auth.uid())));
GRANT SELECT (id, land_id, season_label, planned_on, released_on, video_url, video_published_at)
  ON public.release_batches TO authenticated;

-- order_events, order_refunds, order_invoices, sales_settings: politika YOK → yalnız service_role.

COMMENT ON TABLE public.release_orders  IS 'Tohum topu bıraktırma siparişleri (satış modeli v2). Silinemez; 10 yıl saklanır.';
COMMENT ON TABLE public.order_documents IS 'Siparişe özel üretilen hukuki metinlerin değişmez kopyası (HTML + SHA-256).';
COMMENT ON TABLE public.order_events    IS 'Sipariş denetim izi; yalnız eklenir.';
COMMENT ON COLUMN public.release_orders.total_kurus IS 'KDV dâhil toplam, kuruş. quantity * unit_price_kurus ile eşit olmak zorunda.';

-- ═══════════════════════════════════════════════════════════════════════════
-- GERİ ALMA (yalnız sipariş yokken):
--   DROP TABLE public.order_invoices, public.order_refunds, public.order_events,
--              public.order_documents, public.release_orders, public.release_batches,
--              public.sales_settings;
--   DROP FUNCTION public.reserve_release_capacity(uuid, integer),
--                 public.release_reserved_capacity(uuid, integer),
--                 public.commit_reserved_capacity(uuid, integer),
--                 public.forbid_mutation(), public.forbid_order_delete();
--   DROP TYPE public.release_order_status, public.release_buyer_type;
-- ═══════════════════════════════════════════════════════════════════════════
