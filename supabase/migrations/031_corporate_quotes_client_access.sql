-- 031 — corporate_quotes İSTEMCİ ERİŞİMİ sıkılaştırması (D1-a). Uygulama adı: corporate_quotes_client_access_031.
-- Araç sürümü: işlem denetimi (BEGIN/COMMIT) YOK; tek işlemi uygulayan araç kurar (canlıda uygula-031.sql, temiz
-- kurulumda dosya sırası). Kaynak: b2b-d1/d1a-erisim-sikilastirma.sql (sha256 3a3958f8…); ifadeler aynı.
-- Canlıda 018'den sonra, 019'dan önce uygulanır; 019–023 ile ortak nesne yok (claude-d1-mekanizma/D1-UYGULAMA.md).
-- Kapsam: yalnız public.corporate_quotes'un politika ve yetkileri. Veri ve şema değişmez.
--
-- Sorun (canlı, 30 Eylül 13:30 UTC salt okuma): "Insert quote requires owner" politikası anon ve authenticated için
--   user_id IS NOT NULL AND (auth.uid() IS NULL OR user_id = auth.uid()) AND upper(coalesce(status,'pending')) = 'PENDING'
-- `auth.uid() IS NULL` dalı yüzünden OTURUMSUZ istemci (herkese açık anon anahtarı) var olan HERHANGİ bir kullanıcının
-- kimliğiyle teklif ekleyebiliyor; o kullanıcı teklifi kendi panelinde görür (SELECT politikası). B2B sayfaları kapalı
-- olsa da (TRANSACTIONS_ENABLED) veritabanı politikası bugün de açık: sorun uygulama bayrağından bağımsız.
-- Ayrıca tabloda anon/authenticated için tablo düzeyinde bütün yetkiler var (Supabase varsayılanı; RLS'e dayanılıyor).
--
-- Düzeltme:
--   1) Oturumsuz ekleme yok: politika yalnız authenticated, user_id = auth.uid(), status = 'PENDING'.
--   2) İstemci yalnız müşteri alanlarını yazabilir (sütun düzeyinde INSERT yetkisi); yönetim alanları (004 sonrası
--      approved_price, quoted_by, paid_at, payment_id, order_id, …) istemciden yazılamaz.
--   3) İstemci UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER yetkileri kaldırılır (politika yoktu, TRUNCATE RLS'e tabi değil).
--   4) SELECT: "Users can view own quotes" (authenticated, user_id = auth.uid()) değişmez; anon SELECT yetkisi kaldırılır
--      (politika olmadığı için zaten satır görmüyordu).
-- Etki: e-posta onayı açıkken "önce kayıt ol, oturum açılmadan teklif gönder" akışı (009 yorumu, kurumsal/teklif-al)
-- bu hâliyle çalışmaz; B2B bugün kapalı olduğu için şu an etkisi yok. Açılıştan önce D1 kararındaki akış seçilir.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP POLICY IF EXISTS "Insert quote requires owner" ON public.corporate_quotes;
DROP POLICY IF EXISTS "Insert own pending quote" ON public.corporate_quotes;
CREATE POLICY "Insert own pending quote" ON public.corporate_quotes
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'PENDING');

REVOKE ALL ON public.corporate_quotes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.corporate_quotes FROM authenticated;
GRANT SELECT ON public.corporate_quotes TO authenticated;
GRANT INSERT (id, user_id, company_name, tax_office, tax_no, contact_person, corporate_email, phone,
              need_types, need_details, seed_count, budget_range, timeline, notes, status)
  ON public.corporate_quotes TO authenticated;
