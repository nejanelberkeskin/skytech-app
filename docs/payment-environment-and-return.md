# Ödeme ortamı ve dönüş koruması

1 Ekim 2026. Taban: #110 `33100b9`. Canlı ayar veya SQL değişikliği gerektirmeyen kod düzeltmesi; dağıtımdan önce mevcut iyzico adresi bu kurallarla doğrulanmalıdır.

## Davranış

- Siparişin `is_test` değeri sağlayıcının `isTest` değeriyle eşleşmeden `startPayment` ve `completePayment` sağlayıcıyı çağırmaz. Ödenmiş siparişte ikinci tahsilat araştırması da bu kontrolün arkasındadır.
- Asıl/mükerrer iade ve yeniden deneme, sağlayıcı adı ve test/canlı ortamını denetler. Uyuşmazlık 409 `provider_environment_mismatch` döndürür. Claim açılmaz, deneme numarası ilerlemez. Mevcut yerel finalize ve mutabakat yolları değişmez.
- iyzico SDK'sı ve sağlayıcı ortam etiketi aynı `iyzicoConfig` kaynağını kullanır. Yalnız `https://api.iyzipay.com` ve `https://sandbox-api.iyzipay.com` (isteğe bağlı son `/`) kabul edilir. Yol, sorgu, kullanıcı bilgisi, ek port ve başka host reddedilir. SDK yapılandırma değiştiğinde yeniden oluşturulur; geçersiz yapılandırmada önceden önbelleklenmiş istemci kullanılamaz.
- Mevcut geliştirme varsayılanı sandbox korunur. `VERCEL_ENV=production` ise sandbox yapılandırması geçersizdir; hukuki metinler kesin olsa bile sipariş kapısı test ödemesini reddeder. `NODE_ENV=production` tek başına canlı dağıtım ölçütü değildir; yerel üretim derlemesi/preview mevcut Vercel ortam kuralını korur.
- `/api/payment/donus` sonucunda imzalı erişim belirteci yalnız HttpOnly, SameSite=Lax çerezine konur (üretim derlemesinde Secure). Location `/[dil]/odeme/sonuc/[no]` biçimindedir; `?t` içermez. Her yönlendirme `private, no-store` ve `no-referrer` başlıklarını taşır. İmza oluşturulamıyorsa erişim verilmez, genel hata sayfasına gidilir.
- E-postadaki belirteçli bağlantı sözleşmesi ve onu temizleyen #104 kapısı korunur.

Resmî API kökleri: [iyzico Live vs Sandbox](https://docs.iyzico.com/on-hazirliklar/live-vs-sandbox). Anahtarın gerçek hesap/ortam geçerliliğini sağlayıcı doğrular; bu sürüm anahtarın ön ekinden doğrulama sonucu uydurmaz.

## Kanıt

- `npm test`: **366/366**, 12 yeni regresyon testi; sıfır atlanan.
- `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run i18n:check`, `git diff --check`: başarılı. Üç dil 1316 anahtar; EN/RU `projectsPage.cta.titleTail` boşluk uyarıları mevcut.
- `npm run build -- --webpack`: başarılı, 191 sayfa. Next middleware/proxy kullanım uyarısı, Next'in Edge modülünde process.cwd uyarısı ve webpack büyük metin önbelleği uyarısı var; temiz/uyarısız derleme iddiası yok.
- #110 kaynaklarını bellekte yükleyen önce/sonra düzeneği beş farkı doğruladı: yanlış ortamda init, retrieve, refund claim; kesin metinle üretimde test kapısı; dönüş URL'sinde belirteç.
- Gerçek dönüş route'u ve NextResponse ile yerel HTTPS tarayıcı düzeneği: Chromium, TR/EN/RU **3/3**. Farklı siteden POST → 303 → ilk GET'te geçerli çerez, belirteçsiz adres, Referer yok; yenilemede erişim korunuyor. Dış istek 0. Ödeme/e-posta bağımlılıkları taklit; sonuç sayfası HTTP doğrulama düzeneğidir, tüm Next arayüzünün tarayıcı kabulü değildir.
- Ayrıntılı yerel kanıt: proje kökündeki `outputs/astra-odeme-korumasi/`.

## Kapsamın sınırı

Gerçek ödeme/iade/e-posta veya canlı veritabanı çağrısı yok. Safari/iOS ve gerçek iyzico sandbox 3DS kabulü yapılmadı. Sağlayıcı mutabakatı, kapasite sahipliği/024–030, B2B tutar ve yarış kontrolleri, ödeme tokenı benzersizliği bu PR ile çözülmüş sayılmaz. Eski kirli `siparis-guvenilirlik` ağacı değiştirilmedi; o taslağa entegrasyon ayrıca yapılmalıdır.
