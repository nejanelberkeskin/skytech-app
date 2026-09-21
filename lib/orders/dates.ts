/**
 * Sipariş sayfalarında tarih yazımı — deterministik (Intl'e bağlı değil; sunucu ile
 * tarayıcı aynı metni üretir). Girdi her zaman İstanbul takvim günü: "YYYY-MM-DD".
 */
const MONTHS = {
  tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  // Rusçada tarih içinde ay adı ilgi hâlinde yazılır ("31 марта 2027 г.").
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
} as const;

const NBSP = String.fromCharCode(0xa0);

/** "2027-03-31" → "31 Mart 2027" · "31 March 2027" · "31 марта 2027 г." */
export function formatLongDay(day: string, locale: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d || m > 12) return day;
  const months = MONTHS[locale === "en" || locale === "ru" ? locale : "tr"];
  const text = `${d}${NBSP}${months[m - 1]}${NBSP}${y}`;
  return locale === "ru" ? `${text}${NBSP}г.` : text;
}

/** ISO an → İstanbul saatiyle "14:35" */
export function formatTrClock(isoInstant: string): string {
  const shifted = new Date(new Date(isoInstant).getTime() + 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}`;
}
