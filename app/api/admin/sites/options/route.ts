import type { NextRequest } from "next/server";
import { requireAnyPermission } from "@/lib/admin/permissions";
import { readLimit } from "@/lib/admin/pagination";
import { rolesService } from "@/lib/admin/roles-http";
import { failFrom, isServiceError, UUID_RE } from "@/lib/admin/staff-http";
import { ok } from "@/lib/api/envelope";

/**
 * GET /api/admin/sites/options — kapsam seçimi için minimal saha listesi (web-brifler/21 §3.4).
 * İzin: `roles.manage` ya da `staff.invite`. Kapasite, doluluk, müşteri ve finans alanı DÖNMEZ.
 * `ids` verildiğinde yalnız o kayıtlar döner; seçili kimlikleri okunabilir ada çevirmek içindir.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireAnyPermission(request, ["roles.manage", "staff.invite"], { mfa: false });
  if (guard.error) return guard.error;
  const q = request.nextUrl.searchParams;
  const ids = (q.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => UUID_RE.test(s)).slice(0, 200);
  const list = await rolesService().siteOptions({
    limit: readLimit(q.get("limit")), cursor: q.get("cursor"), q: q.get("q"), ids: ids.length ? ids : null,
  });
  return isServiceError(list) ? failFrom(list) : ok(list);
}
