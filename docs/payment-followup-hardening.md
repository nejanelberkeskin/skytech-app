# Ödeme belirteci ve sağlayıcı yanıtı korumaları

1 Ekim 2026. Taban: #111 `5b21e63`, dal: `odeme-belirteci-tekilligi`.

## Davranış

- `033_payment_token_uniqueness.sql`, dolu güncel ödeme belirteçlerini tekilleştirir. Mevcut mükerrer kayıt varsa veri değiştirmeden hata verir; belirteç hata metnine yazılmaz. Birden çok NULL geçerlidir. Ödeme başlangıç olaylarının tokenHash sorgusuna indeks eklenir.
- iyzico yanıtında tutar, para birimi, işlem ve sepet kimliği doğrulanır. Fraud sonucu 1 dışında kalan belirsiz başarılı yanıt ödeme onayı sayılmaz. İnceleme işareti alan siparişte yeni ödeme başlatılmaz; sonradan doğrulanmış başarı normal tamamlanabilir.
- Kesin ret olarak doğrulanmamış iade hatası sonraki iade/iptal yöntemini çalıştırmaz. Böylece belirsiz sonuçtan sonra ikinci parasal işlem denenmez.
- B2B sağlayıcı çağrıları ortak 15 saniyelik zaman aşımını kullanır. Zaman aşımından sonra gelen SDK yanıtı route yazmalarını başlatmaz. Dönüş 303'tür; ham sağlayıcı hatası URL'ye eklenmez. Bozuk dönüş belirteci sağlayıcıya gitmez. Checkout yanıtı geçerli belirteç ve form olmadan kaydedilmez/yayımlanmaz.

## Yerel doğrulama

Uygulama ucu `a138cad`: 384/384 test, atlanan 0; üretim derlemesi başarılı. Son TypeScript, lint ve i18n komutları teslim raporunda kayıtlıdır. PGlite testleri gerçek PostgreSQL motorunda mükerrer kayıt reddini, migration rollback'ini ve mevcut veri korunmasını doğrular. B2B transport testleri 6/6; sağlayıcı ve veritabanı bağımlılıkları taklit edilir.

Ayrıca #111 `5b21e63` dönüş route'u HTTPS Chromium ve WebKit'te TR/EN/RU için ayrı ayrı 3/3 geçti: çapraz site POST → 303 → ilk GET ve yenilemede HttpOnly/Secure/Lax çerez, belirteçsiz URL, boş Referer; dış istek 0. Sonuç sayfası ve ödeme/e-posta bağımlılıkları taklit; tam Next UI, fiziksel Safari/iOS veya gerçek sağlayıcı kabulü değildir.

## Migration ve yayın sınırı

033 yalnız yerel taslaktır; canlıya uygulanmadı. 016 release_orders/order_events sözleşmesine dayanır; 024–030'un eksik capacity_reservation_state alanına dayanmaz. 031/032 D1 için ayrılmış numaralardır. Kilit 5 saniye, ifade 30 saniye ile sınırlıdır; kilit alınamazsa migration durur. Mükerrer kayıtlar otomatik temizlenmez. Canlı yedek, mükerrerlik incelemesi ve migration geçmişi doğrulanmadan uygulanmaz. 024–030 dahil kör toplu db push yapılmaz.

## Kapanmayanlar

- F1: kayıp/geciken callback için sağlayıcı mutabakat işi, eski ödeme oturumlarının kalıcı takibi, geç tahsilat ve atomik kapasite rezervi. 024–030 ayrı, eksik ve onay bekleyen taslaktır.
- F3: B2B atomik ödeme/sipariş/teklif güncellemesi, B2B tutar/para birimi/fraud doğrulaması, gerçek fatura bilgileri ve taksit politikası. Bu PR yalnız B2B çağrı/yönlendirme güvenliğini iyileştirir; B2B finans akışını yayına hazır ilan etmez.
- İnceleme işareti genel sağlayıcı mutabakatı değildir; geçmiş tüm oturumları tekilleştiren bir defter kurulmadı. 033 yalnız güncel release_orders.payment_token alanını korur.
- D1 anonim INSERT, 019–023 canlı geçişleri, sırlar/MFA ve hukuk/operasyon kararları bu paketle kapanmaz.

Gerçek ödeme, iade, e-posta, canlı SQL, birleştirme ve üretim yayını yapılmadı.

Sağlayıcı sözleşmesi: https://docs.iyzico.com/en/payment-methods/checkoutform/cf-implementation/cf-retrieve
