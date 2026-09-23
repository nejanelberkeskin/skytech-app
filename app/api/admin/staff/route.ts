import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { failFrom, isServiceError, staffService } from "@/lib/admin/staff-http";
import { ok } from "@/lib/api/envelope";
import { encodeCursor, readLimit } from "@/lib/admin/pagination";

/** GET /api/admin/staff?limit&cursor — personel listesi (web-brifler/19 §6.2). İzin: staff.manage. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "staff.manage");
  if (guard.error) return guard.error;
  const limit = readLimit(request.nextUrl.searchParams.get("limit"));
  const list = await staffService().list({ limit, cursor: request.nextUrl.searchParams.get("cursor") });
  if (isServiceError(list)) return failFrom(list);
  const last = list[list.length - 1];
  return ok({ items: list, nextCursor: list.length === limit && last ? encodeCursor(last.createdAt, last.id) : null });
}
