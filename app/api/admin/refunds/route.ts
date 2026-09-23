import type { NextRequest } from "next/server";
import { can, requirePermission } from "@/lib/admin/permissions";
import { ok } from "@/lib/api/envelope";
import { failFrom, isServiceError, refundService } from "@/lib/refunds/http";

/**
 * GET /api/admin/refunds?filter=open|all&includeTest=1&limit=50 — iade iş kuyruğu (web-brifler/17 §6.1).
 * İzin: finance.read. Sıra: son tarihi geçenler → dikkat gerektirenler → son tarihi yakın olanlar.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "finance.read");
  if (guard.error) return guard.error;
  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number.parseInt(params.get("limit") ?? "50", 10) || 50, 1), 200);
  const queue = await refundService().queue({
    filter: params.get("filter") === "all" ? "all" : "open",
    includeTest: params.get("includeTest") === "1",
    limit,
    canExecute: can(guard.access, "refunds.execute"),
  });
  if (isServiceError(queue)) return failFrom(queue);
  return ok({ items: queue.items, total: queue.total, generatedAt: new Date().toISOString() });
}
