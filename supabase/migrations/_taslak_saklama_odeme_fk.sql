-- TASLAK — UYGULANMAZ. Dosya adı bilerek numarasızdır: Supabase CLI ve kayıtlı uygulama betiği yalnız
-- "<numara>_ad.sql" dosyalarını alır; migration-transaction-control testi de bu dosyayı kapsam dışı bırakır.
-- Uygulama kararı: şirket yetkilisi + mali müşavir (kanuni arşiv kapsamı) + teknik sorumlu. Kayıt: outputs/claude-saklama-imha.
--
-- Sorun (canlı şema kopyası skytech-prova-dalga2 üzerinde 12 Ekim 2026'da ROLLBACK içinde sınandı):
--   payments.user_id → auth.users ON DELETE CASCADE
--   payments.order_id → orders     ON DELETE CASCADE
-- Bir üye Supabase panelinden/Auth API'sinden silindiğinde, ona bağlı ÖDEME satırları da kendiliğinden silinir;
-- eski (legacy) `orders` satırı ise kalır. Böylece muhasebe kaydının ödeme kısmı "kullanıcıyı sil" ile kaybolur.
-- Yeni satış modeli (release_orders ve çocukları) bu riskten etkilenmez: user_id SET NULL, silme tetikleyiciyle yasak,
-- belge/olay/fatura RESTRICT. B2B ödeme satırına bağlı b2b_* kayıtları varsa silme FK hatasıyla durur (veri kaybı yok).
--
-- Öneri: kişi bağı kopsun, ödeme kaydı kalsın (kanuni arşiv). Eski sipariş silinirse ödeme kaydı sessizce gitmesin.
-- Not: eski siparişlerin bilinçli temizliği (ör. deneme verisi) bundan sonra önce ödeme satırını açıkça ele almalıdır.
-- Bu dosya dosya düzeyinde BEGIN/COMMIT taşımaz; tek işlemi uygulayan araç kurar.

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;
