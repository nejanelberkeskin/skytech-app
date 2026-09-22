# Hukuk revizyonu teslim raporu

22 Eylül 2026 • hukuk-son-inceleme • Taban: origin/faz5c-satis-ayarlari (64f6409)

## Sonuç

Macun adresi, kullanıcı teyitli Kahramankazan Vergi Dairesi ve Ankara Ticaret Sicili Müdürlüğü / 510174 uygulama ve belge paketine işlendi. Tam unvan, VKN ve MERSİS eşlendi; UETS, KEP diye kullanılmadı. Kullanıcının kabul ettiği ayrı isteğe bağlı ad yayın izni sunucu, sipariş ekranı ve herkese açık sertifika çıktılarında uygulandı. Sertifika/izleme süreleri kullanıcı tarafından ayrıca bildirileceği için uydurulmadı. Metin revizyonu tamamlandı; olgusal eksikler ve operasyon kabulü nedeniyle 2026-09.4-taslak kilidi korunuyor. Bu çalışma avukat imzası veya hukuka uygunluk onayı değildir.

Cayma ve uzamaları, iade süresinin başlangıcı, gecikme/imkânsızlık, tür ve hizmet değişikliklerinde açık kabul, tüketici statüsü, delil ve yetki hükümleri düzeltildi. KVKK amaç/sebep/aktarım/saklama ve başvuru hükümleri ayrıntılandırıldı. Site politikaları aynı kaynaklara bağlandı. Analitik için ayrı izin ve varsayılan kapalı aktarım hazırlığı anahtarı eklendi; özel işlem sayfaları ölçüm dışında bırakıldı. Ayrıntılı gerekçe ve 17 resmî kaynak HUKUK-INCELEMESI.md içindedir.

## Teslimler

- Yerel paket: ../outputs/yayin-hukuk-paketi — 17 düzenlenebilir Markdown metni, 41 sayfalık birleşik Word, README ve tüm belgelerin ZIP paketi.
- Örnekler: ../web-brifler/hukuk-taslaklari — 4 belge × 3 senaryo = 12 PDF ve 12 HTML; toplam 66 PDF sayfası.
- Bu dizindeki metinler/ paketin inceleme anındaki kopyasıdır. 01/02/04/09 ile 08/10/11 uygulama şablonlarından scripts/export-legal-review.mjs ile üretilir. Bunlar bağımsız ikinci sözleşme seti değildir.
- ../web-brifler/10-YAYIN-KONTROL-LISTESI.md ve hukuk-taslaklari/KVKK-AVUKAT-NOTLARI.md güncel kullanıcı kararları ve kalan işlerle eşlendi.
- ARTIFACT-MANIFEST.json, teslim edilen Word ve PDF/HTML/metinlerin SHA-256 özetlerini içerir. QA ara görselleri teslim belgesi değildir.

## Çalıştırılan kontroller

| Komut | Sonuç | Çıktı |
|---|---|---|
| npm run typecheck | geçti, çıkış 0 | checks/typecheck.txt |
| npm run i18n:check | geçti, çıkış 0 | checks/i18n.txt |
| npm test | 13 test geçti, 0 başarısız; çıkış 0 | checks/test.txt |
| npm run build | üretim derlemesi geçti, çıkış 0 | checks/build.txt |
| npm run lint | çıkış 1; 50 hata, 29 uyarı | checks/lint.txt |
| Değişen tüm TS/TSX/MJS dosyalarında eslint | 46 dosya, çıkış 0 | checks/lint-changed.txt |
| Aynı bağımlılıklarla başlangıç HEAD lint karşılaştırması | 70 hata, 29 uyarı; mevcut hatalar | checks/baseline-lint.txt |
| LEGAL_DRAFTS_DIR ile scripts/test/legal.test.mjs | 12 örnek PDF/HTML üretildi; geçti | checks/pdf.txt |
| git diff --check | geçti | boşluk/patch kontrolü |

Yeni testler: eski/izinsiz sertifikada adın gizlenmesi, ad ve rıza eşleşmesi, geri alma, üçüncü kişi adına izin reddi, isteğe bağlı varsayılanlar, ölçüm hazırlığı ve özel yollar, geri almadan sonra olay gönderilmemesi. Gerçek ödeme, e-posta veya veri tabanı yazımı kullanılmadı.

## Görsel ve yerel tarayıcı kontrolü

Word 41 sayfa olarak render edildi ve tamamı görsel incelendi; son metin düzeltmelerinden etkilenen sayfalar yeniden incelendi. 12 PDF'nin 66 sayfası render edildi; piksel düzeyinde aynı olanlar ayrılarak 53 farklı sayfa görsel incelendi. Kesilme/taşma veya bozuk Türkçe karakter saptanmadı; PDF metin koordinatı kontrolü de temiz. Belge gövdesi ve tablo yazıları 12 punto; HTML gövdesi 16px.

Yerel KVKK ve İletişim sayfaları, adres bağlantısı ve çerez tercihinde ret/yeniden açma/kabul denendi. Aktarım hazırlığı kapalıyken dış script ve iframe bulunmadığı DOM üzerinden gözlendi. Bu gözlem tam ağ kaydı/HAR kanıtı değildir. Gerçek kişisel veriyle işlem yapılmadı.

## Yayın öncesi açık işler

1. Kullanıcıdan gelecek ayrı sertifika ve izleme teslim süreleri; siparişe özgü kesin tarihlere dönüştürme.
2. KEP ve bağlı meslek odası; gerçek sağlayıcı tarafları/ülkeleri, KVKK m.9 mekanizması ve gerekiyorsa imza/bildirim; saklama-imha planı, VERBİS, İYS ve ETBİS değerlendirmesi/uygulaması.
3. Fatura doğuran olay, KDV ve iade belgeleri için mali uygulama. Müşteri metnini düzeltmek muhasebe motorunun bütün işlemlerini onaylamaz.
4. Cayma motorunun olağan paid/14 günlük takvim dışındaki kanuni uzamaları ve süresinde yöneltilmiş bildirimleri operasyonla ele alması. Otomatik ret hukuki hak kaybı diye kullanılamaz.
5. Yeni özel sertifika indirme ve ad yayın iznini geri alma uçlarının gerçek oturum/çerez, yetkisiz erişim, geri alma ve önbellek senaryolarıyla deneme verisi üzerinde kabulü. Birim testleri bu uçtan uca testin yerine geçmez.
6. Analitik anahtarı açılmadan önce sağlayıcı panel ayarları ve gerçek ağ kaydıyla ret/kabul/geri alma/özel sayfa geçişi kabulü. Anahtarın açılması için sırf çerez izni yeterli değildir.
7. #54 sipariş durdurma dalı bu tabana dahil değildir; entegrasyon sonrası son derleme ve deneme sipariş/ödeme/iade akışı. Bu çalışmada başka dal değiştirilmedi, rebase veya merge yapılmadı. Canlı satış açılmadı.

Tamamlanmamış olguları tamamlanmış gibi göstermek veya yalnız taslak ekini silmek yayın kabulü değildir. Google İşletme Profili gibi site dışı adres kayıtları bu çalışma kapsamında değiştirilmedi.
