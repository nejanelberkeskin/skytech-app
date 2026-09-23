/**
 * İzin sözlüğü — sözleşme web-brifler/19 §3. Adlar brif 12 §6'dan gelir.
 * Kaynak doğruluğu: rol şablonları SQL'de (021), anahtar listesi burada; test ikisini karşılaştırır.
 */
export const PERMISSIONS = [
  "orders.read", "orders.note", "orders.assign", "orders.cancel", "orders.documents.read", "orders.export",
  "customers.contact.read", "customers.tax.read", "customers.export",
  "refunds.request", "refunds.approve", "refunds.execute", "invoices.read", "invoices.manage", "finance.read",
  "sites.read", "sites.edit", "sites.publish", "sites.capacity.manage",
  "batches.read", "batches.plan", "batches.assign", "batches.release",
  "monitoring.edit", "monitoring.review", "monitoring.publish", "certificates.read_private", "certificates.resend",
  "requests.read", "requests.assign", "requests.update", "messages.send",
  "content.edit", "content.publish", "media.upload", "legal.edit", "legal.publish",
  "staff.invite", "staff.manage", "roles.manage", "audit.read",
  "sales.pause", "sales.resume", "sales.pricing.manage", "system.readiness.read", "system.jobs.run",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Yeniden doğrulanmış oturum (aal2) isteyen izinler. `sales.pause` bilerek dışarıdadır:
 * acil durdurma hiçbir koşulda gecikmemeli. Açma (`sales.resume`) doğrulama ister.
 */
export const MFA_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "orders.cancel", "orders.documents.read", "orders.export", "customers.tax.read", "customers.export",
  "refunds.approve", "refunds.execute",
  "sites.publish", "sites.capacity.manage", "batches.release", "monitoring.publish", "certificates.read_private",
  "messages.send", "content.publish", "legal.edit", "legal.publish",
  "staff.invite", "staff.manage", "roles.manage",
  "sales.resume", "sales.pricing.manage", "system.jobs.run",
]);

/** Son doğrulamanın üzerinden bu süre geçtiyse hassas işlem yeniden doğrulama ister. */
export const MFA_FRESHNESS_MINUTES = 15;

/** Kapsam: bütün kayıtlar · belirli sahalar · kişiye atanmış işler (web-brifler/19 §2). */
export type Scope = { kind: "all" } | { kind: "sites"; siteIds: string[] } | { kind: "assigned" };

/** Aynı izin birden çok kapsamla gelebilir; birleşim KAYIPSIZDIR ve `all`a yükseltilmez (19 §2). */
export interface GrantedPermission {
  key: Permission;
  scopes: Scope[];
}

export interface EffectiveAccess {
  adminId: string | null;
  permissions: GrantedPermission[];
  roles: { key: string; label: string; scope: Scope; assignmentId: string; version: string | null; endsAt: string | null }[];
  /** `refundKurus` yalnız saklanır; `enforced` false olduğu sürece hiçbir uç uygulamaz (19 §6). */
  limits: { refundKurus: number | null; enforced: boolean };
}

export const EMPTY_ACCESS: EffectiveAccess = { adminId: null, permissions: [], roles: [], limits: { refundKurus: null, enforced: false } };

const isPermission = (value: unknown): value is Permission => (PERMISSIONS as readonly string[]).includes(String(value));

function toScope(value: unknown): Scope {
  const raw = (value ?? {}) as { kind?: unknown; siteIds?: unknown };
  if (raw.kind === "sites" && Array.isArray(raw.siteIds)) return { kind: "sites", siteIds: raw.siteIds.map(String) };
  if (raw.kind === "assigned") return { kind: "assigned" };
  return { kind: "all" };
}

/** Veritabanı yanıtını tipli erişime çevirir; tanınmayan izin adı yok sayılır (varsayılan ret). */
export function toEffectiveAccess(raw: unknown): EffectiveAccess {
  const data = (raw ?? {}) as Record<string, unknown>;
  const permissions = Array.isArray(data.permissions) ? data.permissions : [];
  const roles = Array.isArray(data.roles) ? data.roles : [];
  const limits = (data.limits ?? {}) as { refundKurus?: unknown; enforced?: unknown };
  return {
    adminId: typeof data.adminId === "string" ? data.adminId : null,
    permissions: permissions
      .map((p) => p as { key?: unknown; scopes?: unknown })
      .filter((p) => isPermission(p.key))
      .map((p) => ({
        key: p.key as Permission,
        scopes: (Array.isArray(p.scopes) ? p.scopes : []).map(toScope),
      }))
      .filter((p) => p.scopes.length > 0),
    roles: roles.map((r) => {
      const role = r as Record<string, unknown>;
      return {
        key: String(role.key ?? ""),
        label: String(role.label ?? ""),
        scope: toScope(role.scope),
        assignmentId: String(role.assignmentId ?? ""),
        version: typeof role.version === "string" ? role.version : null,
        endsAt: typeof role.endsAt === "string" ? role.endsAt : null,
      };
    }),
    limits: { refundKurus: typeof limits.refundKurus === "number" ? limits.refundKurus : null, enforced: limits.enforced === true },
  };
}

export function scopesOf(access: EffectiveAccess, permission: Permission): Scope[] {
  return access.permissions.find((p) => p.key === permission)?.scopes ?? [];
}

export const hasPermission = (access: EffectiveAccess, permission: Permission): boolean => scopesOf(access, permission).length > 0;

/** İzin bütün kayıtlarda mı geçerli? Kapsamı uygulamayan uçlar yalnız bunu kabul eder (19 §1). */
export const hasFullScope = (access: EffectiveAccess, permission: Permission): boolean =>
  scopesOf(access, permission).some((s) => s.kind === "all");

/** Kapsamı uygulayan uçlar için erişilebilir kümeler; `all` sınırsızdır. */
export function accessibleScope(access: EffectiveAccess, permission: Permission): { all: boolean; siteIds: string[]; assigned: boolean } {
  const scopes = scopesOf(access, permission);
  return {
    all: scopes.some((s) => s.kind === "all"),
    siteIds: scopes.flatMap((s) => (s.kind === "sites" ? s.siteIds : [])),
    assigned: scopes.some((s) => s.kind === "assigned"),
  };
}
