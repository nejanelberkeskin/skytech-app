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
import { createRefundService, type ActionOutcome as RefundActionOutcome, type ServiceError as RefundServiceError } from "@/lib/refunds/service";
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

/*
 * Tek iade uygulaması lib/refunds/service.ts'tedir (sözleşme: web-brifler/17): claim (019) → sağlayıcı
 * (yalnız ilk sahiplenmede) → sonuç kaydı (020) → atomik tamamlama (019). Sonucu belirsiz deneme kendiliğinden
 * tekrarlanmaz; sonuç kaydedilemezse sağlayıcı tekrar çağrılmaz. Buradaki iki işlev, sipariş ayrıntısındaki
 * eski `refund` / `refund_duplicate` eylemleri için aynı servisi eski sonuç biçimine çevirir.
 */
function refundService(supabase: SupabaseClient) {
  return createRefundService({
    db: supabase,
    getProvider: getProviderByName,
    now: () => new Date(),
    log: (message, data) => console.error(message, JSON.stringify(data)),
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
}

const LEGACY_REFUND_ERRORS: Record<string, AdminActionError> = {
  not_found: "not_found",
  in_progress: "in_progress",
  already_done: "already_done",
  provider_unavailable: "provider_unavailable",
  unavailable: "unavailable",
};

async function legacyRefundResult(outcome: RefundActionOutcome | RefundServiceError, orderId: string, supabase: SupabaseClient): Promise<AdminActionResult> {
  if (!outcome.ok) return { ok: false, error: LEGACY_REFUND_ERRORS[outcome.code] ?? "invalid_state", detail: outcome.message };
  const pending = outcome.warnings.find((w) => w.code === "result_not_recorded" || w.code === "finalize_pending");
  switch (outcome.result.outcome) {
    case "completed":
    case "noop": {
      const order = outcome.notify ?? (await getOrder(supabase, orderId));
      return order ? { ok: true, order } : { ok: false, error: "unavailable" };
    }
    case "failed":
      return { ok: false, error: "provider_error", detail: "Sağlayıcı iadeyi yapmadı. İade ekranından yeniden deneyin ya da mutabakat yapın." };
    case "provider_succeeded":
      return { ok: false, error: "unavailable", detail: pending?.message ?? "Sağlayıcı iadesi tamam; yerel kayıt tamamlanmalı." };
    default:
      return pending
        ? { ok: false, error: "unavailable", detail: pending.message }
        : { ok: false, error: "provider_error", detail: "Sağlayıcı sonucu belirsiz; tekrar iade gönderilmedi. Mutabakat gerekli." };
  }
}

export async function executeRefund(orderId: string, adminUserId: string, ip: string | null, supabase: SupabaseClient = db()): Promise<AdminActionResult> {
  const outcome = await refundService(supabase).execute(orderId, { kind: "order" }, { user_id: adminUserId }, ip);
  return legacyRefundResult(outcome, orderId, supabase);
}

export { duplicateChargesFrom, type DuplicateCharge } from "./duplicates";

export async function refundDuplicate(orderId: string, paymentId: string, adminUserId: string, ip: string | null, supabase: SupabaseClient = db()): Promise<AdminActionResult> {
  const outcome = await refundService(supabase).execute(orderId, { kind: "duplicate", paymentId }, { user_id: adminUserId }, ip);
  return legacyRefundResult(outcome, orderId, supabase);
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
