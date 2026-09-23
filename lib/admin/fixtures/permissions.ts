/**
 * Tipli örnek yanıtlar — arayüz gerçek veritabanı, e-posta ya da canlı yetki olmadan çalışsın diye.
 * Sözleşme: web-brifler/19. Kişisel veri yoktur; e-postalar `example.invalid` alanındadır.
 */
import type { AdminMeDto, AuditEntryDto, PageDto, RoleDetailDto, RoleDto, RoleImpactPreview, SiteOptionDto } from "../dto";
import type { AccessPreview } from "../preview";
import type { InvitationView, StaffView } from "../staff";

const NOW = "2026-09-23T12:00:00.000Z";
const SITE_A = "20000000-0000-0000-0000-0000000000aa";

export const ME_OWNER: AdminMeDto = {
  admin: { id: "a0000000-0000-0000-0000-000000000001", userId: "10000000-0000-0000-0000-000000000001", fullName: "Sistem Sahibi", email: "sahip@example.invalid", isActive: true, legacyRole: "SUPER_ADMIN" },
  roles: [{ key: "owner", label: "Sistem sahibi", scope: { kind: "all" }, assignmentId: "b0000000-0000-0000-0000-000000000001", version: NOW, endsAt: null }],
  permissions: [
    { key: "orders.read", scopes: [{ kind: "all" }] },
    { key: "refunds.execute", scopes: [{ kind: "all" }] },
    { key: "staff.manage", scopes: [{ kind: "all" }] },
    { key: "roles.manage", scopes: [{ kind: "all" }] },
    { key: "audit.read", scopes: [{ kind: "all" }] },
  ],
  limits: { refundKurus: null, enforced: false },
  mfa: { enrolled: false, assuranceLevel: "aal1", verifiedAt: null, enforced: false, freshnessMinutes: 15, requiredFor: ["refunds.execute", "staff.manage", "roles.manage"] },
  checkedAt: NOW,
};

/** Saha kapsamlı kişi: kapsamı uygulamayan ekranlar ona `scope_unsupported` döner. */
export const ME_SCOPED: AdminMeDto = {
  admin: { id: "a0000000-0000-0000-0000-000000000002", userId: "10000000-0000-0000-0000-000000000002", fullName: "Saha Sorumlusu", email: "saha@example.invalid", isActive: true, legacyRole: "NONE" },
  roles: [{ key: "engineer", label: "Orman mühendisi", scope: { kind: "sites", siteIds: [SITE_A] }, assignmentId: "b0000000-0000-0000-0000-000000000002", version: NOW, endsAt: "2026-12-31T20:59:59.000Z" }],
  permissions: [
    { key: "sites.read", scopes: [{ kind: "sites", siteIds: [SITE_A] }] },
    { key: "sites.edit", scopes: [{ kind: "sites", siteIds: [SITE_A] }, { kind: "assigned" }] },
    { key: "monitoring.edit", scopes: [{ kind: "assigned" }] },
  ],
  limits: { refundKurus: null, enforced: false },
  mfa: { enrolled: true, assuranceLevel: "aal2", verifiedAt: "2026-09-23T11:55:00.000Z", enforced: false, freshnessMinutes: 15, requiredFor: ["sites.capacity.manage"] },
  checkedAt: NOW,
};

export const ROLES: RoleDto[] = [
  { key: "owner", label: "Sistem sahibi", description: "Tüm modüller, personel ve politika yönetimi.", permissions: ["orders.read", "refunds.execute", "staff.manage", "roles.manage", "audit.read"], isSystem: true },
  { key: "finance", label: "Finans ve muhasebe", description: "Tahsilat, fatura, iade ve finans raporları.", permissions: ["orders.read", "finance.read", "refunds.execute", "invoices.manage", "audit.read"], isSystem: true },
  { key: "engineer", label: "Orman mühendisi", description: "Sahalar, kapasite, tür bilgisi ve izleme.", permissions: ["sites.read", "sites.edit", "sites.capacity.manage", "batches.read", "monitoring.edit"], isSystem: true },
];

export const STAFF_PAGE: PageDto<StaffView> = {
  items: [
    {
      id: "a0000000-0000-0000-0000-000000000001", userId: "10000000-0000-0000-0000-000000000001",
      fullName: "Sistem Sahibi", email: "sahip@example.invalid", isActive: true, legacyRole: "SUPER_ADMIN",
      createdAt: "2026-01-04T08:00:00.000Z", mfa: { enrolled: false },
      assignments: [{ id: "b0000000-0000-0000-0000-000000000001", roleKey: "owner", roleLabel: "Sistem sahibi", scope: { kind: "all" }, startsAt: "2026-01-04T08:00:00.000Z", endsAt: null, revokedAt: null, reason: "migration:021", updatedAt: NOW }],
    },
    {
      id: "a0000000-0000-0000-0000-000000000002", userId: "10000000-0000-0000-0000-000000000002",
      fullName: "Saha Sorumlusu", email: "saha@example.invalid", isActive: true, legacyRole: "NONE",
      createdAt: "2026-09-20T09:30:00.000Z", mfa: { enrolled: true },
      assignments: [{ id: "b0000000-0000-0000-0000-000000000002", roleKey: "engineer", roleLabel: "Orman mühendisi", scope: { kind: "sites", siteIds: [SITE_A] }, startsAt: "2026-09-20T09:30:00.000Z", endsAt: "2026-12-31T20:59:59.000Z", revokedAt: null, reason: "Çanakkale sahası", updatedAt: NOW }],
    },
  ],
  nextCursor: null,
};

export const INVITATIONS_PAGE: PageDto<InvitationView> = {
  items: [
    { id: "c0000000-0000-0000-0000-000000000001", email: "yeni@example.invalid", roleKey: "finance", roleLabel: "Finans ve muhasebe", scope: { kind: "all" }, status: "pending", createdAt: "2026-09-23T09:00:00.000Z", expiresAt: "2026-09-30T09:00:00.000Z", lastSentAt: "2026-09-23T09:00:00.000Z", sentCount: 1, acceptedAt: null, revokedAt: null, accessEndsAt: null },
    { id: "c0000000-0000-0000-0000-000000000002", email: "eski@example.invalid", roleKey: "read_only", roleLabel: "İnceleyici (salt okuma)", scope: { kind: "all" }, status: "revoked", createdAt: "2026-09-18T09:00:00.000Z", expiresAt: "2026-09-25T09:00:00.000Z", lastSentAt: "2026-09-18T09:00:00.000Z", sentCount: 2, acceptedAt: null, revokedAt: "2026-09-19T10:00:00.000Z", accessEndsAt: null },
  ],
  nextCursor: null,
};

export const AUDIT_PAGE: PageDto<AuditEntryDto> = {
  items: [
    { id: "d0000000-0000-0000-0000-000000000001", at: "2026-09-23T11:59:00.000Z", actor: { id: "10000000-0000-0000-0000-000000000001", label: "sahip@example.invalid" }, action: "UPDATE", entity: "admin_assignment", entityId: "b0000000-0000-0000-0000-000000000002", details: { adminId: "a0000000-0000-0000-0000-000000000002", before: { scope: { kind: "all" } }, after: { scope: { kind: "sites", siteIds: [SITE_A] } }, reason: "Çanakkale sahası" }, ip: "203.0.113.9" },
    { id: "d0000000-0000-0000-0000-000000000002", at: "2026-09-23T11:58:00.000Z", actor: { id: "00000000-0000-0000-0000-000000000000", label: "system/database" }, action: "CREATE", entity: "admin_invitation", entityId: "c0000000-0000-0000-0000-000000000001", details: { email: "yeni@example.invalid", role: "finance", tckn: "•••••••8901" }, ip: null },
  ],
  nextCursor: "2026-09-23T11:58:00.000Z|d0000000-0000-0000-0000-000000000002",
};

/** Kaydedilebilir önizleme: kapsam daralıyor, eski rol aynası kapanıyor. */
export const PREVIEW_NARROWING: AccessPreview = {
  change: { kind: "update", assignmentId: "b0000000-0000-0000-0000-000000000002", scope: { kind: "sites", siteIds: [SITE_A] }, endsAt: null },
  current: { permissions: [{ key: "sites.read", scopes: [{ kind: "all" }] }, { key: "sites.edit", scopes: [{ kind: "all" }] }], legacyRole: "ENGINEER" },
  next: { permissions: [{ key: "sites.read", scopes: [{ kind: "sites", siteIds: [SITE_A] }] }, { key: "sites.edit", scopes: [{ kind: "sites", siteIds: [SITE_A] }] }], legacyRole: "NONE" },
  added: [],
  removed: [],
  scopeChanges: [
    { key: "sites.read", from: [{ kind: "all" }], to: [{ kind: "sites", siteIds: [SITE_A] }] },
    { key: "sites.edit", from: [{ kind: "all" }], to: [{ kind: "sites", siteIds: [SITE_A] }] },
  ],
  legacyRoleChange: { from: "ENGINEER", to: "NONE" },
  blocked: null,
};

/** Engelli önizleme: son kalıcı sahip kaldırılamaz. */
export const PREVIEW_BLOCKED: AccessPreview = {
  change: { kind: "revoke", assignmentId: "b0000000-0000-0000-0000-000000000001" },
  current: { permissions: [{ key: "staff.manage", scopes: [{ kind: "all" }] }], legacyRole: "SUPER_ADMIN" },
  next: { permissions: [], legacyRole: "NONE" },
  added: [],
  removed: ["staff.manage"],
  scopeChanges: [],
  legacyRoleChange: { from: "SUPER_ADMIN", to: "NONE" },
  blocked: { code: "last_active_owner", message: "Sistemde en az bir aktif ve süresiz sahip kalmalı. Önce yeni sahibi atayın." },
};

/** Seçilen sahalardan biri yok: önizleme kaydetmeyle aynı engeli ve kimlikleri döner (21 §3.5). */
export const PREVIEW_MISSING_SITE: AccessPreview = {
  ...PREVIEW_NARROWING,
  change: { kind: "assign", roleKey: "engineer", scope: { kind: "sites", siteIds: [SITE_A, "20000000-0000-0000-0000-0000000000ff"] }, endsAt: null },
  blocked: {
    code: "invalid_scope",
    message: "Kapsam geçersiz: seçilen sahalardan bazıları bulunamadı.",
    details: { missingSiteIds: ["20000000-0000-0000-0000-0000000000ff"] },
  },
};

/* ── Özel roller (web-brifler/21) ─────────────────────────────────────────── */

/** Düzenlenebilir özel rol: sürüm, kullanım sayıları ve parmak izi ile. */
export const ROLE_DETAIL_CUSTOM: RoleDetailDto = {
  key: "saha_sorumlusu",
  label: "Saha sorumlusu",
  description: "Atanmış sahalarda operasyon.",
  permissions: ["sites.read", "batches.read", "monitoring.edit"],
  isSystem: false,
  version: NOW,
  createdAt: "2026-09-20T09:00:00.000Z",
  updatedBy: { adminId: "10000000-0000-0000-0000-000000000001", label: "Sistem Sahibi" },
  usage: { activeAssignments: 2, scheduledAssignments: 1, staffCount: 3, pendingInvitations: 1, fingerprint: "4f2a9c1d8b6e0a374f2a9c1d8b6e0a37" },
  sensitivePermissions: [],
  globalOnlyPermissions: [],
};

/** Sistem rolü: kopyalanabilir, düzenlenemez. */
export const ROLE_DETAIL_SYSTEM: RoleDetailDto = {
  key: "owner",
  label: "Sistem sahibi",
  description: "Bütün yetkiler.",
  permissions: ["staff.manage", "roles.manage", "audit.read"],
  isSystem: true,
  version: "2026-09-18T08:00:00.000Z",
  createdAt: "2026-09-18T08:00:00.000Z",
  updatedBy: null,
  usage: { activeAssignments: 1, scheduledAssignments: 0, staffCount: 1, pendingInvitations: 0, fingerprint: "0a1b2c3d4e5f60710a1b2c3d4e5f6071" },
  sensitivePermissions: ["staff.manage", "roles.manage"],
  globalOnlyPermissions: ["staff.manage", "roles.manage"],
};

/** Etki önizlemesi: yazma yapılmadan "kim etkilenecek" sorusunun yanıtı. */
export const ROLE_IMPACT_PREVIEW: RoleImpactPreview = {
  role: { key: "saha_sorumlusu", label: "Saha sorumlusu", isSystem: false, version: NOW },
  next: { label: "Saha sorumlusu", description: "Atanmış sahalarda operasyon.", permissions: ["sites.read", "batches.read"] },
  added: [],
  removed: ["monitoring.edit"],
  unchanged: 2,
  usage: { activeAssignments: 2, scheduledAssignments: 1, staffCount: 3, pendingInvitations: 1, fingerprint: "4f2a9c1d8b6e0a374f2a9c1d8b6e0a37" },
  affectedStaff: [
    { id: "a0000000-0000-0000-0000-000000000002", fullName: "Saha Sorumlusu", activeAssignments: 1, scheduledAssignments: 0 },
    { id: "a0000000-0000-0000-0000-000000000003", fullName: "İkinci Sorumlu", activeAssignments: 1, scheduledAssignments: 0 },
    { id: "a0000000-0000-0000-0000-000000000004", fullName: "Ekim Dönemi Sorumlusu", activeAssignments: 0, scheduledAssignments: 1 },
  ],
  /** E-posta maskelidir: rol yöneticisi davet listesini okuma yetkisi taşımayabilir. */
  affectedInvitations: [{ id: "c0000000-0000-0000-0000-000000000001", email: "y***@example.invalid", status: "pending" }],
  blocked: null,
};

/** Kaydetmede dönecek engel önizlemede de aynı kodla görünür. */
export const ROLE_IMPACT_BLOCKED: RoleImpactPreview = {
  ...ROLE_IMPACT_PREVIEW,
  role: { key: "owner", label: "Sistem sahibi", isSystem: true, version: "2026-09-18T08:00:00.000Z" },
  blocked: { code: "system_role_readonly", message: "Sistem rolleri düzenlenemez; kopyalayıp yeni rol oluşturabilirsiniz." },
};

/** Kapsamla sınırlanamayan izin eklenirken rolün dar kapsamlı ataması/daveti varsa kaydetme engellenir. */
export const ROLE_IMPACT_SCOPE_CONFLICT: RoleImpactPreview = {
  ...ROLE_IMPACT_PREVIEW,
  next: { ...ROLE_IMPACT_PREVIEW.next, permissions: ["sites.read", "batches.read", "staff.invite"] },
  added: ["staff.invite"],
  removed: [],
  blocked: {
    code: "global_scope_conflict",
    message: "Bu izinler kapsamla sınırlanamaz; rolün saha ya da atanmış işle sınırlı ataması veya daveti var. Önce onları \"tüm kayıtlar\" kapsamına alın ya da kaldırın.",
    details: { permissions: ["staff.invite"], assignments: 1, invitations: 0 },
  },
};

/** Kapsam seçicisi: yalnız kimlik, ad, slug, durum ve yayın bilgisi. */
export const SITE_OPTIONS: PageDto<SiteOptionDto> = {
  items: [
    { id: SITE_A, name: "Antalya Sahası", slug: "antalya-sahasi", status: "open", isPublic: true },
    { id: "20000000-0000-0000-0000-0000000000bb", name: "Muğla Sahası", slug: "mugla-sahasi", status: "preparing", isPublic: false },
  ],
  nextCursor: null,
};
