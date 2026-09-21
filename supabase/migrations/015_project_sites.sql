-- ═══════════════════════════════════════════════════════════════════════════
-- 015 — Proje Uygulama Sahaları
-- ═══════════════════════════════════════════════════════════════════════════
-- `lands` tablosu yeni satış modelinin "Proje Uygulama Sahası" kaydıdır.
-- Bu migration yalnız EKLEME yapar (mevcut sütun ve veriler korunur):
--   • vitrin alanları: slug, il/ilçe, hektar, yangın bilgisi, çalışma türü,
--     bırakılan türler, çok dilli ad/özet, görseller, video, sıra
--   • kapasite sayılarını herkese açık okumadan çıkaran sütun bazlı yetki
--     (sahalarda hektar gösterilir, bırakılacak tohum topu sayısı gösterilmez)
--   • yayında olan üç "… Demo Sahası" kaydının adından "Demo" kalkar
-- Geri alma: eklenen sütunlar DROP COLUMN ile, yetkiler GRANT SELECT ON lands ile.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Sütunlar ────────────────────────────────────────────────────────────
ALTER TABLE public.lands
  ADD COLUMN IF NOT EXISTS slug             text,
  ADD COLUMN IF NOT EXISTS province         text,
  ADD COLUMN IF NOT EXISTS district         text,
  ADD COLUMN IF NOT EXISTS area_hectares    numeric(9,2),
  ADD COLUMN IF NOT EXISTS is_fire_affected boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fire_year        smallint,
  ADD COLUMN IF NOT EXISTS work_type        text     NOT NULL DEFAULT 'ormanlastirma_genclestirme',
  ADD COLUMN IF NOT EXISTS species_slugs    text[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS name_i18n        jsonb    NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS summary_i18n     jsonb    NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_image      text,
  ADD COLUMN IF NOT EXISTS gallery          text[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_url        text,
  ADD COLUMN IF NOT EXISTS sort_order       integer  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lands_area_hectares_check') THEN
    ALTER TABLE public.lands ADD CONSTRAINT lands_area_hectares_check
      CHECK (area_hectares IS NULL OR (area_hectares > 0 AND area_hectares < 1000000));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lands_fire_year_check') THEN
    ALTER TABLE public.lands ADD CONSTRAINT lands_fire_year_check
      CHECK (fire_year IS NULL OR (fire_year BETWEEN 1980 AND 2100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lands_work_type_check') THEN
    ALTER TABLE public.lands ADD CONSTRAINT lands_work_type_check
      CHECK (work_type IN ('ormanlastirma', 'genclestirme', 'ormanlastirma_genclestirme'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lands_slug_format_check') THEN
    ALTER TABLE public.lands ADD CONSTRAINT lands_slug_format_check
      CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lands_i18n_object_check') THEN
    ALTER TABLE public.lands ADD CONSTRAINT lands_i18n_object_check
      CHECK (jsonb_typeof(name_i18n) = 'object' AND jsonb_typeof(summary_i18n) = 'object');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lands_video_url_check') THEN
    ALTER TABLE public.lands ADD CONSTRAINT lands_video_url_check
      CHECK (video_url IS NULL OR video_url ~ '^https://');
  END IF;
END $$;

-- ── 2. Yayındaki demo kayıtları: ad ve işaretler ───────────────────────────
-- Gerçek saha verileri (ad, ilçe, hektar, yangın yılı, tür) müşteriden gelince
-- yönetim panelinden girilecek; burada yalnız "Demo" sözcüğü kaldırılır.
UPDATE public.lands
   SET name = replace(name, ' Demo Sahası', ' Proje Uygulama Sahası'),
       is_fire_affected = true
 WHERE name LIKE '% Demo Sahası';

UPDATE public.lands SET province = region WHERE province IS NULL AND region IS NOT NULL;

-- ── 3. Slug üretimi (Türkçe karakterler sadeleştirilir) ────────────────────
UPDATE public.lands
   SET slug = trim(both '-' from regexp_replace(
         lower(translate(name, 'ÇĞİIÖŞÜçğıöşüÂâÎîÛû', 'CGIIOSUcgiosuAaIiUu')),
         '[^a-z0-9]+', '-', 'g'))
 WHERE slug IS NULL;

-- Çakışan slug kalırsa kimliğin ilk 6 hanesiyle ayrıştır.
WITH d AS (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
  FROM public.lands WHERE slug IS NOT NULL
)
UPDATE public.lands l SET slug = l.slug || '-' || left(l.id::text, 6)
FROM d WHERE d.id = l.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS lands_slug_key ON public.lands (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS lands_public_listing_idx ON public.lands (is_public, status, sort_order);

-- updated_at tetikleyicisi (fonksiyon 003a'da tanımlı)
DROP TRIGGER IF EXISTS lands_set_updated_at ON public.lands;
CREATE TRIGGER lands_set_updated_at
  BEFORE UPDATE ON public.lands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 4. Yetkiler: kapasite sayıları herkese açık okumadan çıkar ─────────────
-- "Public read access on lands" politikası satırları açıyor; sütunları ise
-- tablo yetkisi belirler. capacity/filled/reserved/sold sütunları anon ve
-- authenticated rollerine KAPATILIR. Yönetim paneli ve sunucu tarafı service
-- role kullandığı için etkilenmez. (Tarayıcıdan lands okuyan eski /lands ve
-- /bireysel/satin-al/arazi sayfaları askıda ve emekliye ayrılıyor.)
REVOKE ALL ON public.lands FROM anon, authenticated;
GRANT SELECT (
  id, slug, name, region, province, district, area_hectares, is_fire_affected,
  fire_year, work_type, species_slugs, name_i18n, summary_i18n, cover_image,
  gallery, video_url, status, is_public, is_corporate, lat, lng, sort_order,
  created_at, updated_at
) ON public.lands TO anon, authenticated;

COMMENT ON COLUMN public.lands.area_hectares IS 'Vitrinde gösterilen alan (hektar). Bırakılacak tohum topu sayısı vitrinde gösterilmez.';
COMMENT ON COLUMN public.lands.species_slugs IS 'Sahaya bırakılan tür(ler) — seed_catalog.slug. Müşteri seçmez, bilgi olarak gösterilir.';
COMMENT ON COLUMN public.lands.work_type IS 'ormanlastirma | genclestirme | ormanlastirma_genclestirme';
