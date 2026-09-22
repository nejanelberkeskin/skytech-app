import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin/permissions";
import { fail } from "@/lib/api/envelope";
import { UUID_RE, clientIp, readJson, refundService, respondAction } from "@/lib/refunds/http";

/**
 * POST /api/admin/refunds/orders/{orderId}/execute — ilk iade denemesi (web-brifler/17 §6.3). İzin: refunds.execute.
 * Gövde: { kind: "order" } | { kind: "duplicate", paymentId }. Tutar her zaman kayıttan gelir.
 * Sağlayıcının reddetmesi ya da belirsiz sonuç HTTP hatası değildir: 200 + result.outcome.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("order") }).strict(),
  z.object({ kind: z.literal("duplicate"), paymentId: z.string().trim().min(1).max(100) }).strict(),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requirePermission(request, "refunds.execute");
  if (guard.error) return guard.error;
  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) return fail(404, "not_found", "Sipariş bulunamadı.");
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return fail(400, "invalid_body", "Geçersiz istek: kind \"order\" ya da \"duplicate\" (paymentId ile) olmalı.");
  return respondAction(await refundService().execute(orderId, body.data, guard.admin, clientIp(request)));
}
