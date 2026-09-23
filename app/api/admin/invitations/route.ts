import type { NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin/permissions";
import { DEFAULT_INVITATION_DAYS } from "@/lib/admin/staff";
import { failFrom, isServiceError, readJson, scopeSchema, staffService } from "@/lib/admin/staff-http";
import { SKIPPED_ID, publicOrigin, sendStaffInvitation } from "@/lib/mail";
import { fail, ok, type ApiWarning } from "@/lib/api/envelope";

/**
 * GET  /api/admin/invitations — davet listesi. İzin: staff.manage.
 * POST /api/admin/invitations — davet oluşturur ve e-posta gönderir. İzin: staff.invite (+ MFA).
 * Auth kullanıcısı oluşturulmaz, şifre üretilmez; kişi kendi hesabını kurar (web-brifler/19 §6.3).
 */
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    roleKey: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/),
    scope: scopeSchema.default({ kind: "all" }),
    accessEndsAt: z.string().datetime().nullable().optional(),
    expiresInDays: z.number().int().min(1).max(30).default(DEFAULT_INVITATION_DAYS),
  })
  .strict();

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "staff.manage");
  if (guard.error) return guard.error;
  const list = await staffService().invitations();
  if (isServiceError(list)) return failFrom(list);
  return ok({ invitations: list });
}

export async function POST(request: NextRequest) {
  const guard = await requirePermission(request, "staff.invite");
  if (guard.error) return guard.error;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return fail(400, "invalid_body", "Geçersiz istek: e-posta ve rol gerekli.");
  const created = await staffService().createInvitation(guard.admin.user_id, {
    email: body.data.email, roleKey: body.data.roleKey, scope: body.data.scope,
    accessEndsAt: body.data.accessEndsAt ?? null, expiresInDays: body.data.expiresInDays,
  });
  if (isServiceError(created)) return failFrom(created);

  const acceptUrl = `${publicOrigin(request.nextUrl.origin)}/davet/${created.token}`;
  const warnings: ApiWarning[] = [];
  try {
    const sent = await sendStaffInvitation({
      to: created.invitation.email, roleLabel: created.invitation.roleLabel,
      inviterName: guard.admin.full_name || guard.admin.email, acceptUrl,
      expiresAt: new Date(created.invitation.expiresAt),
    });
    if (!sent?.id || sent.id === SKIPPED_ID) {
      warnings.push({ code: "email_not_sent", message: "Davet oluşturuldu ancak e-posta gönderilemedi. Bağlantıyı yeniden gönderin." });
    }
  } catch {
    warnings.push({ code: "email_not_sent", message: "Davet oluşturuldu ancak e-posta gönderilemedi. Bağlantıyı yeniden gönderin." });
  }
  after(() => console.log("[personel] davet oluşturuldu", created.invitation.id));
  return ok({ invitation: created.invitation }, warnings, 201);
}
