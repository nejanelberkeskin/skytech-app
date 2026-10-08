/**
 * İade mutabakatı — YALNIZ SUNUCU. Sözleşme: web-brifler/17.
 *
 *   execute   ilk deneme: claim (019) → sağlayıcı (yalnız ilk sahiplenmede) → sonuç (020) → tamamlama (019)
 *   retry     kesin reddedilmiş işlemi yeni denemeyle yeniden başlatır (020)
 *   resolve   sonucu belirsiz işlem için mutabakat kararı (020); "iade yapıldı" ise tamamlama
 *   finalize  sağlayıcıda başarılı işlemin yerel kaydını tamamlar; sağlayıcı ÇAĞRILMAZ
 *
 * Kurallar: tutar her zaman kayıttan gelir; sonucu belirsiz deneme kendiliğinden tekrarlanmaz; sağlayıcı
 * sonucu kaydedilemezse sağlayıcı tekrar çağrılmaz, iade kimliği sunucu loguna ve yanıta yazılır.
 * Durum değiştiren her adımın olay ve audit kaydı SQL fonksiyonunun içinde, aynı transaction'da yazılır.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiWarning } from "@/lib/api/envelope";
import type { PaymentProvider, RefundResult } from "@/lib/payments/types";
import type { ReleaseOrderRow } from "@/lib/orders/types";
import { duplicateChargesFrom } from "@/lib/orders/duplicates";
import {
  REFUND_EVENT_TYPES,
  REFUNDABLE_ORDER_STATUSES,
  buildOrderView,
  buildQueue,
  type EvidenceSource,
  type OrderEventRow,
  type RefundAction,
  type RefundActionResult,
  type RefundOperationRow,
  type RefundOrderRow,
  type RefundOrderView,
  type RefundQueueItem,
} from "./model";

export interface RefundServiceDeps {
  db: SupabaseClient;
  getProvider(name: string | null | undefined): PaymentProvider | null;
  now(): Date;
  /** Sunucu logu (kişisel veri yazılmaz; sipariş no ve ödeme/iade kimlikleri yazılabilir). */
  log(message: string, data: Record<string, unknown>): void;
  /** Kaydı tekrar okumadan önce kısa bekleme (testlerde 0). */
  pause(ms: number): Promise<void>;
}

export interface Actor {
  user_id: string;
}

export type ServiceError = { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };
export type ActionOutcome = {
  ok: true;
  view: RefundOrderView | null;
  result: RefundActionResult;
  warnings: ApiWarning[];
  /** Tamamlanan sipariş iadesi: rota yanıttan sonra müşteriye "iade tamamlandı" e-postası gönderir. */
  notify: ReleaseOrderRow | null;
};

const ORDER_FIELDS = "id, order_no, status, is_test, total_kurus, payment_provider, payment_id, withdrawal_requested_at, cancelled_at";
const OP_FIELDS = "id, order_id, provider, payment_id, duplicate, amount_kurus, actor, state, result, created_at, updated_at, attempt_no, attempt_started_at, attention, resolution";

const err = (status: number, code: string, message: string, details?: Record<string, unknown>): ServiceError => ({
  ok: false, status, code, message, ...(details ? { details } : {}),
});
const unavailable = () => err(503, "unavailable", "Veri alınamadı. Lütfen yeniden deneyin.");

/** SQL fonksiyonlarının RAISE mesajı → API hatası (web-brifler/17 §6.7). */
const SQL_ERRORS: Record<string, [number, string, string]> = {
  forbidden: [403, "forbidden", "Bu işlem için yetkiniz yok."],
  operation_missing: [404, "not_found", "İade işlemi bulunamadı."],
  order_missing: [404, "not_found", "Sipariş bulunamadı."],
  attempt_changed: [409, "attempt_changed", "Bu iade işleminde başka biri işlem yaptı. Görünümü yenileyin."],
  invalid_state: [409, "invalid_state", "İade işlemi bu adım için uygun durumda değil."],
  invalid_refund_state: [409, "invalid_state", "Sipariş iade tamamlamaya uygun durumda değil."],
  invalid_duplicate: [409, "invalid_state", "Bu ödeme siparişin kayıtlı ikinci tahsilatı değil."],
  refund_conflict: [409, "invalid_state", "Bu ödeme için farklı bilgilerle açılmış bir iade işlemi var."],
  attention_required: [409, "invalid_state", "Geç ya da çelişen bir sağlayıcı sonucu var; önce mutabakat yapılmalı."],
  order_not_refundable: [409, "invalid_state", "Sipariş artık iade bekleyen durumda değil."],
  provider_result_missing: [409, "invalid_state", "Sağlayıcı sonucu kayıtlı değil; tamamlanamaz."],
  too_early: [409, "too_early", "\"İade yapılmadı\" kararı deneme başlangıcından 30 dakika sonra verilebilir."],
  invalid_refund_id: [422, "invalid_refund_id", "Geçerli bir iade kimliği girin (en çok 100 karakter; harf, rakam ve . _ : -)."],
  note_required: [422, "note_required", "Gerekçe notu 10–1000 karakter olmalı."],
  evidence_required: [422, "evidence_required", "Kanıt kaynağını seçin (kaynak açıklaması en çok 200 karakter)."],
  invalid_outcome: [400, "invalid_body", "Geçersiz sonuç."],
};

interface PgError { message?: string; details?: string | null; code?: string }

export function mapSqlError(error: PgError | null | undefined): ServiceError {
  const key = String(error?.message ?? "").trim();
  const known = SQL_ERRORS[key];
  if (!known) return unavailable();
  const [status, code, message] = known;
  if (key === "too_early" && error?.details) return err(status, code, message, { availableAt: error.details });
  return err(status, code, message);
}

type ClaimData = Partial<RefundOperationRow> & { state?: string; fresh?: boolean };

export function createRefundService(deps: RefundServiceDeps) {
  const { db } = deps;

  async function adminLabels(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
    if (!unique.length) return new Map();
    const { data, error } = await db.from("admin_users").select("user_id, full_name, email").in("user_id", unique);
    if (error) throw new Error("admin_labels_unavailable");
    return new Map((data ?? []).map((r) => [String(r.user_id), String(r.full_name || r.email || "Yönetici")]));
  }

  async function loadOrderRow(orderId: string): Promise<ReleaseOrderRow | null> {
    const { data, error } = await db.from("release_orders").select("*").eq("id", orderId).maybeSingle();
    if (error) throw new Error("order_unavailable");
    return (data as ReleaseOrderRow | null) ?? null;
  }

  async function loadOperation(operationId: string): Promise<RefundOperationRow | null> {
    const { data, error } = await db.from("refund_operations").select(OP_FIELDS).eq("id", operationId).maybeSingle();
    if (error) throw new Error("operation_unavailable");
    return (data as RefundOperationRow | null) ?? null;
  }

  /** Siparişin iade görünümü. Okuma hatası boş görünüm değil, hata olur. */
  async function orderView(orderId: string, canExecute: boolean): Promise<RefundOrderView | ServiceError> {
    try {
      const { data: order, error } = await db.from("release_orders").select(ORDER_FIELDS).eq("id", orderId).maybeSingle();
      if (error) return unavailable();
      if (!order) return err(404, "not_found", "Sipariş bulunamadı.");
      const [ops, events] = await Promise.all([
        db.from("refund_operations").select(OP_FIELDS).eq("order_id", orderId).order("created_at", { ascending: true }),
        db
          .from("order_events")
          .select("type, actor, data, created_at")
          .eq("order_id", orderId)
          .in("type", ["payment_succeeded", ...REFUND_EVENT_TYPES])
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (ops.error || events.error) return unavailable();
      const operations = (ops.data ?? []) as RefundOperationRow[];
      const eventRows = (events.data ?? []) as OrderEventRow[];
      const actorIds = [
        ...eventRows.map((e) => (e.actor.startsWith("admin:") ? e.actor.slice(6) : "")),
        ...operations.map((o) => String(o.resolution?.by ?? "")),
      ];
      const labels = await adminLabels(actorIds);
      return buildOrderView({ order: order as RefundOrderRow, operations, events: eventRows, labels, now: deps.now(), canExecute });
    } catch {
      return unavailable();
    }
  }

  /** İşlem sonrası görünüm; okunamazsa işlem geri alınmış gibi gösterilmez, uyarı eklenir. */
  async function respond(orderId: string, result: RefundActionResult, warnings: ApiWarning[], notify: ReleaseOrderRow | null): Promise<ActionOutcome> {
    const view = await orderView(orderId, true);
    if ("ok" in view) {
      warnings.push({ code: "view_unavailable", message: "İşlem kaydedildi ancak güncel görünüm alınamadı; sayfayı yenileyin." });
      return { ok: true, view: null, result, warnings, notify };
    }
    return { ok: true, view, result, warnings, notify };
  }

  /** Yerel tamamlama (019 finish). Başarısızsa durum provider_succeeded kalır ve uyarı döner. */
  async function complete(op: Pick<RefundOperationRow, "id" | "duplicate">, warnings: ApiWarning[]) {
    const done = await db.rpc("finish_refund_operation", { p_id: op.id });
    if (done.error || !done.data) {
      warnings.push({ code: "finalize_pending", message: "Sağlayıcıda iade başarılı; yerel kayıt tamamlanamadı. \"Tamamla\" ile yeniden deneyin." });
      return { outcome: "provider_succeeded" as const, notify: null };
    }
    return { outcome: "completed" as const, notify: op.duplicate ? null : (done.data as ReleaseOrderRow) };
  }

  /** Sağlayıcıyı BİR KEZ çağırır, sonucu kaydeder; kayıt başarısızsa sağlayıcı tekrar çağrılmaz. */
  async function callProvider(
    op: Pick<RefundOperationRow, "id" | "duplicate" | "payment_id" | "amount_kurus">,
    attempt: number,
    provider: PaymentProvider,
    order: ReleaseOrderRow,
    ip: string | null,
    warnings: ApiWarning[]
  ): Promise<{ state: string; late: boolean }> {
    let result: RefundResult;
    try {
      result = await provider.refund({
        paymentId: op.payment_id,
        amountKurus: Number(op.amount_kurus),
        orderNo: order.order_no,
        meta: op.duplicate ? null : order.payment_meta,
        ip,
      });
    } catch {
      result = { ok: false, error: "Sağlayıcı çağrısı beklenmedik biçimde kesildi.", outcome: "unknown", errorCode: "exception" };
    }
    const payload = result.ok
      ? { outcome: "succeeded", refundId: result.refundId, method: result.method }
      : { outcome: result.outcome ?? "unknown", errorCode: result.errorCode ?? null, error: result.error };

    let rec = await db.rpc("record_refund_result", { p_id: op.id, p_attempt: attempt, p_result: payload });
    if (rec.error) {
      // Yanıt kaybolmuş olabilir: önce kayıt gerçekten yazıldı mı bak, yazılmadıysa bir kez daha dene.
      await deps.pause(300);
      const current = await db.from("refund_operations").select("state, attempt_no, result").eq("id", op.id).maybeSingle();
      const row = current.data as { state: string; attempt_no: number; result: Record<string, unknown> | null } | null;
      if (!current.error && row && row.attempt_no === attempt && row.state !== "started" && Number(row.result?.attempt) === attempt) {
        return { state: row.state, late: false };
      }
      rec = await db.rpc("record_refund_result", { p_id: op.id, p_attempt: attempt, p_result: payload });
    }
    if (rec.error || !rec.data) {
      deps.log("[iade] deneme sonucu kaydedilemedi — mutabakat gerekli", {
        orderNo: order.order_no, operationId: op.id, attempt, outcome: payload.outcome,
        refundId: result.ok ? result.refundId : null, paymentId: op.payment_id,
      });
      warnings.push({
        code: "result_not_recorded",
        message: result.ok
          ? `Sağlayıcı iadeyi onayladı (iade no ${result.refundId}) ancak sonuç kaydedilemedi. Sağlayıcı tekrar çağrılmayacak; 15 dakika sonra mutabakatla "iade yapıldı" olarak işaretleyin.`
          : "Sağlayıcı sonucu kaydedilemedi. Sağlayıcı tekrar çağrılmayacak; 15 dakika sonra mutabakat yapın.",
      });
      return { state: "started", late: false };
    }
    const data = rec.data as { state: string; late?: boolean };
    if (data.late) warnings.push({ code: "late_result", message: "Bu işlemde geç bir sağlayıcı sonucu kaydedildi; mutabakat gerekli." });
    return { state: data.state, late: data.late === true };
  }

  async function runAttempt(
    action: RefundAction,
    op: Pick<RefundOperationRow, "id" | "duplicate" | "payment_id" | "amount_kurus" | "order_id">,
    attempt: number,
    provider: PaymentProvider,
    order: ReleaseOrderRow,
    ip: string | null
  ): Promise<ActionOutcome> {
    const warnings: ApiWarning[] = [];
    const recorded = await callProvider(op, attempt, provider, order, ip, warnings);
    let outcome: RefundActionResult["outcome"] =
      recorded.state === "failed" ? "failed" : recorded.state === "provider_succeeded" ? "provider_succeeded" : "needs_review";
    let notify: ReleaseOrderRow | null = null;
    if (recorded.state === "provider_succeeded" && !recorded.late) {
      const done = await complete(op, warnings);
      outcome = done.outcome;
      notify = done.notify;
    }
    return respond(op.order_id, { action, operationId: op.id, outcome }, warnings, notify);
  }

  /* ── Eylemler ─────────────────────────────────────────────────────────── */

  async function execute(
    orderId: string,
    input: { kind: "order" } | { kind: "duplicate"; paymentId: string },
    actor: Actor,
    ip: string | null
  ): Promise<ActionOutcome | ServiceError> {
    try {
      const order = await loadOrderRow(orderId);
      if (!order) return err(404, "not_found", "Sipariş bulunamadı.");
      let paymentId: string;
      let amount: number;
      let providerName: string | null;
      const duplicate = input.kind === "duplicate";
      if (!duplicate) {
        if (order.status === "refunded") return err(409, "already_done", "Bu siparişin iadesi tamamlanmış.");
        if (!(REFUNDABLE_ORDER_STATUSES as readonly string[]).includes(order.status) || !order.payment_id) {
          return err(409, "invalid_state", "Sipariş iade bekleyen durumda değil.");
        }
        paymentId = order.payment_id;
        amount = Number(order.total_kurus);
        providerName = order.payment_provider;
      } else {
        if (input.paymentId === order.payment_id) return err(409, "invalid_state", "Asıl ödeme bu yoldan iade edilmez; sipariş iadesini kullanın.");
        const { data, error } = await db.from("order_events").select("type, data").eq("order_id", orderId).in("type", ["payment_succeeded", "refund_succeeded"]);
        if (error) return unavailable();
        const charge = duplicateChargesFrom(data ?? []).find((c) => c.paymentId === input.paymentId);
        if (!charge) return err(404, "not_found", "Bu siparişte böyle bir ikinci tahsilat kaydı yok.");
        if (charge.refunded) return err(409, "already_done", "Bu tahsilatın iadesi tamamlanmış.");
        paymentId = charge.paymentId;
        amount = charge.paidKurus;
        providerName = charge.provider || order.payment_provider;
      }
      const provider = deps.getProvider(providerName);
      if (!provider) return err(503, "provider_unavailable", "Ödemenin alındığı sağlayıcı bu ortamda tanımlı değil.");

      const claim = await db.rpc("claim_refund_operation", {
        p_order: order.id, p_provider: provider.name, p_payment: paymentId,
        p_amount: amount, p_duplicate: duplicate, p_actor: actor.user_id,
      });
      if (claim.error || !claim.data) return claim.error ? mapSqlError(claim.error) : unavailable();
      const op = claim.data as ClaimData;
      if (op.state === "completed") return err(409, "already_done", "Bu iade tamamlanmış.");
      if (!op.fresh || !op.id) {
        if (op.state === "provider_succeeded" && op.id) {
          const warnings: ApiWarning[] = [];
          const done = await complete({ id: op.id, duplicate }, warnings);
          return respond(order.id, { action: "finalize", operationId: op.id, outcome: done.outcome }, warnings, done.notify);
        }
        if (op.state === "started") return err(409, "in_progress", "Bu iade için sağlayıcı yanıtı bekleniyor.");
        if (op.state === "failed") return err(409, "invalid_state", "Önceki deneme başarısız oldu; \"Yeniden dene\" kullanın.");
        return err(409, "invalid_state", "Bu iadenin sonucu belirsiz; önce mutabakat yapılmalı.");
      }
      const attempt = Number(op.attempt_no ?? 1);
      return runAttempt("execute", { id: op.id, duplicate, payment_id: paymentId, amount_kurus: amount, order_id: order.id }, attempt, provider, order, ip);
    } catch {
      return unavailable();
    }
  }

  async function retry(operationId: string, expectedAttempt: number, actor: Actor, ip: string | null): Promise<ActionOutcome | ServiceError> {
    try {
      const current = await loadOperation(operationId);
      if (!current) return err(404, "not_found", "İade işlemi bulunamadı.");
      const provider = deps.getProvider(current.provider);
      if (!provider) return err(503, "provider_unavailable", "Ödemenin alındığı sağlayıcı bu ortamda tanımlı değil.");
      const res = await db.rpc("retry_refund_operation", { p_id: operationId, p_actor: actor.user_id, p_expected_attempt: expectedAttempt });
      if (res.error || !res.data) return res.error ? mapSqlError(res.error) : unavailable();
      const op = res.data as RefundOperationRow;
      const order = await loadOrderRow(op.order_id);
      if (!order) return err(404, "not_found", "Sipariş bulunamadı.");
      return runAttempt("retry", op, Number(op.attempt_no), provider, order, ip);
    } catch {
      return unavailable();
    }
  }

  async function resolve(
    operationId: string,
    input: { expectedAttempt: number; outcome: "provider_succeeded" | "failed"; refundId?: string; source: EvidenceSource; reference?: string; note: string },
    actor: Actor
  ): Promise<ActionOutcome | ServiceError> {
    try {
      const res = await db.rpc("resolve_refund_operation", {
        p_id: operationId, p_actor: actor.user_id, p_expected_attempt: input.expectedAttempt, p_outcome: input.outcome,
        p_refund_id: input.refundId ?? null, p_source: input.source, p_reference: input.reference ?? null, p_note: input.note,
      });
      if (res.error || !res.data) return res.error ? mapSqlError(res.error) : unavailable();
      const op = res.data as RefundOperationRow;
      const warnings: ApiWarning[] = [];
      if (input.outcome === "failed") {
        return respond(op.order_id, { action: "resolve_failed", operationId: op.id, outcome: "failed" }, warnings, null);
      }
      const done = await complete(op, warnings);
      return respond(op.order_id, { action: "resolve_succeeded", operationId: op.id, outcome: done.outcome }, warnings, done.notify);
    } catch {
      return unavailable();
    }
  }

  async function finalize(operationId: string): Promise<ActionOutcome | ServiceError> {
    try {
      const op = await loadOperation(operationId);
      if (!op) return err(404, "not_found", "İade işlemi bulunamadı.");
      if (op.state === "completed") return respond(op.order_id, { action: "finalize", operationId: op.id, outcome: "noop" }, [], null);
      if (op.state !== "provider_succeeded") return err(409, "invalid_state", "Yalnız sağlayıcıda başarılı iade tamamlanabilir.");
      const warnings: ApiWarning[] = [];
      const done = await complete(op, warnings);
      return respond(op.order_id, { action: "finalize", operationId: op.id, outcome: done.outcome }, warnings, done.notify);
    } catch {
      return unavailable();
    }
  }

  async function queue(opts: { filter: "open" | "all"; includeTest: boolean; limit: number; canExecute: boolean }): Promise<{ items: RefundQueueItem[]; total: number } | ServiceError> {
    try {
      let opsQuery = db.from("refund_operations").select(`${OP_FIELDS}, order:release_orders!inner(${ORDER_FIELDS})`);
      opsQuery = opts.filter === "open" ? opsQuery.neq("state", "completed") : opsQuery;
      const [ops, orders, dups] = await Promise.all([
        opsQuery.order("updated_at", { ascending: false }).limit(1000),
        db.from("release_orders").select(ORDER_FIELDS).in("status", [...REFUNDABLE_ORDER_STATUSES]).limit(1000),
        db
          .from("order_events")
          .select(`type, actor, data, created_at, order:release_orders!inner(${ORDER_FIELDS})`)
          .in("type", ["payment_succeeded", "refund_succeeded"])
          .eq("data->>duplicate", "true")
          .limit(5000),
      ]);
      if (ops.error || orders.error || dups.error) return unavailable();
      const all = buildQueue({
        operations: (ops.data ?? []) as unknown as (RefundOperationRow & { order: RefundOrderRow })[],
        refundableOrders: (orders.data ?? []) as RefundOrderRow[],
        duplicateEvents: (dups.data ?? []) as unknown as (OrderEventRow & { order: RefundOrderRow })[],
        now: deps.now(),
        canExecute: opts.canExecute,
        includeTest: opts.includeTest,
      });
      return { items: all.slice(0, opts.limit), total: all.length };
    } catch {
      return unavailable();
    }
  }

  return { orderView, execute, retry, resolve, finalize, queue };
}

export type RefundService = ReturnType<typeof createRefundService>;
