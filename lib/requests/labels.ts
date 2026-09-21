/**
 * Talep alanlarının görünen adları (tr / en / ru) — e-postalar, hesabım
 * paneli ve admin listesi aynı sözlüğü kullanır. Saf veri; istemcide de
 * sunucuda da import edilebilir.
 */
import type { ServiceRequest, ServiceRequestStatus, ServiceRequestType } from "@/lib/types";
import { ilAdi } from "@/lib/tr-iller";
import { formatCount, formatTry } from "@/lib/pricing";

export type LabelLocale = "tr" | "en" | "ru";

type Dict<K extends string> = Record<LabelLocale, Record<K, string>>;

export const REQUEST_TYPE_LABELS: Dict<ServiceRequestType> = {
  // seed_purchase: 2026-09'da kaldırılan tür — yalnız eski kayıtlar için.
  tr: { seed_purchase: "Tohum talebi (eski)", land_application: "Kendi arazim için başvuru", open_land_seeding: "Sahaya tohum topu bıraktırma talebi" },
  en: { seed_purchase: "Seed request (legacy)", land_application: "Own-land application", open_land_seeding: "Seed ball release request" },
  ru: { seed_purchase: "Заявка на семена (архив)", land_application: "Заявка для собственного участка", open_land_seeding: "Заявка на сброс семенных шаров" },
};

export const REQUEST_STATUS_LABELS: Dict<ServiceRequestStatus> = {
  tr: { new: "Yeni", contacted: "İletişime geçildi", quoted: "Teklif verildi", converted: "Sonuçlandı", closed: "Kapatıldı", spam: "Spam" },
  en: { new: "New", contacted: "Contacted", quoted: "Quoted", converted: "Completed", closed: "Closed", spam: "Spam" },
  ru: { new: "Новая", contacted: "Связались", quoted: "Предложение отправлено", converted: "Завершена", closed: "Закрыта", spam: "Спам" },
};

export const LAND_CONDITION_LABELS: Dict<"burnt" | "mine" | "erosion" | "idle" | "other"> = {
  tr: { burnt: "Yanmış alan", mine: "Maden / taş ocağı sahası", erosion: "Erozyon hattı", idle: "Boş / atıl arazi", other: "Diğer" },
  en: { burnt: "Burnt area", mine: "Mine / quarry site", erosion: "Erosion line", idle: "Idle land", other: "Other" },
  ru: { burnt: "Выгоревшая территория", mine: "Территория рудника / карьера", erosion: "Эрозионная зона", idle: "Пустующий участок", other: "Другое" },
};

export const OWNERSHIP_LABELS: Dict<"own" | "institution" | "cooperative" | "other"> = {
  tr: { own: "Kendi arazim", institution: "Kurum / belediye arazisi", cooperative: "Kooperatif / birlik", other: "Diğer" },
  en: { own: "My own land", institution: "Institution / municipality land", cooperative: "Cooperative / union", other: "Other" },
  ru: { own: "Мой собственный участок", institution: "Участок учреждения / муниципалитета", cooperative: "Кооператив / союз", other: "Другое" },
};

export const TIMING_LABELS: Dict<"this_season" | "six_months" | "flexible"> = {
  tr: { this_season: "Bu bırakma sezonu (Ekim–Mart)", six_months: "6 ay içinde", flexible: "Esnek" },
  en: { this_season: "This release season (Oct–Mar)", six_months: "Within 6 months", flexible: "Flexible" },
  ru: { this_season: "В этот сезон сброса (октябрь–март)", six_months: "В течение 6 месяцев", flexible: "Гибко" },
};

export const AREA_UNIT_LABELS: Dict<"dekar" | "hektar"> = {
  tr: { dekar: "dekar", hektar: "hektar" },
  en: { dekar: "decares", hektar: "hectares" },
  ru: { dekar: "декар", hektar: "га" },
};

/** Sahalara bırakılan türler — ad sözlüğü `messages/*.json → ourSeeds.seeds` ile aynı tutulur. */
export const SPECIES_LABELS: Record<LabelLocale, Record<string, string>> = {
  tr: { kizilcam: "Kızılçam", karacam: "Karaçam", sedir: "Sedir (Toros Sediri)", ardic: "Ardıç" },
  en: { kizilcam: "Turkish Red Pine", karacam: "Black Pine", sedir: "Cedar (Cedar of Lebanon)", ardic: "Juniper" },
  ru: { kizilcam: "Сосна калабрийская", karacam: "Сосна чёрная", sedir: "Кедр (ливанский кедр)", ardic: "Можжевельник" },
};

const FIELD: Dict<
  | "seeds" | "totalSeeds" | "province" | "district" | "area" | "conditions"
  | "ownership" | "timing" | "mapLink" | "accessNotes" | "land" | "species" | "quantity"
  | "certificateName" | "unitPrice" | "estimatedTotal"
> = {
  tr: { seeds: "Tohum türleri", totalSeeds: "Toplam tohum", province: "İl", district: "İlçe", area: "Alan", conditions: "Arazi durumu", ownership: "Mülkiyet", timing: "Zamanlama", mapLink: "Konum bağlantısı", accessNotes: "Erişim / arazi notu", land: "Proje Uygulama Sahası", species: "Bırakılacak tür", quantity: "Tohum topu adedi", certificateName: "Sertifikadaki ad", unitPrice: "Birim bedel (KDV dâhil)", estimatedTotal: "Tahmini tutar (KDV dâhil)" },
  en: { seeds: "Seed species", totalSeeds: "Total seeds", province: "Province", district: "District", area: "Area", conditions: "Land condition", ownership: "Ownership", timing: "Timing", mapLink: "Map link", accessNotes: "Access / terrain notes", land: "Project Site", species: "Species released", quantity: "Seed balls", certificateName: "Name on certificate", unitPrice: "Unit price (VAT incl.)", estimatedTotal: "Estimated total (VAT incl.)" },
  ru: { seeds: "Виды семян", totalSeeds: "Всего семян", province: "Провинция", district: "Район", area: "Площадь", conditions: "Состояние участка", ownership: "Собственность", timing: "Сроки", mapLink: "Ссылка на карту", accessNotes: "Доступ / рельеф", land: "Проектный участок", species: "Древесная порода", quantity: "Семенные шары", certificateName: "Имя в сертификате", unitPrice: "Цена за шар (с НДС)", estimatedTotal: "Ориентировочная сумма (с НДС)" },
};

export interface SummaryRow {
  label: string;
  value: string;
  /** Uzun metin — çok satırlı gösterim */
  multiline?: boolean;
  /** Tıklanabilir bağlantı */
  href?: string;
}

const fmtInt = (n: number, locale: LabelLocale) => formatCount(n, locale);

/**
 * Talep detaylarını okunur satırlara çevirir. `details` DB'de doğrulanmış
 * JSON'dır ama yine de savunmacı okunur (eksik/bozuk alan → satır atlanır).
 * `landName` saha taleplerinde lands tablosundan gelir.
 */
export function requestSummaryRows(
  req: Pick<ServiceRequest, "type" | "details" | "seed_items" | "total_seeds">,
  locale: LabelLocale,
  landName?: string | null
): SummaryRow[] {
  const f = FIELD[locale];
  const d = (req.details ?? {}) as Record<string, unknown>;
  const rows: SummaryRow[] = [];
  const str = (k: string) => (typeof d[k] === "string" && (d[k] as string).trim() ? (d[k] as string) : null);
  const num = (k: string) => (typeof d[k] === "number" && Number.isFinite(d[k]) ? (d[k] as number) : null);

  if (req.type === "seed_purchase") {
    const items = Array.isArray(req.seed_items) ? req.seed_items : [];
    if (items.length) {
      rows.push({
        label: f.seeds,
        value: items.map((i) => `${i.name}: ${fmtInt(i.quantity, locale)}`).join(" · "),
      });
    }
    if (req.total_seeds) rows.push({ label: f.totalSeeds, value: fmtInt(req.total_seeds, locale) });
    const il = ilAdi(str("deliveryProvince"));
    if (il) rows.push({ label: f.province, value: il });
    const ilce = str("deliveryDistrict");
    if (ilce) rows.push({ label: f.district, value: ilce });
  }

  if (req.type === "land_application") {
    const il = ilAdi(str("province"));
    if (il) rows.push({ label: f.province, value: il });
    const ilce = str("district");
    if (ilce) rows.push({ label: f.district, value: ilce });
    const area = num("areaValue");
    const unit = str("areaUnit") as keyof typeof AREA_UNIT_LABELS.tr | null;
    if (area !== null && unit && AREA_UNIT_LABELS[locale][unit]) {
      rows.push({ label: f.area, value: `${area.toLocaleString(locale === "tr" ? "tr-TR" : "en-GB")} ${AREA_UNIT_LABELS[locale][unit]}` });
    }
    const conds = Array.isArray(d.conditions) ? (d.conditions as string[]) : [];
    const condLabels = conds
      .map((c) => LAND_CONDITION_LABELS[locale][c as keyof typeof LAND_CONDITION_LABELS.tr])
      .filter(Boolean);
    if (condLabels.length) rows.push({ label: f.conditions, value: condLabels.join(", ") });
    const own = str("ownership") as keyof typeof OWNERSHIP_LABELS.tr | null;
    if (own && OWNERSHIP_LABELS[locale][own]) rows.push({ label: f.ownership, value: OWNERSHIP_LABELS[locale][own] });
    const tm = str("timing") as keyof typeof TIMING_LABELS.tr | null;
    if (tm && TIMING_LABELS[locale][tm]) rows.push({ label: f.timing, value: TIMING_LABELS[locale][tm] });
    const link = str("mapLink");
    if (link && /^https?:\/\//i.test(link)) rows.push({ label: f.mapLink, value: link, href: link });
    const notes = str("accessNotes");
    if (notes) rows.push({ label: f.accessNotes, value: notes, multiline: true });
  }

  if (req.type === "open_land_seeding") {
    const site = landName ?? str("landName");
    if (site) rows.push({ label: f.land, value: site });
    const species = (Array.isArray(d.speciesSlugs) ? (d.speciesSlugs as unknown[]) : [])
      .map((s) => (typeof s === "string" ? SPECIES_LABELS[locale][s] : undefined))
      .filter((s): s is string => Boolean(s));
    if (species.length) rows.push({ label: f.species, value: species.join(", ") });
    const q = num("quantity") ?? req.total_seeds;
    if (q) rows.push({ label: f.quantity, value: fmtInt(q, locale) });
    const unit = num("unitPriceKurus");
    if (unit) rows.push({ label: f.unitPrice, value: formatTry(unit, locale) });
    const total = num("estimatedTotalKurus");
    if (total) rows.push({ label: f.estimatedTotal, value: formatTry(total, locale) });
    // "dedication": 2026-09 öncesi kayıtlardaki eski alan adı.
    const cert = str("certificateName") ?? str("dedication");
    if (cert) rows.push({ label: f.certificateName, value: cert });
  }

  return rows;
}
