import type { NextRequest } from "next/server";
import { MFA_FRESHNESS_MINUTES, MFA_PERMISSIONS } from "@/lib/admin/permission-keys";
import { mfaEnforced, requireAdminAccess } from "@/lib/admin/permissions";
import { ok } from "@/lib/api/envelope";

/**
 * GET /api/admin/me — oturum sahibinin etkili yetkisi (web-brifler/19 §6.1).
 * Menü bu yanıttan çizilir; karar her zaman sunucudadır. Önbelleğe alınmaz: yetki kaldırılınca
 * bir sonraki istek 403 alır.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireAdminAccess(request);
  if (guard.error) return guard.error;
  const { admin, access, assurance } = guard;
  return ok({
    admin: { id: admin.id, userId: admin.user_id, fullName: admin.full_name, email: admin.email, isActive: admin.is_active, legacyRole: admin.role },
    roles: access.roles,
    permissions: access.permissions,
    limits: { ...access.limits, enforced: false as const },
    mfa: {
      enrolled: assurance.enrolled,
      assuranceLevel: assurance.aal,
      verifiedAt: assurance.verifiedAt,
      enforced: mfaEnforced(),
      freshnessMinutes: MFA_FRESHNESS_MINUTES,
      requiredFor: [...MFA_PERMISSIONS],
    },
    checkedAt: new Date().toISOString(),
  });
}
