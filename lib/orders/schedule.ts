/**
 * Takvim kuralları — cayma süresi, bırakma sezonu ve sözleşmedeki KESİN son tarih.
 *
 *  • Tohum topu bırakma sezonu: 1 Ekim – 31 Mart. Nisan–Eylül izleme ve raporlama.
 *  • Cayma süresi: sözleşmenin kurulduğu (ödemenin alındığı) günden itibaren 14 gün.
 *    Bırakma bu süre dolmadan yapılmaz; "erken ifa onayı" alınmaz.
 *  • Sipariş tarihi ile sezon sonu arasında cayma + hazırlık payı kalmıyorsa sipariş
 *    SONRAKİ sezona yazılır; sözleşmedeki son tarih o sezonun 31 Mart'ıdır.
 *
 * Tüm hesaplar Türkiye saatiyle (UTC+3, yaz saati yok) yapılır; sunucunun saat
 * diliminden bağımsızdır.
 */

export const WITHDRAWAL_DAYS = 14;
/** Cayma süresi + operasyon hazırlığı. Yönetim ayarından değiştirilebilir olacak. */
export const DEFAULT_PREP_DAYS = 21;

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReleaseSeason {
  /** "2026-2027" */
  label: string;
  /** Sezonun ilk günü — YYYY-MM-DD (1 Ekim) */
  startsOn: string;
  /** Sezonun son günü — YYYY-MM-DD (31 Mart); sözleşmedeki kesin son tarih */
  endsOn: string;
}

export interface OrderSchedule {
  season: ReleaseSeason;
  /** Cayma hakkının son anı (İstanbul saatiyle 14. günün sonu) — ISO */
  withdrawalDeadline: string;
  /** Bırakmanın yapılabileceği en erken gün — YYYY-MM-DD */
  earliestReleaseOn: string;
  /** Sözleşmede yazan kesin son tarih — YYYY-MM-DD */
  performanceDeadline: string;
  /** Sipariş içinde bulunulan sezona yetişmediği için sonraki sezona yazıldı mı? */
  rolledToNextSeason: boolean;
}

/** Verilen anın İstanbul takvimindeki yıl/ay/gün değeri. */
function trParts(at: Date): { y: number; m: number; d: number } {
  const shifted = new Date(at.getTime() + TR_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** YYYY-MM-DD → o günün İstanbul saatiyle 00:00'ının UTC anı. */
function trMidnightUtc(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - TR_OFFSET_MS;
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function trToday(at: Date = new Date()): string {
  const { y, m, d } = trParts(at);
  return iso(y, m, d);
}

function seasonStartingIn(year: number): ReleaseSeason {
  return { label: `${year}-${year + 1}`, startsOn: iso(year, 10, 1), endsOn: iso(year + 1, 3, 31) };
}

/** İçinde bulunulan ya da (Nisan–Eylül'de) yaklaşan bırakma sezonu. */
export function seasonFor(at: Date = new Date()): ReleaseSeason {
  const { y, m } = trParts(at);
  return seasonStartingIn(m >= 10 ? y : m <= 3 ? y - 1 : y);
}

/** "2026-2027" → sezonun son günü "2027-03-31"; biçim bozuksa null. */
export function seasonEndOf(label: string): string | null {
  const m = /^(\d{4})-(\d{4})$/.exec(label);
  return m && Number(m[2]) === Number(m[1]) + 1 ? iso(Number(m[2]), 3, 31) : null;
}

export function nextSeason(season: ReleaseSeason): ReleaseSeason {
  return seasonStartingIn(Number(season.label.slice(0, 4)) + 1);
}

/**
 * Siparişin takvimini hesaplar. `paidAt`: sözleşmenin kurulduğu an (ödeme onayı);
 * sihirbazda önizleme için "şimdi" verilir.
 */
export function scheduleFor(paidAt: Date = new Date(), prepDays: number = DEFAULT_PREP_DAYS): OrderSchedule {
  const orderDay = trToday(paidAt);
  const lead = Math.max(prepDays, WITHDRAWAL_DAYS + 1);

  // Cayma: ödeme günü sayılmaz; 14. günün İstanbul saatiyle 23:59:59.999'u son andır.
  const lastWithdrawalDay = addDays(orderDay, WITHDRAWAL_DAYS);
  const withdrawalDeadline = new Date(trMidnightUtc(addDays(lastWithdrawalDay, 1)) - 1).toISOString();

  const readyOn = addDays(orderDay, lead);
  let season = seasonFor(paidAt);
  let rolled = false;
  if (readyOn > season.endsOn) {
    season = nextSeason(season);
    rolled = true;
  }

  return {
    season,
    withdrawalDeadline,
    earliestReleaseOn: readyOn > season.startsOn ? readyOn : season.startsOn,
    performanceDeadline: season.endsOn,
    rolledToNextSeason: rolled,
  };
}
