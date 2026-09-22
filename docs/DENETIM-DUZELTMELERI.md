# Denetim düzeltmeleri — 22 Eylül 2026

Taban: `71740c5` / #61. Dal: `denetim-duzeltmeleri`. D01–D19 genel denetim bulguları için düzeltme paketi. Canlı veritabanı, e-posta, ödeme ve kullanıcı yetkileri bu çalışma sırasında değiştirilmedi.

## Dağıtım sırası

1. #61 içeriği ile bu PR birlikte değerlendirilmeli. Başka çalışanın dalına rebase/yazma yapılmadı.
2. İzole veritabanında mevcut migration'lar üzerine `019_audit_hardening.sql` çalıştırılmalı. Migration içinde `BEGIN/COMMIT` var; hata halinde bütün değişiklikler geri alınır. Personel değişiklikleri sırasında kısa tablo kilidi alır.
3. Mevcut DB şemasında `admin_users` alanlarını (özellikle `id` varsayılanı, rol tipi), en az bir aktif süper yöneticiyi ve 016/017/018 migration geçmişini salt okunur kontrol edin. Test altyapısı 007/016/017/019'u PGlite üzerinde çalıştırır; canlı şema doğrulandığı anlamına gelmez.
4. Migration uygulandıktan sonra uygulama dağıtılır. Yeni iade/personel RPC'leri ve iletişim kotası olmadan ilgili işlemler başarı sayılmaz. Migration eski uygulamayla birlikteyken iade akışını açmayın; eski uygulama yeni sahiplenme tablosunu kullanmaz. Finans işlemleri için bakım aralığı kullanın.
5. Oturumlu dört rol, HTML/PDF belge erişimi, son süper yönetici ve gerçek sağlayıcının **sandbox** iade sonuçları ayrı kabul ortamında doğrulanmalı. Üretimde test ödemesi/iade yapılmadı, satış anahtarı açılmadı.

## İade mutabakatı

`refund_operations` aynı `(provider,payment_id)` için yalnız bir sağlayıcı çağrısına izin verir. Sipariş idaresi ve çift tahsilat iadesi aynı korumayı kullanır.

- `started`: çağrı başlamış olabilir; otomatik süre aşımı/devralma yok.
- `needs_review`: hata/zaman aşımı sonucu belirsiz. Sağlayıcı paneli/API mutabakatı gerekir; otomatik yeniden para gönderilmez.
- `provider_succeeded`: sağlayıcı sonucu kalıcı kaydedilmiş. Panelden aynı işlem tekrar denenince sadece DB finalizasyonu çalışır; sağlayıcı çağrılmaz.
- `completed`: sipariş, iade, kapasite, fatura kuyruğu, olay ve denetim kaydı tek transaction ile tamamlandı.

`started`/`needs_review` kaydını silmek veya yeniden `started` yapıp para göndermek güvenli değildir. Yetkili operatör önce sağlayıcıda tam ödeme kimliği/tutarı ile sonucu doğrular; başarılıysa doğrulanmış refundId/method ile checkpoint onarılır ve `finish_refund_operation` çağrılır. Başarısızlığı kesinleşmiş bir ödemeyi yeniden denemek bu PR'da otomatikleştirilmedi. Eski sistemden kalan belirsiz `claim:*`, başarılı iade veya çift tahsilat `refund_started` kayıtları da mutabakat gerektirir.

Bu işlem kuyruğu için ayrı bir mutabakat ekranı/davet/MFA/ince izin CMS'i bu hata düzeltme paketinin kapsamı değil, brif 12'nin devamıdır. Yeni kalıcı korumalar silinerek geri alınmamalı; uygulama geri dönüşü önce finans işlemleri durdurularak planlanmalıdır.

## Finans tanımı

- Bırakma kaynağı: `release_orders`, deneme kayıtları hariç. Tutarlar kuruş cinsinden hesaplanır.
- Bu ay net tahsilat: İstanbul takvimindeki bu ayın sipariş tahsilatları eksi bu ay tamamlanan `order_refunds` kayıtları. Önceki ayın bu ayki iadesi de bu aydan düşer.
- İade yükümlülüğü henüz nakit çıkışı değildir; ayrı gösterilir.
- B2B yalnız `payments.metadata.checkout_type=b2b` ile ayrı sunulur. Aylık tarih mevcut modelin `updated_at` alanına dayanır. Eski bireysel satış dahil edilmez; B2B tabloları silinmez.
- Sorgu hataları 503 olur. Finans sorguları PostgREST satır sınırı nedeniyle sessizce kesilmez (sayfalama). Farklı sorgular mutlak tek anın muhasebe ekstresi değildir; sağlayıcı mutabakatı ve çift tahsilat ayrıntıları ayrıca incelenmelidir.

## Güvenlik paketleri

Next / eslint-config-next / bundle-analyzer 16.3.5, React 19.3.0, jsPDF 4.2.1, iyzipay 2.0.69. `postman-request` altındaki `uuid` 11.1.1 ve `qs` 6.16.0 ile override edildi. İlgili SDK yalnız CommonJS `uuid.v4()` kullanıyor; bu arayüz ve iyzipay başlangıç/ödeme sorgusu/iade yöntemlerinin yüklenmesi test edildi. Gerçek sağlayıcı çağrısı yapılmadı.

Son `npm audit`: 0 açık. Kaynaklar: [Next güvenlik duyuruları](https://github.com/vercel/next.js/security/advisories), [jsPDF güvenlik duyuruları](https://github.com/parallax/jsPDF/security/advisories). Sonuç yalnız tarama tarihindeki paket kayıtlarını kapsar.

## Doğrulama

- `npm test`: regresyonlar + yerel PostgreSQL/PGlite migration testleri. Dış ağ/gerçek kayıt yok.
- `npm run lint`, `npm run typecheck`, `npm run i18n:check`.
- `npm run build -- --webpack`: üretim derlemesi. Varsayılan Turbopack bu ortamda PostCSS işçisi için port açarken `Operation not permitted` verdi; bu komuta geçti denmedi. Webpack desteklenen üretim derleyicisidir; uygulama build scripti değiştirilmedi.
- Tarayıcı: admin giriş 320/390/768/1440; TR/EN/RU auth; mobil menü Tab/Escape/odak dönüşü; bilgi formu etiketi; yeni satış kapalıyken cayma formu.
- PGlite PostgreSQL mantığını ve atomik geri almayı sınar. Kuyruğa verilen paralel çağrı testi, birden çok gerçek Postgres bağlantısının yük/stres testi yerine geçmez.

Yerel kanıtlar: `../outputs/denetim-duzeltmeleri/`. Bu klasör repository dışındadır; CLI çıktıları ve ekran görüntüleri ortak çalışma alanında teslim edilir.
