/**
 * Sabit örnek iade görünümleri — arayüz geliştirme ve testler için (web-brifler/17 §8).
 * Gerçek sunucu kodu (`buildOrderView`) ile üretilir; biçim sözleşmeyle aynı kalır. Veritabanına,
 * ödeme sağlayıcısına ya da e-postaya gitmez. Kişisel veri içermez.
 */
import { buildOrderView, buildQueue, type OrderEventRow, type RefundOperationRow, type RefundOrderRow, type RefundOrderView, type RefundQueueItem } from "./model";

export const FIXTURE_NOW = new Date("2026-09-22T14:10:00.000Z");
const ADMIN = "10000000-0000-0000-0000-00000000000f";
const labels = new Map([[ADMIN, "Finans Kullanıcısı"]]);

const order = (over: Partial<RefundOrderRow> = {}): RefundOrderRow => ({
  id: "30000000-0000-0000-0000-000000000001",
  order_no: "SG-2026-K7M2PQ",
  status: "withdrawal_requested",
  is_test: false,
  total_kurus: 20000,
  payment_provider: "iyzico",
  payment_id: "22416035",
  withdrawal_requested_at: "2026-09-20T09:00:00.000Z",
  cancelled_at: null,
  ...over,
});

const op = (over: Partial<RefundOperationRow> = {}): RefundOperationRow => ({
  id: "40000000-0000-0000-0000-000000000001",
  order_id: "30000000-0000-0000-0000-000000000001",
  provider: "iyzico",
  payment_id: "22416035",
  duplicate: false,
  amount_kurus: 20000,
  actor: ADMIN,
  state: "started",
  result: null,
  created_at: "2026-09-22T14:00:00.000Z",
  updated_at: "2026-09-22T14:00:16.000Z",
  attempt_no: 1,
  attempt_started_at: "2026-09-22T14:00:00.000Z",
  attention: false,
  resolution: null,
  ...over,
});

const started: OrderEventRow = {
  type: "refund_started", actor: `admin:${ADMIN}`, created_at: "2026-09-22T14:00:00.000Z",
  data: { duplicate: false, paymentId: "22416035", amountKurus: 20000, operationId: "40000000-0000-0000-0000-000000000001" },
};
const result = (outcome: string, extra: Record<string, unknown> = {}): OrderEventRow => ({
  type: "refund_attempt_result", actor: "system", created_at: "2026-09-22T14:00:16.000Z",
  data: { outcome, attempt: 1, operationId: "40000000-0000-0000-0000-000000000001", ...extra },
});

const view = (o: RefundOrderRow, ops: RefundOperationRow[], events: OrderEventRow[], canExecute = true): RefundOrderView =>
  buildOrderView({ order: o, operations: ops, events, labels, now: FIXTURE_NOW, canExecute });

export const REFUND_VIEW_FIXTURES: Record<string, RefundOrderView> = {
  /** Cayma bildirildi, iade henüz başlatılmadı. */
  notStarted: view(order(), [], []),
  /** Zaman aşımı: sonuç belirsiz; "iade yapılmadı" 14:30'a kadar kapalı. */
  needsReview: view(
    order(),
    [op({ state: "needs_review", result: { ok: false, outcome: "unknown", errorCode: "timeout", error: "iyzico yanıt vermedi", attempt: 1 } })],
    [result("unknown", { errorCode: "timeout" }), started]
  ),
  /** İstek sağlayıcıya gitmedi: yeniden denenebilir. */
  failed: view(
    order(),
    [op({ state: "failed", result: { ok: false, outcome: "not_sent", errorCode: "config", error: "yapılandırma hatası", attempt: 1 } })],
    [result("not_sent", { errorCode: "config" }), started]
  ),
  /** Sağlayıcıda başarılı, yerel kayıt tamamlanamadı: "Tamamla". */
  providerSucceeded: view(
    order(),
    [op({ state: "provider_succeeded", result: { ok: true, outcome: "succeeded", refundId: "22416035", method: "refund", attempt: 1 } })],
    [result("succeeded", { refundId: "22416035" }), started]
  ),
  /** Tamamlandı. */
  completed: view(
    order({ status: "refunded" }),
    [op({ state: "completed", updated_at: "2026-09-22T14:00:17.000Z", result: { ok: true, outcome: "succeeded", refundId: "22416035", method: "refund", attempt: 1 } })],
    [
      { type: "refund_succeeded", actor: `admin:${ADMIN}`, created_at: "2026-09-22T14:00:17.000Z", data: { duplicate: false, amountKurus: 20000, refundId: "22416035", operationId: "40000000-0000-0000-0000-000000000001" } },
      result("succeeded", { refundId: "22416035" }),
      started,
    ]
  ),
  /** Satıcı iptali + iade edilmemiş çift tahsilat; son tarih geçmiş. */
  overdueWithDuplicate: view(
    order({ status: "cancelled_by_seller", withdrawal_requested_at: null, cancelled_at: "2026-09-01T08:00:00.000Z" }),
    [],
    [{ type: "payment_succeeded", actor: "system", created_at: "2026-08-30T10:00:00.000Z", data: { duplicate: true, paymentId: "22416099", paidKurus: 20000, provider: "iyzico" } }]
  ),
  /** Yalnız okuma izni olan rol (işlem düğmeleri yok). */
  readOnly: view(order(), [], [], false),
};

export const REFUND_QUEUE_FIXTURE: RefundQueueItem[] = buildQueue({
  operations: [{ ...op({ state: "needs_review", result: { ok: false, outcome: "unknown", errorCode: "timeout", attempt: 1 } }), order: order() }],
  refundableOrders: [order({ id: "30000000-0000-0000-0000-000000000002", order_no: "SG-2026-K7M2PR", payment_id: "22416036", status: "cancelled_by_seller", withdrawal_requested_at: null, cancelled_at: "2026-09-01T08:00:00.000Z" })],
  duplicateEvents: [],
  now: FIXTURE_NOW,
  canExecute: true,
  includeTest: false,
});
