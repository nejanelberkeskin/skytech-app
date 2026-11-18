# SEO/GEO düzeltmeleri — 18 Kasım 2026

Taban: `603f3853871bb4dc7b3c1706ea7a2d898409cae7` (`origin/main`). Dal: `seo-geo-duzeltmeleri`.

Önceki canlı denetimdeki 14 işin yazılım ve metin düzenlemeleri bu dalda uygulanmıştır. G04'ün gerçek saha belgeleri, tür gerekçeleri ve tarihlerinin yayımlanması operasyon verisi gerektirir; bu bölüm tamamlanmış sayılmamıştır. Canlı veritabanına yazma, SQL, gerçek talep/e-posta/ödeme, main birleştirmesi veya üretim yayını yapılmadı.

## İş listesi

| Kod | Durum | Değişiklik / sınır |
|---|---|---|
| T01 | Tamamlandı | `/_next/` genel robots engeli kaldırıldı. CSS, JS ve görseller taranabilir; özel API/hesap korumaları korunur. |
| T02 | Tamamlandı | Ana sayfa H1, özet ve CTA hydration beklemeden görünür. İç sayfa başlıklarındaki gecikmeli gizleme de kaldırıldı. |
| G01 | Tamamlandı | Kaynaksız başarı oranları, hız/ömür/üstünlük ifadeleri ve standart uyumu iddiası temizlendi. Demo paneli ve temsili görseller açıkça etiketlendi; demo `data-nosnippet` kapsamındadır. Gerçek sonuç uydurulmadı. |
| T03 | Tamamlandı | Özel teklif URL'leri sitemap dışında; self canonical ve noindex var. Eski `/kurumsal` tanıtım sayfası da sitemapten çıktı. |
| T04 | Tamamlandı, belirtilen politika ile | Hukuk belgelerinin gövdesi Türkçe kalır; TR canonical, yalnız TR sitemap/hreflang; EN/RU kopyalarında noindex, açık dil bildirimi ve belge/H1 üzerinde `lang=tr`. Hukuk çevirisi yapıldığı iddia edilmez. Bilinen saha adı son eki EN/RU'ya çevrilir; özel yer isimleri korunur. |
| T05 | Tamamlandı | Service ve Breadcrumb URL'leri aktif dile göre üretilir. Hayali breadcrumb adresi kaldırıldı. Saha ayrıntısına breadcrumb şeması eklendi. |
| T06 | Tamamlandı | Her deploy'da uydurulan `lastmod` kaldırıldı. Güvenilir anlamlı güncelleme tarihi sağlanana kadar bu isteğe bağlı alan yazılmıyor. |
| T07 | Yerel ölçümle doğrulandı | Ana içerik artık animasyon/hydration gecikmesini beklemiyor. Aynı koşullu karşılaştırma aşağıda. Canlı CWV/CrUX ve gerçek kullanıcı INP sonucu değildir. |
| G02 | Tamamlandı | `llms.txt` ürünler, Kasım–Mart sezonu, hizmet/rapor sınırları, şirket kuruluşu ve değişken ödeme durumu bakımından güncellendi. Sıralama veya AI atıf garantisi verilmez. |
| G03 | Tamamlandı | `/kaplamali-tohum` TR/EN/RU sunucu sayfası; ürün farkı, hizmet, sonuç sınırları, kayıtlar ve tür seçimi anlatıldı. Menü, footer, sitemap ve saha iç bağlantıları eklendi. |
| G04 | Arayüz tamamlandı; operasyon verisi açık | Saha bazlı mevcut konum/ürün/evre verilerinden açıklama, hizmet kapsamı, tür bilgisi boşluk açıklaması ve yöntem/rapor bağlantısı eklendi. Haber bağlantısı, tamamlanmış faaliyet kanıtından ayrıldı. Gerçek izin/tür gerekçesi/tarih/sonuç kaydı eklenmedi. |
| G05 | Tamamlandı | 2021 fikir/hikâye başlangıcı ile 7 Mayıs 2024 tüzel kuruluş ayrıldı. Organization tarihi düzeltildi. Teyitsiz 36 kişi ve rol başına çalışan sayıları kaldırıldı. |
| T08 | Tamamlandı | Kamuya açık içerikte www ve `/tr` normalizasyonu. İç next-intl rewrite ve RSC/arka plan istekleri yönlendirme döngüsüne sokulmaz. Belirteç kapısı önce çalışır; sipariş/hesap çerezleri host değişimine zorlanmaz. |
| U01 | Tamamlandı | Mobil çerez tercihi açıkken sabit CTA gizlenir; sayfa içi bağlantı kalır. Tercih sonrası geri gelir, tercihler yeniden açılınca çekilir. Kabul/ret eşit görünümdedir. |

## Ek olarak bulunan eski kurumsal sayfa

Satış/B2B bayrağı açıkken `/kurumsal` eski bir istemci tanıtım ekranını açıyordu: 128.000, karbon miktarı ve partner sayısı gibi fallback rakamları, blockchain/ISO/denkleştirme vaatleri bulunuyordu. Bu sayfa üç dilde güncel `/kurumsal-cozumler` sayfasına kalıcı yönlenir. Kurumsal panel, başvuru, giriş ve teklif işleyişi değiştirilmedi. Bayrak kapalıyken mevcut `/yakinda` kapısı korunur.

## Doğrulama

- `npm test`: **608/608**. Sipariş belirteci kapısının önceliği, hosta bağlı çerezin korunması, iç rewrite ve arka plan istekleri için regresyon kapsamı var.
- `npm run typecheck`: başarılı.
- `npm run lint:check`: 0 hata; hukuk şablonlarındaki önceden var olan iki kullanılmayan `draftNotes` uyarısı sürüyor.
- `npm run i18n:check`: üç dilde **1.827** anahtar eşleşiyor; önceden boş bırakılmış EN/RU `projectsPage.cta.titleTail` için iki uyarı var.
- `npm run build`: Next 16.3.5 / Turbopack üretim derlemesi başarılı. Mevcut middleware→proxy taşıma uyarısı bu işin kapsamında değiştirilmedi.
- `npm run test:prefetch:self`: 17 olumlu/olumsuz senaryo ve çıkış kodları beklendiği gibi. Hatalı yönlendirme başarı sayılmıyor.
- Tarayıcı kabulü: **260/260**; 57 sitemap URL'si, üç dil ve altı ön yükleme/gezinme senaryosu başarılı. 371 tarayıcı isteğinde dış istek ve mutasyon denemesi 0.
- Ana sayfa LCP, eş koşullu üçer yerel ölçüm: önce 4.268 / 4.276 / 4.268 saniye; sonra 1.116 / 1.112 / 1.120 saniye. Medyan **4.268 → 1.116 saniye** (yaklaşık %74 azalma). Her ölçümde CLS 0.
- İkincil sayfalarda tek eş koşullu kontrol: `/tohum-topu` 1.100 → 1.072 saniye; Bursa saha sayfası 1.064 → 1.052 saniye; CLS yine 0. Bunlar üç tekrar değildir ve küçük farklar anlamlı hız kazanımı iddiası sayılmaz; belirgin gerileme görülmedi.
- Koşullar: Chrome, 390×844, soğuk tarayıcı önbelleği, 150 ms ağ gecikmesi, 1.6 Mbps indirme, CPU 4× yavaşlatma; aynı makine, bağımlılıklar ve yerel veri fikstürü. Bu bir Lighthouse puanı veya canlı saha metriği değildir.

Tarayıcı kabulü gerçek üretim derlemesini, üç sentetik sahası olan **salt okunur yerel HTTP/PostgREST fikstürü** ile çalıştırır. Gerçek Supabase anahtarı kullanılmaz. Tarayıcı dış istekleri ve GET/HEAD dışındaki yöntemleri engeller. `POST`/gerçek form gönderimi yapılmaz. Bayraklar kabul kapsamını görmek için yerelde açıktır; canlı satışın açık olduğu anlamına gelmez.

Kapsam: 57 sitemap URL'si, metadata/canonical/H1/indexleme, 18 EN/RU hukuk kopyası, Service/Breadcrumb URL'leri, üç dilde saha adı ve yeni ürün sayfası, JavaScript kapalı ilk görünüm, 390 px taşma, çerez/CTA, www/TR canonical, eski kurumsal yönlendirme ve istemci dil/gezinme ön yüklemesi.

## Tekrarlama

1. Ayrı terminalde `FIXTURE_PORT=4828 node scripts/e2e/seo-fixture.mjs`.
2. Build ve start ortamını yalnız bu fikstüre bağlayın: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4828`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=seo-fixture-anon`, `SUPABASE_SERVICE_ROLE_KEY=seo-fixture-service`. `.env` içinde gerçek anahtar kullanmayın. Fikstür adındaki bu dizeler gerçek anahtar değildir.
3. Bu kabulün bayrakları: `NEXT_PUBLIC_SALES_ENABLED=true`, `NEXT_PUBLIC_TRANSACTIONS_ENABLED=true`, `NEXT_PUBLIC_CORPORATE_PORTAL_ENABLED=true`, `NEXT_PUBLIC_LEGAL_PAGES_ENABLED=true`, `NEXT_PUBLIC_PRICING_VISIBLE=true`; `NEXT_PUBLIC_SITE_URL=https://skytechgreen.com`, `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3348`. `npm run build`, ardından aynı ortamla `npm run start -- --hostname 127.0.0.1 --port 3348`.
4. `BASE=http://localhost:3348 OUTPUT=/tmp/seo-acceptance node scripts/e2e/seo-acceptance.mjs` (kurulu Chrome gerekir).
5. Hız karşılaştırması: taban ve uç aynı bağımlılıklarla, aynı fikstür ve bayraklarla ayrı üretim derlemesi olarak 3349/3348 portlarında çalışır. `OUTPUT=/tmp/seo-performance.json node scripts/e2e/seo-performance.mjs`. Ek sayfalar için `PATHS=/tohum-topu,/sahalar/bursa-proje-uygulama-sahasi RUNS=1` kullanılır.

## G04 için gerçekten açık kalanlar

Operasyon ekibi her saha için mevcut yönetim alanlarına gerçek ürün/tür bilgisini ve açıklamayı, teyitli tarihleri, izin kapsamı/kaynağını ve gerçekleşmiş işin rapor/görüntü bağlantılarını girmelidir. Bursa, Çanakkale ve İzmir için aynı genel paragrafı sonuç kanıtı saymak doğru değildir. Sadece planlanmış bir iş, tamamlanmış iş gibi gösterilmemelidir. Bu dal bunları uydurmaz veya canlıya yazmaz.

Yayın sonrası robots/sitemap/canonical ve yönlendirmeler üretim hostunda tekrar okunmalı; Search Console URL incelemesi/sitemap gönderimi ve 28 günlük CWV etkisi ayrıca izlenmelidir. İndekslenme, sıralama, trafik veya üretken aramada atıf artışı bu yerel testlerle kanıtlanmış değildir.

## Kanıt konumu

Yerel çalışma alanı: `outputs/astra-seo-geo-duzeltmeleri/`. `TESLIM-RAPORU.md`, `crawl.json`, `acceptance.json`, `network.json`, `prefetch.json`, komut günlükleri, mobil ekran görüntüleri, `performance*.json` ve salt okunur fikstür istek günlüğü bulunur. Bu rapor depoda; büyük ham ağ kayıtları ve ekran görüntüleri yerel kanıt klasöründedir.
