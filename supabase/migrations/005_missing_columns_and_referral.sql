-- ═══════════════════════════════════════════════════════════════════════════════
-- SKYTECH GREEN — Migration 005: Eksik Kolonlar + Referral Sistemi
-- ═══════════════════════════════════════════════════════════════════════════════
-- Güvenli çalışır: IF NOT EXISTS her yerde kullanıldı.
-- Supabase SQL Editor → yapıştır → Run
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. orders tablosu — eksik kolonlar ─────────────────────────────────────

-- updated_at: callback route'ta yazılıyor ama kolon olmayabilir
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- payment_status: callback'te "paid" yazılıyor
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- order_type: "physical" | "reservation" | "gift"
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'physical';

-- gift_info: hediye ekimi JSONB verisi
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS gift_info JSONB DEFAULT NULL;

-- metadata: siparis_no ve diğer esnek veriler
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- referred_by: davet eden kullanıcı ID
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS referred_by UUID DEFAULT NULL;

-- is_subscription: otonom abonelik
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT false;

-- ─── 2. profiles tablosu — eksik kolonlar ───────────────────────────────────

-- phone: misafir checkout'tan senkronize ediliyor
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL;

-- referral_code: 6 karakterli benzersiz davet kodu
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT DEFAULT NULL;

-- earned_seeds: referraldan kazanılan toplam tohum
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS earned_seeds INTEGER DEFAULT 0;

-- referral_code unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_referral_code
  ON profiles (referral_code)
  WHERE referral_code IS NOT NULL;

-- ─── 3. certificates tablosu — order_id UNIQUE constraint ───────────────────
-- Aynı sipariş için iki kez sertifika oluşmasını önler (upsert onConflict)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'certificates'
      AND indexname = 'uq_certificates_order_id'
  ) THEN
    CREATE UNIQUE INDEX uq_certificates_order_id
      ON certificates (order_id)
      WHERE order_id IS NOT NULL;
    RAISE NOTICE '✅ certificates.order_id UNIQUE index oluşturuldu';
  ELSE
    RAISE NOTICE 'ℹ️ certificates.order_id UNIQUE index zaten mevcut';
  END IF;
END $$;

-- ─── 4. Auto-generated referral_code için PostgreSQL fonksiyonu ─────────────
-- İlk siparişi tamamlanan kullanıcıya otomatik kod üretir.
-- Kod: 6 büyük harf + rakam (ör: "A3K9PX")

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Karıştırılabilecek karakterler çıkarıldı (0,O,1,I)
  code  TEXT := '';
  i     INTEGER;
  attempt INTEGER := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;

    -- Benzersizlik kontrolü
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = code) THEN
      RETURN code;
    END IF;

    attempt := attempt + 1;
    IF attempt > 100 THEN
      -- Çok nadir durum — 7 karaktere çık
      code := code || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION generate_referral_code() IS
  'Benzersiz 6 haneli davet kodu üretir (karıştırılabilir karakterler hariç)';

-- ─── 5. orders tablosu için auto-update trigger ──────────────────────────────

CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- ─── 6. Indexler ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON orders (payment_status);

CREATE INDEX IF NOT EXISTS idx_orders_order_type
  ON orders (order_type);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_email
  ON orders (buyer_email);

CREATE INDEX IF NOT EXISTS idx_orders_referred_by
  ON orders (referred_by)
  WHERE referred_by IS NOT NULL;

-- ─── 7. Doğrulama ───────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 005 tamamlandı';
  RAISE NOTICE '   orders: updated_at, payment_status, order_type, gift_info, metadata, referred_by, is_subscription';
  RAISE NOTICE '   profiles: phone, referral_code, earned_seeds';
  RAISE NOTICE '   certificates: order_id UNIQUE index';
  RAISE NOTICE '   functions: generate_referral_code()';
END $$;
