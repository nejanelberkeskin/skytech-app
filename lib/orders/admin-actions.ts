/**
 * Yönetim işlemleri — YALNIZ SUNUCU (service role). Her işlem durum makinesinden geçer,
 * denetim izine (order_events) yöneticinin kimliğiyle yazılır; çağıran uç ayrıca
 * admin_audit_logs'a kaydeder.
 *
 *   cancelBySeller()   ifa edilemeyecek sipariş → `cancelled_by_seller` + bekleyen iade
 *   executeRefund()    bekleyen iadeyi sağlayıcıdan yapar → `refunded`, kapasite serbest
 *   refundDuplicate()  aynı siparişe gelen İKİNCİ tahsilatı iade eder
 *   queueInvoice()     "şimdi fatura kes" — fatura kuyruğuna alır
 *   markInvoiceIssued() kesilen faturanın numarasını işler
 *   reserveCapacityNow() geç ödemede ayrılamamış kapasiteyi sonradan ayırır
 *   confirmDueOrders() cayma süresi dolan `paid` siparişleri `confirmed` yapar
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProviderByName } from "@/lib/payments";
import { duplicateChargesFrom } from "./duplicates";
import { addOrderEvent, db, transitionOrder } from "./store";
import type { OrderActor, OrderStatus, ReleaseOrderRow } from "./types";

export type AdminActionError =
  | "not_found"
  | "invalid_state"
  | "in_progress" //        aynı iade şu anda başka bir istekte işleniyor
  | "provider_unavailable" // ödemenin alındığı sağlayıcı bu ortamda yapılandırılmamış
  | "provider_error"
  | "already_done"
  | "unavailable";

export type AdminActionResult<T = { order: ReleaseOrderRow }> = ({ ok: true } & T) | { ok: false; error: AdminActionError; detail?: string };

const actorOf = (adminUserId: string): OrderActor => `admin:${adminUserId}`;

async function getOrder(supabase: SupabaseClient, id: string): Promise<ReleaseOrderRow | null> {
  const { data, error } = await supabase.from("release_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`siparis okunamadı: ${error.code}`);
  return (data as ReleaseOrderRow | null) ?? null;
}

/* ── Satıcı kaynaklı iptal ────────────────────────────────────────────────── */

const SELLER_CANCELLABLE: OrderStatus[] = ["paid", "confirmed", "scheduled"];

export async function cancelBySeller(orderId: string, reason: string, adminUserId: string, supabase: SupabaseClient = db()): Promise<AdminActionResult> {
  const order = await getOrder(supabase, orderId);
  if (!order) return { ok: false, error: "not_found" };
  if (!SELLER_CANCELLABLE.includes(order.status)) return { ok: false, error: "invalid_state" };

  const at = new Date().toISOString();
  const moved = await transitionOrder(supabase, order.id, [order.status], "cancelled_by_seller", {
    cancelled_at: at,
    cancel_reason: reason,
    batch_id: null,
  });
  if (!moved) return { ok: false, error: "invalid_state" };

  const refund = await supabase.from("order_refunds").insert({
    order_id: moved.id,
    amount_kurus: moved.total_kurus,
    reason: "seller_cancellation",
    status: "pending",
    provider: moved.payment_provider,
    requested_by: actorOf(adminUserId),
  });
  if (refund.error) console.error(`[yonetim] iade kaydı açılamadı (${moved.order_no}):`, refund.error.code);

  await addOrderEvent(supabase, moved.id, "status_changed", actorOf(adminUserId), { from: order.status, to: "cancelled_by_seller", reason });
  return { ok: true, order: moved };
}

/* ── İade ─────────────────────────────────────────────────────────────────── */

/** Durable claim → provider result checkpoint → atomic local completion.
 * An uncertain provider call is never retried on a timer. Operations staff reconcile it
 * against the provider before marking its result; succeeded checkpoints can be finalized again.
 */
async function performRefund(order: ReleaseOrderRow, paymentId: string, amount: number, providerName: string | null, duplicate: boolean, adminUserId: string, ip: string | null, supabase: SupabaseClient): Promise<AdminActionResult> {
  const provider = getProviderByName(providerName);
  if (!provider) return { ok: false, error: "provider_unavailable" };
  const claim = await supabase.rpc("claim_refund_operation", {
    p_order: order.id, p_provider: provider.name, p_payment: paymentId,
    p_amount: amount, p_duplicate: duplicate, p_actor: adminUserId,
  });
  if (claim.error || !claim.data) return { ok: false, error: "unavailable" };
  const op = claim.data as { id: string; state: string; fresh: boolean };
  if (op.state === "completed") return { ok: false, error: "already_done" };
  if (!op.fresh && op.state !== "provider_succeeded") {
    return { ok: false, error: "in_progress", detail: "Sağlayıcı sonucu mutabakat bekliyor; tekrar iade gönderilmedi." };
  }
  if (op.fresh) {
    let result: import("@/lib/payments/types").RefundResult;
    try {
      result = await provider.refund({ paymentId, amountKurus: amount, orderNo: order.order_no, meta: duplicate ? null : order.payment_meta, ip });
    } catch {
      result = { ok: false, error: "provider_outcome_unknown" };
    }
    // Retry only the local checkpoint. A lost DB response may mean the first write committed.
    let checkpointSaved = false;
    for (let attempt = 0; attempt < 2 && !checkpointSaved; attempt++) {
      try {
        const checkpoint = await supabase.from("refund_operations").update({
          state: result.ok ? "provider_succeeded" : "needs_review", result, updated_at: new Date().toISOString(),
        }).eq("id", op.id).eq("state", "started").select("id").maybeSingle();
        checkpointSaved = !checkpoint.error && !!checkpoint.data;
        if (!checkpointSaved) {
          const existing = await supabase.from("refund_operations").select("state, result").eq("id", op.id).maybeSingle();
          const stored = existing.data?.result as { ok?: boolean; refundId?: string } | undefined;
          checkpointSaved = !existing.error && (result.ok
            ? ["provider_succeeded", "completed"].includes(existing.data?.state) && stored?.ok === true && stored.refundId === result.refundId
            : existing.data?.state === "needs_review" && stored?.ok === false);
        }
      } catch { /* Keep the durable claim; never repeat a provider call. */ }
    }
    if (!checkpointSaved) {
      // Restricted server diagnostic: identifiers only, no buyer data, token, secret or provider payload.
      console.error("[refund] checkpoint_unavailable", { operationId: op.id, orderId: order.id,
        paymentId, ...(result.ok ? { refundId: result.refundId, method: result.method } : {}) });
      return { ok: false, error: "unavailable", detail: `İade sonucu kaydedilemedi; mutabakat kaydı: ${op.id}.` };
    }
    if (!result.ok) return { ok: false, error: "provider_error", detail: "Sağlayıcı sonucu mutabakat bekliyor." };
  }
  const done = await supabase.rpc("finish_refund_operation", { p_id: op.id });
  if (done.error || !done.data) return { ok: false, error: "unavailable", detail: "Sağlayıcı iadesi tamam; yerel kayıt tekrar tamamlanmalı." };
  return { ok: true, order: done.data as ReleaseOrderRow };
}

export async function executeRefund(orderId: string, adminUserId: string, ip: string | null, supabase: SupabaseClient = db()): Promise<AdminActionResult> {
  const order = await getOrder(supabase, orderId);
  if (!order) return { ok: false, error: "not_found" };
  if (order.status === "refunded") return { ok: false, error: "already_done" };
  if (!["withdrawal_requested", "cancelled_by_seller"].includes(order.status) || !order.payment_id) return { ok: false, error: "invalid_state" };
  return performRefund(order, order.payment_id, order.total_kurus, order.payment_provider, false, adminUserId, ip, supabase);
}

export { duplicateChargesFrom, type DuplicateCharge } from "./duplicates";

export async function refundDuplicate(orderId: string, paymentId: string, adminUserId: string, ip: string | null, supabase: SupabaseClient = db()): Promise<AdminActionResult> {
  const order = await getOrder(supabase, orderId);
  if (!order) return { ok: false, error: "not_found" };
  if (paymentId === order.payment_id) return { ok: false, error: "invalid_state" };
  const { data, error } = await supabase.from("order_events").select("type, data").eq("order_id", orderId).in("type", ["payment_succeeded", "refund_succeeded"]);
  if (error) return { ok: false, error: "unavailable" };
  const charge = duplicateChargesFrom(data ?? []).find((c) => c.paymentId === paymentId);
  if (!charge) return { ok: false, error: "not_found" };
  if (charge.refunded) return { ok: false, error: "already_done" };
  return performRefund(order, paymentId, charge.paidKurus, charge.provider || order.payment_provider, true, adminUserId, ip, supabase);
}

/* ── Fatura kuyruğu ───────────────────────────────────────────────────────── */

const INVOICEABLE: OrderStatus[] = ["paid", "confirmed", "scheduled", "released", "monitoring", "completed"];

/** "Şimdi fatura kes": bırakma beklenmeden fatura kuyruğuna alır (kurumsal alıcı talebi vb.). */
export async function queueInvoice(orderId: string, adminUserId: string, supabase: SupabaseClient = db()): Promise<AdminActionResult> {
  const order = await getOrder(supabase, orderId);
  if (!order) return { ok: false, error: "not_found" };
  if (!INVOICEABLE.includes(order.status)) return { ok: false, error: "invalid_state" };
  const existing = await supabase.from("order_invoices").select("id").eq("order_id", order.id).eq("kind", "sale").in("status", ["pending", "issued"]).limit(1);
  if (existing.error) return { ok: false, error: "unavailable" };
  if (existing.data?.length) return { ok: false, error: "already_done" };
  const inserted = await supabase.from("order_invoices").insert({ order_id: order.id, kind: "sale", provider: "manual", status: "pending", created_by: actorOf(adminUserId) });
  if (inserted.error) return { ok: false, error: "unavailable" };
  await addOrderEvent(supabase, order.id, "admin_note", actorOf(adminUserId), { note: "invoice_queued" });
  return { ok: true, order };
}

export interface InvoiceIssueInput {
  invoiceId: string;
  invoiceNo: string;
  ettn: string | null;
  /** YYYY-MM-DD */
  issuedOn: string;
}

export async function markInvoiceIssued(orderId: string, input: InvoiceIssueInput, adminUserId: string, supabase: SupabaseClient = db()): Promise<AdminActionResult> {
  const order = await getOrder(supabase, orderId);
  if (!order) return { ok: false, error: "not_found" };
  const issuedAt = new Date(`${input.issuedOn}T09:00:00Z`).toISOString(); // İstanbul 12:00 — gün kaymaz
  const { data, error } = await supabase
    .from("order_invoices")
    .update({ status: "issued", invoice_no: input.invoiceNo, ettn: input.ettn, issued_at: issuedAt })
    .eq("id", input.invoiceId)
    .eq("order_id", order.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "unavailable" };
  if (!data) return { ok: false, error: "invalid_state" };
  await addOrderEvent(supabase, order.id, "invoice_issued", actorOf(adminUserId), { invoiceNo: input.invoiceNo, ettn: input.ettn, issuedOn: input.issuedOn });
  return { ok: true, order };
}

/* ── Geç ödemede ayrılamamış kapasite ─────────────────────────────────────── */

/**
 * `payment_meta.capacityHeld=false` siparişte kapasiteyi şimdi ayırmayı dener (yönetici sahanın
 * kapasitesini artırdıktan sonra). Başarılıysa işaret kalkar; sipariş partiye alınabilir hâle gelir.
 */
export async function reserveCapacityNow(orderId: string, adminUserId: string, supabase: SupabaseClient = db()): Promise<AdminActionResult> {
  const order = await getOrder(supabase, orderId);
  if (!order) return { ok: false, error: "not_found" };
  if (order.payment_meta?.capacityHeld !== false) return { ok: false, error: "already_done" };
  if (!["paid", "confirmed"].includes(order.status)) return { ok: false, error: "invalid_state" };
  const reserved = await supabase.rpc("reserve_release_capacity", { p_land_id: order.land_id, p_quantity: order.quantity });
  if (reserved.error) return { ok: false, error: "unavailable" };
  if (reserved.data !== true) return { ok: false, error: "invalid_state", detail: "sahada yeterli boş kapasite yok ya da saha katılıma kapalı" };
  const meta = { ...(order.payment_meta ?? {}) };
  delete meta.capacityHeld;
  const { data, error } = await supabase.from("release_orders").update({ payment_meta: meta }).eq("id", order.id).select("*").maybeSingle();
  if (error || !data) return { ok: false, error: "unavailable" };
  await addOrderEvent(supabase, order.id, "status_changed", actorOf(adminUserId), { note: "capacity_reserved_late" });
  return { ok: true, order: data as ReleaseOrderRow };
}

/* ── Cayma süresi dolan siparişler ────────────────────────────────────────── */

/** `paid` ve cayma son anı geçmiş siparişleri `confirmed` yapar. Zamanlanmış iş (Faz 6) ve yönetim listesi çağırır. */
export async function confirmDueOrders(supabase: SupabaseClient = db(), limit = 100): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("release_orders").select("id").eq("status", "paid").lt("withdrawal_deadline", now).limit(limit);
  if (error || !data) return 0;
  let confirmed = 0;
  for (const row of data) {
    const done = await transitionOrder(supabase, row.id as string, ["paid"], "confirmed", { confirmed_at: now });
    if (!done) continue;
    await addOrderEvent(supabase, done.id, "status_changed", "system", { from: "paid", to: "confirmed", reason: "withdrawal_period_ended" });
    confirmed++;
  }
  return confirmed;
}
