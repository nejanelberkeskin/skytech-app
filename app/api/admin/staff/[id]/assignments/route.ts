import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin/permissions";
import { UUID_RE, failFrom, isServiceError, readJson, reasonSchema, scopeSchema, staffService } from "@/lib/admin/staff-http";
import { fail, ok } from "@/lib/api/envelope";

/**
 * POST /api/admin/staff/{id}/assignments — rol + kapsam + süre atar. İzin: roles.manage (+ MFA).
 * Kimse kendisinde olmayan izni ya da daha geniş kapsamı veremez; kendine atama yapamaz (sunucu kontrolü).
 */
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    roleKey: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/),
    scope: scopeSchema.default({ kind: "all" }),
    endsAt: z.string().datetime().nullable().optional(),
    reason: reasonSchema,
  })
  .strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "roles.manage");
  if (guard.error) return guard.error;
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Personel kaydı bulunamadı.");
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return fail(400, "invalid_body", "Geçersiz istek: roleKey ve kapsam gerekli.");
  const service = staffService();
  const result = await service.assign(guard.admin.user_id, id, body.data.roleKey, body.data.scope, body.data.endsAt ?? null, body.data.reason ?? null);
  if (isServiceError(result)) return failFrom(result);
  const detail = await service.detail(id);
  return isServiceError(detail) ? failFrom(detail) : ok(detail, [], 201);
}
