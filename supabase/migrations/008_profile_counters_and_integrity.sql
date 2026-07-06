-- ═══════════════════════════════════════════════════════════════════════════════
-- 008: Profile Counters & Data Integrity
--
-- Profil tablosuna tohum ve karbon sayaçları ekler.
-- Bu sayaçlar ödeme onaylandığında otomatik güncellenir (post-payment chain).
-- Dashboard'lar hızlı erişim için bu değerleri kullanabilir.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. profiles tablosuna sayaç kolonları ────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS total_seeds       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carbon_offset_kg  numeric(12,3) DEFAULT 0;

COMMENT ON COLUMN profiles.total_seeds      IS 'Kullanıcının satın aldığı toplam tohum sayısı (ödeme onaylı)';
COMMENT ON COLUMN profiles.carbon_offset_kg IS 'Tahmini toplam karbon nötrleme (kg). Hesaplama: tohum × 0.025';

-- ── 2. Mevcut verileri retroaktif senkronize et ─────────────────────────────
-- Ödeme onaylanmış (paid/confirmed+) tüm siparişlerin tohumlarını topla
UPDATE profiles p
SET
  total_seeds = sub.total,
  carbon_offset_kg = ROUND(sub.total * 0.025, 3)
FROM (
  SELECT
    user_id,
    COALESCE(SUM(total_seeds), 0)::integer AS total
  FROM orders
  WHERE user_id IS NOT NULL
    AND (
      payment_status = 'paid'
      OR status IN ('confirmed', 'preparing', 'shipped', 'delivered', 'planted')
    )
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id;

-- ── 3. order_allocations tablosuna index (drone kuyruğu hızı) ──────────────
CREATE INDEX IF NOT EXISTS idx_order_allocations_status
  ON order_allocations(status);

CREATE INDEX IF NOT EXISTS idx_order_allocations_order_id_status
  ON order_allocations(order_id, status);

-- ── 4. certificates tablosuna order_id UNIQUE constraint (idempotent upsert)
-- Not: Eğer zaten varsa hata vermez (IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'certificates_order_id_key'
  ) THEN
    ALTER TABLE certificates ADD CONSTRAINT certificates_order_id_key UNIQUE (order_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'certificates_order_id_key constraint already exists or error: %', SQLERRM;
END $$;

-- ── 5. Yardımcı fonksiyon: Profil sayaçlarını sipariş verilerinden senkronize et
CREATE OR REPLACE FUNCTION sync_profile_counters(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_total integer;
BEGIN
  SELECT COALESCE(SUM(total_seeds), 0)::integer INTO v_total
  FROM orders
  WHERE user_id = p_user_id
    AND (
      payment_status = 'paid'
      OR status IN ('confirmed', 'preparing', 'shipped', 'delivered', 'planted')
    );

  UPDATE profiles
  SET
    total_seeds = v_total,
    carbon_offset_kg = ROUND(v_total * 0.025, 3),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
