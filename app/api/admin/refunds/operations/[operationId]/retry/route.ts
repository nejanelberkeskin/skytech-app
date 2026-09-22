import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin/permissions";
import { fail } from "@/lib/api/envelope";
import { UUID_RE, clientIp, readJson, refundService, respondAction } from "@/lib/refunds/http";

/**
 * POST /api/admin/refunds/operations/{operationId}/retry — kesin reddedilmiş iadeyi yeniden dener
 * (web-brifler/17 §6.4). İzin: refunds.execute. Gövde: { expectedAttempt }.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ expectedAttempt: z.number().int().min(1).max(1000) }).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ operationId: string }> }) {
  const guard = await requirePermission(request, "refunds.execute");
  if (guard.error) return guard.error;
  const { operationId } = await params;
  if (!UUID_RE.test(operationId)) return fail(404, "not_found", "İade işlemi bulunamadı.");
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return fail(400, "invalid_body", "Geçersiz istek: expectedAttempt (tam sayı) gerekli.");
  return respondAction(await refundService().retry(operationId, body.data.expectedAttempt, guard.admin, clientIp(request)));
}
