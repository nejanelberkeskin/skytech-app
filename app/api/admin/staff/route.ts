import type { NextRequest } from "next/server";
import { requireAnyPermission } from "@/lib/admin/permissions";
import { failFrom, isServiceError, staffService } from "@/lib/admin/staff-http";
import { ok } from "@/lib/api/envelope";
import { encodeCursor, readLimit } from "@/lib/admin/pagination";

/**
 * GET /api/admin/staff?limit&cursor — personel listesi (web-brifler/19 §6.2).
 * İzin: staff.manage YA DA roles.manage (20 madde 7): atama yöneticisi kime rol vereceğini görebilmeli.
 * Okuma yetkisi yazma yetkisi değildir: aktiflik ve MFA sıfırlama yalnız staff.manage ile yapılır.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireAnyPermission(request, ["staff.manage", "roles.manage"]);
  if (guard.error) return guard.error;
  const limit = readLimit(request.nextUrl.searchParams.get("limit"));
  const list = await staffService().list({ limit, cursor: request.nextUrl.searchParams.get("cursor") });
  if (isServiceError(list)) return failFrom(list);
  const last = list[list.length - 1];
  return ok({ items: list, nextCursor: list.length === limit && last ? encodeCursor(last.createdAt, last.id) : null });
}
