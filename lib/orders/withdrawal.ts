/**
 * Cayma bildirimi — YALNIZ SUNUCU.
 *
 * Mevzuat: bildirim ulaştığı anda geçerlidir (bizim onayımız gerekmez), müşteriye DERHAL
 * teyit gönderilir ve bedelin tamamı bildirimden itibaren 14 gün içinde, ödemede
 * kullanılan araca, tek seferde iade edilir. Bu yüzden burada yalnız üç şey yapılır:
 * durum `withdrawal_requested` olur, bekleyen bir iade kaydı açılır, denetim izi yazılır.
 * İadenin kendisi yönetim ekranından (Faz 5) sağlayıcı üzerinden başlatılır.
 *
 * Sipariş no ile e-posta eşleşmezse hangisinin yanlış olduğu söylenmez ("not_found").
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWithdrawalNotification, sendWithdrawalReceipt } from "@/lib/mail";
import { formatTry } from "@/lib/pricing";
import { recordEmailResults } from "./after-payment";
import { formatLongDay } from "./dates";
import { trToday } from "./schedule";
import { canWithdraw } from "./state";
import { addOrderEvent, db, getOrderByNo, transitionOrder } from "./store";
import type { ReleaseOrderRow } from "./types";
import { refundDueDay } from "./withdrawal-dates";

export { REFUND_DAYS, refundDueDay } from "./withdrawal-dates";

export type WithdrawalOutcome =
  | { ok: true; order: ReleaseOrderRow; receivedAt: string; refundDueOn: string }
  | { ok: false; error: "not_found" | "not_eligible" | "already_requested" | "already_refunded" };

export interface WithdrawalMeta {
  channel: "form" | "account";
  note: string | null;
  ipHash: string | null;
  userAgent: string | null;
}

export async function recordWithdrawal(
  orderNo: string,
  email: string,
  meta: WithdrawalMeta,
  supabase: SupabaseClient = db()
): Promise<WithdrawalOutcome> {
  const order = await getOrderByNo(supabase, orderNo);
  if (!order || !order.paid_at || order.buyer_email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { ok: false, error: "not_found" };
  }
  if (order.status === "refunded") return { ok: false, error: "already_refunded" };
  if (order.status === "withdrawal_requested" || order.status === "cancelled_by_seller") {
    return { ok: false, error: "already_requested" };
  }
  const now = new Date();
  if (!canWithdraw(order.status, order.withdrawal_deadline, now)) return { ok: false, error: "not_eligible" };

  const receivedAt = now.toISOString();
  const moved = await transitionOrder(supabase, order.id, ["paid"], "withdrawal_requested", {
    withdrawal_requested_at: receivedAt,
    withdrawal_channel: meta.channel,
  });
  if (!moved) {
    // Aynı anda ikinci bir bildirim ya da durum değişikliği: güncel duruma göre yanıtla.
    const again = await getOrderByNo(supabase, orderNo);
    return { ok: false, error: again?.status === "withdrawal_requested" ? "already_requested" : "not_eligible" };
  }

  const refundDueOn = refundDueDay(now);
  const refund = await supabase.from("order_refunds").insert({
    order_id: moved.id,
    amount_kurus: moved.total_kurus,
    reason: "withdrawal",
    status: "pending",
    provider: moved.payment_provider,
    requested_by: "customer",
  });
  // İade kaydı açılamasa da bildirim GEÇERLİDİR; yönetim ekranı durumdan görür. Yine de logla.
  if (refund.error) console.error(`[cayma] iade kaydı açılamadı (${moved.order_no}):`, refund.error.code);

  await addOrderEvent(supabase, moved.id, "withdrawal_requested", "customer", {
    channel: meta.channel,
    refundDueOn,
    ...(meta.note ? { note: meta.note } : {}),
    ipHash: meta.ipHash,
    userAgent: meta.userAgent,
  });
  return { ok: true, order: moved, receivedAt, refundDueOn };
}

/** Müşteriye teyit + şirkete bildirim. Hata siparişi etkilemez; olay olarak kaydedilir. */
export async function sendWithdrawalEmails(order: ReleaseOrderRow, receivedAt: string, refundDueOn: string): Promise<void> {
  const supabase = db();
  const totalText = formatTry(order.total_kurus, order.locale);
  const mailLocale = order.locale === "tr" ? "tr" : "en";
  const results = await Promise.allSettled([
    sendWithdrawalReceipt({
      orderId: order.id,
      orderNo: order.order_no,
      locale: order.locale,
      email: order.buyer_email,
      firstName: order.buyer_first_name,
      totalText,
      receivedOnText: formatLongDay(trToday(new Date(receivedAt)), mailLocale),
      refundDueOnText: formatLongDay(refundDueOn, mailLocale),
      isTest: order.is_test,
    }),
    sendWithdrawalNotification({
      orderId: order.id,
      orderNo: order.order_no,
      buyerName: `${order.buyer_first_name} ${order.buyer_last_name}`,
      siteName: order.site_snapshot.name,
      totalText: formatTry(order.total_kurus, "tr"),
      refundDueOnText: formatLongDay(refundDueOn, "tr"),
      isTest: order.is_test,
    }),
  ]);
  await recordEmailResults(supabase, order.id, results, [
    { template: "release_withdrawal_receipt" },
    { template: "release_withdrawal_notify" },
  ]);
}
