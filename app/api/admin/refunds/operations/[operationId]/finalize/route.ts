import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { fail } from "@/lib/api/envelope";
import { UUID_RE, refundService, respondAction } from "@/lib/refunds/http";

/**
 * POST /api/admin/refunds/operations/{operationId}/finalize — sağlayıcıda başarılı iadenin yerel kaydını
 * tamamlar; sağlayıcı ÇAĞRILMAZ (web-brifler/17 §6.6). İzin: refunds.execute. Tamamlanmış işlemde "noop".
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ operationId: string }> }) {
  const guard = await requirePermission(request, "refunds.execute");
  if (guard.error) return guard.error;
  const { operationId } = await params;
  if (!UUID_RE.test(operationId)) return fail(404, "not_found", "İade işlemi bulunamadı.");
  return respondAction(await refundService().finalize(operationId));
}
