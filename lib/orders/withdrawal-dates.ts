/** Cayma sonrası iade süresi — saf hesap (sunucu ve testler ortak kullanır). */
import { trToday } from "./schedule";

export const REFUND_DAYS = 14;

/** Bildirim gününden 14 gün sonrası (İstanbul takvimi) — iadenin en geç yapılacağı gün. */
export function refundDueDay(receivedAt: Date): string {
  return trToday(new Date(receivedAt.getTime() + REFUND_DAYS * 24 * 60 * 60 * 1000));
}
