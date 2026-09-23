import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin/permissions";
import { UUID_RE, failFrom, isServiceError, readJson, scopeSchema, staffService } from "@/lib/admin/staff-http";
import { fail, ok } from "@/lib/api/envelope";

/**
 * POST /api/admin/staff/{id}/access-preview — YAZMA YAPMAZ (web-brifler/19 §6.2).
 * Kaydetmeden önce "ne değişecek?" sorusunu yanıtlar: kazanılan/kaybedilen izinler, kapsam farkları,
 * eski rol aynasındaki değişiklik ve kaydetmeyi engelleyecek durum. Atama uçları önizleme için çağrılmaz.
 * İzin: roles.manage. Önizleme sürüm tüketmez; kaydetme `expectedVersion` ile yapılır.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("assign"), roleKey: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/), scope: scopeSchema.default({ kind: "all" }), endsAt: z.string().datetime().nullable().optional() }).strict(),
  z.object({ kind: z.literal("update"), assignmentId: z.string().regex(UUID_RE), scope: scopeSchema, endsAt: z.string().datetime().nullable().optional() }).strict(),
  z.object({ kind: z.literal("revoke"), assignmentId: z.string().regex(UUID_RE) }).strict(),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "roles.manage");
  if (guard.error) return guard.error;
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Personel kaydı bulunamadı.");
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return fail(400, "invalid_body", "Geçersiz istek: değişiklik türü assign, update ya da revoke olmalı.");
  const preview = await staffService().previewAssignment(guard.admin.user_id, id, body.data);
  if (isServiceError(preview)) return failFrom(preview);
  return ok(preview);
}
