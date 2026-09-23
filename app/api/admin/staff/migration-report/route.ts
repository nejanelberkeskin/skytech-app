import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { failFrom, isServiceError, staffService } from "@/lib/admin/staff-http";
import { ok } from "@/lib/api/envelope";

/** GET /api/admin/staff/migration-report — 021 geçişinin kişi bazında fark raporu. İzin: roles.manage. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "roles.manage");
  if (guard.error) return guard.error;
  const report = await staffService().migrationReport();
  if (isServiceError(report)) return failFrom(report);
  return ok({ report: report.data });
}
