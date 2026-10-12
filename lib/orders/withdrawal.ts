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
 *
 * Gerekçe, üyelik/oturum, belge ya da imza İSTENMEZ: sipariş no + siparişteki e-posta yeterlidir.
 *
 * Olağan cayma süresi dolmuş (ya da sipariş artık `paid` olmayan bir ifa aşamasında) ise bildirim
 * REDDEDİLMEZ: "süre sonrası başvuru" olarak denetim izine yazılır ve yönetimin incelemesine düşer
 * (ayıplı / geç / hiç ifa edilmeme hakları ile eksik bilgilendirmede uzayan cayma süresi 14 günle
 * bitmez). Bu yolda durum değişmez, iade kaydı açılmaz, iade kararı otomatik verilmez.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/mail";
import { runNotificationOutbox } from "./notification-outbox";
import { canWithdraw } from "./state";
import { addOrderEvent, db, getOrderByNo, transitionOrder } from "./store";
import type { OrderEventType, OrderStatus, ReleaseOrderRow } from "./types";
import { refundDueDay } from "./withdrawal-dates";

export { REFUND_DAYS, refundDueDay } from "./withdrawal-dates";

export type WithdrawalOutcome =
  | { ok: true; order: ReleaseOrderRow; receivedAt: string; refundDueOn: string }
  | { ok: false; error: "recorded_as_claim"; order: ReleaseOrderRow; receivedAt: string }
  | { ok: false; error: "not_found" | "not_eligible" | "already_requested" | "already_refunded" };

/** Olağan cayma süresi dolduktan sonra da bildirimi (ayıplı/geç ifa vb.) kayda alınan ifa aşamaları. */
export const POST_PERIOD_CLAIM_STATUSES: readonly OrderStatus[] = ["paid", "confirmed", "scheduled", "released", "monitoring", "completed"];

/** Süre sonrası başvurunun denetim izindeki olay türü (yönetim sipariş ayrıntısında görür). */
export const POST_PERIOD_CLAIM_EVENT: OrderEventType = "post_period_claim";

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
  supabase: SupabaseClient = db(),
  now: Date = new Date()
): Promise<WithdrawalOutcome> {
  const order = await getOrderByNo(supabase, orderNo);
  if (!order || !order.paid_at || order.buyer_email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { ok: false, error: "not_found" };
  }
  if (order.status === "refunded") return { ok: false, error: "already_refunded" };
  if (order.status === "withdrawal_requested" || order.status === "cancelled_by_seller") {
    return { ok: false, error: "already_requested" };
  }
  if (!canWithdraw(order.status, order.withdrawal_deadline, now)) return recordPostPeriodClaim(order, meta, supabase, now);

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

/**
 * Olağan süre dışındaki bildirim: durum ve finans DEĞİŞMEZ; yalnız denetim izine yazılır. Kayıt yazılamazsa
 * müşteriye "kaydedildi" denmez (not_eligible → e-posta adresine yönlendiren ileti).
 */
async function recordPostPeriodClaim(
  order: ReleaseOrderRow,
  meta: WithdrawalMeta,
  supabase: SupabaseClient,
  now: Date
): Promise<WithdrawalOutcome> {
  if (!POST_PERIOD_CLAIM_STATUSES.includes(order.status)) return { ok: false, error: "not_eligible" };
  const receivedAt = now.toISOString();
  const { error } = await supabase.from("order_events").insert({
    order_id: order.id,
    type: POST_PERIOD_CLAIM_EVENT,
    actor: "customer",
    data: {
      channel: meta.channel,
      status: order.status,
      withdrawalDeadline: order.withdrawal_deadline,
      receivedAt,
      ...(meta.note ? { note: meta.note } : {}),
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    },
  });
  if (error) {
    console.error(`[cayma] süre sonrası başvuru kaydedilemedi (${order.order_no}):`, error.code);
    return { ok: false, error: "not_eligible" };
  }
  return { ok: false, error: "recorded_as_claim", order, receivedAt };
}

/** The status transaction enqueues both recipients; after() only wakes the durable worker. */
export async function sendWithdrawalEmails(order: ReleaseOrderRow, _receivedAt: string, _refundDueOn: string): Promise<void> {
  void _receivedAt; void _refundDueOn;
  await runNotificationOutbox(publicOrigin(), db(), { orderId: order.id, templates: ["release_withdrawal_receipt", "release_withdrawal_notify"], limit: 2 });
}
