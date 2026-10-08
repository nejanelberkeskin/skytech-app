import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { UUID_RE, failFrom, isServiceError, staffService } from "@/lib/admin/staff-http";
import { fail, ok } from "@/lib/api/envelope";

/** POST /api/admin/invitations/{id}/revoke — bekleyen daveti iptal eder. İzin: staff.invite (+ MFA). */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "staff.invite");
  if (guard.error) return guard.error;
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Davet bulunamadı.");
  const service = staffService();
  const result = await service.revokeInvitation(guard.admin.user_id, id);
  if (isServiceError(result)) return failFrom(result);
  const view = await service.invitationById(id);
  return isServiceError(view) ? failFrom(view) : ok({ invitation: view });
}
