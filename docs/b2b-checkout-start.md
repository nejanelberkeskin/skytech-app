# B2B başlatma güvenilirliği — 039

Bu paket #126/#122 üstündedir. Müşteri sözleşmesinin üç dilli tüketicisi **#123** ile birlikte yayınlanmalıdır. Eski istemci `checkout_pending`/`status=pending` mesajlarını göstermez. Yerel birleşik prova Git merge değildir.

## Başlatma ve yeniden deneme

Yerel istek gövdesi claim'den önce hazırlanır; doğrulama/yapılandırma/gövde hatasında sağlayıcı çağrısı ve ödeme satırı yoktur. Claim ile `b2b_checkout_starts` kaydı tek işlemde oluşur. `prepared` izni iki dakika geçerlidir. Sağlayıcı çağrısından hemen önce `begin_b2b_checkout_start` bunu bir kez `dispatched` yapar; sahip, ortam, tutar/adet/sipariş, gözlem ve bekletmeler tekrar denetlenir. RPC yanıtı kaybolursa SDK çağrılmaz.

İki dakika, **yerel gönderim izninin kirasıdır**; sağlayıcı oturumunun ömrü, ödeme bekleme süresi ya da şirketin deneme limiti değildir. Müşterinin sonraki isteği yalnız süresi dolmuş `prepared` denemeyi, token/sağlayıcı kimliği/gözlem/aktif yönetim incelemesi/bekletme yoksa kapatır. Sipariş iptali, ödeme iptali, gözlem, teklif bağlantısının açılması ve yeni claim aynı işlemdedir. Eski süreç sonradan devam ederse gönderim izni alamaz. Başlamış işlem süreyle **asla** açılmaz.

`callIyzicoObserved` kökeni sağlayıcı alanlarından ayrı döndürür. Ağ/zaman aşımı/SDK istisnası `unknown`; gerçek SDK yanıtı `provider_response`. SDK içinde fırlayan `config` hatası gönderilmediğinin kanıtı değildir. Genel çağıranların `callIyzico` sonuç sözleşmesi korunur; yerel hata ayrıntıları dışarı taşınmaz.

Geçerli token, HTML yokken de saklanır. Metadata birleştirilir; mevcut dil ve inceleme bilgisi silinmez. Form yalnız kayıt kesin başarılı ve deneme hâlâ uygun olduğunda döner. Token yazılamadıysa/yanıt kayıpsa/HTML yoksa sonuç belirsiz kalır; ikinci oturum açılmaz. Yerel süreç öldükten veya timeout döndükten sonra geç SDK callback'inin saklanacağı garanti edilmez; kayıtlı conversation kimliğiyle takip sürer.

## Takip ve müşteri yanıtı

035'in mevcut iki sorgu / sekiz deneme / on dakikalık kiralama bütçesi korunur. Gönderim izni verildiği anda takip satırı oluşur. Token yoksa `payment.retrieve(paymentConversationId)`; varsa `checkoutForm.retrieve(token)` kullanılır. Eski token'sız pending kayıtlar da ortam etiketi doğruysa keşfedilir. Sonuç aynı atomik doğrulayıcıdan geçer. Hazırlık aşamasındaki kayıtlar sağlayıcıda aranmaz.

Başlatma belirsizliği 503 `checkout_pending`; açık ve henüz incelemeye düşmemiş deneme 409 `checkout_pending`; inceleme/bekletme/tarihsel belirsiz kayıt 409 `checkout_unavailable`. Deneme bütçesi dolunca kilit açılmaz, incelemeye gider. Başarı dışı kayıtlı dönüşler, ortam/taşıma/DB hatası dahil, `status=pending`; yalnız kayda bağlanamayan dönüş `/odeme/hata`. `declined` üretilmez: bu paket otomatik terminal ret serbest bırakması yapmaz. Başarılı sonuç aynı sözleşmeyle döner; URL'de ham hata/token yoktur.

## Geçiş ve sınırlar

039 tek kaydedilmiş transaction içinde uygulanmalı. **B2B kapalı, eski checkout süreçleri durdurulmuş olmalı.** Eski kod claim'den sonra yeni gönderim iznini kullanmadığından karma sürümle çalıştırmak güvenli değildir. Eski kodun sağlayıcıya göndermiş olabileceği tarihi kayıtlara `prepared` etiketi eklenmez. Yeni fonksiyonlar yalnız service_role; eski core fonksiyonunun dış çağrı yetkisi kaldırıldı. Canlı geçiş bu teslimin kapsamı değildir.

Henüz doğrulanmış terminal initialize hata kodu yok; boş listeyi varsayımla doldurmadık. Sağlayıcı `failure`ı veya `payment not found` **serbest bırakma kanıtı değildir**. Sağlayıcıya ulaşmış belirsiz oturum için güvenli otomatik açma bu paketle iddia edilmez. #122'nin izin/MFA/kanıtlı elle çözümü korunur. Gerçek CF sorgulama ve oturum kapanma davranışı sandbox/destek kanıtı gerektirir.

Webhook/dayanıklı olay deposu, kapanmış denemenin periyodik izlemesi, bekletme çözümü/iade politikası, günlük deneme sınırı, gerçek şirket kimlik/adres/taksit kararı bu pakette uygulanmadı. B2B açılış engelleri devam eder.

Birincil kaynaklar (5 Ekim 2026): [CF başlatma ve sorgulama](https://docs.iyzico.com/en/getting-started/preliminaries/api-reference-beta/payment-methods/checkoutform), [conversation kimliğiyle ödeme sorgusu](https://docs.iyzico.com/en/advanced/retrieve-payment). Belgeler sorgu yöntemini tanımlar; bulunamayan oturumun kapalı olduğunu kanıtlamaz.
