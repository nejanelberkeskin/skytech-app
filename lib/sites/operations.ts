/** Published operation facts confirmed by the operator on 24 November 2026.
 * These are project records, never sales counters or customer order/fulfilment records.
 * Month-only dates deliberately retain their original precision.
 */
export interface SiteOperation {
  releaseMonth: string;
  completed: boolean;
  totalAreaHectares?: number;
  fireContext?: { hectares: number; scopeKey: string; source: string; publisher: string };
  releasedSeeds?: number;
  certificatesDelivered?: boolean;
  monitoringWindow?: { from: string; through: string };
  photos?: { src: string; caption: string }[];
  video?: { src: string; poster: string };
}
const base = "/images/sahalar/aliaga-2026-11/";
const operations: Readonly<Record<string, SiteOperation>> = {
  "izmir-proje-uygulama-sahasi": {
    releaseMonth: "2026-11", completed: true, releasedSeeds: 14_000_000,
    fireContext: { hectares: 907, scopeKey: "izmirFire", publisher: "OGM · 06.08.2026", source: "https://www.ogm.gov.tr/izmirobm/haberler/aliaga-bozkoy-ile-foca-ilipinar-arasinda-25-haziran-2025-tarihinde-meydana-gelen-orman-yanginindan-etkilenen-alanda-agacla" },
    certificatesDelivered: true,
    monitoringWindow: { from: "2027-05", through: "2027-06" },
    photos: [
      { src: base + "01.webp", caption: "inspection" },
      { src: base + "02.webp", caption: "team" },
      { src: base + "05.webp", caption: "drying" },
      { src: base + "06.webp", caption: "preparation" },
      { src: base + "09.webp", caption: "drone" },
      { src: base + "10.webp", caption: "equipment" },
      { src: base + "11.webp", caption: "aerial" },
      { src: base + "12.webp", caption: "release" },
    ],
    video: { src: "/videos/sahalar/aliaga-kasim-2026.mp4", poster: base + "09.webp" },
  },
  "bursa-proje-uygulama-sahasi": {
    releaseMonth: "2026-11", completed: false, totalAreaHectares: 400,
  },
  "canakkale-proje-uygulama-sahasi": {
    releaseMonth: "2026-12", completed: false,
    fireContext: { hectares: 617, scopeKey: "canakkaleFire", publisher: "DHA · 21.08.2025", source: "https://www.dha.com.tr/foto-galeri/canakkaledeki-4-yanginda-5-bin-236-hektar-orman-alani-zarar-gordu-2703724" },
  },
};
export function siteOperation(slug: string): SiteOperation | null {
  return Object.hasOwn(operations, slug) ? operations[slug] : null;
}
export function operationClosesParticipation(slug: string): boolean {
  return siteOperation(slug)?.completed === true;
}
export function operationMonth(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}-01T12:00:00Z`));
}

/** Operator planning assumption, not a seed-lot measurement or saleable inventory. */
export function estimatedSeedTarget(areaHectares: number | null): number | null {
  if (areaHectares === null || !Number.isFinite(areaHectares) || areaHectares <= 0) return null;
  return Math.round(areaHectares * 7 * 20_000);
}
