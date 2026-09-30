/**
 * Tipli örnek yanıtlar — bırakma partileri arayüzü gerçek veri olmadan çalışsın diye. Sözleşme: web-brifler/31 §8.
 * Kişisel veri yoktur; adlar ve sipariş numaraları kurgusaldır.
 */
import type { ApiErrorBody } from "@/lib/api/envelope";
import type { BatchDetailDto, BatchListDto, BatchOrderRow, BatchSummary } from "../admin-dto";

const SITE_A = "20000000-0000-4000-8000-0000000000aa";
const BATCH = "50000000-0000-4000-8000-000000000001";

const summary: BatchSummary = {
  id: BATCH,
  landId: SITE_A,
  landName: "Antalya Proje Uygulama Sahası",
  seasonLabel: "2026-2027",
  title: "Kasım bırakması",
  plannedOn: "2026-11-15",
  releasedOn: null,
  videoUrl: null,
  videoPublishedAt: null,
  monitoringReportUrl: null,
  notes: null,
  createdAt: "2026-09-20T09:00:00.000Z",
  orders: 2,
  quantity: 40,
  capabilities: { plan: true, assign: true, release: true, publish: false },
};

/** Operasyon şablonu: plan + atama + bırakma; yayın izni yok. */
export const BATCH_LIST_OPERATIONS: BatchListDto = {
  batches: [summary],
  lands: [{ id: SITE_A, name: "Antalya Proje Uygulama Sahası", status: "open", isPublic: true, canPlan: true }],
  seasons: ["2026-2027", "2027-2028"],
  waiting: [{ landId: SITE_A, landName: "Antalya Proje Uygulama Sahası", seasonLabel: "2026-2027", orders: 3, quantity: 60 }],
  dueForConfirmation: 1,
  scope: { kind: "all" },
  capabilities: { create: true },
  mfa: { enforced: true, satisfied: false, enrolled: true },
};

const baseRow: BatchOrderRow = {
  id: "30000000-0000-4000-8000-000000000001",
  orderNo: "SG-2026-ABCDEF",
  status: "scheduled",
  isTest: false,
  quantity: 20,
  confirmedAt: "2026-09-18T09:00:00.000Z",
  withdrawalDeadline: "2026-09-17T21:00:00.000Z",
  capacityHeld: true,
};

/** Yalnız parti izni (+ orders.read): alıcı, tutar ve sertifika adı yok. */
export const BATCH_DETAIL_OPERATIONS: BatchDetailDto = {
  batch: summary,
  land: { id: SITE_A, name: "Antalya Proje Uygulama Sahası", capacity: { total: 50000, filled: 1000, reserved: 500 } },
  orders: [baseRow, { ...baseRow, id: "30000000-0000-4000-8000-000000000002", orderNo: "SG-2026-BCDEFG" }],
  candidates: [{ ...baseRow, id: "30000000-0000-4000-8000-000000000003", orderNo: "SG-2026-CDEFGH", status: "confirmed" }],
  candidatesTruncated: false,
  groups: ["order"],
  mfaRequiredGroups: [],
  mfa: { enforced: true, satisfied: false, enrolled: true },
};

/** Sahip, oturum yeniden doğrulanmamış: alıcı ve tutar açık, sertifika adı MFA bekliyor. */
export const BATCH_DETAIL_OWNER_MFA: BatchDetailDto = {
  ...BATCH_DETAIL_OPERATIONS,
  batch: { ...summary, capabilities: { plan: true, assign: true, release: true, publish: true } },
  orders: BATCH_DETAIL_OPERATIONS.orders.map((o) => ({
    ...o, buyer: { firstName: "Deneme", lastName: "Kişi" }, finance: { totalKurus: 20000, paidAt: "2026-09-03T09:00:00.000Z" },
  })),
  candidates: [],
  groups: ["order", "contact", "finance"],
  mfaRequiredGroups: ["certificate"],
};

export const BATCH_ERRORS: Record<string, ApiErrorBody> = {
  assignMissing: { code: "forbidden", message: "Bu değişiklik için yetkiniz yok.", details: { reason: "missing_permission", permissions: ["batches.assign"] } },
  releaseMfa: {
    code: "mfa_required", message: "Bu değişiklik iki aşamalı doğrulama ister.",
    details: { permissions: ["batches.release"], enrolled: true, reason: "stale", freshnessMinutes: 15 },
  },
  publishMissing: { code: "forbidden", message: "Bu değişiklik için yetkiniz yok.", details: { reason: "missing_permission", permissions: ["monitoring.publish"] } },
  orderOutOfScope: { code: "forbidden", message: "Siparişlerden biri atama yetkinizin saha kapsamı dışında.", details: { reason: "out_of_scope", permissions: ["batches.assign"] } },
  orderNotInBatch: { code: "mismatch", message: "Sipariş bu partide değil.", details: { reason: "order_not_in_batch" } },
  orderNotFound: { code: "not_found", message: "Sipariş bulunamadı.", details: { missing: 1 } },
  mismatch: { code: "mismatch", message: "Sipariş bu partinin sahasına ya da sezonuna ait değil.", details: { detail: "SG-2026-ABCDEF" } },
  invalidState: { code: "invalid_state", message: "Parti ya da sipariş bu işlem için uygun durumda değil.", details: { detail: "partide sipariş var" } },
  scopeUnsupported: { code: "scope_unsupported", message: "Parti yetkiniz yalnız kişiye atanmış işleri kapsıyor; partiler için atama modeli yok.", details: { permission: "batches.read", permissions: ["batches.read"] } },
  notFound: { code: "not_found", message: "Parti bulunamadı." },
  unavailable: { code: "unavailable", message: "Veri alınamadı. Lütfen yeniden deneyin." },
};
