import type { NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getClientIP } from "@/lib/admin-auth";
import { mfaEnforced, mfaSatisfied, requireAdminAccess, requirePermission, type Permission } from "@/lib/admin/permissions";
import { onlyAssigned, permissionScope, scopeCovers } from "@/lib/admin/record-scope";
import { evaluatePermissionSet, permissionSetResponse } from "@/lib/admin/permission-set";
import { auditLog } from "@/lib/admin/audit";
import { fail, ok, unavailable } from "@/lib/api/envelope";
import { loadBatchList, loadBatchSummary } from "@/lib/batches/admin-read";
import { createBatch } from "@/lib/orders/batches";

/**
 * Admin — Bırakma partileri. Sözleşme: web-brifler/31.
 *
 * GET  → Ok<BatchListDto>            batches.read (all / sites). Okuma hiçbir siparişi kesinleştirmez:
 *                                    cayma süresi dolan siparişleri zamanlanmış iş kesinleştirir (31 §5).
 * POST { landId, seasonLabel, title?, plannedOn?, notes? } → 201 Ok<{ batch: BatchSummary }>
 *                                    batches.plan, sahayı kapsamalı.
 */
export const dynamic = "force-dynamic";

const unsupported = (permission: Permission) =>
  fail(403, "scope_unsupported", "Parti yetkiniz yalnız kişiye atanmış işleri kapsıyor; partiler için atama modeli yok.", { permission, permissions: [permission] });

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "batches.read", { scope: "any" });
  if (guard.error) return guard.error;
  const read = permissionScope(guard.access, "batches.read");
  if (!read) return unsupported("batches.read");

  const list = await loadBatchList(createServiceRoleClient(), {
    access: guard.access,
    read,
    assurance: guard.assurance,
    enforced: mfaEnforced(),
    satisfied: (p) => mfaSatisfied(p, guard.assurance),
  });
  if (!list) {
    console.error("[admin/release-batches] liste okunamadı");
    return unavailable();
  }
  return ok(list);
}

const createSchema = z.object({
  landId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  seasonLabel: z.string().regex(/^\d{4}-\d{4}$/),
  title: z.string().trim().max(120).nullable().optional(),
  plannedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdminAccess(request);
  if (guard.error) return guard.error;
  const { access } = guard;
  const read = permissionScope(access, "batches.read");
  if (!read) {
    return onlyAssigned(access, "batches.read")
      ? unsupported("batches.read")
      : fail(403, "forbidden", "Partileri okuma yetkiniz yok.", { reason: "missing_permission", permissions: ["batches.read"] });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(400, "invalid_body", "Geçersiz istek.", { fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "body"))] });
  }
  const input = parsed.data;
  // Okuma kapsamı dışındaki saha yok sayılır (varlık sızmaz); okunup plan kapsamı dışındaysa 403.
  if (!scopeCovers(read, input.landId)) return fail(404, "not_found", "Saha bulunamadı.");
  const denial = evaluatePermissionSet(access, guard.assurance, [{ permission: "batches.plan", target: { siteId: input.landId } }]);
  if (denial) return permissionSetResponse(denial);

  const db = createServiceRoleClient();
  const result = await createBatch(
    { landId: input.landId, seasonLabel: input.seasonLabel, title: input.title || null, plannedOn: input.plannedOn || null, notes: input.notes || null },
    guard.admin.user_id,
    db
  );
  if (!result.ok) {
    if (result.error === "not_found") return fail(404, "not_found", "Saha bulunamadı.");
    if (result.error === "unavailable") return unavailable();
    return fail(400, "invalid_date", "Sezon ya da plan tarihi geçersiz.");
  }

  const warnings = await auditLog(db, {
    admin: guard.admin,
    action: "CREATE",
    entity: "release_batch",
    entityId: result.batch.id,
    details: { landId: input.landId, seasonLabel: input.seasonLabel, plannedOn: input.plannedOn ?? null },
    ip: getClientIP(request),
  });
  const summary = await loadBatchSummary(db, access, result.batch as unknown as Record<string, unknown>);
  if (!summary) {
    return fail(503, "unavailable", "Parti oluşturuldu ancak güncel kayıt okunamadı. Listeyi yenileyin; işlemi tekrarlamayın.", {
      applied: true, id: result.batch.id,
    });
  }
  return ok({ batch: summary }, warnings, 201);
}
