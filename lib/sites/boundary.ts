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

export function siteBoundaryImage(slug: string): SiteBoundaryImage | null {
  return BOUNDARIES[slug] ?? null;
}
