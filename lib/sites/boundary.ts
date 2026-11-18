/**
 * Saha sınırı görselleri: KMZ sınırı (sarı) Sentinel-2 uydu görüntüsü üstünde. Kaynak: outputs/saha-kmz-2 (sinir-cikar.py, uydu.py).
 * Saha sayfasında tam boy gösterilir (kırpılmaz). Yeni saha için görseli public/images/sahalar'a ekleyip buraya yazın.
 */
export interface SiteBoundaryImage {
  src: string;
  width: number;
  height: number;
  /** Uydu çekim tarihi (YYYY-AA-GG). */
  capturedOn: string;
}

const BOUNDARIES: Record<string, SiteBoundaryImage> = {
  "izmir-proje-uygulama-sahasi": {
    src: "/images/sahalar/izmir-aliaga-sinir-sentinel2-2026-10.webp",
    width: 1600,
    height: 1638,
    capturedOn: "2026-10-05",
  },
  "canakkale-proje-uygulama-sahasi": {
    src: "/images/sahalar/canakkale-saraycik-sinir-sentinel2-2026-09.webp",
    width: 1600,
    height: 1476,
    capturedOn: "2026-09-21",
  },
  "bursa-proje-uygulama-sahasi": {
    src: "/images/sahalar/bursa-diskaya-sinir-sentinel2-2026-10.webp",
    width: 1600,
    height: 2610,
    capturedOn: "2026-10-10",
  },
};

/**
 * Kapakta "uzaktan → yakına" geçiş: aynı merkezli iki 4:3 kare (outputs/saha-kmz-2/kapak.py). GENİŞ karede saha
 * çerçevenin yaklaşık 1/10'unu kaplar; YAKIN karede çerçeveyi doldurur. `scale`, genişten yakına doğrusal orandır.
 */
export interface SiteZoomCover {
  wide: string;
  close: string;
  scale: number;
  capturedOn: string;
}

const ZOOM_SCALE = Math.sqrt(10);
const ZOOM_COVERS: Record<string, SiteZoomCover> = {
  "izmir-proje-uygulama-sahasi": {
    wide: "/images/sahalar/izmir-aliaga-genis-2026-10.webp",
    close: "/images/sahalar/izmir-aliaga-yakin-2026-10.webp",
    scale: ZOOM_SCALE,
    capturedOn: "2026-10-05",
  },
  "canakkale-proje-uygulama-sahasi": {
    wide: "/images/sahalar/canakkale-saraycik-genis-2026-09.webp",
    close: "/images/sahalar/canakkale-saraycik-yakin-2026-09.webp",
    scale: ZOOM_SCALE,
    capturedOn: "2026-09-21",
  },
  "bursa-proje-uygulama-sahasi": {
    wide: "/images/sahalar/bursa-diskaya-genis-2026-10.webp",
    close: "/images/sahalar/bursa-diskaya-yakin-2026-10.webp",
    scale: ZOOM_SCALE,
    capturedOn: "2026-10-10",
  },
};

export function siteZoomCover(slug: string): SiteZoomCover | null {
  return ZOOM_COVERS[slug] ?? null;
}

export function siteBoundaryImage(slug: string): SiteBoundaryImage | null {
  return BOUNDARIES[slug] ?? null;
}
