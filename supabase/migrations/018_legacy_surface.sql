-- 018 — Eski bireysel tohum satışının veritabanı yüzeyi daraltılır; B2B için iki politika sıkılaştırılır.
--
-- Uygulama: kullanıcı onayıyla. Yalnız yetki/politika değişikliği — hiçbir satır silinmez ya da
-- değiştirilmez. Kod tarafı Faz 8'de (eski uçlar silindi, B2B uçları bayrağa bağlandı) zaten hazır;
-- bu dosya, uygulama katmanını atlayıp doğrudan veritabanı API'sine (anon anahtarıyla) gelen
-- istekleri de kapatır.

-- 1. Eski rezervasyon fonksiyonları: kodda çağıranları kalmadı (Faz 8). SECURITY INVOKER oldukları
--    için satır politikaları zaten koruyordu; yine de anon/üye tarafından RPC ile çağrılamasınlar.
--    service_role'ün açık yetkisi (Supabase varsayılanı) yerinde kalır.
REVOKE EXECUTE ON FUNCTION public.reserve_seeds_for_order(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_order_reservation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_order(uuid) FROM PUBLIC, anon, authenticated;

-- 2. certificates: "herkes bütün satırları okuyabilir" (USING true) politikası kaldırılır.
--    "Kendi sertifikasını okuma" ve service_role politikaları kalır. B2B çalışan sertifikaları
--    açılırsa herkese açık gösterim sunucu tarafında, tahmin edilemez bir kodla yapılmalı.
--    (22 Eylül 2026: tabloda 0 satır.)
DROP POLICY IF EXISTS "Public can view certificates by id" ON public.certificates;

-- 3. corporate_quotes: teklif yalnız "bekliyor" durumunda eklenebilir. Önceki politika durum
--    sütununu kısıtlamıyordu; istemci teklifi doğrudan "PAID" olarak ekleyebiliyordu.
--    (Anon eklemeye izin — kayıttan hemen sonra, oturum yokken — B2B formu için korunur.)
DROP POLICY IF EXISTS "Insert quote requires owner" ON public.corporate_quotes;
CREATE POLICY "Insert quote requires owner" ON public.corporate_quotes
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    user_id IS NOT NULL
    AND (auth.uid() IS NULL OR user_id = auth.uid())
    AND upper(coalesce(status, 'pending')) = 'PENDING'
  );
