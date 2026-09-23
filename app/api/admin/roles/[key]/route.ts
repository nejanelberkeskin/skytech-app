import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAnyPermission, requirePermission } from "@/lib/admin/permissions";
import { rolesService } from "@/lib/admin/roles-http";
import { failFrom, isServiceError, readJson } from "@/lib/admin/staff-http";
import { fail, ok } from "@/lib/api/envelope";

/**
 * GET   /api/admin/roles/{key} — rol yönetim ayrıntısı (kullanım sayıları + sürüm). İzin: roles.manage.
 * PATCH /api/admin/roles/{key} — yalnız özel roller; sürüm, parmak izi ve gerekçe zorunlu (+ MFA).
 * Yanıt zarfının `data` alanı doğrudan `RoleDetailDto`dur. Sözleşme: web-brifler/21 §3.2.
 */
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    label: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).optional(),
    permissions: z.array(z.string()).min(1).max(100).optional(),
    expectedVersion: z.string().datetime({ offset: true }),
    /** Önizlemenin `usage` alanı olduğu gibi geri gelir; parmak izi ZORUNLUDUR (21 §3.2). */
    expectedUsage: z
      .object({
        activeAssignments: z.number().int().nonnegative().optional(),
        scheduledAssignments: z.number().int().nonnegative().optional(),
        staffCount: z.number().int().nonnegative().optional(),
        pendingInvitations: z.number().int().nonnegative().optional(),
        fingerprint: z.string().regex(/^[0-9a-f]{32}$/),
      })
      .strict(),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const guard = await requireAnyPermission(request, ["roles.manage"], { mfa: false });
  if (guard.error) return guard.error;
  const role = await rolesService().detail(guard.admin.user_id, (await params).key);
  return isServiceError(role) ? failFrom(role) : ok(role);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const guard = await requirePermission(request, "roles.manage");
  if (guard.error) return guard.error;
  const body = patchSchema.safeParse(await readJson(request));
  if (!body.success) {
    return fail(400, "invalid_body", "Geçersiz istek: sürüm, önizleme parmak izi ve 10–500 karakterlik gerekçe gerekli.", {
      fields: [...new Set(body.error.issues.map((i) => i.path.join(".") || "body"))],
    });
  }
  const updated = await rolesService().update(guard.admin.user_id, (await params).key, {
    label: body.data.label ?? null,
    description: body.data.description ?? null,
    permissions: body.data.permissions ?? null,
    expectedVersion: body.data.expectedVersion,
    expectedFingerprint: body.data.expectedUsage.fingerprint,
    reason: body.data.reason,
  });
  return isServiceError(updated) ? failFrom(updated) : ok(updated);
}
