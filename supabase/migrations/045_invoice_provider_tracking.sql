-- Paraşüt ile otomatik fatura (045). order_invoices satırına sağlayıcı takibi eklenir; veri değişmez.
--  • external_id: Paraşüt satış faturası kimliği (resmîleştirmeden ÖNCE yazılır: yeniden denemede ikinci fatura açılmaz).
--  • document_type: e_archive | e_invoice — resmîleştirme isteği gönderildiyse dolu (ikinci kez gönderilmez).
--  • job_id: Paraşüt resmîleştirme işinin kimliği (15 dk geçerli; süresi geçerse faturanın e-belgesine bakılır).
--  • attempts / last_attempt_at: deneme sayısı (sınırı aşan satır yönetimde "başarısız" olur, elle yeniden denenir).
-- Aynı siparişte birden fazla açık (bekleyen ya da kesilmiş) satış faturası olamaz; aynı Paraşüt faturası iki satıra bağlanamaz.
-- No transaction control here: apply the entire file in one recorded transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.order_invoices
  ADD COLUMN external_id text CHECK (external_id IS NULL OR length(external_id) BETWEEN 1 AND 64),
  ADD COLUMN document_type text CHECK (document_type IS NULL OR document_type IN ('e_archive', 'e_invoice')),
  ADD COLUMN job_id text CHECK (job_id IS NULL OR length(job_id) BETWEEN 1 AND 128),
  ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  ADD COLUMN last_attempt_at timestamptz;

CREATE UNIQUE INDEX order_invoices_one_open_sale
  ON public.order_invoices (order_id) WHERE kind = 'sale' AND status IN ('pending', 'issued');
CREATE UNIQUE INDEX order_invoices_provider_external
  ON public.order_invoices (provider, external_id) WHERE external_id IS NOT NULL;

COMMENT ON COLUMN public.order_invoices.external_id IS 'Sağlayıcıdaki fatura kimliği (Paraşüt sales_invoice id)';
COMMENT ON COLUMN public.order_invoices.document_type IS 'e_archive | e_invoice — resmîleştirme gönderildiyse';
