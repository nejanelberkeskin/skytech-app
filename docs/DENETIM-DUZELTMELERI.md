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

## İkinci inceleme düzeltmeleri — 22 Eylül 2026

Claude incelemesindeki 2, 5, 6, 8, 9, 10 numaralı altı bulgu bu ek paketle ele alındı:

| Bulgu | Son davranış | Kanıt |
|---|---|---|
| 2 — son yönetici / NULL | `is_active` artık NOT NULL; eski NULL kayıtlar pasifleştirilir. Rol/aktiflik NULL olsa da sahip sayacı doğru azalır; son sahip kaldırılamaz. | PGlite ve gerçek PostgreSQL 17.6: iki ayrı bağlantıyla eşzamanlı yetki düşürme, NULL rol/aktiflik, tek komutla çok satır güncelleme; sayaç geri alma. |
| 5 — sağlayıcı başarılı, checkpoint başarısız | Yalnız yerel checkpoint iki kez denenir; kaybolmuş yanıt kalıcı kayıttan doğrulanır. Sağlayıcıya ikinci iade gönderilmez. Kalıcı hata halinde kısıtlı sunucu loguna işlem/ödeme/iade kimlikleri yazılır. | Geçici DB hatası, yazılıp yanıtı kaybolan checkpoint, iki başarısız checkpoint ve tek sağlayıcı çağrısı testleri. |
| 6 — işlem sonrası audit hatası | Tamamlanmış işleme yanlış 500 dönülmez. Mevcut 200/201 gövdesine `warnings` eklenir. Etkilenen tüm yönetim ekranlarında aynı işlemi tekrarlamama uyarısı kalıcı görünür. Personel/iade zorunlu audit'i DB transaction'ında kalır. | Gerçek katalog handler'ı + audit yardımcısıyla tek yazma/201/uyarı testi; browser fixture tek PUT ve mobil kalıcı role=alert. |
| 8 — bozuk satış ayarı onarılamıyor | Yalnız yetkili admin GET'i ham alan, alan hatası ve sürüm döner. Bağlayıcı satış okuması kapalı kalır. Onarım satış kapalıyken, sürüm kontrolü ve normal şemayla kaydedilir; açmak ayrı işlem. | Ham değer/kapalı satış, PUT onarım ve CAS; tarayıcıda hata alanları, varsayılan yükleme, onay özeti, tek kayıt. |
| 9 — rol geçmişinde önceki değer yok | Personel audit'inde rol/aktiflik için before/after saklanır; oluşturma/silmede ilgili taraf null. | DB transaction testi. |
| 10 — mevcut Auth hesabı bulunamıyor | Hata metni yerine `email_exists` / `user_already_exists` kodları kullanılır; sayfalı arama mevcut hesabı bulur, parolası değiştirilmez. | Farklı dilde hata metni, ikinci sayfada eşleşme ve parola değiştirmeme testi. |

### Son doğrulama

- `npm test`: **39/39** geçti.
- `npm run lint`, `npm run typecheck`: geçti.
- `npm run i18n:check`: geçti, 1260 anahtar/dil. EN/RU `projectsPage.cta.titleTail` boş değerleri mevcut uyarılardır; yeni çeviri değişikliği yok.
- `npm run build -- --webpack`: geçti. Varsayılan Turbopack'a geçti denmiyor.
- Gerçek PostgreSQL testi: ağsız, dış portu olmayan, tmpfs kullanan yerel `skytech-review019` konteynerinde 007/016/017/019. Başlangıç şeması test için asgari kuruldu; üretim şemasının dökümü ya da canlı migration doğrulaması değildir. `scripts/check-owner-postgres.mjs` iki ayrı psql bağlantısı kullanır.
- Tarayıcı: asıl SalesSettingsForm ve AdminMutationWarnings bileşenleri yalıtılmış fixture uygulamasında. Sahte GET/PUT; gerçek Auth/API/DB/ödeme/e-posta yok. 390 px genişlikte taşma yok; satış kapalı, bir PUT, kalıcı audit uyarısı. Masaüstü onarım görünümü de incelendi.

019 yalnız yerel test veritabanlarına uygulandı; canlıya uygulanmadı. İade mutabakat ekranı ve 020, finans/cron devamı ayrı Claude dalındadır; bu paket onların tamamlandığı veya yayın onayı aldığı anlamına gelmez. Genel audit uyarısı tamamlanamayan geçmiş kaydını otomatik onarmaz; sunucu logu üzerinden takip gerekir. Genel işlemlerin audit ile aynı transaction'a taşınması sonraki yetki paketindedir.
