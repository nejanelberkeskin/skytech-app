import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin/permissions";
import { DEFAULT_INVITATION_DAYS } from "@/lib/admin/staff";
import { UUID_RE, failFrom, isServiceError, readJson, staffService } from "@/lib/admin/staff-http";
import { SKIPPED_ID, publicOrigin, sendStaffInvitation } from "@/lib/mail";
import { fail, ok, type ApiWarning } from "@/lib/api/envelope";

/** POST /api/admin/invitations/{id}/resend — yeni belirteç üretir, eskisi geçersiz olur. İzin: staff.invite (+ MFA). */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "staff.invite");
  if (guard.error) return guard.error;
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Davet bulunamadı.");
  const body = z.object({ expiresInDays: z.number().int().min(1).max(30).default(DEFAULT_INVITATION_DAYS) }).strict().safeParse(await readJson(request));
  const result = await staffService().resendInvitation(guard.admin.user_id, id, body.success ? body.data.expiresInDays : DEFAULT_INVITATION_DAYS);
  if (isServiceError(result)) return failFrom(result);
  const warnings: ApiWarning[] = [];
  try {
    const sent = await sendStaffInvitation({
      to: result.invitation.email, roleLabel: result.invitation.roleLabel,
      inviterName: guard.admin.full_name || guard.admin.email,
      acceptUrl: `${publicOrigin(request.nextUrl.origin)}/personel-daveti/${result.token}`,
      expiresAt: new Date(result.invitation.expiresAt),
    });
    if (!sent?.id || sent.id === SKIPPED_ID) warnings.push({ code: "email_not_sent", message: "Davet yenilendi ancak e-posta gönderilemedi." });
  } catch {
    warnings.push({ code: "email_not_sent", message: "Davet yenilendi ancak e-posta gönderilemedi." });
  }
  return ok({ invitation: result.invitation }, warnings);
}
