# B2B ödeme inceleme ve doğrulanmış ret sonrası yeniden deneme

Bu paket yalnız yerel kod/test ve taslak PR kapsamındadır. Canlı veritabanı, ödeme/iade, yayın veya birleştirme uygulanmadı. 037 ve 038 geçişleri inceleme içindir; uygulanmış sayılmaz.

## Yetki ve erişim

`/admin/finans/b2b` kayıt listesi, bütün kayıtlar kapsamında `finance.read` ister. İşlem için ayrıca bütün kayıtlar kapsamında yeni `finance.b2b_payment.resolve` izni ve son 15 dakikada doğrulanmış MFA zorunludur. Genel MFA dağıtım bayrağı bu şartı kapatmaz. Yetki hem sağlayıcı sorgusundan önce hem sonra kontrol edilir; SQL de etkili izinleri tekrar değerlendirir. Dar saha kapsamı yeterli değildir.

038 katalog iznini ekler ve yalnız mevcut `owner` sistem rolüne verir. Finans rolü kendiliğinden bu yetkiyi kazanmaz. Yetkili yönetici mevcut rol yönetiminden gerekli iki izni içeren özel rolü uygun kişiye tüm kayıtlar kapsamında atayabilir. Son sahip koruması ve sistem rolü düzenleme yasağı devam eder. Geçiş, koruma tetikleyicisini yalnız işlem içinde kapatıp açar; geçişin tamamı tek transaction içinde yürütülmelidir.

## Operatör akışı

1. Finans ekranındaki Kurumsal ödeme incelemeleri bağlantısını açın. Liste 50 kayıtlık sayfalarla gelir; ödeme belirteci, kart verisi, e-posta veya ham sağlayıcı yanıtı tarayıcıya aktarılmaz.
2. Kaydı seçip sağlayıcı destek/panel incelemesine ait 10–500 karakterlik kanıt referansı girin. Kişisel veri veya gizli anahtar girmeyin.
3. “Sağlayıcıdan sorgula” güncel sonucu doğrular. Başarılı ödeme, mevcut atomik B2B kaydedicisi üzerinden işlenir. Belirsiz, uyuşmayan veya çelişkili sonuç tekrar ödemeye açılmaz.
4. “Doğrulanmış ret sonrası yeniden deneme aç” yalnız eski oturumun artık tahsilat alamayacağı sağlayıcıdan teyit edildiyse kullanılabilir. Ayrı ve başlangıçta boş kutu bu teyidi kaydeder. Kutuyu işaretlemek kendi başına sağlayıcı kanıtı üretmez.
5. Sunucu güncel sonucu ayrıca sorgular. Açık FAILURE; aynı deneme ve sepet; aynı TRY tutarı, teklif, kullanıcı ve sipariş; pozitif ödenmiş tutar olmaması; önceki başarı veya finans bekletmesi olmaması gerekir. Başarı gelirse ret uygulanmaz, doğrulanmış ödeme işlenir.
6. Uygun ret eski denemeyi kapatır, yalnız ilgili bekleyen siparişi iptal eder, teklif bağlantısını kaldırır ve denetim kaydını aynı transaction içinde yazar. Sonraki müşteri isteği yeni deneme oluşturabilir. Genel `failed` durumu tek başına yeniden deneme yetkisi değildir.

İşlem sonucunun belirsiz kaldığı ağ hatası, 409 veya 5xx durumunda aynı işlem otomatik tekrar gönderilmez. Önce görünümü yenileyin. MFA reddinde doğrulamayı yenileyip listeyi tekrar açın. Yetki kaybında eski veri ve işlem formu temizlenir.

## Eşzamanlılık ve geç sonuçlar

İnceleme işleminin süresi iki dakikadır; bu süre **ödeme oturumunun geçerlilik süresi değildir** ve dolması ödeme kilidini açmaz. Aynı denemede tek aktif inceleme vardır. Sağlayıcı HTTP çağrısı SQL transaction ve satır kilitlerinin dışında yapılır. Sonuç uygulama aşamasında ödeme/teklif görüntüsü değişmişse eski yanıt uygulanmaz. Aynı işlem kimliği tekrar sonuçlandırılırsa kayıtlı sonuç döner, ikinci denetim kaydı yazılmaz.

Callback artık başarısız veya iptal edilmiş B2B denemelerde de sağlayıcıyı sorgular. Kapanmış denemenin geç başarısı gözlem ve finans bekletmesi olarak kaydedilir; eski sipariş canlandırılmaz. Teklifte başka deneme varsa onun sonucu da otomatik yeni tahsilat olarak kabul edilmez. Bu işlem para iadesi yapmaz. Zaten kaydedilmiş başarılı ödeme tekrarlı callback ile tekrar uygulanmaz.

## Geçiş bağımlılıkları ve doğrulama

037, gerçek şemadaki sipariş/ödeme tabloları ile 021/022 yetki-denetim çekirdeği ve 034/035 B2B kayıt/mutabakat işlevlerine bağlıdır. 038 yeni izin kataloğu ve sahip atamasını tamamlar. Dağıtım planı depodaki önceki geçişlerin tamamını ve 036 bildirim kuyruğu dahil bağımlılıklarını ayrıca doğrulamalıdır. İzole test fikstürünün dar şeması üretim geçiş planı değildir. Bu paket 024–030 B2C kapasite/silme işlemlerine onay vermez.

Testler PGlite gerçek SQL, ağsız PostgreSQL eşzamanlı oturumları, taklit sağlayıcı API testleri ve gerçek bileşeni kullanan yalıtılmış tarayıcı senaryolarıyla çalışır. Canlı Supabase, gerçek iyzico, e-posta, ödeme veya iade çağrısı yapılmaz.

## Açık kalan sınırlar

- Zaman aşımı, bulunamadı yanıtı, yalnız yerel ret durumu veya belirteçsiz bilinmeyen deneme otomatik kapanmaz. 10/45 dakika gibi varsayımsal süreler yeniden deneme açmaz.
- Sağlayıcının ret sonrası Checkout Form oturumunu kesin kapatma davranışı gerçek sandbox senaryosuyla doğrulanmadı. Belgeler bunu tek başına kanıtlamıyor; operatör teyidi zorunlu. Teyit alınamıyorsa kilit korunur.
- Yeni webhook veya kapanmış denemelerin periyodik taraması eklenmedi. Geç sonuç bu pakette callback veya yetkili manuel sorgu ulaştığında gözlemlenir. Hiç gelmeyen sonuç için otomatik keşif garantisi yoktur.
- Çelişkili/çift tahsilat bekletmesini kaldırma ve gerçek iade iş akışı bu paketin dışında. İade talebi, gerçekleşmiş iade olarak kabul edilmez; bu ekran bekletmeyi kaldırmaz.
- Üretim PostgREST/RLS bağlantısı, sağlayıcı uçtan uca sandbox doğrulaması ve canlı geçiş provası ayrıca yapılmalıdır.
