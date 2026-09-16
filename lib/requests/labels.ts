/**
 * Talep alanlarının görünen adları (tr / en / ru) — e-postalar, hesabım
 * paneli ve admin listesi aynı sözlüğü kullanır. Saf veri; istemcide de
 * sunucuda da import edilebilir.
 */
import type { ServiceRequest, ServiceRequestStatus, ServiceRequestType } from "@/lib/types";
import { ilAdi } from "@/lib/tr-iller";

export type LabelLocale = "tr" | "en" | "ru";

type Dict<K extends string> = Record<LabelLocale, Record<K, string>>;

export const REQUEST_TYPE_LABELS: Dict<ServiceRequestType> = {
  tr: { seed_purchase: "Tohum talebi", land_application: "Arazime ekim başvurusu", open_land_seeding: "Açık araziye tohum talebi" },
  en: { seed_purchase: "Seed request", land_application: "Plant-on-my-land application", open_land_seeding: "Open-land seeding request" },
  ru: { seed_purchase: "Заявка на семена", land_application: "Заявка на посев на моём участке", open_land_seeding: "Заявка на посев на открытом участке" },
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
  tr: { this_season: "Bu ekim sezonu", six_months: "6 ay içinde", flexible: "Esnek" },
  en: { this_season: "This planting season", six_months: "Within 6 months", flexible: "Flexible" },
  ru: { this_season: "В этот посевной сезон", six_months: "В течение 6 месяцев", flexible: "Гибко" },
};

export const AREA_UNIT_LABELS: Dict<"dekar" | "hektar"> = {
  tr: { dekar: "dekar", hektar: "hektar" },
  en: { dekar: "decares", hektar: "hectares" },
  ru: { dekar: "декар", hektar: "га" },
};

export const PURPOSE_LABELS: Dict<"garden" | "land" | "gift" | "corporate" | "other"> = {
  tr: { garden: "Bahçe / hobi", land: "Kendi arazime ekim", gift: "Hediye", corporate: "Kurumsal etkinlik", other: "Diğer" },
  en: { garden: "Garden / hobby", land: "Planting on my land", gift: "Gift", corporate: "Corporate event", other: "Other" },
  ru: { garden: "Сад / хобби", land: "Посев на моём участке", gift: "Подарок", corporate: "Корпоративное мероприятие", other: "Другое" },
};

const FIELD: Dict<
  | "seeds" | "totalSeeds" | "province" | "district" | "purpose" | "area" | "conditions"
  | "ownership" | "timing" | "mapLink" | "accessNotes" | "land" | "quantity" | "dedication"
> = {
  tr: { seeds: "Tohum türleri", totalSeeds: "Toplam tohum", province: "İl", district: "İlçe", purpose: "Kullanım amacı", area: "Alan", conditions: "Arazi durumu", ownership: "Mülkiyet", timing: "Zamanlama", mapLink: "Konum bağlantısı", accessNotes: "Erişim / arazi notu", land: "Saha", quantity: "Tohum adedi", dedication: "Adına ekilecek kişi" },
  en: { seeds: "Seed species", totalSeeds: "Total seeds", province: "Province", district: "District", purpose: "Purpose", area: "Area", conditions: "Land condition", ownership: "Ownership", timing: "Timing", mapLink: "Map link", accessNotes: "Access / terrain notes", land: "Site", quantity: "Seed quantity", dedication: "Dedicated to" },
  ru: { seeds: "Виды семян", totalSeeds: "Всего семян", province: "Провинция", district: "Район", purpose: "Цель", area: "Площадь", conditions: "Состояние участка", ownership: "Собственность", timing: "Сроки", mapLink: "Ссылка на карту", accessNotes: "Доступ / рельеф", land: "Участок", quantity: "Количество семян", dedication: "Посвящается" },
};

export interface SummaryRow {
  label: string;
  value: string;
  /** Uzun metin — çok satırlı gösterim */
  multiline?: boolean;
  /** Tıklanabilir bağlantı */
  href?: string;
}

const fmtInt = (n: number, locale: LabelLocale) =>
  n.toLocaleString(locale === "tr" ? "tr-TR" : locale === "ru" ? "ru-RU" : "en-GB");

/**
 * Talep detaylarını okunur satırlara çevirir. `details` DB'de doğrulanmış
 * JSON'dır ama yine de savunmacı okunur (eksik/bozuk alan → satır atlanır).
 * `landName` açık arazi taleplerinde lands tablosundan gelir.
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
    const p = str("purpose") as keyof typeof PURPOSE_LABELS.tr | null;
    if (p && PURPOSE_LABELS[locale][p]) rows.push({ label: f.purpose, value: PURPOSE_LABELS[locale][p] });
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
    if (landName) rows.push({ label: f.land, value: landName });
    const q = num("quantity") ?? req.total_seeds;
    if (q) rows.push({ label: f.quantity, value: fmtInt(q, locale) });
    const ded = str("dedication");
    if (ded) rows.push({ label: f.dedication, value: ded });
  }

  return rows;
}
