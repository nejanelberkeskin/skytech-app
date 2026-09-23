import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAnyPermission, requirePermission } from "@/lib/admin/permissions";
import { UUID_RE, failFrom, isServiceError, readJson, reasonSchema, staffService } from "@/lib/admin/staff-http";
import { fail, ok } from "@/lib/api/envelope";

/**
 * GET   /api/admin/staff/{id} — personel ayrıntısı. İzin: staff.manage YA DA roles.manage (20 madde 7).
 * PATCH /api/admin/staff/{id} — aktiflik değişikliği. İzin: staff.manage (+ MFA).
 * Kendi kaydını değiştirmek ve son sahibi pasifleştirmek sunucuda engellenir.
 */
export const dynamic = "force-dynamic";

const patchSchema = z.object({ isActive: z.boolean(), reason: reasonSchema }).strict();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAnyPermission(request, ["staff.manage", "roles.manage"]);
  if (guard.error) return guard.error;
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Personel kaydı bulunamadı.");
  const detail = await staffService().detail(id);
  if (isServiceError(detail)) return failFrom(detail);
  return ok(detail);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "staff.manage");
  if (guard.error) return guard.error;
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Personel kaydı bulunamadı.");
  const body = patchSchema.safeParse(await readJson(request));
  if (!body.success) return fail(400, "invalid_body", "Geçersiz istek: isActive (true/false) gerekli.");
  const result = await staffService().setActive(guard.admin.user_id, id, body.data.isActive, body.data.reason ?? null);
  if (isServiceError(result)) return failFrom(result);
  const detail = await staffService().detail(id);
  return isServiceError(detail) ? failFrom(detail) : ok(detail);
}
