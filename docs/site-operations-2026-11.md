# Kasım 2026 saha kayıtları

Kaynak: işletmecinin 24 Kasım 2026 tarihli talimatı. `lib/sites/operations.ts` yayımlanacak saha çalışma kayıtlarını tutar; sipariş, satılmış miktar, kapasite rezervasyonu veya tekil sertifika teslim verisi değildir.

- İzmir/Aliağa: Kasım 2026 bırakma tamamlandı; işletmeci beyanı 14.000.000 tohum ve sertifikaların teslim edildiği yönünde. İlk izleme çekimi Mayıs–Haziran 2027 için planlı; çimlenme sonucu yok.
- Bursa: Kasım 2026 planı; genel saha 400 ha. Uygulama alanı mevcut saha kaydından gelir (92,8 ha).
- Çanakkale: Aralık 2026 planı; mevcut uygulama alanı 95 ha. Eski test fikstüründeki 382,4 ha, 18 Kasım canlı veri güncellemesiyle uyumlu 95 ha yapıldı.
- Tahmini bırakılacak tohum: alan × 7 kg/ha × 20.000 tohum/kg. Bursa 12.992.000, Çanakkale 13.300.000. Bu işletmecinin planlama varsayımıdır; ölçülmüş bin dane ağırlığı, satış miktarı, tohum topu adedi veya sağlayıcı kapasitesi değildir. İzmir'in gerçekleşen 14.000.000 beyanı hesapla değiştirilmez.
- %21 ve %34 işletmeci tarafından görsel doluluk önerisi olarak açıklandı; gerçekleşen satış gibi gösterilmedi.

## Alanların kapsamı ve haber kaynakları

Genel proje alanı, bu dönem tohumlanan/tohumlanacak alan ve bölgesel yangının etkilediği orman alanı ayrı kavramlardır. Bursa'nın 400 ha genel alanı işletmeci beyanıdır. Diğer iki sahanın genel proje sınırı haberlerden türetilmedi; haber verisi ayrı kaynak kutusunda gösterilir.

- [OGM, 6 Ağustos 2026](https://www.ogm.gov.tr/izmirobm/haberler/aliaga-bozkoy-ile-foca-ilipinar-arasinda-25-haziran-2025-tarihinde-meydana-gelen-orman-yanginindan-etkilenen-alanda-agacla): 25 Haziran 2025 Aliağa–Bozköy / Foça–Ilıpınar yangını, etkilenen orman 907 ha. Bu geniş bölgenin tamamı Skytech Green uygulama alanı olarak sunulmaz. Başka Bozköy yangını haberlerindeki 150 ha ve Ege Orman Vakfı raporundaki 897 ha ile birleştirilmez.
- [DHA, 21 Ağustos 2025](https://www.dha.com.tr/foto-galeri/canakkaledeki-4-yanginda-5-bin-236-hektar-orman-alani-zarar-gordu-2703724): 8 Ağustos 2025 Sarıcaeli yangını, etkilenen orman 617 ha. İldeki dört yangının 5.236 ha toplamı veya 2024 Bayramiç–Saraycık yangınıyla karıştırılmaz. 617 ha tüm arazi türlerini kapsayan toplam yanık alan diye sunulmaz.

## Medya

- Kare seçkisi: `outputs/aliaga-gorsel-seckisi-2026-11-24`, 01/02/05/06/09/10/11/12. Seçki kayıtlarına göre gerçek video kareleri; üretken değişiklik yok. Seçilen kareler saha incelemesi, hazırlık ve dron uygulaması; fidan/yeşillenme kareleri sonuç kanıtı olarak kullanılmadı.
- Kaynak video: `/Volumes/Extreme Pro/Skytech Green/1117_BES_VERSIYON_V02/1080p/03_Muziksiz_Canli_1080p.mp4`. Özgün dosya korunur. Web kopyası H.264/AAC 720p; videonun adresi tıklamaya kadar medya öğesine bağlanmaz. Poster ve video aynı site üzerindedir; üçüncü taraf oynatıcı/ytimg yok.
- Yatay/dikey sertifika tasarım entegrasyonu kullanıcının son talimatıyla bekliyor; mevcut renderer değiştirilmedi.

## Kapanış ve veri sınırı

İzmir vitrin evresi bırakma tamamlandı olarak gösterilir (ileride DB izlemeye geçerse izleme evresi korunur); katılım düğmeleri yoktur ve `/katil` ayrıntıya döner. Siparişin `checkSite` kontrolü aynı vitrin uygunluğunu kullanır. Talep ucu ayrıca çalışma kaydını kontrol ederek doğrudan POST'u `landInvalid` ile reddeder. Yeni B2B akışı veya genel satış bayrakları açılmaz.

Bu paket canlı SQL çalıştırmaz; `lands.status` yönetim kaydını, kapasite sayaçlarını, geçmiş siparişleri veya tekil sertifikaları değiştirmez. Yayın sırasında yönetim kaydının `seeded` evresine alınması operasyonel tutarlılık için ayrıca yapılmalıdır. Sonraki çalışma dönemi açılacaksa bu tarihli tamamlanma kaydı da güncellenmelidir; sadece DB'de `open` yapmak siteyi yeniden açmaz.

## Doğrulama

612/612 test; üç dilde 1.861 anahtar; TypeScript/üretim derlemesi başarılı; lint 0 hata, önceden var olan 2 uyarı. Yerel tarayıcı üç dil × 390/1440: 110/110. Ağ kaydı tıklamadan önce video isteği 0; sonrasında yalnız aynı site videosu. Dış istek 0. Yerel gerçek HTTP `/api/public/talep` geçerli İzmir gövdesini 400 `details.landId=landInvalid` ile reddeder; fikstür yazma kabul etmez. Canlı talep/e-posta/ödeme yapılmadı.

Kanıtlar: çalışma alanındaki `outputs/astra-saha-kasim-2026/`. Tekrar: `scripts/e2e/seo-fixture.mjs`; derleme/start aynı sahte Supabase değerleriyle; `BASE=http://127.0.0.1:3353 node scripts/e2e/site-operations.mjs`. Doğrudan POST senaryosu Next yerel host normalizasyonu nedeniyle `http://localhost:3353` üzerinden yapılır; CSRF kapatılmaz.
