/**
 * Saha sınırı görselleri: KMZ sınırı (sarı) Sentinel-2 uydu görüntüsü üstünde. Kaynak: outputs/saha-kmz (uydu.py).
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
    src: "/images/sahalar/izmir-karsiyaka-sinir-sentinel2-2026-10.webp",
    width: 1600,
    height: 1354,
    capturedOn: "2026-10-05",
  },
  "canakkale-proje-uygulama-sahasi": {
    src: "/images/sahalar/canakkale-saraycik-sinir-sentinel2-2026-09.webp",
    width: 1600,
    height: 1498,
    capturedOn: "2026-09-21",
  },
};

export function siteBoundaryImage(slug: string): SiteBoundaryImage | null {
  return BOUNDARIES[slug] ?? null;
}
