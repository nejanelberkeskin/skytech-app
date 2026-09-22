import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin/permissions";
import { fail } from "@/lib/api/envelope";
import { EVIDENCE_SOURCES, REFUND_ID_PATTERN } from "@/lib/refunds/model";
import { UUID_RE, readJson, refundService, respondAction } from "@/lib/refunds/http";

/**
 * POST /api/admin/refunds/operations/{operationId}/resolve — mutabakat (web-brifler/17 §6.5). İzin: refunds.execute.
 * "iade yapıldı" iade kimliği ister; "iade yapılmadı" deneme başlangıcından 30 dk sonra verilebilir.
 * Gerekçe notu ve kanıt kaynağı zorunlu. Kurallar SQL'de de (020) uygulanır.
 */
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    expectedAttempt: z.number().int().min(1).max(1000),
    outcome: z.enum(["provider_succeeded", "failed"]),
    refundId: z.string().trim().max(100).optional(),
    evidence: z.object({ source: z.enum(EVIDENCE_SOURCES), reference: z.string().trim().max(200).optional() }).strict(),
    note: z.string().trim().min(10).max(1000),
  })
  .strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ operationId: string }> }) {
  const guard = await requirePermission(request, "refunds.execute");
  if (guard.error) return guard.error;
  const { operationId } = await params;
  if (!UUID_RE.test(operationId)) return fail(404, "not_found", "İade işlemi bulunamadı.");
  const raw = await readJson(request);
  const body = bodySchema.safeParse(raw);
  if (!body.success) {
    const fields = new Set(body.error.issues.map((i) => String(i.path[0] ?? "")));
    if (fields.has("note")) return fail(422, "note_required", "Gerekçe notu 10–1000 karakter olmalı.");
    if (fields.has("evidence")) return fail(422, "evidence_required", "Kanıt kaynağını seçin (kaynak açıklaması en çok 200 karakter).");
    if (fields.has("refundId")) return fail(422, "invalid_refund_id", "Geçerli bir iade kimliği girin (en çok 100 karakter; harf, rakam ve . _ : -).");
    return fail(400, "invalid_body", "Geçersiz istek.");
  }
  const input = body.data;
  if (input.outcome === "provider_succeeded" && !REFUND_ID_PATTERN.test(input.refundId ?? "")) {
    return fail(422, "invalid_refund_id", "Geçerli bir iade kimliği girin (en çok 100 karakter; harf, rakam ve . _ : -).");
  }
  return respondAction(
    await refundService().resolve(
      operationId,
      {
        expectedAttempt: input.expectedAttempt,
        outcome: input.outcome,
        refundId: input.outcome === "provider_succeeded" ? input.refundId : undefined,
        source: input.evidence.source,
        reference: input.evidence.reference || undefined,
        note: input.note,
      },
      guard.admin
    )
  );
}
