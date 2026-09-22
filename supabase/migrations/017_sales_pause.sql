-- 017 — Satış ayarları: sipariş alımını durdurma anahtarı
--
-- Yönetim → Satış Ayarları'ndan açılır/kapanır (lib/orders/settings.ts, lib/orders/gate.ts).
-- Açıkken:
--   · yeni sipariş oluşturulmaz, önizleme ve ödeme başlatma "closed" döner;
--   · sipariş sihirbazı talep kipinde açılır (ödeme alınmaz) ve kısa bir açıklama gösterir;
--   · ödenmiş siparişler, iadeler, partiler ve sertifikalar etkilenmez.
--
-- Salt ek sütun: mevcut satır varsayılanla (false) dolar; UPDATE tetikleyicisi çalışmaz, yani
-- updated_at değişmez. Kod bu sütundan önce de sonra da yayına çıkabilir (okuma yoksa false sayılır).
-- Yetki: tablo düzeyindeki REVOKE (016) yeni sütunu da kapsar — yalnız service_role okur/yazar.

ALTER TABLE public.sales_settings
  ADD COLUMN IF NOT EXISTS orders_paused boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sales_settings.orders_paused IS
  'Yönetimden sipariş alımı durduruldu: yeni sipariş ve ödeme alınmaz, sihirbaz talep kipinde açılır.';
