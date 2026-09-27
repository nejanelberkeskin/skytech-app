/**
 * Yetki değişikliği önizlemesi — SAF hesap (yazma yok). Sözleşme: web-brifler/19 §6.
 * Veritabanı tarafı `admin_preview_assignment` hiçbir satır yazmaz; burada iki durum karşılaştırılır.
 */
import { toEffectiveAccess, type GrantedPermission, type Permission, type Scope } from "./permission-keys";

export type PreviewChange =
  | { kind: "assign"; roleKey: string; scope: Scope; endsAt?: string | null }
  | { kind: "update"; assignmentId: string; scope: Scope; endsAt?: string | null }
  | { kind: "revoke"; assignmentId: string };

export interface AccessPreview {
  change: PreviewChange;
  current: { permissions: GrantedPermission[]; legacyRole: string };
  next: { permissions: GrantedPermission[]; legacyRole: string };
  /** Kişinin kazanacağı izinler (kapsamlarıyla). */
  added: GrantedPermission[];
  /** Tamamen kaybedeceği izinler. */
  removed: Permission[];
  /** İzin kalıyor ama kapsamı değişiyor. */
  scopeChanges: { key: Permission; from: Scope[]; to: Scope[] }[];
  legacyRoleChange: { from: string; to: string } | null;
  /**
   * Kaydetme denenirse dönecek engel; null ise kaydedilebilir. `details` kaydetme hatasının
   * `details` alanıyla aynıdır (ör. `invalid_scope` → `{ missingSiteIds }`, 21 §3.5).
   */
  blocked: { code: string; message: string; details?: Record<string, unknown> } | null;
}

const BLOCK_MESSAGES: Record<string, string> = {
  forbidden: "Bu işlem için yetkiniz yok.",
  self_assignment: "Kendi yetkinizi değiştiremezsiniz; başka bir yetkili yapmalı.",
  escalation_blocked: "Kendinizde olmayan bir yetkiyi, daha geniş bir kapsamı ya da kendi sürenizden uzun erişimi veremezsiniz.",
  invalid_scope: "Kapsam geçersiz.",
  last_active_owner: "Sistemde en az bir aktif ve süresiz sahip kalmalı. Önce yeni sahibi atayın.",
};

const sameScopes = (a: Scope[], b: Scope[]) => JSON.stringify(a) === JSON.stringify(b);

export function buildAccessPreview(change: PreviewChange, raw: unknown): AccessPreview {
  const data = (raw ?? {}) as { current?: unknown; next?: unknown; blocked?: { code?: unknown; details?: unknown } | null };
  const current = toEffectiveAccess({ permissions: (data.current as { permissions?: unknown })?.permissions ?? [] });
  const next = toEffectiveAccess({ permissions: (data.next as { permissions?: unknown })?.permissions ?? [] });
  const currentByKey = new Map(current.permissions.map((p) => [p.key, p.scopes]));
  const nextByKey = new Map(next.permissions.map((p) => [p.key, p.scopes]));

  const added = next.permissions.filter((p) => !currentByKey.has(p.key));
  const removed = current.permissions.filter((p) => !nextByKey.has(p.key)).map((p) => p.key);
  const scopeChanges = next.permissions
    .filter((p) => currentByKey.has(p.key) && !sameScopes(currentByKey.get(p.key) as Scope[], p.scopes))
    .map((p) => ({ key: p.key, from: currentByKey.get(p.key) as Scope[], to: p.scopes }));

  const currentLegacy = String((data.current as { legacyRole?: unknown })?.legacyRole ?? "NONE");
  const nextLegacy = String((data.next as { legacyRole?: unknown })?.legacyRole ?? "NONE");
  const code = typeof data.blocked?.code === "string" ? data.blocked.code : null;
  const details = data.blocked?.details && typeof data.blocked.details === "object" ? (data.blocked.details as Record<string, unknown>) : null;
  const message = code === "invalid_scope" && details?.missingSiteIds
    ? "Kapsam geçersiz: seçilen sahalardan bazıları bulunamadı."
    : code ? BLOCK_MESSAGES[code] ?? "Bu değişiklik kaydedilemez." : "";

  return {
    change,
    current: { permissions: current.permissions, legacyRole: currentLegacy },
    next: { permissions: next.permissions, legacyRole: nextLegacy },
    added,
    removed,
    scopeChanges,
    legacyRoleChange: currentLegacy === nextLegacy ? null : { from: currentLegacy, to: nextLegacy },
    blocked: code ? { code, message, ...(details ? { details } : {}) } : null,
  };
}
