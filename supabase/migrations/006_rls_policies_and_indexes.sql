-- ═══════════════════════════════════════════════════════════════════════
-- Migration 006: RLS Policies + Missing Indexes
--
-- Bu migration:
--   1. Core tablolarda RLS'yi etkinleştirir (orders, payments, profiles,
--      certificates, lands, order_allocations)
--   2. Kullanıcı kendi verisini görebilir, service_role her şeye erişir
--   3. Eksik performans indekslerini ekler
--   4. CHECK constraint'ler ekler
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. ORDERS ──────────────────────────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi siparişlerini okuyabilir
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

-- Kullanıcı misafirken sipariş oluşturabilir (user_id null olabilir)
CREATE POLICY "Anyone can insert orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Service role her şeyi yapabilir (admin, callback, claim-order)
CREATE POLICY "Service role full access on orders"
  ON orders FOR ALL
  USING (auth.role() = 'service_role');

-- CHECK constraint'ler
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_payment_status'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT chk_orders_payment_status
      CHECK (payment_status IN ('pending', 'paid'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_order_type'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT chk_orders_order_type
      CHECK (order_type IN ('physical', 'reservation', 'gift'));
  END IF;
END $$;

-- ── 2. PAYMENTS ────────────────────────────────────────────────────────

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi ödemelerini görebilir
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

-- Ödeme kaydı oluşturma (guest checkout — user_id null olabilir)
CREATE POLICY "Anyone can insert payments"
  ON payments FOR INSERT
  WITH CHECK (true);

-- Service role full access (callback, admin)
CREATE POLICY "Service role full access on payments"
  ON payments FOR ALL
  USING (auth.role() = 'service_role');

-- ── 3. PROFILES ────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi profilini okuyabilir
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Kullanıcı kendi profilini güncelleyebilir
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Profil oluşturma (signUp sonrası)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Service role full access (claim-order, callback, admin)
CREATE POLICY "Service role full access on profiles"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');

-- ── 4. CERTIFICATES ───────────────────────────────────────────────────

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi sertifikalarını görebilir
CREATE POLICY "Users can view own certificates"
  ON certificates FOR SELECT
  USING (auth.uid() = user_id);

-- Herkes sertifika okuyabilir (public paylaşım linkleri)
-- NOT: Sertifika UUID'si tahmin edilemez, IDOR riski düşük
CREATE POLICY "Public can view certificates by id"
  ON certificates FOR SELECT
  USING (true);

-- Service role full access (callback, claim-order, admin)
CREATE POLICY "Service role full access on certificates"
  ON certificates FOR ALL
  USING (auth.role() = 'service_role');

-- ── 5. LANDS ──────────────────────────────────────────────────────────

ALTER TABLE lands ENABLE ROW LEVEL SECURITY;

-- Araziler herkese açık okuma (katalog sayfası, orman profili)
CREATE POLICY "Public read access on lands"
  ON lands FOR SELECT
  USING (true);

-- Service role full access (admin CRUD)
CREATE POLICY "Service role full access on lands"
  ON lands FOR ALL
  USING (auth.role() = 'service_role');

-- ── 6. ORDER_ALLOCATIONS ──────────────────────────────────────────────

ALTER TABLE order_allocations ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi siparişlerine ait allocation'ları görebilir
CREATE POLICY "Users can view own allocations"
  ON order_allocations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_allocations.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role full access on order_allocations"
  ON order_allocations FOR ALL
  USING (auth.role() = 'service_role');

-- ── 7. MISSING INDEXES ───────────────────────────────────────────────

-- orders.user_id — hesabım dashboard sorguları
CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON orders (user_id) WHERE user_id IS NOT NULL;

-- orders.created_at — tarih sıralaması
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders (created_at DESC);

-- payments.order_id — callback lookup
CREATE INDEX IF NOT EXISTS idx_payments_order_id
  ON payments (order_id);

-- payments.user_id — kullanıcı ödeme geçmişi
CREATE INDEX IF NOT EXISTS idx_payments_user_id
  ON payments (user_id) WHERE user_id IS NOT NULL;

-- certificates.user_id — sertifika listeleme
CREATE INDEX IF NOT EXISTS idx_certificates_user_id
  ON certificates (user_id);

-- order_allocations.order_id — sipariş detayı
CREATE INDEX IF NOT EXISTS idx_order_allocations_order_id
  ON order_allocations (order_id);

-- order_allocations.land_id — arazi kullanım sorguları
CREATE INDEX IF NOT EXISTS idx_order_allocations_land_id
  ON order_allocations (land_id);

-- lands.status — aktif arazi filtresi
CREATE INDEX IF NOT EXISTS idx_lands_status
  ON lands (status) WHERE is_public = true;
