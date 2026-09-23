import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/admin/permissions";
import { rolesService } from "@/lib/admin/roles-http";
import { failFrom, isServiceError, readJson } from "@/lib/admin/staff-http";
import { fail, ok } from "@/lib/api/envelope";

/**
 * POST /api/admin/roles/{key}/impact-preview — rol değişikliğinin etkisi (web-brifler/21 §3.3).
 *
 * HİÇBİR SATIR YAZMAZ: denetim kaydı üretmez, sürüm tüketmez, rolü kilitlemez. Kaydetmede
 * dönecek engel kodu burada `blocked` olarak görünür; onay ekranı bunu kaydetmeden önce gösterir.
 * Yanıt zarfının `data` alanı doğrudan `RoleImpactPreview`dir.
 */
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    permissions: z.array(z.string()).max(100).optional(),
    label: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const guard = await requireAnyPermission(request, ["roles.manage"], { mfa: false });
  if (guard.error) return guard.error;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) {
    return fail(400, "invalid_body", "Geçersiz istek.", {
      fields: [...new Set(body.error.issues.map((i) => i.path.join(".") || "body"))],
    });
  }
  const preview = await rolesService().preview(guard.admin.user_id, (await params).key, {
    permissions: body.data.permissions ?? null,
    label: body.data.label ?? null,
    description: body.data.description ?? null,
  });
  return isServiceError(preview) ? failFrom(preview) : ok(preview);
}
