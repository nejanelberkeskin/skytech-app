/**
 * Proje Uygulama Sahası — vitrin veri sözleşmesi.
 *
 * Bu tipler İSTEMCİYE gidebilen alanları tanımlar. Kapasite sayıları
 * (capacity/filled/reserved/sold) bilinçli olarak YOKTUR: sahalarda hektar
 * gösterilir, bırakılacak tohum topu sayısı gösterilmez. Satışa uygunluk yalnız
 * `acceptsOrders` ile iletilir; kapasite denetimi sipariş anında sunucuda yapılır.
 */

export const WORK_TYPES = ["ormanlastirma", "genclestirme", "ormanlastirma_genclestirme"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

/**
 * Sahanın vitrindeki evresi (DB `land_status` → vitrin):
 *   open → open · full → full · scheduled → scheduled ·
 *   seeded → released · monitoring → monitoring · closed → (listelenmez)
 */
export const SITE_PHASES = ["open", "full", "scheduled", "released", "monitoring"] as const;
export type SitePhase = (typeof SITE_PHASES)[number];

export type SiteLocale = "tr" | "en" | "ru";

export interface SiteSpecies {
  /** seed_catalog.slug — yerelleştirilmiş ad için `ourSeeds.seeds.<slug>.name` kullanılır. */
  slug: string;
  /** Türkçe ad (katalogdan); çeviri anahtarı yoksa yedek. */
  name: string;
  latinName: string;
  /** public/images/tohumlar/<slug>.webp varsa yolu. */
  image: string | null;
}

export interface ProjectSite {
  id: string;
  slug: string;
  /** İstenen dilde ad; çevirisi yoksa Türkçe ad. */
  name: string;
  province: string | null;
  district: string | null;
  /** Hektar; bilinmiyorsa null (arayüz alanı gizler). */
  areaHectares: number | null;
  isFireAffected: boolean;
  fireYear: number | null;
  workType: WorkType;
  /** Sahaya bırakılan tür(ler). Müşteri seçmez; bilgi olarak gösterilir. */
  species: SiteSpecies[];
  /** İstenen dilde kısa tanıtım; yoksa null. */
  summary: string | null;
  coverImage: string | null;
  gallery: string[];
  /** Yaklaşık konum (2 ondalık ≈ 1 km); harita noktası içindir. */
  lat: number | null;
  lng: number | null;
  phase: SitePhase;
  /** Sipariş/talep alınıyor mu? (yalnız `open` evresinde true) */
  acceptsOrders: boolean;
  /** Çalışma videosu (YouTube); yayımlanınca dolar. */
  videoUrl: string | null;
}
