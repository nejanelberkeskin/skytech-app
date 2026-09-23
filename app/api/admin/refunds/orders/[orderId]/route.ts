import type { NextRequest } from "next/server";
import { hasFullScope, requirePermission } from "@/lib/admin/permissions";
import { fail, ok } from "@/lib/api/envelope";
import { UUID_RE, failFrom, isServiceError, refundService } from "@/lib/refunds/http";

/** GET /api/admin/refunds/orders/{orderId} — siparişin iade görünümü (web-brifler/17 §6.2). İzin: finance.read. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requirePermission(request, "finance.read");
  if (guard.error) return guard.error;
  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) return fail(404, "not_found", "Sipariş bulunamadı.");
  const view = await refundService().orderView(orderId, hasFullScope(guard.access, "refunds.execute"));
  if (isServiceError(view)) return failFrom(view);
  return ok(view);
}
