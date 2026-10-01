# B2B ödeme doğrulaması ve atomik kayıt

2 Ekim 2026. Dal `b2b-odeme-dogrulamasi`; taban #112 `94bd99c`. Yeni yerel migration: `034_b2b_payment_result.sql`.

## Değişiklik

Önceden callback yalnız status/paymentStatus'a bakıp payment, order ve quote tablolarını ayrı ayrı yazıyordu; bir yazma başarısız olsa bile başarı yönlendirmesi çıkabiliyordu. İki sekme aynı teklif için iki ödeme oturumu açabiliyordu.

- `claim_b2b_checkout`: teklif satırını kilitler, sahip/fiyat/adedi tekrar doğrular; order/payment/quote bağlantısını tek işlemde kurar. Eski order bağlantısı veya B2B ödeme denemesi varsa yeni oturum açmaz. Sağlayıcı oturumu yalnız başarılı claim'den sonra açılır. Eksik şirket e-postası reddedilir; anonim veya authenticated RPC çağıramaz.
- `record_b2b_payment_result`: ödeme ortamını, tutarı, TRY para birimini, basketId'yi, varsa conversationId'yi, fraud=1'i ve ödeme/sipariş/teklif durumlarını kilit altında doğrular. Siparişin fiyat ve adedi de teklif ile eşleşmelidir. Başarı üç tabloda aynı işlemde kaydedilir. Hata tamamını geri alır; HTTP başarıya yönlendirmez.
- Aynı sağlayıcı işlem kimliği için danışma kilidi, ardından quote/payment/order satır kilitleri alınır. Tekrarlanan başarı yeni bir ödeme geçişi oluşturmaz; geç başarısız yanıt başarıyı düşürmez; iptal edilmiş kayıt yeniden canlanmaz.
- Belirsiz, farklı tutarlı veya fraud incelemesindeki sonuçlar pending kalır, `payment_review_required` işaretlenir. Arındırılmış gözlem ayrı tabloya eklenir; önceki tahsilat gözlemi sonraki belirsiz yanıtla silinmez. Ham SDK yanıtı, belirteç, kart ve sağlayıcı hata metni saklanmaz.
- Callback ortam snapshot'ı olmayan eski kayda ortam uydurmaz; güvenli biçimde durur. Terminal kayıtta tekrar sağlayıcı çağrısı yapmaz. 303, private/no-store ve no-referrer korunur.

## Doğrulama

- PGlite + gerçek route hedefli 18/18: başarı/tekrar, tutar/para birimi/kimlik/fraud retleri, geç onay, iptal, ortam, yetki, rollback ve checkout claim.
- SDK normalleştirme 2/2: sayı/metin fraud, tam kuruş hesabı ve hassas alanların dışarıda bırakılması.
- Gerçek PostgreSQL 17.6: ağ bağlantısı ve host portu olmayan ayrı geçici container; aynı anda iki gerçek kilit bekleyen bağlantı. Checkout sonucu bir claimed + bir checkout_in_progress; callback sonucu bir paid + bir already_paid. Tek order/payment/observation. Betik `scripts/test/b2b-postgres-race.py`; yalnız boş, volumesuz, network=none container kabul eder.
- Son tam test 398/398, atlanan 0. Lint/typecheck/diff temiz; i18n 1316×3 (önceden var olan EN/RU boş titleTail uyarısı); üretim build başarılı (191 sayfa, mevcut Next Edge/middleware/webpack uyarıları). Ayrıntılı çıktılar yerel teslim raporunda. Testlerde gerçek ödeme, e-posta, iade ve canlı veritabanı çağrısı yok.

Şema fixture'ı 30 Eylül salt okunur katalog çıktısındaki orders/payments/corporate_quotes tablo, enum ve check/unique tanımlarından alınmıştır. İlgisiz auth/org FK'ları fixture dışında; 004'ün teklif sütunları/tetikleyicisi gerçek migration gövdesiyle eklenir. Bugünkü canlı şema yeniden sorgulanmadı.

## Yayın ön koşulları ve kalanlar

Bu taslak B2B'yi açmaz. 034, mevcut orders/payments ve 004 ya da D1-b/032 sonrası corporate_quotes şemasını gerektirir. D1 erişim açığı, migration geçmişi/yedek ve önceki yayın engelleri kapanmadan uygulanmaz. 024–030 kapasite dosyaları değiştirilmedi; 031/032/033 korunur. 034 canlıya uygulanmadı; veri silmez.

- Gerçek fatura adresi, kimlik/vergi numarası politikası ve taksit kararı henüz tamamlanmadı. Checkout'un mevcut örnek adres/kimlik/telefon yedekleri bu PR'ın dışında ve B2B açılış engelidir.
- Taksit farkını otomatik kabul eden bir politika uydurulmadı: price ve paidPrice beklenen tutara tam eşit olmalıdır; fazla/eksik tahsilat hizmet açmadan incelemeye düşer. Mevcut taksit listesi bu taslakta değiştirilmedi; taksit farkı olan gerçek akış açılıştan önce çözülmelidir.
- Yanıt vermeyen SDK, kayıp callback veya token yazılamaması sonrası arka plan sağlayıcı mutabakatı yoktur. Claim otomatik bırakılmaz; belirsiz eski oturum yenisiyle değiştirilmez. Bu, çift tahsilatı engeller ama operatör mutabakatı olmadan yeniden ödeme açmaz.
- Eski is_test snapshot'ı olmayan kayıtlar otomatik taşınmaz; ayrı salt okuma envanter/mutabakat gerekir.
- Gözlem tablosu finans ekibine SQL/service-role üzerinden kanıt sağlar; yeni yönetim inceleme ekranı ve otomatik iade bu kapsamda yoktur.
- Gerçek iyzico sandbox/cihaz kabulü yapılmadı. Kaynak sözleşme: https://docs.iyzico.com/en/getting-started/preliminaries/api-reference-beta/payment-methods/checkoutform

Birleştirme, üretim yayını ve gerçek parasal işlem yapılmadı.

## #113 ile işlem sınırı uyumu

033 ve 034 gövdelerinde üst düzey BEGIN/COMMIT yoktur. Uygulayan araç tüm dosyayı ve migration tarihçe kaydını aynı işlemde sarmalar; düz psql -f ile gövde uygulanmaz. PGlite ve PostgreSQL prova araçları açık işlemi kendileri kurar. 033'ün iç SQL ifadeleri değişmedi; veri koruma testleri yeniden çalıştırıldı. Bu, #113'ün 019 ve sonrası için getirdiği sözleşmeyle uyumludur; #113 bu dala birleştirilmedi.
