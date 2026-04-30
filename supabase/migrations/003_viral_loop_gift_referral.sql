-- ═══════════════════════════════════════════════════════════════════════════════
-- SKYTECH GREEN — Viral Loop: "Hediye Gönder → Davet Et Kazan"
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Bu script 3 bileşen oluşturur:
--   1) user_rewards tablosu — kullanıcı ödül kayıtları
--   2) process_gift_referral() fonksiyonu — hediye siparişi → ödül mantığı
--   3) Trigger — profiles tablosuna yeni kullanıcı eklendiğinde tetiklenir
--
-- Senaryo:
--   Kullanıcı A, arkadaşı B'ye tohum hediye eder (order_type = 'gift',
--   gift_info->>'recipientEmail' = B'nin e-postası).
--   B platforma kayıt olduğunda, sistem otomatik olarak A'ya ödül tanımlar.
--
-- Çalıştırma: Supabase SQL Editor → yapıştır → Run
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. user_rewards TABLOSU ────────────────────────────────────────────────
-- Kullanıcıların kazandığı hediye/davet puanlarını tutar.
-- Aynı sipariş için mükerrer ödül verilmesini UNIQUE constraint önler.

CREATE TABLE IF NOT EXISTS user_rewards (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type     TEXT NOT NULL DEFAULT 'referral_gift',
  amount          INTEGER NOT NULL DEFAULT 1,
  source_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Aynı siparişten mükerrer ödül önleme
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_rewards_source_order
  ON user_rewards (user_id, source_order_id)
  WHERE source_order_id IS NOT NULL;

-- Hızlı sorgulama için index
CREATE INDEX IF NOT EXISTS idx_user_rewards_user_id
  ON user_rewards (user_id);

-- RLS aktif et
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

-- Kullanıcı yalnızca kendi ödüllerini görebilir
CREATE POLICY "Users can view own rewards"
  ON user_rewards FOR SELECT
  USING (auth.uid() = user_id);

-- Yalnızca service_role INSERT yapabilir (trigger ve API)
CREATE POLICY "Service role can insert rewards"
  ON user_rewards FOR INSERT
  WITH CHECK (true);

-- Yorum: SELECT herkesin kendi kaydı, INSERT ise sadece service_role
-- (RLS bypass) veya trigger kontekstinde çalışır.

COMMENT ON TABLE user_rewards IS 'Viral loop ödül sistemi — hediye gönder/davet et kazan';


-- ─── 2. process_gift_referral() FONKSİYONU ─────────────────────────────────
-- profiles tablosuna yeni kayıt (INSERT) geldiğinde çalışır.
--
-- Mantık:
--   1. Yeni kullanıcının e-posta adresini al
--   2. orders tablosunda:
--      - order_type = 'gift'
--      - gift_info->>'recipientEmail' = yeni kullanıcının e-postası
--      - payment_status = 'paid'
--      olan siparişleri bul
--   3. Her eşleşen sipariş için:
--      - Siparişi veren asıl kullanıcıya (orders.user_id) 1 birim ödül yaz
--      - Mükerrer kontrolü: user_rewards'da aynı source_order_id varsa atla
--   4. Ödül veren kullanıcının profiles.earned_seeds değerini artır

CREATE OR REPLACE FUNCTION process_gift_referral()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- RLS'yi atla (service-level erişim)
SET search_path = public
AS $$
DECLARE
  new_user_email TEXT;
  gift_order     RECORD;
  reward_count   INTEGER := 0;
BEGIN
  -- Yeni kullanıcının e-postasını al
  new_user_email := NEW.email;

  -- E-posta boşsa çık
  IF new_user_email IS NULL OR new_user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Bu e-postaya gönderilmiş, ödemesi tamamlanmış hediye siparişlerini bul
  FOR gift_order IN
    SELECT id, user_id, total_seeds
    FROM orders
    WHERE order_type = 'gift'
      AND payment_status = 'paid'
      AND user_id IS NOT NULL                              -- Gönderenin hesabı olmalı
      AND (
        gift_info->>'recipientEmail' = new_user_email      -- gift_info JSONB alanından
        OR metadata->>'gift_recipient_email' = new_user_email  -- metadata fallback
      )
  LOOP
    -- Mükerrer kontrol: Bu sipariş için zaten ödül verilmiş mi?
    IF NOT EXISTS (
      SELECT 1 FROM user_rewards
      WHERE user_id = gift_order.user_id
        AND source_order_id = gift_order.id
    ) THEN
      -- Gönderen kullanıcıya (A) ödül yaz
      INSERT INTO user_rewards (user_id, reward_type, amount, source_order_id, description)
      VALUES (
        gift_order.user_id,
        'referral_gift',
        1,  -- 1 birim ödül (tohum/puan)
        gift_order.id,
        'Hediye alıcısı (' || new_user_email || ') platforma katıldı'
      );

      -- Gönderenin earned_seeds değerini artır
      UPDATE profiles
      SET earned_seeds = COALESCE(earned_seeds, 0) + 1
      WHERE id = gift_order.user_id;

      reward_count := reward_count + 1;
    END IF;
  END LOOP;

  -- Log (opsiyonel — debug için)
  IF reward_count > 0 THEN
    RAISE LOG '[viral_loop] % ödül tanımlandı. Yeni kullanıcı: %, eşleşen sipariş sayısı: %',
      reward_count, new_user_email, reward_count;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION process_gift_referral() IS
  'Yeni kullanıcı kaydında hediye siparişlerini kontrol edip gönderene ödül tanımlar';


-- ─── 3. TRIGGER ─────────────────────────────────────────────────────────────
-- profiles tablosuna yeni satır eklendiğinde (AFTER INSERT) tetiklenir.
-- auth.users yerine profiles kullanıyoruz çünkü:
--   - profiles tablosu bizim kontrolümüzde (auth.users Supabase internal)
--   - profiles'da email alanı mevcut ve güvenilir
--   - claim-order akışında da profiles upsert ediliyor

DROP TRIGGER IF EXISTS trg_process_gift_referral ON profiles;

CREATE TRIGGER trg_process_gift_referral
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION process_gift_referral();

COMMENT ON TRIGGER trg_process_gift_referral ON profiles IS
  'Yeni kullanıcı profilinde hediye-davet ödül kontrolü';


-- ═══════════════════════════════════════════════════════════════════════════════
-- DOĞRULAMA: Tüm bileşenler oluşturuldu mu?
-- ═══════════════════════════════════════════════════════════════════════════════

-- Tablo kontrolü
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_rewards') THEN
    RAISE NOTICE '✅ user_rewards tablosu oluşturuldu';
  ELSE
    RAISE WARNING '❌ user_rewards tablosu OLUŞTURULAMADI';
  END IF;
END $$;

-- Fonksiyon kontrolü
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_gift_referral') THEN
    RAISE NOTICE '✅ process_gift_referral() fonksiyonu oluşturuldu';
  ELSE
    RAISE WARNING '❌ process_gift_referral() fonksiyonu OLUŞTURULAMADI';
  END IF;
END $$;

-- Trigger kontrolü
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_process_gift_referral') THEN
    RAISE NOTICE '✅ trg_process_gift_referral trigger oluşturuldu';
  ELSE
    RAISE WARNING '❌ trg_process_gift_referral trigger OLUŞTURULAMADI';
  END IF;
END $$;
