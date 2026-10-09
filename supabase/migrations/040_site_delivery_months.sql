-- Saha başına Katılım Sertifikası ve izleme içeriği teslim ayı (1–12).
-- Sipariş belgesinde kesin son tarih: bırakma son tarihinden sonraki ilk bu ayın son günü (lib/orders/schedule.ts).
-- Yalnız ekleme; eski kod bu kolonları okumaz. Ayları boş sahada yeni kod sipariş açmaz.
-- No transaction control here: apply the entire file in one recorded transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.lands
  ADD COLUMN certificate_month smallint CHECK (certificate_month BETWEEN 1 AND 12),
  ADD COLUMN monitoring_month smallint CHECK (monitoring_month BETWEEN 1 AND 12);
COMMENT ON COLUMN public.lands.certificate_month IS 'Katılım Sertifikası teslim ayı (1–12); sözleşmede o ayın son günü kesin son tarih';
COMMENT ON COLUMN public.lands.monitoring_month IS 'İzleme içeriği teslim ayı (1–12); sözleşmede o ayın son günü kesin son tarih';
