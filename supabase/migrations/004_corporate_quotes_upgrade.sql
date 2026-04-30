-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  004 — Corporate Quotes: B2B Proforma & Quote State Machine       ║
-- ║  PENDING → QUOTED → PAID (admin fiyat onayı + Iyzico ödeme)      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Mevcut corporate_quotes tablosuna yeni kolonlar ekle
-- (teklif-al sayfası zaten bu tabloya insert yapıyor)

-- 1. approved_price: Admin'in belirlediği özel fiyat (kuruş cinsinden TL)
ALTER TABLE corporate_quotes
  ADD COLUMN IF NOT EXISTS approved_price NUMERIC(12,2) DEFAULT NULL;

-- 2. approved_seed_count: Admin'in onayladığı tohum sayısı
ALTER TABLE corporate_quotes
  ADD COLUMN IF NOT EXISTS approved_seed_count INTEGER DEFAULT NULL;

-- 3. admin_note: Admin'in müşteriye yazdığı not
ALTER TABLE corporate_quotes
  ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT NULL;

-- 4. quoted_at: Teklif gönderilme tarihi
ALTER TABLE corporate_quotes
  ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ DEFAULT NULL;

-- 5. quoted_by: Teklifi gönderen admin user_id
ALTER TABLE corporate_quotes
  ADD COLUMN IF NOT EXISTS quoted_by UUID DEFAULT NULL;

-- 6. paid_at: Ödeme tarihi
ALTER TABLE corporate_quotes
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NULL;

-- 7. payment_id: İlişkili ödeme kaydı
ALTER TABLE corporate_quotes
  ADD COLUMN IF NOT EXISTS payment_id UUID DEFAULT NULL;

-- 8. order_id: İlişkili sipariş kaydı
ALTER TABLE corporate_quotes
  ADD COLUMN IF NOT EXISTS order_id UUID DEFAULT NULL;

-- 9. updated_at: Son güncelleme
ALTER TABLE corporate_quotes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Status alanı zaten var ("pending"), enum kontrolü ekle
-- Mevcut status text → check constraint ile PENDING/QUOTED/PAID enum benzeri
DO $$
BEGIN
  -- Önce mevcut "pending" değerlerini büyük harfe çevir
  UPDATE corporate_quotes SET status = UPPER(status) WHERE status = 'pending';

  -- Check constraint ekle (yoksa)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'corporate_quotes_status_check'
  ) THEN
    ALTER TABLE corporate_quotes
      ADD CONSTRAINT corporate_quotes_status_check
      CHECK (status IN ('PENDING', 'QUOTED', 'PAID', 'REJECTED', 'EXPIRED'));
  END IF;
END $$;

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_corporate_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_corporate_quotes_updated_at ON corporate_quotes;
CREATE TRIGGER trg_corporate_quotes_updated_at
  BEFORE UPDATE ON corporate_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_corporate_quotes_updated_at();

-- Index for status filtering (admin panel queries)
CREATE INDEX IF NOT EXISTS idx_corporate_quotes_status ON corporate_quotes(status);
CREATE INDEX IF NOT EXISTS idx_corporate_quotes_user_id ON corporate_quotes(user_id);

-- ── Email Log Table ──────────────────────────────────────────────────
-- Gönderilen e-postaları takip etmek için
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  template TEXT NOT NULL,         -- 'order_confirmation', 'b2b_quote_ready', 'seed_planted'
  subject TEXT NOT NULL,
  related_id TEXT DEFAULT NULL,   -- order_id veya quote_id
  status TEXT DEFAULT 'sent',     -- 'sent', 'failed', 'bounced'
  resend_id TEXT DEFAULT NULL,    -- Resend API response id
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage email_logs"
  ON email_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── RLS for corporate_quotes (service_role her şeyi yapabilir) ──────
-- Kullanıcılar sadece kendi tekliflerini görebilir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own quotes'
  ) THEN
    CREATE POLICY "Users can view own quotes"
      ON corporate_quotes FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
