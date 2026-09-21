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

const CLAIM_TTL_MS = 10 * 60_000;
const claimValue = () => `claim:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
const claimAge = (ref: string | null) => {
  const m = ref ? /^claim:(\d+):/.exec(ref) : null;
  return m ? Date.now() - Number(m[1]) : null;
};

/**
 * Bekleyen (ya da önceki denemesi başarısız) iadeyi sağlayıcıdan yapar. Çift iadeyi önlemek için
 * iade satırı önce "sahiplenilir" (provider_ref üzerinde karşılaştır-ve-yaz); aynı anda gelen
 * ikinci istek `in_progress` alır. Yarıda kalmış sahiplenme 10 dakika sonra devralınabilir.
 */
export async function executeRefund(orderId: string, adminUserId: string, ip: string | null, supabase: SupabaseClient = db()): Promise<AdminActionResult> {
  const order = await getOrder(supabase, orderId);
  if (!order) return { ok: false, error: "not_found" };
  if (order.status === "refunded") return { ok: false, error: "already_done" };
  if (order.status !== "withdrawal_requested" && order.status !== "cancelled_by_seller") return { ok: false, error: "invalid_state" };
  if (!order.payment_id) return { ok: false, error: "invalid_state", detail: "ödeme kimliği yok" };

  const provider = getProviderByName(order.payment_provider);
  if (!provider) return { ok: false, error: "provider_unavailable", detail: order.payment_provider ?? "-" };

  // İade satırı: bekleyen ya da başarısız son kayıt; yoksa aç.
  let { data: refund } = await supabase
    .from("order_refunds")
    .select("id, status, provider_ref")
    .eq("order_id", order.id)
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!refund) {
    const created = await supabase
      .from("order_refunds")
      .insert({
        order_id: order.id,
        amount_kurus: order.total_kurus,
        reason: order.status === "withdrawal_requested" ? "withdrawal" : "seller_cancellation",
        status: "pending",
        provider: order.payment_provider,
        requested_by: actorOf(adminUserId),
      })
      .select("id, status, provider_ref")
      .single();
    if (created.error || !created.data) return { ok: false, error: "unavailable" };
    refund = created.data;
  }

  // Sahiplen (karşılaştır-ve-yaz)
  const previousRef = (refund.provider_ref as string | null) ?? null;
  const age = claimAge(previousRef);
  if (age !== null && age < CLAIM_TTL_MS) return { ok: false, error: "in_progress" };
  const claim = claimValue();
  let claimQuery = supabase.from("order_refunds").update({ provider_ref: claim, status: "pending", error: null }).eq("id", refund.id).in("status", ["pending", "failed"]);
  claimQuery = previousRef === null ? claimQuery.is("provider_ref", null) : claimQuery.eq("provider_ref", previousRef);
  const claimed = await claimQuery.select("id").maybeSingle();
  if (claimed.error) return { ok: false, error: "unavailable" };
  if (!claimed.data) return { ok: false, error: "in_progress" };

  await addOrderEvent(supabase, order.id, "refund_started", actorOf(adminUserId), { provider: provider.name, amountKurus: order.total_kurus });

  const result = await provider.refund({
    paymentId: order.payment_id,
    amountKurus: order.total_kurus,
    orderNo: order.order_no,
    meta: order.payment_meta,
    ip,
  });

  if (!result.ok) {
    await supabase.from("order_refunds").update({ status: "failed", error: result.error.slice(0, 500), provider_ref: null }).eq("id", refund.id).eq("provider_ref", claim);
    await addOrderEvent(supabase, order.id, "refund_failed", actorOf(adminUserId), { provider: provider.name, error: result.error.slice(0, 300) });
    return { ok: false, error: "provider_error", detail: result.error.slice(0, 300) };
  }

  const at = new Date().toISOString();
  await supabase.from("order_refunds").update({ status: "succeeded", provider_ref: result.refundId, completed_at: at, error: null }).eq("id", refund.id);

  const refunded = await transitionOrder(supabase, order.id, [order.status], "refunded", {
    refunded_at: at,
    ...(order.certificate_code && !order.certificate_cancelled_at ? { certificate_cancelled_at: at } : {}),
  });

  // Ayrılmış kapasite serbest kalır (geç ödemede hiç ayrılamamışsa geri verilecek bir şey yoktur).
  if (order.payment_meta?.capacityHeld !== false) {
    await supabase.rpc("release_reserved_capacity", { p_land_id: order.land_id, p_quantity: order.quantity });
  }
  await addOrderEvent(supabase, order.id, "refund_succeeded", actorOf(adminUserId), {
    provider: provider.name,
    refundId: result.refundId,
    method: result.method,
    amountKurus: order.total_kurus,
  });
  if (order.certificate_code && !order.certificate_cancelled_at) {
    await addOrderEvent(supabase, order.id, "certificate_cancelled", "system", { code: order.certificate_code, reason: "refund" });
  }
  await settleInvoicesAfterRefund(supabase, order.id);
  return { ok: true, order: refunded ?? { ...order, status: "refunded", refunded_at: at } };
}

/**
 * İade sonrası fatura kuyruğu: henüz kesilmemiş satış faturası iptal edilir (kesilmesine gerek
 * kalmadı); kesilmiş satış faturası varsa muhasebe için "iade faturası" kuyruğa alınır.
 */
async function settleInvoicesAfterRefund(supabase: SupabaseClient, orderId: string): Promise<void> {
  const { data } = await supabase.from("order_invoices").select("id, kind, status").eq("order_id", orderId);
  const rows = data ?? [];
  const pendingSale = rows.filter((r) => r.kind === "sale" && r.status === "pending");
  if (pendingSale.length) await supabase.from("order_invoices").update({ status: "cancelled" }).in("id", pendingSale.map((r) => r.id as string));
  const issuedSale = rows.some((r) => r.kind === "sale" && r.status === "issued");
  const hasRefundInvoice = rows.some((r) => r.kind === "refund" && (r.status === "pending" || r.status === "issued"));
  if (issuedSale && !hasRefundInvoice) {
    await supabase.from("order_invoices").insert({ order_id: orderId, kind: "refund", provider: "manual", status: "pending", created_by: "system" });
  }
}

/* ── Çift tahsilatın iadesi ───────────────────────────────────────────────── */

export { duplicateChargesFrom, type DuplicateCharge } from "./duplicates";

export async function refundDuplicate(orderId: string, paymentId: string, adminUserId: string, ip: string | null, supabase: SupabaseClient = db()): Promise<AdminActionResult> {
  const order = await getOrder(supabase, orderId);
  if (!order) return { ok: false, error: "not_found" };
  const { data: events, error } = await supabase.from("order_events").select("type, data").eq("order_id", order.id).in("type", ["payment_succeeded", "refund_succeeded", "refund_started"]);
  if (error) return { ok: false, error: "unavailable" };

  const list = (events ?? []) as { type: string; data: Record<string, unknown> | null }[];
  const charge = duplicateChargesFrom(list).find((c) => c.paymentId === paymentId);
  if (!charge) return { ok: false, error: "not_found" };
  if (charge.refunded) return { ok: false, error: "already_done" };
  // Asıl ödeme bu uçtan iade edilemez (o, sipariş iadesidir).
  if (paymentId === order.payment_id) return { ok: false, error: "invalid_state" };
  // Son 10 dakikada başlamış ve sonuçlanmamış bir deneme varsa bekle (çift iade koruması).
  const recentStart = list.some(
    (e) => e.type === "refund_started" && e.data?.duplicate === true && e.data?.paymentId === paymentId && Date.now() - Number(e.data?.at ?? 0) < CLAIM_TTL_MS
  );
  if (recentStart) return { ok: false, error: "in_progress" };

  const provider = getProviderByName(charge.provider || order.payment_provider);
  if (!provider) return { ok: false, error: "provider_unavailable", detail: charge.provider };

  await addOrderEvent(supabase, order.id, "refund_started", actorOf(adminUserId), { duplicate: true, paymentId, amountKurus: charge.paidKurus, at: Date.now() });
  const result = await provider.refund({ paymentId, amountKurus: charge.paidKurus, orderNo: order.order_no, meta: null, ip });
  if (!result.ok) {
    await addOrderEvent(supabase, order.id, "refund_failed", actorOf(adminUserId), { duplicate: true, paymentId, error: result.error.slice(0, 300) });
    return { ok: false, error: "provider_error", detail: result.error.slice(0, 300) };
  }
  await addOrderEvent(supabase, order.id, "refund_succeeded", actorOf(adminUserId), {
    duplicate: true,
    paymentId,
    refundId: result.refundId,
    method: result.method,
    amountKurus: charge.paidKurus,
  });
  return { ok: true, order };
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
