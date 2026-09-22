/**
 * İade mutabakatı — tipler, sabitler ve SAF görünüm üreticileri (veritabanı/ağ yok).
 * Sözleşme: web-brifler/17-IADE-MUTABAKAT-API-SOZLESMESI.md. Buradaki tipler sözleşmedeki tiplerin kendisidir.
 */
import { duplicateChargesFrom } from "@/lib/orders/duplicates";

/* ── Sabitler (SQL 020 ile aynı) ─────────────────────────────────────────── */

export const STALE_AFTER_MINUTES = 15;
export const FAILED_RESOLUTION_MIN_MINUTES = 30;
export const REFUND_DUE_DAYS = 14;
export const REFUND_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;
export const EVIDENCE_SOURCES = ["provider_panel", "provider_query", "bank_statement"] as const;
export const REFUNDABLE_ORDER_STATUSES = ["withdrawal_requested", "cancelled_by_seller"] as const;
export const REFUND_EVENT_TYPES = [
  "refund_started",
  "refund_attempt_result",
  "refund_retry",
  "refund_resolved",
  "refund_late_result",
  "refund_succeeded",
  "refund_failed",
] as const;

/* ── Sözleşme tipleri ────────────────────────────────────────────────────── */

export type RefundState = "none" | "started" | "needs_review" | "failed" | "provider_succeeded" | "completed";
export type RefundOutcome = "succeeded" | "rejected" | "unknown" | "not_sent";
export type RefundKind = "order" | "duplicate";
export type RefundAction = "execute" | "retry" | "resolve_succeeded" | "resolve_failed" | "finalize";
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];
export type RefundEventType = (typeof REFUND_EVENT_TYPES)[number];

export interface RefundOperationView {
  id: string | null;
  kind: RefundKind;
  paymentId: string;
  provider: string;
  amountKurus: number;
  state: RefundState;
  stale: boolean;
  attention: boolean;
  attempt: number;
  attemptStartedAt: string | null;
  lastResult: null | {
    outcome: RefundOutcome;
    refundId?: string;
    method?: "refund" | "cancel" | "reconciled";
    errorCode?: string;
    error?: string;
  };
  resolution: null | {
    outcome: "provider_succeeded" | "failed";
    by: { adminId: string; label: string };
    at: string;
    source: EvidenceSource;
    reference?: string;
    note: string;
  };
  completedAt: string | null;
  allowedActions: RefundAction[];
  blockedActions: { action: RefundAction; reason: "too_early" | "forbidden" | "order_not_refundable"; availableAt?: string }[];
}

export interface RefundDue {
  basis: "withdrawal_notice" | "seller_cancellation";
  startedAt: string;
  dueAt: string;
  overdue: boolean;
  daysLeft: number;
}

export interface RefundHistoryEntry {
  at: string;
  type: RefundEventType;
  actor: { kind: "system" | "customer" | "admin"; adminId?: string; label?: string };
  operationId?: string;
  attempt?: number;
  summary: string;
}

export interface RefundOrderView {
  order: {
    id: string;
    orderNo: string;
    status: string;
    isTest: boolean;
    totalKurus: number;
    paymentProvider: string | null;
    paymentId: string | null;
    refundReason: "withdrawal" | "seller_cancellation" | null;
  };
  due: RefundDue | null;
  operations: RefundOperationView[];
  history: RefundHistoryEntry[];
  thresholds: { staleAfterMinutes: number; failedResolutionMinMinutes: number };
}

export interface RefundActionResult {
  action: RefundAction;
  operationId: string;
  outcome: "completed" | "provider_succeeded" | "failed" | "needs_review" | "noop";
}

export interface RefundQueueItem {
  orderId: string;
  orderNo: string;
  isTest: boolean;
  kind: RefundKind;
  operationId: string | null;
  paymentId: string;
  state: RefundState;
  stale: boolean;
  attention: boolean;
  amountKurus: number;
  attempt: number;
  due: RefundDue | null;
  updatedAt: string;
  allowedActions: RefundAction[];
}

/* ── Veritabanı satırları (service role ile okunur) ──────────────────────── */

export interface RefundOperationRow {
  id: string;
  order_id: string;
  provider: string;
  payment_id: string;
  duplicate: boolean;
  amount_kurus: number | string;
  actor: string;
  state: Exclude<RefundState, "none">;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  attempt_no: number;
  attempt_started_at: string;
  attention: boolean;
  resolution: Record<string, unknown> | null;
}

export interface RefundOrderRow {
  id: string;
  order_no: string;
  status: string;
  is_test: boolean;
  total_kurus: number | string;
  payment_provider: string | null;
  payment_id: string | null;
  withdrawal_requested_at: string | null;
  cancelled_at: string | null;
}

export interface OrderEventRow {
  type: string;
  actor: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

/* ── Yardımcılar ─────────────────────────────────────────────────────────── */

const MINUTE = 60_000;
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined);

export function formatTl(kurus: number): string {
  return (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const isRefundable = (status: string) => (REFUNDABLE_ORDER_STATUSES as readonly string[]).includes(status);

export function refundReasonOf(order: RefundOrderRow): RefundOrderView["order"]["refundReason"] {
  if (order.status === "withdrawal_requested") return "withdrawal";
  if (order.status === "cancelled_by_seller") return "seller_cancellation";
  if (order.status === "refunded") return order.withdrawal_requested_at ? "withdrawal" : order.cancelled_at ? "seller_cancellation" : null;
  return null;
}

/** Sipariş iadesinin son tarihi: cayma bildiriminden ya da satıcı iptalinden itibaren 14 gün. */
export function dueOf(order: RefundOrderRow, now: Date): RefundDue | null {
  const reason = refundReasonOf(order);
  const started = reason === "withdrawal" ? order.withdrawal_requested_at : reason === "seller_cancellation" ? order.cancelled_at : null;
  if (!reason || !started) return null;
  const startMs = Date.parse(started);
  if (!Number.isFinite(startMs)) return null;
  const dueMs = startMs + REFUND_DUE_DAYS * DAY;
  const open = order.status !== "refunded";
  return {
    basis: reason === "withdrawal" ? "withdrawal_notice" : "seller_cancellation",
    startedAt: iso(startMs),
    dueAt: iso(dueMs),
    overdue: open && now.getTime() > dueMs,
    daysLeft: Math.floor((dueMs - now.getTime()) / DAY),
  };
}

function lastResultOf(result: Record<string, unknown> | null): RefundOperationView["lastResult"] {
  const outcome = result?.outcome;
  if (outcome !== "succeeded" && outcome !== "rejected" && outcome !== "unknown" && outcome !== "not_sent") return null;
  const method = result?.method;
  return {
    outcome,
    ...(str(result?.refundId) ? { refundId: str(result?.refundId) } : {}),
    ...(method === "refund" || method === "cancel" || method === "reconciled" ? { method } : {}),
    ...(str(result?.errorCode) ? { errorCode: str(result?.errorCode) } : {}),
    ...(str(result?.error) ? { error: String(result?.error).slice(0, 300) } : {}),
  };
}

function resolutionOf(resolution: Record<string, unknown> | null, labels: Map<string, string>): RefundOperationView["resolution"] {
  if (!resolution) return null;
  const outcome = resolution.outcome;
  const source = resolution.source;
  if ((outcome !== "provider_succeeded" && outcome !== "failed") || !(EVIDENCE_SOURCES as readonly unknown[]).includes(source)) return null;
  const by = String(resolution.by ?? "");
  return {
    outcome,
    by: { adminId: by, label: labels.get(by) ?? "Yönetici" },
    at: String(resolution.at ?? ""),
    source: source as EvidenceSource,
    ...(str(resolution.reference) ? { reference: str(resolution.reference) } : {}),
    note: String(resolution.note ?? ""),
  };
}

interface ActionContext {
  now: Date;
  canExecute: boolean;
  /** Sipariş iadesi için: sipariş hâlâ iade bekliyor mu */
  orderRefundable: boolean;
}

/** İşlemin durumuna göre izin verilen / engellenen eylemler (sunucu kararı; arayüz yalnız gösterir). */
export function actionsFor(
  state: RefundState,
  opts: { kind: RefundKind; attention: boolean; stale: boolean; attemptStartedAt: string | null },
  ctx: ActionContext
): Pick<RefundOperationView, "allowedActions" | "blockedActions"> {
  const wanted: RefundAction[] = [];
  const blocked: RefundOperationView["blockedActions"] = [];
  const resolvable = state === "needs_review" || (state === "started" && opts.stale) || (state === "failed" && opts.attention);

  if (state === "none") wanted.push("execute");
  if (resolvable) {
    wanted.push("resolve_succeeded");
    const startMs = opts.attemptStartedAt ? Date.parse(opts.attemptStartedAt) : NaN;
    const availableMs = startMs + FAILED_RESOLUTION_MIN_MINUTES * MINUTE;
    if (Number.isFinite(availableMs) && ctx.now.getTime() < availableMs) {
      blocked.push({ action: "resolve_failed", reason: "too_early", availableAt: iso(availableMs) });
    } else {
      wanted.push("resolve_failed");
    }
  }
  if (state === "failed" && !opts.attention) wanted.push("retry");
  if (state === "provider_succeeded") wanted.push("finalize");

  // Sipariş artık iade beklemiyorsa (ör. başka yoldan tamamlandı) yeni para işlemi başlatılmaz.
  const needsRefundableOrder: RefundAction[] = ["execute", "retry"];
  const allowed: RefundAction[] = [];
  for (const action of wanted) {
    if (opts.kind === "order" && needsRefundableOrder.includes(action) && !ctx.orderRefundable) {
      blocked.push({ action, reason: "order_not_refundable" });
    } else if (!ctx.canExecute) {
      blocked.push({ action, reason: "forbidden" });
    } else {
      allowed.push(action);
    }
  }
  if (!ctx.canExecute) {
    for (const b of blocked) if (b.reason === "too_early") b.reason = "forbidden";
  }
  return { allowedActions: allowed, blockedActions: blocked };
}

export function operationView(row: RefundOperationRow, ctx: ActionContext, labels: Map<string, string>): RefundOperationView {
  const stale = row.state === "started" && Date.parse(row.attempt_started_at) <= ctx.now.getTime() - STALE_AFTER_MINUTES * MINUTE;
  const kind: RefundKind = row.duplicate ? "duplicate" : "order";
  const completedAt = row.state === "completed" ? row.updated_at : null;
  return {
    id: row.id,
    kind,
    paymentId: row.payment_id,
    provider: row.provider,
    amountKurus: Number(row.amount_kurus),
    state: row.state,
    stale,
    attention: row.attention === true,
    attempt: row.attempt_no ?? 1,
    attemptStartedAt: row.attempt_started_at ?? null,
    lastResult: lastResultOf(row.result),
    resolution: resolutionOf(row.resolution, labels),
    completedAt,
    ...actionsFor(row.state, { kind, attention: row.attention === true, stale, attemptStartedAt: row.attempt_started_at }, ctx),
  };
}

function noneOperation(kind: RefundKind, paymentId: string, provider: string, amountKurus: number, ctx: ActionContext): RefundOperationView {
  return {
    id: null,
    kind,
    paymentId,
    provider,
    amountKurus,
    state: "none",
    stale: false,
    attention: false,
    attempt: 0,
    attemptStartedAt: null,
    lastResult: null,
    resolution: null,
    completedAt: null,
    ...actionsFor("none", { kind, attention: false, stale: false, attemptStartedAt: null }, ctx),
  };
}

/* ── Geçmiş ─────────────────────────────────────────────────────────────── */

const SOURCE_LABEL: Record<EvidenceSource, string> = {
  provider_panel: "sağlayıcı paneli",
  provider_query: "sağlayıcı sorgusu",
  bank_statement: "banka ekstresi",
};

const ERROR_LABEL: Record<string, string> = {
  timeout: "zaman aşımı",
  network: "bağlantı hatası",
  config: "yapılandırma hatası",
  exception: "beklenmeyen hata",
  provider_unavailable: "sağlayıcı tanımlı değil",
};

function outcomeText(data: Record<string, unknown>): string {
  const code = str(data.errorCode);
  const codeText = code ? ERROR_LABEL[code] ?? `kod ${code}` : null;
  switch (data.outcome) {
    case "succeeded":
      return `sağlayıcı iadeyi onayladı${str(data.refundId) ? ` (iade no ${str(data.refundId)})` : ""}`;
    case "rejected":
      return `sağlayıcı reddetti${codeText ? ` (${codeText})` : ""}`;
    case "not_sent":
      return `istek sağlayıcıya gitmedi${codeText ? ` (${codeText})` : ""}`;
    default:
      return `sonuç belirsiz${codeText ? ` (${codeText})` : ""}`;
  }
}

function actorOf(actor: string, labels: Map<string, string>): RefundHistoryEntry["actor"] {
  if (actor === "system" || actor === "customer") return { kind: actor };
  const adminId = actor.startsWith("admin:") ? actor.slice(6) : actor;
  return { kind: "admin", adminId, label: labels.get(adminId) ?? "Yönetici" };
}

export function historyEntry(event: OrderEventRow, labels: Map<string, string>): RefundHistoryEntry | null {
  if (!(REFUND_EVENT_TYPES as readonly string[]).includes(event.type)) return null;
  const data = event.data ?? {};
  const type = event.type as RefundEventType;
  const attempt = num(data.attempt);
  const amount = num(data.amountKurus);
  const dup = data.duplicate === true ? " (çift tahsilat)" : "";
  let summary: string;
  switch (type) {
    case "refund_started":
      summary = `İade başlatıldı${dup}${amount !== undefined ? `: ${formatTl(amount)} TL` : ""}.`;
      break;
    case "refund_attempt_result":
      summary = `${attempt ?? 1}. deneme: ${outcomeText(data)}.${data.outcome === "unknown" ? " Mutabakat gerekli." : ""}`;
      break;
    case "refund_retry":
      summary = `${attempt ?? "?"}. deneme başlatıldı (yeniden deneme)${dup}.`;
      break;
    case "refund_resolved": {
      const source = SOURCE_LABEL[data.source as EvidenceSource] ?? "belirtilmemiş kaynak";
      const verdict = data.outcome === "provider_succeeded" ? `iade yapıldı${str(data.refundId) ? ` (iade no ${str(data.refundId)})` : ""}` : "iade yapılmadı";
      summary = `Mutabakat: ${verdict} — kaynak: ${source}.${str(data.note) ? ` Not: ${String(data.note).slice(0, 300)}` : ""}`;
      break;
    }
    case "refund_late_result":
      summary = `Geç sağlayıcı sonucu (${attempt ?? "?"}. deneme: ${outcomeText(data)}); işlem durumu değişmedi. Mutabakat gerekli.`;
      break;
    case "refund_succeeded":
      summary = `İade tamamlandı${dup}${amount !== undefined ? `: ${formatTl(amount)} TL` : ""}.`;
      break;
    default:
      summary = `İade denemesi başarısız${str(data.error) ? `: ${String(data.error).slice(0, 200)}` : ""}.`;
  }
  const operationId = str(data.operationId);
  return {
    at: new Date(event.created_at).toISOString(),
    type,
    actor: actorOf(event.actor, labels),
    ...(operationId ? { operationId } : {}),
    ...(attempt !== undefined ? { attempt } : {}),
    summary,
  };
}

/* ── Sipariş görünümü ───────────────────────────────────────────────────── */

export interface OrderViewInput {
  order: RefundOrderRow;
  operations: RefundOperationRow[];
  /** Siparişin payment_succeeded / refund_succeeded ve iade olayları */
  events: OrderEventRow[];
  labels: Map<string, string>;
  now: Date;
  canExecute: boolean;
}

export function buildOrderView(input: OrderViewInput): RefundOrderView {
  const { order, operations, events, labels, now, canExecute } = input;
  const orderRefundable = isRefundable(order.status) && Boolean(order.payment_id);
  const ctx: ActionContext = { now, canExecute, orderRefundable };

  const views: RefundOperationView[] = [];
  const orderOp = operations.find((o) => !o.duplicate);
  if (orderOp) views.push(operationView(orderOp, ctx, labels));
  else if (orderRefundable) {
    views.push(noneOperation("order", order.payment_id as string, order.payment_provider ?? "", Number(order.total_kurus), ctx));
  }

  const dupOps = operations.filter((o) => o.duplicate).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const dupCtx: ActionContext = { ...ctx, orderRefundable: true };
  for (const op of dupOps) views.push(operationView(op, dupCtx, labels));
  const withOp = new Set(dupOps.map((o) => o.payment_id));
  for (const charge of duplicateChargesFrom(events)) {
    if (charge.refunded || withOp.has(charge.paymentId) || charge.paymentId === order.payment_id) continue;
    views.push(noneOperation("duplicate", charge.paymentId, charge.provider || order.payment_provider || "", charge.paidKurus, dupCtx));
  }

  const history = events
    .map((e) => historyEntry(e, labels))
    .filter((e): e is RefundHistoryEntry => e !== null)
    .sort((a, b) => b.at.localeCompare(a.at));

  return {
    order: {
      id: order.id,
      orderNo: order.order_no,
      status: order.status,
      isTest: order.is_test,
      totalKurus: Number(order.total_kurus),
      paymentProvider: order.payment_provider,
      paymentId: order.payment_id,
      refundReason: refundReasonOf(order),
    },
    due: dueOf(order, now),
    operations: views,
    history,
    thresholds: { staleAfterMinutes: STALE_AFTER_MINUTES, failedResolutionMinMinutes: FAILED_RESOLUTION_MIN_MINUTES },
  };
}

/* ── İş kuyruğu ─────────────────────────────────────────────────────────── */

export interface QueueInput {
  /** Tamamlanmamış işlemler (filter=all ise tamamlananlar da) + siparişleri */
  operations: (RefundOperationRow & { order: RefundOrderRow })[];
  /** İade bekleyen siparişler */
  refundableOrders: RefundOrderRow[];
  /** Çift tahsilat olayları (payment_succeeded/refund_succeeded, duplicate:true) + siparişleri */
  duplicateEvents: (OrderEventRow & { order: RefundOrderRow })[];
  now: Date;
  canExecute: boolean;
  includeTest: boolean;
}

/** Sıralı ve süzülmüş kuyruk (sınırsız); sayfalama/limit çağıranda. */
export function buildQueue(input: QueueInput): RefundQueueItem[] {
  const { now, canExecute } = input;
  const items: RefundQueueItem[] = [];
  const orderOpFor = new Set<string>();
  const dupOpFor = new Set<string>();

  for (const row of input.operations) {
    const order = row.order;
    if (row.duplicate) dupOpFor.add(`${row.order_id}:${row.payment_id}`);
    else orderOpFor.add(row.order_id);
    const ctx: ActionContext = { now, canExecute, orderRefundable: row.duplicate || (isRefundable(order.status) && Boolean(order.payment_id)) };
    const view = operationView(row, ctx, new Map());
    items.push({
      orderId: order.id,
      orderNo: order.order_no,
      isTest: order.is_test,
      kind: view.kind,
      operationId: row.id,
      paymentId: row.payment_id,
      state: view.state,
      stale: view.stale,
      attention: view.attention,
      amountKurus: view.amountKurus,
      attempt: view.attempt,
      due: row.duplicate ? null : dueOf(order, now),
      updatedAt: new Date(row.updated_at).toISOString(),
      allowedActions: view.allowedActions,
    });
  }

  for (const order of input.refundableOrders) {
    if (orderOpFor.has(order.id) || !order.payment_id || !isRefundable(order.status)) continue;
    const ctx: ActionContext = { now, canExecute, orderRefundable: true };
    const view = noneOperation("order", order.payment_id, order.payment_provider ?? "", Number(order.total_kurus), ctx);
    items.push({
      orderId: order.id, orderNo: order.order_no, isTest: order.is_test, kind: "order", operationId: null,
      paymentId: order.payment_id, state: "none", stale: false, attention: false, amountKurus: view.amountKurus,
      attempt: 0, due: dueOf(order, now), updatedAt: new Date(order.withdrawal_requested_at ?? order.cancelled_at ?? now).toISOString(),
      allowedActions: view.allowedActions,
    });
  }

  const byOrder = new Map<string, { order: RefundOrderRow; events: OrderEventRow[] }>();
  for (const e of input.duplicateEvents) {
    const entry = byOrder.get(e.order.id) ?? { order: e.order, events: [] };
    entry.events.push(e);
    byOrder.set(e.order.id, entry);
  }
  for (const { order, events } of byOrder.values()) {
    for (const charge of duplicateChargesFrom(events)) {
      if (charge.refunded || dupOpFor.has(`${order.id}:${charge.paymentId}`) || charge.paymentId === order.payment_id) continue;
      const first = events.find((e) => e.type === "payment_succeeded" && e.data?.paymentId === charge.paymentId);
      items.push({
        orderId: order.id, orderNo: order.order_no, isTest: order.is_test, kind: "duplicate", operationId: null,
        paymentId: charge.paymentId, state: "none", stale: false, attention: false, amountKurus: charge.paidKurus,
        attempt: 0, due: null, updatedAt: new Date(first?.created_at ?? now).toISOString(),
        allowedActions: canExecute ? ["execute"] : [],
      });
    }
  }

  const rank = (i: RefundQueueItem) => (i.due?.overdue ? 0 : i.attention ? 1 : i.due ? 2 : 3);
  return items
    .filter((i) => input.includeTest || !i.isTest)
    .sort((a, b) =>
      rank(a) - rank(b) ||
      (a.due && b.due ? a.due.dueAt.localeCompare(b.due.dueAt) : 0) ||
      b.updatedAt.localeCompare(a.updatedAt)
    );
}
