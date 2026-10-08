/**
 * Sipariş yönetimi erişim kuralları — YALNIZ SUNUCU. Sözleşme: web-brifler/27.
 *
 * Eylem → izin eşlemesi, okuma kapsamı, alan grupları ve yetenekler tek yerde tanımlıdır; route'lar
 * rol listesi yazmaz. Kapsam kuralı: yalnız aynı iznin açık `all` kaydı kapsamı kaldırır; farklı
 * izinlerin kapsamları birbirine kopyalanmaz; `assigned` (veri modeli yok) hiçbir kayda erişim vermez.
 */
import { accessibleScope, hasFullScope, type EffectiveAccess, type Permission } from "@/lib/admin/permissions";

export const ORDER_ACTIONS = [
  "note", "cancel_by_seller", "refund", "refund_duplicate", "invoice_now", "invoice_issued", "reserve_capacity",
] as const;
export type OrderAction = (typeof ORDER_ACTIONS)[number];

/** 27 §2. MFA, izin sözlüğündeki hassas izin kümesinden gelir (lib/admin/permission-keys.ts). */
export const ACTION_PERMISSION: Record<OrderAction, Permission> = {
  note: "orders.note",
  cancel_by_seller: "orders.cancel",
  refund: "refunds.execute",
  refund_duplicate: "refunds.execute",
  invoice_now: "invoices.manage",
  invoice_issued: "invoices.manage",
  reserve_capacity: "sites.capacity.manage",
};

/** SQL 019 iade talebi aktif eski SUPER_ADMIN/FINANCE rolünü ister; eski yol da aynısını arar (27 §7). */
export const LEGACY_REFUND_ROLES: readonly string[] = ["SUPER_ADMIN", "FINANCE"];
export const isRefundAction = (action: OrderAction) => action === "refund" || action === "refund_duplicate";

/** Saklı belgeler iletişim ve vergi bilgisini maskesiz taşır; üç izin birlikte aranır (27 §3). */
export const DOCUMENT_PERMISSIONS: readonly Permission[] = ["orders.documents.read", "customers.contact.read", "customers.tax.read"];

export const ORDER_GROUPS = ["order", "contact", "tax", "finance", "invoices", "legal", "certificate"] as const;
export type OrderGroup = (typeof ORDER_GROUPS)[number];
export type SensitiveGroup = Exclude<OrderGroup, "order">;

export const GROUP_PERMISSION: Record<SensitiveGroup, Permission> = {
  contact: "customers.contact.read",
  tax: "customers.tax.read",
  finance: "finance.read",
  invoices: "invoices.read",
  legal: "orders.documents.read",
  certificate: "certificates.read_private",
};

export type ReadScope = { kind: "all" } | { kind: "sites"; siteIds: string[] };

const unique = (ids: string[]) => [...new Set(ids)].sort();

function scopeOf(access: EffectiveAccess, permission: Permission): ReadScope | null {
  const s = accessibleScope(access, permission);
  if (s.all) return { kind: "all" };
  const siteIds = unique(s.siteIds);
  return siteIds.length ? { kind: "sites", siteIds } : null;
}

function intersect(a: ReadScope, b: ReadScope): ReadScope | null {
  if (a.kind === "all") return b;
  if (b.kind === "all") return a;
  const siteIds = a.siteIds.filter((id) => b.siteIds.includes(id));
  return siteIds.length ? { kind: "sites", siteIds } : null;
}

/**
 * Sipariş okuma kapsamı. `null`: izin var ama yalnız `assigned` (desteklenmiyor → scope_unsupported).
 * `sites` + `assigned` birleşiminde `assigned` yok sayılır, `all`a yükseltilmez.
 */
export const orderReadScope = (access: EffectiveAccess): ReadScope | null => scopeOf(access, "orders.read");

/** Grubun görünür olduğu kayıt kümesi: okuma kapsamı ∩ grup izninin kapsamı. `null`: hiçbir kayıtta yok. */
export function groupScope(access: EffectiveAccess, group: SensitiveGroup, read: ReadScope): ReadScope | null {
  const own = scopeOf(access, GROUP_PERMISSION[group]);
  return own ? intersect(read, own) : null;
}

export const scopeCovers = (scope: ReadScope | null, landId: string | null): boolean =>
  !!scope && (scope.kind === "all" || (landId !== null && scope.siteIds.includes(landId)));

/** Grup kapsamı okuma kapsamının tamamını kapsıyor mu? (iletişim alanıyla arama için, 27 §4.3) */
export function groupCoversRead(group: ReadScope | null, read: ReadScope): boolean {
  if (!group) return false;
  if (group.kind === "all") return true;
  return read.kind === "sites" && read.siteIds.every((id) => group.siteIds.includes(id));
}

export interface OrderCapabilities {
  note: boolean;
  cancel: boolean;
  refund: boolean;
  refundDuplicate: boolean;
  invoiceQueue: boolean;
  invoiceIssue: boolean;
  reserveCapacity: boolean;
  documents: boolean;
}

/** Eylem düğmeleri için; yalnız tam kapsam. MFA gerekebilir, sunucu eylem anında `mfa_required` döner. */
export function orderCapabilities(access: EffectiveAccess, legacyRole: string): OrderCapabilities {
  const full = (p: Permission) => hasFullScope(access, p);
  const refund = full("refunds.execute") && LEGACY_REFUND_ROLES.includes(legacyRole);
  return {
    note: full("orders.note"),
    cancel: full("orders.cancel"),
    refund,
    refundDuplicate: refund,
    invoiceQueue: full("invoices.manage"),
    invoiceIssue: full("invoices.manage"),
    reserveCapacity: full("sites.capacity.manage"),
    documents: DOCUMENT_PERMISSIONS.every(full),
  };
}

/* ── Hassas okuma grupları için yeniden doğrulama (27 §4.5) ───────────────── */

export const SENSITIVE_GROUPS: readonly SensitiveGroup[] = Object.keys(GROUP_PERMISSION) as SensitiveGroup[];

export interface ReadMfa {
  /** Zorlama açık ve oturum yeterince taze değilse bu gruplar sorgulanmaz ve dönmez. */
  blocked: ReadonlySet<SensitiveGroup>;
  enrolled: boolean;
  reason: "enrollment" | "challenge" | "stale" | null;
}

/**
 * Mevcut MFA kuralı aynen: grup izni hassas izin setindeyse (vergi, hukuki kayıt, özel sertifika) ve
 * zorlama açıkken oturum yeniden doğrulanmamışsa grup kapalıdır. `satisfied` = lib/admin/permissions
 * mfaSatisfied; kural burada kopyalanmaz. Zorlama kapalıyken davranış değişmez (hiçbir grup kapanmaz).
 */
export function readMfaState(
  enforced: boolean,
  assurance: { aal: string | null; enrolled: boolean },
  satisfied: (permission: Permission) => boolean
): ReadMfa {
  const blocked = new Set(enforced ? SENSITIVE_GROUPS.filter((g) => !satisfied(GROUP_PERMISSION[g])) : []);
  return {
    blocked,
    enrolled: assurance.enrolled,
    reason: blocked.size === 0 ? null : !assurance.enrolled ? "enrollment" : assurance.aal !== "aal2" ? "challenge" : "stale",
  };
}
