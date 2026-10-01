# Ödeme inceleme görünürlüğü ve B2B dönüş dili

Bu ek #114 (`64a67a4`) tabanlıdır. Ödeme sonucunu, rezervi, süre dolumunu veya iade davranışını değiştirmez.

## Yönetim

- `payment_meta.paymentReviewRequired` işareti `finance.read` ve sipariş okuma/saha kapsamı kesişiminde görünür.
- Sipariş listesinde `alerts.paymentReview` sayacı ve `flag=payment_review` filtresi vardır. İzni olmayan kullanıcıda sayaç yoktur; filtre isteği 403 olur. Filtre ve sayaç veritabanında kapsamlanır.
- Ayrıntıda yalnız `finance.payment.reviewRequired` boolean alanı döner; ham `payment_meta`, token veya sağlayıcı gövdesi dışarı verilmez.
- Uyarı süresi dolmuş siparişte de görünür. Uyarının kapasiteyi tutmadığı veya süre dolumunu durdurmadığı açıktır. Bu paket F1/F2 kapasite/mutabakat sorununun çözümü değildir.
- İş sağlığı panelinde Vazgeç sonrası odak, yeniden oluşturulmuş doğru iş düğmesine döner. Onaylanmadan POST yok; çift tıklama kilidi ve hata sonrası yenileme gereği korunur.

## B2B dili

Checkout isteğindeki `locale` yalnız `tr/en/ru` kabul eder, diğer girdiler Türkçeye düşer. Sunucudaki tutar/sahiplik denetimlerini etkilemez. Dönen token kaydedilirken `metadata.ui_locale` saklanır. Callback'te saklanan dil sorgudaki ipucundan önceliklidir; kayda bağlanamayan dönüşlerde yalnız güvenli dil ipucu kullanılır. Belirteç veya ham hata yönlendirmeye eklenmez. 303, no-store ve no-referrer korunur.

Sağlayıcı formu TR için Türkçe, EN/RU için İngilizce açılır; Rusça uygulama dönüşü `/ru/...` adresini korur. Bu, sağlayıcıya Rusça form desteği eklediğimiz anlamına gelmez.

## #115 ile bir araya getirme

#115 müşteri çevirileri de `kurumsal/panel/odeme/page.tsx` dosyasına dokunuyor. İki değişiklik alınırken `useLocale` import'u tek tutulmalı; #115'in mevcut `lang = uiLocale(useLocale())` değeri checkout gövdesine `locale: lang` olarak eklenmelidir. Çeviri değişikliklerini bu PR'daki eski Türkçe metinlerle ezmeyin.

Ayrı geçici kaynakta #113 (`12bf574`) + #114 (`64a67a4`) + #115 (`773821e`) + bu ek bir araya getirildi: 416/416 test ve üretim derlemesi geçti. Bu prova GitHub birleştirmesi değildir. #115'teki çalışan tahsis P2 düzeltmesi bu ekin kapsamında değildir.

## Açık bağımlılıklar

B2C inceleme ödemelerinin süre dolumunda kapasite kaybetmesi, 024–030 eksik kapasite taslağı ve mutabakatı; B2B gerçek fatura/kimlik/taksit kararı; gerçek sağlayıcı kabulü, canlı geçişler, sırlar ve zamanlayıcı kurulumu ayrı açık işlerdir. Bunlar bu görünürlük/dil ekinin testleriyle kapanmaz. Canlı işlem yapılmadı.

## Doğrulama

Ana paket 411/411 test; TypeScript, tam lint ve üretim derlemesi başarılı. Çeviri eşitliği 1316 × 3 (önceden var olan EN/RU boş `projectsPage.cta.titleTail` uyarıları). Gerçek bileşenlerle izole Next tarayıcı kabulü 7/7: 375 px görünüm, finans izni, iki kartta iptal sonrası odak, tek POST, 403/503 ve çalışmakta olan iş. Ağ uçları taklit; dış istek 0. Liste filtresi/yetki/saha kapsamı PGlite + route testleriyle doğrulandı. Ham sağlayıcı verisi veya belirteç DTO'ya eklenmedi. Ayrıntılı rapor ve görseller ortak çalışma alanındaki `outputs/astra-odeme-gorunumu/TESLIM-RAPORU.md` dosyasındadır.
