/**
 * Hukuki metinlerde kullanılan biçimler — deterministik (Intl'e bağlı değil):
 * aynı sipariş her ortamda aynı metni, dolayısıyla aynı SHA-256 özetini üretir.
 */
import { COMPANY, companyAddressLine } from "@/lib/company";
import { formatCount, formatTry } from "@/lib/pricing";

const NBSP = String.fromCharCode(0xa0);

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
] as const;

/** "2027-03-31" → "31 Mart 2027" (parçalar arasında bölünmez boşluk) */
export function trLongDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  // Bölünmez boşluk: tarih satır sonunda ikiye ayrılmasın.
  return `${d}${NBSP}${MONTHS_TR[m - 1]}${NBSP}${y}`;
}

/** ISO an → İstanbul takvim günü ("2026-10-05T20:59:59.999Z" → "2026-10-05"). */
export function trDayOf(isoInstant: string): string {
  const shifted = new Date(new Date(isoInstant).getTime() + 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}`;
}

export const money = (kurus: number) => formatTry(kurus, "tr");
export const count = (n: number) => formatCount(n, "tr");

/** Satıcı künyesi tablosu — yalnız dolu alanlar yazılır (eksikler açılış kontrol listesinde). */
export function sellerRows(): [string, string][] {
  const rows: [string, string | null][] = [
    ["Unvan", COMPANY.legalName],
    ["MERSİS no", COMPANY.mersis],
    ["Ticaret sicil no", COMPANY.tradeRegistryNo],
    ["Vergi dairesi / no", `${COMPANY.taxOffice} / ${COMPANY.taxId}`],
    ["Adres", companyAddressLine()],
    ["Telefon", COMPANY.phone],
    ["E-posta", COMPANY.email],
    ["KEP adresi", COMPANY.kep],
    ["İnternet sitesi", COMPANY.website.replace(/^https?:\/\//, "")],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1]));
}

/** Cayma bildiriminin yapılabileceği kanallar — tek cümle. */
export function withdrawalChannels(): string {
  const site = COMPANY.website.replace(/^https?:\/\//, "");
  const parts = [
    `${site}/cayma adresindeki form`,
    `${COMPANY.email} adresine e-posta`,
    ...(COMPANY.kep ? [`${COMPANY.kep} KEP adresine ileti`] : []),
    "SATICI'nın yukarıdaki adresine yazılı bildirim",
  ];
  return parts.slice(0, -1).join(", ") + " veya " + parts.at(-1);
}
