# Kalıcı sipariş bildirim kuyruğu — 036

Bu paket #117 tabanında bağımsızdır. Eski, kabul edilmemiş 024–030 kapasite/finans taslağına dayanmaz; o taslaktaki 027 burada **036** olarak ayrılmıştır. İkisi bir arada uygulanmaz. Çalışan sipariş çekirdeğinin ödeme, rezerv, cayma kabulü veya iade davranışı değiştirilmez. 016 sipariş tabloları, 004 email_logs ve 020 job_runs ön koşuldur.

## Davranış

Sipariş teyidi ve dört saklı sözleşme PDF'i, şirkete sipariş bildirimi, cayma teyidi ve şirket bildirimi, sertifika ve video e-postaları tek kalıcı kuyruktan gönderilir. Sipariş/şablon tekilliği vardır. İlgili alanın ilk durum değişikliğiyle aynı transaction içinde kuyruk kaydı oluşur. Kuyruk yazılamazsa o UPDATE geri alınır; bu garanti çok adımlı eski ödeme/ifa akışının tamamının atomik olduğu anlamına gelmez. Kapasite ve ödeme atomikliği ayrı açık iştir.

Altı eski gönderici ağ yapmayan prepare işlevlerine ayrılmıştır; after() ve günlük işler aynı worker'ı uyandırır. Her alıcı bağımsız işlenir. Dört saklı belgenin/onay kaydının bütünlüğü kontrol edilir; eksik belgeli teyit PDF'siz yollanmaz. Eski uygun kayıtlar yalnız güvenilir email_sent sağlayıcı kimliği varsa sent olur; diğerleri needs_review olur, otomatik toplu eski gönderim yoktur.

## Kesintiler ve tekrar

- FOR UPDATE SKIP LOCKED ve iki dakikalık claim lease; süresi geçen sahibin tüm ilerletme çağrıları reddedilir.
- Gövde, alıcı, gönderen, HTML ve PDF baytları ilk HTTP öncesi dondurulur; SHA-256 doğrulanır.
- Ağdan önce first_network_at kaydedilir. Her denemede aynı gövde ve sg-outbox/UUID anahtarı kullanılır.
- Resend [anahtarları 24 saat saklar](https://resend.com/changelog/idempotency-keys). Yerel otomatik deneme penceresi 23 saattir; pencere bitince yeni anahtar verilmez, needs_review gerekir.
- Zaman aşımı, 429/5xx ve aynı anahtara eşzamanlı 409 gecikmeli denenir. Farklı içerik 409, geçersiz alıcı gibi kesin 4xx kalıcı incelemeye gider. Eksik sağlayıcı kimliği başarı değildir.
- Sağlayıcı kabulü, outbox sent, email_sent/email_logs ve videonun bildirildi kaydı tek settlement transaction'ındadır. sent gelen kutusuna teslim garantisi değildir.
- Her ağdan önce sertifika/video uygunluğu yeniden kontrol edilir. Dondurma öncesi düzeltilmiş video kaynağı alınır; dondurma sonrası farklı bağlantıyla aynı anahtar kullanılmaz. Kontrolden sonra, dış HTTP ile eşzamanlı iptal atomik olamaz; bu sınırlama korunur.

## İşletim ve panel

GET /api/cron/bildirimler: CRON_SECRET sabit süreli Bearer kontrolü, no-store. Eksik/yanlış kimlikte istemci ve worker kurulmaz. job_runs başlangıcı kaydedilemiyorsa hiçbir gönderim yapılmaz; bitiş kaydı kaybolursa başarı denmez. POST /api/admin/jobs/bildirimler/run: system.jobs.run gerekir, scope=all zorunlu; status kapsamı e-posta göndermeden 400 olur.

Yönetim iş sağlığında ayrı bildirim kartı vardır. Onay metni e-posta etkisini söyler, iptal doğru düğmeye odak verir, çift tıklama tek POST üretir. Raporlar alıcı/gövde içermeyen sayılar ve Türkçe etiketlerdir: bekleyen/işlenen/inceleme, şablon başına kabul/başarısızlık. Diğer sipariş işleri ve B2B mutabakat ayrıdır.

vercel.json değişmedi. Her 10 dakikada bir yetkili harici scheduler ve ilk gerçek job_runs kanıtı yayın ön koşuludur; günlük sipariş cron'u 23 saat içinde güvenilir retry sıklığı sağlamaz. Paneldeki CRON_SECRET varlığı scheduler kurulmuş demek değildir. RESEND_API_KEY yoksa job başarısızdır; boş başarı verilmez. Bu çalışma canlı anahtar, scheduler veya e-posta gönderimi yapmadı.

## Gizlilik ve manuel inceleme

Outbox RLS kapalıdır; anon/authenticated tabloyu okuyamaz ve işlevleri çalıştıramaz. Servis rolü sayım/okuma ve sınırlı worker RPC'leri kullanır. Kaynak snapshot'ı fatura adresi, telefon, ödeme token/metadata, IP/user-agent, kullanıcı kimliği veya onay verisi kopyalamaz. Dondurulmuş e-posta gövdesi ise alıcı, özel sipariş bağlantısı ve sözleşme PDF'lerini içerir; istemci/panel veya genel günlüğe aktarılmaz.

review_order_notification yalnız needs_review durumunda, belgeli kanıtla confirm_sent veya dismiss yapar; kör retry/reset yoktur. Servis rolüne açık bu işlem için yeni UI veya herkese açık uç yoktur. İşlem yetkili operatörün sağlayıcı kanıtına dayanır. İki dakikalık lease ve 23 saat penceresi içinde gövde/source silinmez veya değiştirilmez. Şirketin onaylı saklama süreleri verilmediği için otomatik saklama süresi uydurulmadı; kaynak/gövde için silme/maskeleme politikası canlı öncesi kararlaştırılmalıdır.

Outbox order_id yabancı anahtarı RESTRICT'tir: bağlı teslim kanıtı varken eski test siparişi purge işlemi sessizce silmez; transaction geri alınır. Purge/finans kapsamındaki ayrı izin engeli bu paketle aşılmadı.

## Doğrulama

PGlite: rollback, tekillik, lease ve eski sahip, donmuş gövde, kayıp HTTP/DB acknowledgement, 23 saat, eksik kimlik, bağımsız alıcılar, eksik belgeler, 1000 üzeri sertifika kuyruğu, iptal edilmiş/düzeltilmiş kaynak, ACL/RLS. Cron/admin kimlik ve iş kaydı testleri, gerçek PostgreSQL 17.6 iki bağlantılı claim/settlement yarışı, mobil 375 px ve klavye kabulü ayrıca vardır. Hiçbir dış e-posta/ödeme/DB isteği yapılmadı. Ayrıntılı son sayılar ve günlükler ortak çalışma alanındaki outputs/astra-bildirim-kuyrugu/TESLIM-RAPORU.md içindedir.
