import type { NextRequest } from "next/server";
import { hasFullScope, requireAdminAccess } from "@/lib/admin/permissions";
import { fail } from "@/lib/api/envelope";
import { ok, unavailable } from "@/lib/api/envelope";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/roles — rol sözlüğü (web-brifler/19 §6.2). İzin: `roles.manage` ya da `staff.invite`.
 * Davet eden kişi rol seçeneklerini ve "bu rol ne yapabilir?" listesini görebilmeli; bu okuma yetkisi
 * atama hakkı vermez — atama ve davet kuralları değişmedi. Sistem rolleri salt okunurdur.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireAdminAccess(request);
  if (guard.error) return guard.error;
  if (!hasFullScope(guard.access, "roles.manage") && !hasFullScope(guard.access, "staff.invite")) {
    return fail(403, "forbidden", "Bu işlem için yetkiniz yok.");
  }
  const { data, error } = await createServiceRoleClient()
    .from("admin_roles")
    .select("key, label, description, permissions, is_system")
    .order("key");
  if (error) return unavailable();
  return ok({
    roles: (data ?? []).map((r) => ({
      key: r.key as string,
      label: r.label as string,
      description: r.description as string,
      permissions: (r.permissions ?? []) as string[],
      isSystem: r.is_system === true,
    })),
  });
}
