import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { ok, unavailable } from "@/lib/api/envelope";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/roles — rol sözlüğü (web-brifler/19 §6.2). İzin: roles.manage.
 * Arayüz rol seçimini ve "bu rol ne yapabilir?" listesini buradan çizer. Sistem rolleri salt okunurdur.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "roles.manage");
  if (guard.error) return guard.error;
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
