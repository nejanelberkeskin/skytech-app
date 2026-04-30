-- ============================================================================
-- Migration 003: Seed Catalog (Dynamic Products) + System Settings
-- ============================================================================

-- ── 1. seed_catalog tablosu ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seed_catalog (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,                       -- "kizilcam", "mese"
  name        TEXT NOT NULL,                              -- "Kızılçam"
  latin_name  TEXT NOT NULL DEFAULT '',                   -- "Pinus brutia"
  emoji       TEXT NOT NULL DEFAULT '🌱',
  color       TEXT NOT NULL DEFAULT 'from-green-600 to-green-800',
  description TEXT NOT NULL DEFAULT '',
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,          -- TL / tohum
  stock       INTEGER NOT NULL DEFAULT 0,                 -- mevcut stok
  max_order_qty INTEGER NOT NULL DEFAULT 500,             -- max sipariş limiti
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Mevcut hardcoded seed verilerini aktar ──────────────────────────────
INSERT INTO seed_catalog (slug, name, latin_name, emoji, color, description, price, stock, max_order_qty, is_active, sort_order)
VALUES
  ('kizilcam', 'Kızılçam', 'Pinus brutia', '🌲', 'from-green-600 to-green-800',
   'Akdeniz iklimine dayanıklı, hızlı büyüyen çam türü.', 12, 10000, 500, true, 1),
  ('mese', 'Meşe', 'Quercus robur', '🌳', 'from-amber-600 to-amber-800',
   'Uzun ömürlü, güçlü kök yapısıyla toprağı koruyan yaprak ağacı.', 18, 8000, 500, true, 2),
  ('sedir', 'Sedir (Toros Sediri)', 'Cedrus libani', '🏔️', 'from-emerald-700 to-teal-800',
   'Anadolu''nun simgesi, yüzyıllarca yaşayan asil ağaç.', 25, 5000, 500, true, 3),
  ('kayin', 'Kayın', 'Fagus orientalis', '🍂', 'from-orange-500 to-red-700',
   'Karadeniz ormanlarının vazgeçilmezi, gölge seven tür.', 15, 7000, 500, true, 4)
ON CONFLICT (slug) DO NOTHING;

-- ── 3. system_settings tablosu (tek satır) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_ttl_minutes  INTEGER NOT NULL DEFAULT 5,
  maintenance_mode         BOOLEAN NOT NULL DEFAULT false,
  overflow_tolerance_pct   INTEGER NOT NULL DEFAULT 10,    -- %10 arazi taşma toleransı
  updated_at               TIMESTAMPTZ DEFAULT now(),
  updated_by               UUID REFERENCES auth.users(id)
);

-- Başlangıç kaydı
INSERT INTO system_settings (reservation_ttl_minutes, maintenance_mode, overflow_tolerance_pct)
SELECT 5, false, 10
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- ── 4. RLS Policies ────────────────────────────────────────────────────────
ALTER TABLE seed_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- seed_catalog: Herkes okuyabilir (public vitrin), sadece service_role yazabilir
CREATE POLICY "seed_catalog_public_read" ON seed_catalog
  FOR SELECT USING (true);

CREATE POLICY "seed_catalog_service_write" ON seed_catalog
  FOR ALL USING (auth.role() = 'service_role');

-- system_settings: Herkes okuyabilir, sadece service_role yazabilir
CREATE POLICY "system_settings_public_read" ON system_settings
  FOR SELECT USING (true);

CREATE POLICY "system_settings_service_write" ON system_settings
  FOR ALL USING (auth.role() = 'service_role');

-- ── 5. updated_at trigger ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seed_catalog_updated_at
  BEFORE UPDATE ON seed_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
