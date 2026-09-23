import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAnyPermission, requirePermission } from "@/lib/admin/permissions";
import { rolesService } from "@/lib/admin/roles-http";
import { failFrom, isServiceError, readJson } from "@/lib/admin/staff-http";
import { fail, ok, unavailable } from "@/lib/api/envelope";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET  /api/admin/roles — rol sözlüğü (web-brifler/19 §6.2). İzin: `roles.manage` ya da `staff.invite`.
 * Davet eden kişi rol seçeneklerini ve "bu rol ne yapabilir?" listesini görebilmeli; bu okuma yetkisi
 * atama hakkı vermez. DTO değişmedi.
 * POST /api/admin/roles — özel rol oluşturur, `copyFrom` ile bir rolün izinlerini kopyalar (21 §3.1).
 *   Yanıt: 201, `data` doğrudan `RoleDetailDto`.
 * Sistem rolleri salt okunurdur; rol silme bu dilimde yoktur.
 */
export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]{2,40}$/),
    label: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).optional(),
    permissions: z.array(z.string()).min(1).max(100).optional(),
    copyFrom: z.string().trim().regex(/^[a-z][a-z0-9_]{2,40}$/).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const guard = await requireAnyPermission(request, ["roles.manage", "staff.invite"], { mfa: false });
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

export async function POST(request: NextRequest) {
  const guard = await requirePermission(request, "roles.manage");
  if (guard.error) return guard.error;
  const body = createSchema.safeParse(await readJson(request));
  if (!body.success) {
    return fail(400, "invalid_body", "Geçersiz istek: anahtar ve 2–80 karakterlik ad gerekli.", {
      fields: [...new Set(body.error.issues.map((i) => i.path.join(".") || "body"))],
    });
  }
  if (!body.data.permissions && !body.data.copyFrom) {
    return fail(422, "invalid_permissions", "İzin listesi ya da kopyalanacak rol gerekli.");
  }
  const created = await rolesService().create(guard.admin.user_id, {
    key: body.data.key, label: body.data.label, description: body.data.description ?? "",
    permissions: body.data.permissions ?? null, copyFrom: body.data.copyFrom ?? null,
  });
  return isServiceError(created) ? failFrom(created) : ok(created, [], 201);
}
