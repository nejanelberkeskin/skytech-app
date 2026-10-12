/**
 * Cayma süresinin KABUL tarafı — saf hesap, bağımlılıksız (sunucu, istemci ve testler ortak kullanır).
 *
 * Sözleşmede gösterilen son gün `scheduleFor()` (schedule.ts) ile hesaplanır ve DEĞİŞMEZ: ödeme
 * gününden sonraki 14. günün İstanbul saatiyle sonu. Burada yalnız başvuruyu kabul etme mantığı
 * tüketici lehine genişletilir: son gün tatile (hafta sonu, ulusal bayram/genel tatil, dinî bayram
 * ya da arife) denk gelirse süre izleyen ilk iş gününün sonuna uzar. Böylece tatilde dolan süre
 * yüzünden bildirim reddedilmez; erken bir anı asla geç saymaz.
 *
 * Takvim: İstanbul saati (UTC+3, yaz saati yok).
 *
 * DİKKAT: Dinî bayram tarihleri her yıl değişir; `RELIGIOUS_HOLIDAYS` yalnız listelenen yıllar için
 * doğrudur ve resmî takvimle (Diyanet / Resmî Gazete) her yıl güncellenmelidir. Listede olmayan bir
 * yılda dinî bayram uzaması UYGULANMAZ (hafta sonu ve sabit tarihli tatiller yine uygulanır).
 */

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Bayram + hafta sonu birleşse bile uzama bundan uzun olamaz; döngü koruması. */
const MAX_EXTENSION_DAYS = 14;

/**
 * Tüketici lehine yorum: Cumartesi de tatil sayılır (yalnız Pazar değil). Hukuk görüşüyle
 * daraltılması gerekirse yalnız bu değer değişir.
 */
export const SATURDAY_IS_HOLIDAY = true;

/** Her yıl aynı gün olan ulusal bayram ve genel tatiller (2429 sayılı Kanun) — AA-GG. 28 Ekim: arife (yarım gün). */
export const FIXED_HOLIDAYS: readonly string[] = ["01-01", "04-23", "05-01", "05-19", "07-15", "08-30", "10-28", "10-29"];

/**
 * Ramazan ve Kurban bayramı günleri (arife dahil — arife yarım gündür, tüketici lehine tam gün sayılır).
 * Kaynak: Diyanet takvimi. Yeni yıl eklenmeden önce resmî takvimle doğrulanmalı.
 */
export const RELIGIOUS_HOLIDAYS: Readonly<Record<number, readonly string[]>> = {
  2026: ["2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22", "2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30"],
  2027: ["2027-03-08", "2027-03-09", "2027-03-10", "2027-03-11", "2027-05-15", "2027-05-16", "2027-05-17", "2027-05-18", "2027-05-19"],
};

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** YYYY-MM-DD İstanbul takviminde tatil mi? */
export function isTrHoliday(day: string): boolean {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (weekday === 0 || (SATURDAY_IS_HOLIDAY && weekday === 6)) return true;
  if (FIXED_HOLIDAYS.includes(day.slice(5))) return true;
  return RELIGIOUS_HOLIDAYS[y]?.includes(day) ?? false;
}

/** Verilen anın İstanbul takvimindeki günü — YYYY-MM-DD. */
function trDay(at: number): string {
  return iso(at + TR_OFFSET_MS);
}

/**
 * Bildirimin kabul edileceği son an. Kayıtlı son an (`withdrawal_deadline`) tatile denk gelen bir
 * günün içindeyse, izleyen ilk iş gününün İstanbul saatiyle 23:59:59.999'una uzatılır; değilse
 * aynen döner. Geçersiz/boş girdi → null.
 */
export function effectiveWithdrawalDeadline(deadline: Date | string | null | undefined): Date | null {
  if (!deadline) return null;
  const at = new Date(deadline).getTime();
  if (!Number.isFinite(at)) return null;
  let day = trDay(at);
  let extended = 0;
  while (isTrHoliday(day) && extended < MAX_EXTENSION_DAYS) {
    day = iso(Date.parse(`${day}T00:00:00Z`) + DAY_MS);
    extended++;
  }
  if (extended === 0) return new Date(at);
  return new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS - TR_OFFSET_MS - 1);
}

/** `now` anında olağan cayma süresi (tatil uzaması dahil) hâlâ açık mı? Durum denetimi ayrıca yapılır. */
export function withinWithdrawalPeriod(deadline: Date | string | null | undefined, now: Date = new Date()): boolean {
  const end = effectiveWithdrawalDeadline(deadline);
  return end !== null && now.getTime() <= end.getTime();
}
