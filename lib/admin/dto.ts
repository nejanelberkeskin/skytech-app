/**
 * Arayüzün kullandığı tek tip yüzeyi (web-brifler/19). UI bu dosyadan içe aktarır; sunucu iç tipleri
 * değişse de buradaki adlar sözleşmeyle birlikte değişir.
 */
export type { Permission, Scope, GrantedPermission, EffectiveAccess } from "./permission-keys";
export { PERMISSIONS, MFA_PERMISSIONS, MFA_FRESHNESS_MINUTES } from "./permission-keys";
export type { StaffView, StaffAssignmentView, InvitationView } from "./staff";
export type { AccessPreview, PreviewChange } from "./preview";
/** Özel roller ve saha seçenekleri (web-brifler/21 §2). */
export type { RoleDetailView as RoleDetailDto, RoleUsage, RoleImpactPreview, SiteOptionView as SiteOptionDto } from "./roles";
export type { Cursor } from "./pagination";

import type { Scope } from "./permission-keys";

/** GET /api/admin/me */
export interface AdminMeDto {
  admin: { id: string; userId: string; fullName: string; email: string; isActive: boolean; legacyRole: string };
  roles: { key: string; label: string; scope: Scope; assignmentId: string; version: string | null; endsAt: string | null }[];
  permissions: { key: string; scopes: Scope[] }[];
  limits: { refundKurus: number | null; enforced: false };
  mfa: {
    enrolled: boolean;
    assuranceLevel: "aal1" | "aal2";
    verifiedAt: string | null;
    enforced: boolean;
    freshnessMinutes: number;
    requiredFor: string[];
  };
  checkedAt: string;
}

/** GET /api/admin/roles */
export interface RoleDto {
  key: string;
  label: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

/** GET /api/admin/audit */
export interface AuditEntryDto {
  id: string;
  at: string;
  actor: { id: string; label: string };
  action: string;
  entity: string;
  entityId: string | null;
  details: unknown;
  ip: string | null;
}

/** Sayfalı liste yanıtlarının ortak biçimi. */
export interface PageDto<T> {
  items: T[];
  nextCursor: string | null;
}
