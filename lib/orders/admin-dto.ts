/**
 * Sipariş yönetimi okuma DTO'ları ve dönüştürücüler — YALNIZ SUNUCU. Sözleşme: web-brifler/27 §4.
 *
 * Her alan açık listeden gelir: ham satır, ham fatura JSON'u, ödeme meta verisi (payment_meta) ve olay
 * yükü dışarı çıkmaz. Bir grubun alanları yalnız o grup bu kayıt için açıksa eklenir; yoksa hiç yer almaz
 * (sıfır ya da boş değil). Arayüz bu dosyadaki tipleri kullanır.
 */
import { duplicateChargesFrom } from "./duplicates";
import type { OrderCapabilities, OrderGroup, ReadScope, SensitiveGroup } from "./admin-access";
import type { DocumentKind, OrderEventType, OrderStatus } from "./types";

export type { OrderCapabilities, OrderGroup, ReadScope, SensitiveGroup } from "./admin-access";

/* ── Tipler ───────────────────────────────────────────────────────────────── */

export interface OrderBuyer {
  type: "individual" | "corporate";
  firstName: string;
  lastName: string;
  companyTitle: string | null;
}

export interface OrderListItem {
  id: string;
  orderNo: string;
  status: OrderStatus;
  isTest: boolean;
  locale: "tr" | "en" | "ru";
  createdAt: string;
  paidAt: string | null;
  quantity: number;
  site: { id: string; name: string | null };
  seasonLabel: string;
  batchId: string | null;
  buyer: OrderBuyer;
  certificateName: string;
  withdrawalDeadline: string | null;
  performanceDeadline: string | null;
  contact?: { email: string };
  finance?: { totalKurus: number; paymentProvider: string | null };
}

export interface OrderListDto {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<OrderStatus, number>;
  alerts: { capacity: number; refundPending?: number; duplicate?: number; invoicePending?: number };
  groups: OrderGroup[];
  scope: ReadScope;
  search: { contactFields: boolean };
}

export type EventValue = string | number | boolean | string[] | null;

export interface OrderEventDto {
  id: number;
  type: OrderEventType | string;
  at: string;
  actor: { kind: "customer" | "system" | "admin"; adminId?: string };
  data: Record<string, EventValue>;
}

export interface OrderDetailDto {
  groups: OrderGroup[];
  /**
   * İzni ve saha kapsamı olduğu hâlde yeniden doğrulama gerektiği için DÖNMEYEN gruplar (27 §4.5).
   * Bunların kaynağı sorgulanmadı; arayüz "doğrulayın" der, "yetkiniz yok" demez.
   */
  mfaRequiredGroups: SensitiveGroup[];
  /** `mfaRequiredGroups` doluysa neden ve tazelik süresi (`mfa_required` hatasıyla aynı alanlar), yoksa null. */
  mfa: { enrolled: boolean; reason: "enrollment" | "challenge" | "stale"; freshnessMinutes: number } | null;
  capabilities: OrderCapabilities;
  order: {
    id: string;
    orderNo: string;
    status: OrderStatus;
    isTest: boolean;
    locale: "tr" | "en" | "ru";
    site: { id: string; name: string | null; snapshot: { name?: string; province?: string; district?: string } };
    seasonLabel: string;
    quantity: number;
    batch: { id: string; title: string; plannedOn: string | null; releasedOn: string | null; seasonLabel: string } | null;
    buyer: OrderBuyer;
    certificateName: string;
    dates: {
      createdAt: string; updatedAt: string; paidAt: string | null; paymentExpiresAt: string | null;
      withdrawalDeadline: string | null; performanceDeadline: string | null; confirmedAt: string | null;
      scheduledAt: string | null; releasedAt: string | null; completedAt: string | null;
      withdrawalRequestedAt: string | null; cancelledAt: string | null; refundedAt: string | null;
      certificateIssuedAt: string | null; certificateCancelledAt: string | null;
    };
    withdrawalChannel: string | null;
    cancelReason: string | null;
    adminNote: string | null;
    capacity: { held: boolean | null };
  };
  contact?: {
    email: string;
    phone: string;
    marketingConsent: boolean;
    invoiceAddress: { province: string; district: string; line: string; postalCode: string | null } | null;
    authorizedPerson: string | null;
    kep: string | null;
  };
  tax?: {
    invoiceType: "individual" | "corporate";
    tckn: string | null;
    taxId: string | null;
    taxOffice: string | null;
    mersis: string | null;
    eInvoiceUser: boolean | null;
    poNumber: string | null;
  };
  finance?: {
    unitPriceKurus: number;
    totalKurus: number;
    vatRate: number;
    payment: { provider: string | null; paymentId: string | null; startedAt: string | null; expiresAt: string | null };
    refunds: {
      id: string; amountKurus: number; reason: string; status: string; provider: string | null;
      providerRef: string | null; error: string | null; createdAt: string; completedAt: string | null;
    }[];
    duplicates: { paymentId: string; paidKurus: number; refunded: boolean }[];
  };
  invoices?: {
    id: string; kind: string; provider: string; status: string; invoiceNo: string | null; ettn: string | null;
    issuedAt: string | null; sentAt: string | null; error: string | null; createdAt: string;
  }[];
  legal?: {
    documentsVersion: string;
    sourcePath: string | null;
    documents: { kind: DocumentKind; title: string; sha256: string; templateVersion: string; createdAt: string }[];
    consents: Record<string, { granted: boolean; at: string | null; version: string | null; revokedAt: string | null; subjectName: string | null }>;
  };
  certificate?: { code: string | null };
  events: OrderEventDto[];
}

/* ── Yardımcılar ──────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;
const text = (v: unknown): string | null => (typeof v === "string" ? v : null);
const textOr = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const numberOr = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const record = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});

export function buyerOf(row: Row): OrderBuyer {
  return {
    type: row.buyer_type === "corporate" ? "corporate" : "individual",
    firstName: textOr(row.buyer_first_name),
    lastName: textOr(row.buyer_last_name),
    // Şirket unvanı alıcının kimliğidir (ad gibi); vergi bilgisi değildir. Yalnız bu JSON yolu seçilir.
    companyTitle: text(row.company_title),
  };
}

/* ── Olay beyaz listesi (27 §4.4) ─────────────────────────────────────────── */

type Fields = Partial<Record<OrderGroup, readonly string[]>>;
const REFUND_FIELDS: Fields = {
  finance: ["attempt", "amountKurus", "duplicate", "outcome", "source", "refundId", "operationId", "paymentId", "error", "note"],
};
const EVENT_FIELDS: Record<string, Fields> = {
  order_created: { order: ["quantity", "season", "performanceDeadline", "rolledToNextSeason", "isTest"], finance: ["totalKurus"] },
  consent_recorded: { legal: ["consents"] },
  documents_generated: { order: ["version", "kinds"] },
  payment_started: { finance: ["provider"] },
  payment_succeeded: { finance: ["provider", "paymentId", "paidKurus", "duplicate"] },
  payment_failed: { finance: ["stage", "reason", "status", "expectedKurus", "paidKurus", "paymentId", "error"] },
  order_expired: { order: ["reason"] },
  email_sent: { order: ["template", "attachments"] },
  email_failed: { order: ["template", "attachments", "reason", "stage"] },
  status_changed: { order: ["from", "to", "reason", "note", "capacityReserved", "batchId"] },
  withdrawal_requested: { order: ["channel", "refundDueOn"], contact: ["note"] },
  withdrawal_cancelled: { order: ["reason"] },
  certificate_cancelled: { order: ["reason"] },
  refund_started: REFUND_FIELDS,
  refund_attempt_result: REFUND_FIELDS,
  refund_late_result: REFUND_FIELDS,
  refund_retry: REFUND_FIELDS,
  refund_resolved: REFUND_FIELDS,
  refund_succeeded: REFUND_FIELDS,
  refund_failed: REFUND_FIELDS,
  invoice_issued: { invoices: ["invoiceNo", "ettn", "issuedOn"] },
  batch_assigned: { order: ["batchId", "title", "plannedOn"] },
  release_completed: { order: ["batchId", "releasedOn"] },
  certificate_issued: { certificate: ["code"] },
  video_notified: { order: ["batchId"] },
  admin_note: { order: ["note"] },
};

const MAX_TEXT = 1000;

/** Yalnız ilkel değerler ve dize dizileri; iç içe nesne, ham belge bloğu ya da uzun metin çıkmaz. */
function safeValue(v: unknown): EventValue | undefined {
  if (v === null) return null;
  if (typeof v === "string") return v.slice(0, MAX_TEXT);
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return (v as string[]).slice(0, 50);
  return undefined;
}

function actorOf(raw: unknown): OrderEventDto["actor"] {
  const actor = typeof raw === "string" ? raw : "";
  if (actor.startsWith("admin:")) return { kind: "admin", adminId: actor.slice("admin:".length) };
  return { kind: actor === "customer" ? "customer" : "system" };
}

/** Ham olay → DTO. `groups`: bu kayıtta açık gruplar (her zaman "order" dahil). */
export function sanitizeEvent(event: Row, groups: ReadonlySet<OrderGroup>): OrderEventDto {
  const type = textOr(event.type);
  const raw = record(event.data);
  // Türetilmiş alanlar: belge bloklarının yerine yalnız türler; onayların yerine yalnız verilen anahtarlar.
  const derived: Row = { ...raw };
  if (type === "documents_generated") {
    derived.kinds = Array.isArray(raw.documents)
      ? (raw.documents as unknown[]).map((d) => textOr(record(d).kind)).filter(Boolean)
      : Array.isArray(raw.kinds) ? raw.kinds : [];
  }
  if (type === "consent_recorded") {
    derived.consents = Object.entries(record(raw.consents)).filter(([, v]) => record(v).granted === true).map(([k]) => k);
  }
  const data: Record<string, EventValue> = {};
  for (const [group, keys] of Object.entries(EVENT_FIELDS[type] ?? {}) as [OrderGroup, readonly string[]][]) {
    if (!groups.has(group)) continue;
    for (const key of keys) {
      if (!(key in derived)) continue;
      const value = safeValue(derived[key]);
      if (value !== undefined) data[key] = value;
    }
  }
  return { id: numberOr(event.id), type, at: textOr(event.created_at), actor: actorOf(event.actor), data };
}

/* ── Ayrıntı grupları ─────────────────────────────────────────────────────── */

/**
 * İletişim ve vergi alanları ham `invoice` JSON'undan değil, gruba özel JSON yollarından gelir
 * (lib/orders/admin-detail.ts GROUP_COLUMNS): vergi grubu kapalıyken vergi alanları sorguya girmez.
 */
export function contactOf(row: Row): NonNullable<OrderDetailDto["contact"]> {
  const address = record(row.invoice_address);
  const hasAddress = Object.keys(address).length > 0;
  return {
    email: textOr(row.buyer_email),
    phone: textOr(row.buyer_phone),
    marketingConsent: row.marketing_consent === true,
    invoiceAddress: hasAddress
      ? { province: textOr(address.province), district: textOr(address.district), line: textOr(address.line), postalCode: text(address.postalCode) }
      : null,
    authorizedPerson: text(row.invoice_authorized_person),
    kep: text(row.invoice_kep),
  };
}

export function taxOf(row: Row): NonNullable<OrderDetailDto["tax"]> {
  const eInvoice = row.invoice_e_invoice_user;
  return {
    invoiceType: row.invoice_type === "corporate" ? "corporate" : "individual",
    tckn: text(row.invoice_tckn),
    taxId: text(row.invoice_tax_id),
    taxOffice: text(row.invoice_tax_office),
    mersis: text(row.invoice_mersis),
    eInvoiceUser: eInvoice === true || eInvoice === "true" ? true : eInvoice === false || eInvoice === "false" ? false : null,
    poNumber: text(row.invoice_po_number),
  };
}

export function financeOf(row: Row, refunds: Row[], events: Row[]): NonNullable<OrderDetailDto["finance"]> {
  return {
    unitPriceKurus: numberOr(row.unit_price_kurus),
    totalKurus: numberOr(row.total_kurus),
    vatRate: numberOr(row.vat_rate),
    payment: {
      provider: text(row.payment_provider),
      paymentId: text(row.payment_id),
      startedAt: text(row.payment_started_at),
      expiresAt: text(row.payment_expires_at),
    },
    refunds: refunds.map((r) => ({
      id: textOr(r.id),
      amountKurus: numberOr(r.amount_kurus),
      reason: textOr(r.reason),
      status: textOr(r.status),
      provider: text(r.provider),
      // Sahiplenme işareti ("claim:…") iç ayrıntıdır; panelde "işleniyor" görünür.
      providerRef: typeof r.provider_ref === "string" && r.provider_ref.startsWith("claim:") ? "işleniyor" : text(r.provider_ref),
      error: text(r.error),
      createdAt: textOr(r.created_at),
      completedAt: text(r.completed_at),
    })),
    duplicates: duplicateChargesFrom(events.map((e) => ({ type: textOr(e.type), data: record(e.data) })))
      .map((d) => ({ paymentId: d.paymentId, paidKurus: d.paidKurus, refunded: d.refunded })),
  };
}

export function invoicesOf(rows: Row[]): NonNullable<OrderDetailDto["invoices"]> {
  return rows.map((r) => ({
    id: textOr(r.id), kind: textOr(r.kind), provider: textOr(r.provider), status: textOr(r.status),
    invoiceNo: text(r.invoice_no), ettn: text(r.ettn), issuedAt: text(r.issued_at), sentAt: text(r.sent_at),
    error: text(r.error), createdAt: textOr(r.created_at),
  }));
}

export function legalOf(row: Row, documents: Row[]): NonNullable<OrderDetailDto["legal"]> {
  const consents: NonNullable<OrderDetailDto["legal"]>["consents"] = {};
  for (const [key, value] of Object.entries(record(row.consents))) {
    const c = record(value);
    consents[key] = {
      granted: c.granted === true, at: text(c.at), version: text(c.version),
      revokedAt: text(c.revokedAt), subjectName: text(c.subjectName),
    };
  }
  return {
    documentsVersion: textOr(row.documents_version),
    sourcePath: text(row.source_path),
    documents: documents.map((d) => ({
      kind: textOr(d.kind) as DocumentKind, title: textOr(d.title), sha256: textOr(d.sha256),
      templateVersion: textOr(d.template_version), createdAt: textOr(d.created_at),
    })),
    consents,
  };
}

export function orderCore(row: Row, batch: Row | null): OrderDetailDto["order"] {
  const snapshot = record(row.site_snapshot);
  const held = typeof row.capacity_held === "string" ? row.capacity_held : null;
  return {
    id: textOr(row.id),
    orderNo: textOr(row.order_no),
    status: textOr(row.status) as OrderStatus,
    isTest: row.is_test === true,
    locale: (["tr", "en", "ru"].includes(textOr(row.locale)) ? row.locale : "tr") as "tr" | "en" | "ru",
    site: {
      id: textOr(row.land_id),
      name: text(snapshot.name),
      snapshot: {
        ...(text(snapshot.name) ? { name: text(snapshot.name)! } : {}),
        ...(text(snapshot.province) ? { province: text(snapshot.province)! } : {}),
        ...(text(snapshot.district) ? { district: text(snapshot.district)! } : {}),
      },
    },
    seasonLabel: textOr(row.season_label),
    quantity: numberOr(row.quantity),
    batch: batch
      ? { id: textOr(batch.id), title: textOr(batch.title), plannedOn: text(batch.planned_on), releasedOn: text(batch.released_on), seasonLabel: textOr(batch.season_label) }
      : null,
    buyer: buyerOf(row),
    certificateName: textOr(row.certificate_name),
    dates: {
      createdAt: textOr(row.created_at), updatedAt: textOr(row.updated_at), paidAt: text(row.paid_at),
      paymentExpiresAt: text(row.payment_expires_at), withdrawalDeadline: text(row.withdrawal_deadline),
      performanceDeadline: text(row.performance_deadline), confirmedAt: text(row.confirmed_at),
      scheduledAt: text(row.scheduled_at), releasedAt: text(row.released_at), completedAt: text(row.completed_at),
      withdrawalRequestedAt: text(row.withdrawal_requested_at), cancelledAt: text(row.cancelled_at),
      refundedAt: text(row.refunded_at), certificateIssuedAt: text(row.certificate_issued_at),
      certificateCancelledAt: text(row.certificate_cancelled_at),
    },
    withdrawalChannel: text(row.withdrawal_channel),
    cancelReason: text(row.cancel_reason),
    adminNote: text(row.admin_note),
    capacity: { held: held === "true" ? true : held === "false" ? false : null },
  };
}

/** `contact`/`finance`: yalnız ilgili grubun saha kapsamındaki kayıt için ayrı sorgudan gelen değerler. */
export function listItemOf(row: Row, contact: Row | undefined, finance: Row | undefined): OrderListItem {
  return {
    id: textOr(row.id),
    orderNo: textOr(row.order_no),
    status: textOr(row.status) as OrderStatus,
    isTest: row.is_test === true,
    locale: (["tr", "en", "ru"].includes(textOr(row.locale)) ? row.locale : "tr") as "tr" | "en" | "ru",
    createdAt: textOr(row.created_at),
    paidAt: text(row.paid_at),
    quantity: numberOr(row.quantity),
    site: { id: textOr(row.land_id), name: text(row.site_name) },
    seasonLabel: textOr(row.season_label),
    batchId: text(row.batch_id),
    buyer: buyerOf(row),
    certificateName: textOr(row.certificate_name),
    withdrawalDeadline: text(row.withdrawal_deadline),
    performanceDeadline: text(row.performance_deadline),
    ...(contact ? { contact: { email: textOr(contact.buyer_email) } } : {}),
    ...(finance ? { finance: { totalKurus: numberOr(finance.total_kurus), paymentProvider: text(finance.payment_provider) } } : {}),
  };
}
