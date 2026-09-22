/**
 * Sipariş durum makinesi — hangi durumdan hangisine geçilebilir, TEK KAYNAK.
 *
 * API uçları, zamanlanmış işler ve yönetim paneli durum değiştirirken
 * `assertTransition` kullanır; tabloya doğrudan "status = …" yazılmaz. Böylece
 * iade edilmiş bir siparişin yeniden "paid" olması gibi geçişler kod düzeyinde
 * imkânsızdır (veritabanında ayrıca koşullu UPDATE ile korunur).
 */
import type { OrderStatus } from "./types";

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["awaiting_payment", "expired"],
  awaiting_payment: ["paid", "payment_failed", "expired"],
  // Başarısız denemeden sonra müşteri yeniden dener (→ awaiting_payment). Doğrudan "paid":
  // iki sekmede iki ödeme oturumu açıldıysa biri reddedilip diğeri onaylanabilir.
  payment_failed: ["awaiting_payment", "paid", "expired"],
  // Geç gelen ödeme: müşteri ödeme sayfasında süreyi aştıysa ve sağlayıcı yine de
  // tahsil ettiyse sipariş geri açılır (para alınmışken sipariş "süresi doldu" kalamaz).
  expired: ["paid"],
  // Ödeme alındı: cayma süresi içinde müşteri cayabilir; satıcı da iptal edebilir.
  paid: ["confirmed", "withdrawal_requested", "cancelled_by_seller"],
  // Cayma süresi doldu: yalnız satıcı kaynaklı iptal (ifa imkânsızlığı, erteleme reddi).
  confirmed: ["scheduled", "cancelled_by_seller"],
  scheduled: ["released", "confirmed", "cancelled_by_seller"],
  released: ["monitoring"],
  monitoring: ["completed"],
  completed: [],
  // Cayma bildirimi geri çekilebilir (müşteri vazgeçerse) ya da iade ile sonuçlanır.
  withdrawal_requested: ["refunded", "paid"],
  cancelled_by_seller: ["refunded"],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export class InvalidTransitionError extends Error {
  readonly from: OrderStatus;
  readonly to: OrderStatus;

  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Geçersiz durum geçişi: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/**
 * Müşteri cayma hakkını kullanabilir mi? Yalnız `paid` durumunda ve son an
 * geçmemişse. (Son an, ödeme anından 14 gün sonrasının İstanbul saatiyle gün
 * sonudur — bkz. schedule.ts.)
 */
export function canWithdraw(status: OrderStatus, withdrawalDeadline: Date | string | null, now: Date = new Date()): boolean {
  if (status !== "paid" || !withdrawalDeadline) return false;
  return now.getTime() <= new Date(withdrawalDeadline).getTime();
}
