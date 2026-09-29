/**
 * Tipli örnek yanıtlar — sipariş yönetimi arayüzü gerçek veri, e-posta ya da yetki olmadan çalışsın diye.
 * Sözleşme: web-brifler/27 §6. Kişisel veri yoktur; e-postalar `example.invalid` alanındadır.
 */
import type { ApiErrorBody } from "@/lib/api/envelope";
import type { OrderDetailDto, OrderListDto, OrderListItem } from "../admin-dto";
import { ORDER_STATUSES, type OrderStatus } from "../types";

const SITE_MAIN = "20000000-0000-0000-0000-000000000001";
const SITE_A = "20000000-0000-0000-0000-0000000000aa";
const ORDER_ID = "30000000-0000-0000-0000-000000000001";
const zeroCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;

const baseItem: OrderListItem = {
  id: ORDER_ID,
  orderNo: "SG-2026-AAAAAB",
  status: "paid",
  isTest: false,
  locale: "tr",
  createdAt: "2026-09-28T09:00:00.000Z",
  paidAt: "2026-09-28T09:05:00.000Z",
  quantity: 20,
  site: { id: SITE_MAIN, name: "Ana Saha" },
  seasonLabel: "2026-2027",
  batchId: null,
  buyer: { type: "individual", firstName: "Deneme", lastName: "Alıcı", companyTitle: null },
  certificateName: "Deneme Alıcı",
  withdrawalDeadline: "2026-10-12T20:59:59.000Z",
  performanceDeadline: "2027-03-31T20:59:59.000Z",
};

/** Yalnız `orders.read` (ör. operasyon): iletişim ve tutar alanı yok, yalnız kapasite uyarısı. */
export const ORDER_LIST_BASIC: OrderListDto = {
  items: [baseItem],
  total: 1,
  page: 1,
  pageSize: 25,
  counts: { ...zeroCounts, paid: 1 },
  alerts: { capacity: 0 },
  groups: ["order"],
  scope: { kind: "all" },
  search: { contactFields: false },
};

/** Finans şablonu: iletişim ve finans alanları, bütün uyarılar. */
export const ORDER_LIST_FINANCE: OrderListDto = {
  ...ORDER_LIST_BASIC,
  items: [{ ...baseItem, contact: { email: "alici@example.invalid" }, finance: { totalKurus: 20000, paymentProvider: "iyzico" } }],
  alerts: { capacity: 0, refundPending: 1, duplicate: 0, invoicePending: 1 },
  groups: ["order", "contact", "finance"],
  search: { contactFields: true },
};

/** Saha kapsamlı okuyucu: kapsam listede açıkça döner; sayaç ve uyarılar yalnız bu sahada. */
export const ORDER_LIST_SITE_SCOPED: OrderListDto = {
  ...ORDER_LIST_BASIC,
  items: [{ ...baseItem, site: { id: SITE_A, name: "Antalya Sahası" } }],
  scope: { kind: "sites", siteIds: [SITE_A] },
};

const baseDetail: OrderDetailDto = {
  groups: ["order"],
  mfaRequiredGroups: [],
  mfa: null,
  capabilities: {
    note: true, cancel: false, refund: false, refundDuplicate: false,
    invoiceQueue: false, invoiceIssue: false, reserveCapacity: false, documents: false,
  },
  order: {
    id: ORDER_ID,
    orderNo: "SG-2026-AAAAAB",
    status: "paid",
    isTest: false,
    locale: "tr",
    site: { id: SITE_MAIN, name: "Ana Saha", snapshot: { name: "Ana Saha", province: "Ankara", district: "Kahramankazan" } },
    seasonLabel: "2026-2027",
    quantity: 20,
    batch: null,
    buyer: { type: "individual", firstName: "Deneme", lastName: "Alıcı", companyTitle: null },
    certificateName: "Deneme Alıcı",
    dates: {
      createdAt: "2026-09-28T09:00:00.000Z", updatedAt: "2026-09-28T09:05:00.000Z", paidAt: "2026-09-28T09:05:00.000Z",
      paymentExpiresAt: null, withdrawalDeadline: "2026-10-12T20:59:59.000Z", performanceDeadline: "2027-03-31T20:59:59.000Z",
      confirmedAt: null, scheduledAt: null, releasedAt: null, completedAt: null, withdrawalRequestedAt: null,
      cancelledAt: null, refundedAt: null, certificateIssuedAt: null, certificateCancelledAt: null,
    },
    withdrawalChannel: null,
    cancelReason: null,
    adminNote: null,
    capacity: { held: true },
  },
  events: [
    { id: 1, type: "order_created", at: "2026-09-28T09:00:00.000Z", actor: { kind: "customer" }, data: { quantity: 20, season: "2026-2027", isTest: false } },
    { id: 2, type: "payment_succeeded", at: "2026-09-28T09:05:00.000Z", actor: { kind: "system" }, data: {} },
  ],
};

/** Yalnız `orders.read` + `orders.note` (operasyon şablonu). */
export const ORDER_DETAIL_BASIC: OrderDetailDto = baseDetail;

/** Finans şablonu: iletişim, vergi, finans, fatura ve hukuki kayıt; özel sertifika yok. */
export const ORDER_DETAIL_FINANCE: OrderDetailDto = {
  ...baseDetail,
  groups: ["order", "contact", "tax", "finance", "invoices", "legal"],
  capabilities: { ...baseDetail.capabilities, note: false, refund: true, refundDuplicate: true, invoiceQueue: true, invoiceIssue: true, documents: true },
  contact: {
    email: "alici@example.invalid", phone: "5550000000", marketingConsent: false,
    invoiceAddress: { province: "06", district: "Kahramankazan", line: "Deneme sk. 1", postalCode: "06980" },
    authorizedPerson: null, kep: null,
  },
  tax: { invoiceType: "individual", tckn: null, taxId: null, taxOffice: null, mersis: null, eInvoiceUser: null, poNumber: null },
  finance: {
    unitPriceKurus: 1000, totalKurus: 20000, vatRate: 20,
    payment: { provider: "iyzico", paymentId: "PAY-EXAMPLE", startedAt: "2026-09-28T09:01:00.000Z", expiresAt: null },
    refunds: [], duplicates: [],
  },
  invoices: [{ id: "50000000-0000-4000-8000-000000000001", kind: "sale", provider: "manual", status: "pending", invoiceNo: null, ettn: null, issuedAt: null, sentAt: null, error: null, createdAt: "2026-09-28T09:05:00.000Z" }],
  legal: {
    documentsVersion: "2026-09.5", sourcePath: "/tr/sahalar/ana-saha",
    documents: [{ kind: "contract", title: "Mesafeli Hizmet Sözleşmesi", sha256: "b".repeat(64), templateVersion: "2026-09.5", createdAt: "2026-09-28T09:00:00.000Z" }],
    consents: { contract: { granted: true, at: "2026-09-28T09:00:00.000Z", version: "2026-09.5", revokedAt: null, subjectName: null } },
  },
  events: [
    baseDetail.events[0],
    { id: 2, type: "payment_succeeded", at: "2026-09-28T09:05:00.000Z", actor: { kind: "system" }, data: { provider: "iyzico", paymentId: "PAY-EXAMPLE", paidKurus: 20000 } },
  ],
};

/** Sahip: bütün gruplar ve özel sertifika kodu. */
export const ORDER_DETAIL_OWNER: OrderDetailDto = {
  ...ORDER_DETAIL_FINANCE,
  groups: [...ORDER_DETAIL_FINANCE.groups, "certificate"],
  capabilities: { note: true, cancel: true, refund: true, refundDuplicate: true, invoiceQueue: true, invoiceIssue: true, reserveCapacity: true, documents: true },
  certificate: { code: "SG-ABCD-2345" },
};

/**
 * Sahip, MFA zorlaması açık ve oturum tazelenmemiş (aal1 ya da 15 dakikadan eski aal2): vergi, hukuki kayıt ve
 * özel sertifika sorgulanmadı ve dönmedi; özet ve MFA gerektirmeyen gruplar kullanılabilir. Arayüz "yeniden
 * doğrulayın" gösterir, doğrulamadan sonra ayrıntıyı yeniden OKUR (eylem tekrarı yok).
 */
export const ORDER_DETAIL_MFA_REQUIRED: OrderDetailDto = {
  ...baseDetail,
  groups: ["order", "contact", "finance", "invoices"],
  mfaRequiredGroups: ["tax", "legal", "certificate"],
  mfa: { enrolled: true, reason: "stale", freshnessMinutes: 15 },
  capabilities: ORDER_DETAIL_OWNER.capabilities,
  contact: ORDER_DETAIL_FINANCE.contact,
  finance: ORDER_DETAIL_FINANCE.finance,
  invoices: ORDER_DETAIL_FINANCE.invoices,
  events: ORDER_DETAIL_FINANCE.events,
};

/** Eylem başarısı: `data` doğrudan yeni durum. */
export const ORDER_ACTION_OK = { ok: true as const, data: { status: "cancelled_by_seller" as OrderStatus } };

/** Örnek hata gövdeleri (27 §5). */
export const ORDER_ERRORS: Record<string, ApiErrorBody> = {
  forbidden: { code: "forbidden", message: "Bu işlem için yetkiniz yok." },
  flagForbidden: { code: "forbidden", message: "Bu süzgeç için yetkiniz yok.", details: { flag: "refund_pending" } },
  scopeUnsupported: { code: "scope_unsupported", message: "Bu ekran sınırlı kapsamı (saha/atanmış iş) henüz uygulamıyor; yetkiniz bütün kayıtları kapsamıyor.", details: { permission: "orders.cancel", scopes: [{ kind: "sites", siteIds: [SITE_A] }] } },
  mfaRequired: { code: "mfa_required", message: "Bu işlem iki aşamalı doğrulama ister.", details: { enrolled: true, reason: "stale", freshnessMinutes: 15 } },
  legacyRefundRole: { code: "forbidden", message: "İade bu yoldan yalnız finans ya da sistem sahibi rolüyle yapılabilir.", details: { reason: "legacy_role" } },
  invalidState: { code: "invalid_state", message: "Sipariş bu işlem için uygun durumda değil." },
  notFound: { code: "not_found", message: "Sipariş bulunamadı." },
  unavailable: { code: "unavailable", message: "Veri alınamadı. Lütfen yeniden deneyin." },
};
