/**
 * İzin çözümleme ve kapı — YALNIZ SUNUCU. Sözleşme: web-brifler/19.
 *
 * Etkili yetki veritabanından gelir (021 `admin_effective_permissions`): rol + kapsam + süre.
 * Verilmeyen izin kapalıdır. Uçlar rol listesi yazmaz, izin adı ister.
 *
 * Hassas izinler yeniden doğrulanmış oturum (aal2, en çok 15 dk) ister. Zorlama `ADMIN_MFA_ENFORCED=1`
 * ile açılır; kapalıyken kural yalnız raporlanır ki ilk kurulumda kimse dışarıda kalmasın.
 */
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { fail } from "@/lib/api/envelope";
import type { AdminUser } from "@/lib/rbac";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sessionAssurance, type Assurance } from "./mfa";
import {
  EMPTY_ACCESS,
  MFA_FRESHNESS_MINUTES,
  MFA_PERMISSIONS,
  hasFullScope,
  hasPermission,
  toEffectiveAccess,
  type EffectiveAccess,
  type Permission,
} from "./permission-keys";

export type { Permission, EffectiveAccess } from "./permission-keys";
export { PERMISSIONS, MFA_PERMISSIONS, accessibleScope, hasFullScope, hasPermission, scopesOf } from "./permission-keys";

export const mfaEnforced = (env: Record<string, string | undefined> = process.env) => env.ADMIN_MFA_ENFORCED === "1";

/** Etkili yetki; okunamazsa boş erişim döner (varsayılan ret) ve hata loglanır. */
export async function loadAccess(userId: string, db = createServiceRoleClient()): Promise<EffectiveAccess> {
  const { data, error } = await db.rpc("admin_effective_permissions", { p_user: userId });
  if (error || !data) {
    console.error("[yetki] etkili yetki okunamadı", error?.code ?? "no_data");
    return EMPTY_ACCESS;
  }
  return toEffectiveAccess(data);
}

export function mfaSatisfied(permission: Permission, assurance: Assurance, now = new Date()): boolean {
  if (!MFA_PERMISSIONS.has(permission)) return true;
  if (assurance.aal !== "aal2") return false;
  if (!assurance.verifiedAt) return false;
  return now.getTime() - Date.parse(assurance.verifiedAt) <= MFA_FRESHNESS_MINUTES * 60_000;
}

export interface PermissionGuard {
  admin: AdminUser;
  access: EffectiveAccess;
  assurance: Assurance;
  error: null;
}
type Denied = { admin: null; access: null; assurance: null; error: ReturnType<typeof fail> };

/**
 * Oturum + aktif personel + izin (+ gerekiyorsa yeniden doğrulanmış oturum).
 * MFA eksikse 403 `mfa_required` döner; arayüz kayıt/doğrulama akışını başlatır.
 */
export async function requirePermission(
  request: NextRequest,
  permission: Permission,
  /** "full": uç kapsamı uygulamıyor, yalnız bütün kayıtlara yetkili kişi geçer (varsayılan, 19 §1). */
  options: { scope?: "full" | "any" } = {}
): Promise<PermissionGuard | Denied> {
  const denied = (error: ReturnType<typeof fail>): Denied => ({ admin: null, access: null, assurance: null, error });
  const { admin, error } = await requireAdmin(request);
  if (error || !admin) {
    const status = error?.status ?? 401;
    if (status === 401) return denied(fail(401, "unauthenticated", "Oturum bulunamadı. Lütfen giriş yapın."));
    if (status === 403) return denied(fail(403, "forbidden", "Bu işlem için yetkiniz yok."));
    return denied(fail(503, "unavailable", "Kimlik doğrulanamadı. Lütfen yeniden deneyin."));
  }
  const access = await loadAccess(admin.user_id);
  if (!hasPermission(access, permission)) return denied(fail(403, "forbidden", "Bu işlem için yetkiniz yok."));
  if ((options.scope ?? "full") === "full" && !hasFullScope(access, permission)) {
    return denied(
      fail(403, "scope_unsupported", "Bu ekran sınırlı kapsamı (saha/atanmış iş) henüz uygulamıyor; yetkiniz bütün kayıtları kapsamıyor.", {
        permission,
        scopes: access.permissions.find((p) => p.key === permission)?.scopes ?? [],
      })
    );
  }

  const assurance = await sessionAssurance();
  if (!mfaSatisfied(permission, assurance) && mfaEnforced()) {
    return denied(
      fail(403, "mfa_required", "Bu işlem iki aşamalı doğrulama ister.", {
        enrolled: assurance.enrolled,
        reason: !assurance.enrolled ? "enrollment" : assurance.aal !== "aal2" ? "challenge" : "stale",
        freshnessMinutes: MFA_FRESHNESS_MINUTES,
      })
    );
  }
  return { admin, access, assurance, error: null };
}

/** Yetki gerektirmeyen ama kimliği gereken okuma (ör. /api/admin/me). */
export async function requireAdminAccess(request: NextRequest): Promise<PermissionGuard | Denied> {
  const denied = (error: ReturnType<typeof fail>): Denied => ({ admin: null, access: null, assurance: null, error });
  const { admin, error } = await requireAdmin(request);
  if (error || !admin) {
    const status = error?.status ?? 401;
    return denied(
      status === 401
        ? fail(401, "unauthenticated", "Oturum bulunamadı. Lütfen giriş yapın.")
        : status === 403
          ? fail(403, "forbidden", "Yönetici yetkisi bulunamadı.")
          : fail(503, "unavailable", "Kimlik doğrulanamadı. Lütfen yeniden deneyin.")
    );
  }
  return { admin, access: await loadAccess(admin.user_id), assurance: await sessionAssurance(), error: null };
}

/** Geriye dönük yardımcı: elde edilmiş erişimle izin kontrolü (yanıt alanlarını süzmek için). */
export const can = (access: EffectiveAccess | null | undefined, permission: Permission): boolean =>
  access ? hasPermission(access, permission) : false;
