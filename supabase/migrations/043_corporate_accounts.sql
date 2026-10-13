-- Kurumsal hesap başvurusu ve yönetici onayı.
--  • corporate_accounts: kurumun başvuru bilgileri ve durumu (pending | approved | rejected). Satırı yalnız sunucu
--    (service role) yazar; kullanıcı yalnız kendi satırını okur. Onay/ret yalnız yönetimden (corporate.review izni).
--  • corporate_quotes: teklif yalnız ONAYLI kurumsal hesaptan eklenebilir (031 politikası sıkılaştırılır).
--  • Onay/ret izni corporate.review 042'de eklenir; bu göç 042'den sonra uygulanır.
-- Yalnız ekleme ve politika sıkılaştırma; veri silinmez. Mevcut teklifler etkilenmez.
-- No transaction control here: apply the entire file in one recorded transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.corporate_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_title text NOT NULL CHECK (length(btrim(company_title)) BETWEEN 2 AND 200),
  tax_id text NOT NULL CHECK (tax_id ~ '^[0-9]{10,11}$'),
  tax_office text NOT NULL CHECK (length(btrim(tax_office)) BETWEEN 2 AND 80),
  address text NOT NULL CHECK (length(btrim(address)) BETWEEN 10 AND 400),
  authorized_person text NOT NULL CHECK (length(btrim(authorized_person)) BETWEEN 2 AND 120),
  contact_email text NOT NULL CHECK (length(contact_email) BETWEEN 3 AND 200),
  phone text NOT NULL CHECK (length(phone) BETWEEN 7 AND 40),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note text CHECK (review_note IS NULL OR length(review_note) <= 1000),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT corporate_accounts_review_complete CHECK (status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX corporate_accounts_status_idx ON public.corporate_accounts (status, created_at DESC);
COMMENT ON TABLE public.corporate_accounts IS 'Kurumsal hesap başvurusu; yalnız approved hesap kurumsal panelde teklif ekleyebilir';

ALTER TABLE public.corporate_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.corporate_accounts FROM anon, authenticated;
GRANT SELECT ON public.corporate_accounts TO authenticated;
CREATE POLICY "Read own corporate account" ON public.corporate_accounts
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Insert own pending quote" ON public.corporate_quotes;
CREATE POLICY "Insert own pending quote" ON public.corporate_quotes
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND status = 'PENDING'
    AND EXISTS (SELECT 1 FROM public.corporate_accounts ca WHERE ca.user_id = auth.uid() AND ca.status = 'approved')
  );
