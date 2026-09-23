import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin/permissions";
import { UUID_RE, failFrom, isServiceError, readJson, reasonSchema, scopeSchema, staffService } from "@/lib/admin/staff-http";
import { fail, ok } from "@/lib/api/envelope";

/**
 * PATCH  /api/admin/staff/{id}/assignments/{assignmentId} — kapsam/süre değişikliği (expectedVersion zorunlu).
 * DELETE aynı yol — atamayı kaldırır (kayıt silinmez). İzin: roles.manage (+ MFA).
 */
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    scope: scopeSchema,
    endsAt: z.string().datetime().nullable().optional(),
    expectedVersion: z.string().min(10).max(64),
    reason: reasonSchema,
  })
  .strict();

const ids = async (params: Promise<{ id: string; assignmentId: string }>) => {
  const p = await params;
  return UUID_RE.test(p.id) && UUID_RE.test(p.assignmentId) ? p : null;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const guard = await requirePermission(request, "roles.manage");
  if (guard.error) return guard.error;
  const p = await ids(params);
  if (!p) return fail(404, "not_found", "Atama bulunamadı.");
  const body = patchSchema.safeParse(await readJson(request));
  if (!body.success) return fail(400, "invalid_body", "Geçersiz istek: kapsam ve expectedVersion gerekli.");
  const service = staffService();
  const result = await service.updateAssignment(guard.admin.user_id, p.assignmentId, body.data.scope, body.data.endsAt ?? null, body.data.expectedVersion, body.data.reason ?? null);
  if (isServiceError(result)) return failFrom(result);
  const detail = await service.detail(p.id);
  return isServiceError(detail) ? failFrom(detail) : ok(detail);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const guard = await requirePermission(request, "roles.manage");
  if (guard.error) return guard.error;
  const p = await ids(params);
  if (!p) return fail(404, "not_found", "Atama bulunamadı.");
  const body = z.object({ reason: reasonSchema }).strict().safeParse(await readJson(request));
  const service = staffService();
  const result = await service.revokeAssignment(guard.admin.user_id, p.assignmentId, body.success ? body.data.reason ?? null : null);
  if (isServiceError(result)) return failFrom(result);
  const detail = await service.detail(p.id);
  return isServiceError(detail) ? failFrom(detail) : ok(detail);
}
