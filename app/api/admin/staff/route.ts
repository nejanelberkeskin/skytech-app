import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { failFrom, isServiceError, staffService } from "@/lib/admin/staff-http";
import { ok } from "@/lib/api/envelope";

/** GET /api/admin/staff — personel listesi (web-brifler/19 §6.2). İzin: staff.manage. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "staff.manage");
  if (guard.error) return guard.error;
  const list = await staffService().list();
  if (isServiceError(list)) return failFrom(list);
  return ok({ staff: list });
}
