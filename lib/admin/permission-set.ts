/**
 * Bir istekte birden çok izin gerektiğinde kapı — YALNIZ SUNUCU. Sözleşmeler: web-brifler/19 §1, 30.
 *
 * Gereken izinler isteğin GERÇEKTEN değiştirdiği alanlardan çıkarılır; her biri kendi kapsamıyla ayrı
 * denetlenir (kapsamlar birbirine kopyalanmaz). Biri bile eksikse bütün istek reddedilir: kısmi uygulama yok.
 * Sıra: izin yok → yalnız `assigned` → bütün kayıt kapsamı gerekli → kayıt kapsam dışı → yeniden doğrulama.
 * Ret kararı hiçbir yazma ya da dış servis çağrısından önce verilir.
 */
import { fail } from "@/lib/api/envelope";
import {
  MFA_PERMISSIONS, hasPermission, mfaEnforced, mfaSatisfied,
  type EffectiveAccess, type Permission,
} from "@/lib/admin/permissions";
import type { Assurance } from "@/lib/admin/mfa";
import { MFA_FRESHNESS_MINUTES } from "@/lib/admin/permission-keys";
import { permissionScope, scopeCovers } from "./record-scope";

/** `all`: yeni kayıt gibi bütün kayıtlara yetki isteyen işlem. `{ siteId }`: o sahadaki kayıt. */
export type PermissionTarget = "all" | { siteId: string | null };
export interface RequiredPermission {
  permission: Permission;
  target: PermissionTarget;
}

export type PermissionSetDenial =
  | { code: "forbidden"; reason: "missing_permission" | "all_scope_required" | "out_of_scope"; permissions: Permission[] }
  | { code: "scope_unsupported"; permissions: Permission[] }
  | { code: "mfa_required"; permissions: Permission[]; enrolled: boolean; reason: "enrollment" | "challenge" | "stale" };

const unique = (list: RequiredPermission[]) => [...new Set(list.map((r) => r.permission))];

export function evaluatePermissionSet(
  access: EffectiveAccess,
  assurance: Assurance,
  required: RequiredPermission[],
  enforced = mfaEnforced()
): PermissionSetDenial | null {
  const missing = required.filter((r) => !hasPermission(access, r.permission));
  if (missing.length) return { code: "forbidden", reason: "missing_permission", permissions: unique(missing) };

  // İzin var ama kayıt kapsamı yok: yalnız `assigned` (bu modüllerde atama modeli yok).
  const assignedOnly = required.filter((r) => permissionScope(access, r.permission) === null);
  if (assignedOnly.length) return { code: "scope_unsupported", permissions: unique(assignedOnly) };

  const needsAll = required.filter((r) => r.target === "all" && permissionScope(access, r.permission)?.kind !== "all");
  if (needsAll.length) return { code: "forbidden", reason: "all_scope_required", permissions: unique(needsAll) };

  const outside = required.filter((r) => r.target !== "all" && !scopeCovers(permissionScope(access, r.permission), r.target.siteId));
  if (outside.length) return { code: "forbidden", reason: "out_of_scope", permissions: unique(outside) };

  const mfa = required.filter((r) => MFA_PERMISSIONS.has(r.permission) && !mfaSatisfied(r.permission, assurance));
  if (mfa.length && enforced) {
    return {
      code: "mfa_required",
      permissions: unique(mfa),
      enrolled: assurance.enrolled,
      reason: !assurance.enrolled ? "enrollment" : assurance.aal !== "aal2" ? "challenge" : "stale",
    };
  }
  return null;
}

export function permissionSetResponse(denial: PermissionSetDenial) {
  const { permissions } = denial;
  if (denial.code === "mfa_required") {
    return fail(403, "mfa_required", "Bu değişiklik iki aşamalı doğrulama ister.", {
      permissions, enrolled: denial.enrolled, reason: denial.reason, freshnessMinutes: MFA_FRESHNESS_MINUTES,
    });
  }
  if (denial.code === "scope_unsupported") {
    return fail(403, "scope_unsupported", "Bu yetkiniz yalnız kişiye atanmış işleri kapsıyor; bu modülde atama modeli yok.", { permissions });
  }
  const message = {
    missing_permission: "Bu değişiklik için yetkiniz yok.",
    all_scope_required: "Bu işlem bütün kayıtlara yetki ister; saha kapsamlı yetki yeni kayıt açamaz.",
    out_of_scope: "Bu kayıt yetkinizin saha kapsamı dışında.",
  }[denial.reason];
  return fail(403, "forbidden", message, { reason: denial.reason, permissions });
}
