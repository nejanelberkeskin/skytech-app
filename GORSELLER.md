# Skytech Green Vitrin — Görsel Yerleşim Rehberi

Kodda `{/* GORSEL: ... */}` notlarıyla işaretlenmiş tüm görsel placeholder'larının listesi. Her birinin nerede, hangi oran/format ve ne içermesi gerektiği belirtilmiştir.

Görselleri hazırlayıp `public/images/` altına koyduktan sonra ilgili kodda placeholder gradient/SVG'leri `<img>` veya `next/image` ile değiştirebilirsin.

---

## 🏠 ANA SAYFA (`app/(vitrin)/page.tsx`)

### 1. Hero arka planı (opsiyonel — şu an mesh-dark + aurora yeter)
- **Dosya:** `components/vitrin/homepage/HeroSection.tsx`
- **Konum:** En üstteki section (`-mt-20 pt-32 pb-24`)
- **Format:** Video (MP4, ~15 MB, autoplay+muted+loop) veya yüksek-kaliteli JPG
- **Oran:** 16:9, en az **1920×1080**
- **Ne olmalı:** Drone'dan tohum atışı yavaş çekim, alacakaranlık/şafak ışığı
- **Yer:** Şu anki `<div className="mesh-dark grain-overlay">` katmanının yerine `<video>` etiketi
- **Önerilen dosya yolu:** `public/videos/hero-drone.mp4` + `public/images/hero-poster.jpg`

### 2. Tohumun Yolculuğu — gerçek tohum topu render'ı (opsiyonel)
- **Dosya:** `components/vitrin/homepage/SeedJourney.tsx` — satır 148
- **Format:** PNG, transparan arka plan
- **Boyut:** 256×256 px, retina için 512×512 önerilir
- **Ne olmalı:** Gerçekçi tohum topu — kil küre, çatlaklardan filiz çıkmış
- **Yer:** Şu anki SVG circle + path placeholder yerine `<img>` ya da `next/image`
- **Önerilen dosya yolu:** `public/images/tohum-topu-render.png`

### 3. Sihirli Lens — Önce/Sonra arazi fotoğrafları
- **Dosya:** `components/vitrin/homepage/MagicLens.tsx`
- **2 görsel gerekli:**
  - **a) Önce (yanmış arazi)** — satır 117 → `BarrenScene()` içinde
  - **b) Sonra (yeşil orman)** — satır 158 → `ForestScene()` içinde
- **Format:** JPG, sıkıştırılmış
- **Oran:** 16:9, **1600×900** önerilir
- **Ne olmalı:** **Aynı bölgenin** önce/sonra fotoğrafı (Manavgat 2021 vs. 2026 gibi). Yangın sonrası çorak vs. yeşil dolu drone üst görünüm.
- **Yer:** Şu anki SVG generated `<DeadTrees />` / `<LiveTrees />` placeholder'larını kaldırıp tek bir tam-boyut `<img>` ile değiştir.
- **Önerilen dosya yolları:**
  - `public/images/lens-before-burnt.jpg`
  - `public/images/lens-after-forest.jpg`

### 4. Önce/Sonra — Manavgat 2021 vs 2026
- **Dosya:** `components/vitrin/homepage/BeforeAfter.tsx`
- **2 görsel gerekli:**
  - **a) Yanmış arazi (2021)** — satır 131 → `BarrenLayer()`
  - **b) Yenilenmiş orman (2026)** — satır 185 → `ForestLayer()`
- **Format:** JPG
- **Oran:** 16:9, **1600×900**
- **Ne olmalı:** Aynı koordinattan çekilmiş gerçek önce/sonra fotoğrafı. MagicLens'tekinden farklı bir bölge olabilir (ekran zenginleşir).
- **Yer:** Şu anki gradient + SVG ağaç silüetleri kaldırılıp tek `<img>` ile değiştir.
- **Önerilen dosya yolları:**
  - `public/images/manavgat-2021-yanmis.jpg`
  - `public/images/manavgat-2026-yesil.jpg`

---

## 🗺️ PROJELER SAYFASI (`app/(vitrin)/projeler/page.tsx`)

### 5. Proje kart kapak görselleri (6 adet)
- **Dosya:** `components/vitrin/projeler/ProjectsGrid.tsx` — satır 98
- **Format:** JPG, sıkıştırılmış
- **Oran:** 16:10, **1280×800**
- **Ne olmalı:** Her proje için **drone üst görünüm** (Antalya/Manavgat, Muğla/Marmaris, İzmir/Karşıyaka, Ankara/Beypazarı, Çanakkale/Gelibolu, Bolu/Mengen)
- **Yer:** Şu anki `bg-gradient-to-br from-[#1B6B3A] via-[#22894a] to-[#0a1f12]` div'inin arkasına `<img>` ekle veya replace et
- **Önerilen dosya yolları:**
  - `public/images/projeler/antalya-manavgat.jpg`
  - `public/images/projeler/mugla-marmaris.jpg`
  - `public/images/projeler/izmir-karsiyaka.jpg`
  - `public/images/projeler/ankara-beypazari.jpg`
  - `public/images/projeler/canakkale-gelibolu.jpg`
  - `public/images/projeler/bolu-mengen.jpg`
- **Bonus:** `lib/projects-data.ts`'e her proje için `image: "/images/projeler/xxx.jpg"` alanı ekleyerek render'da otomatik kullanabiliriz.

---

## 🔬 TOHUM TOPU SAYFASI (`app/(vitrin)/tohum-topu/page.tsx`)

### 6. Tohum topu yakın çekim
- **Dosya:** `app/(vitrin)/tohum-topu/page.tsx` — satır 62
- **Format:** JPG veya PNG
- **Oran:** 1:1, **1000×1000**
- **Ne olmalı:** Tohum topunun yakın çekimi — kil küre, içinden tohumun görünmesi, dokulu yüzey
- **Yer:** Şu anki gradient + SVG circle placeholder'ı `<img>` ile değiştir
- **Önerilen dosya yolu:** `public/images/tohum-topu-yakin.jpg`

---

## 🚁 DRON TEKNOLOJİSİ SAYFASI (`app/(vitrin)/dron-teknolojisi/page.tsx`)

### 7. Drone aksiyonu
- **Dosya:** `app/(vitrin)/dron-teknolojisi/page.tsx` — satır 58
- **Format:** JPG veya PNG (transparan arka plan da olabilir)
- **Oran:** 1:1, **1000×1000**
- **Ne olmalı:** Drone havada tohum atışı yaparken — dinamik eylem fotoğrafı veya 3D render
- **Yer:** Şu anki gradient + SVG drone silueti placeholder'ı `<img>` ile değiştir
- **Önerilen dosya yolu:** `public/images/dron-aksiyon.jpg`

---

## 👥 HAKKIMIZDA SAYFASI (`app/(vitrin)/hakkimizda/page.tsx`)

### 8. Ekip fotoğrafı veya saha çekimi
- **Dosya:** `app/(vitrin)/hakkimizda/page.tsx` — satır 64
- **Format:** JPG
- **Oran:** 1:1, **1000×1000**
- **Ne olmalı:** Saha ekibinin grup fotoğrafı veya drone uçuş sahnesi — insan dokunuşu
- **Yer:** Şu anki 3×3 placeholder grid'i `<img>` ile değiştir
- **Önerilen dosya yolu:** `public/images/ekip-saha.jpg`

---

## 📞 İLETİŞİM SAYFASI (`app/(vitrin)/iletisim/page.tsx`)

### 9. Google Maps embed (Ankara ofis)
- **Dosya:** `app/(vitrin)/iletisim/page.tsx` — satır 79
- **Format:** Google Maps `<iframe>` embed
- **Oran:** 16:9
- **Ne olmalı:** Ankara ofis lokasyonu — Google Maps'tan "Share → Embed a map" iframe HTML'i
- **Yer:** Şu anki "Harita Yakında" placeholder div'ini iframe ile değiştir
- **Örnek snippet:**
  ```jsx
  <iframe
    src="https://www.google.com/maps/embed?pb=..."
    width="100%" height="100%"
    style={{ border: 0 }}
    allowFullScreen loading="lazy"
    referrerPolicy="no-referrer-when-downgrade"
  />
  ```

---

## 🍃 BREADCRUMB ARKA PLANI (opsiyonel)

### 10. Tüm alt sayfa hero arka planı
- **Dosya:** `components/vitrin/BreadCrumb.tsx` — satır 15
- **Format:** JPG
- **Oran:** 16:9, **1920×1080**
- **Ne olmalı:** Doğa fotoğrafı — yeşil orman, drone üst görünüm, ışık vurmuş ağaçlar
- **Yer:** `<BreadCrumb backgroundImage="/images/breadcrumb-bg.jpg" ... />` prop'u zaten hazır — sadece görseli koy ve sayfalarda prop'u geç.
- **Önerilen dosya yolu:** `public/images/breadcrumb-bg.jpg`

---

## 📂 Klasör Yapısı Önerisi

```
public/
├── videos/
│   └── hero-drone.mp4              (15-25 MB)
└── images/
    ├── hero-poster.jpg             (video poster)
    ├── tohum-topu-render.png       (transparan, 512×512)
    ├── tohum-topu-yakin.jpg        (1000×1000)
    ├── dron-aksiyon.jpg            (1000×1000)
    ├── ekip-saha.jpg               (1000×1000)
    ├── breadcrumb-bg.jpg           (1920×1080)
    ├── lens-before-burnt.jpg       (1600×900)
    ├── lens-after-forest.jpg       (1600×900)
    ├── manavgat-2021-yanmis.jpg    (1600×900)
    ├── manavgat-2026-yesil.jpg     (1600×900)
    ├── projeler/
    │   ├── antalya-manavgat.jpg    (1280×800)
    │   ├── mugla-marmaris.jpg
    │   ├── izmir-karsiyaka.jpg
    │   ├── ankara-beypazari.jpg
    │   ├── canakkale-gelibolu.jpg
    │   └── bolu-mengen.jpg
    └── echofy/                     (mevcut — referans/yedek)
```

---

## 🛠️ Görselleri Yerleştirme

Görselleri eklediğin zaman söyle, ben her birini ilgili koda `next/image` ile entegre ederim. Örnek:

**Önce (placeholder):**
```tsx
<div className="aspect-square bg-gradient-to-br from-[#1B6B3A] to-[#0a1f12]">
  {/* GORSEL: Tohum topu yakın çekim — 1:1 oran */}
  <div className="absolute inset-0 flex items-center justify-center">
    <svg className="w-48 h-48 text-white/20">...</svg>
  </div>
</div>
```

**Sonra:**
```tsx
import Image from "next/image";

<div className="relative aspect-square overflow-hidden rounded-3xl">
  <Image
    src="/images/tohum-topu-yakin.jpg"
    alt="Tohum topu yakın çekim"
    fill
    className="object-cover"
    sizes="(max-width: 768px) 100vw, 50vw"
  />
</div>
```

---

## Öncelik Sırası (önerim)

1. **Hero video** — ana sayfa girişi, en yüksek etki
2. **6 proje fotoğrafı** — Projeler sayfası şu an düz gradient
3. **Tohum topu yakın çekim** + **Drone aksiyon** — ana ürün/teknoloji sayfaları
4. **Önce/Sonra fotoğrafları** — MagicLens + BeforeAfter (en çok etki yaratan 2 bölüm)
5. **Ekip fotoğrafı** — Hakkımızda
6. **Google Maps embed** — İletişim (en kolay, 5 dakikada hallolur)
7. **Breadcrumb arka planı** — opsiyonel cila

---

**Toplam:** ~15 görsel + 1 video + 1 maps embed
