import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getClientIP } from "@/lib/admin-auth";
import { mfaEnforced, mfaSatisfied, requireAdminAccess, requirePermission, type Permission } from "@/lib/admin/permissions";
import { onlyAssigned, permissionScope, scopeCovers } from "@/lib/admin/record-scope";
import { evaluatePermissionSet, permissionSetResponse } from "@/lib/admin/permission-set";
import { auditLog } from "@/lib/admin/audit";
import { fail, ok, unavailable } from "@/lib/api/envelope";
import { publicOrigin } from "@/lib/mail";
import { loadBatchDetail, loadBatchRow, loadBatchSummary, sourceOrders } from "@/lib/batches/admin-read";
import { assignOrders, completeRelease, deleteBatch, unassignOrder, updateBatch, type BatchError } from "@/lib/orders/batches";
import { sendPendingCertificateEmails } from "@/lib/orders/certificates";
import { publishBatchVideo, sendPendingVideoEmails } from "@/lib/orders/jobs";

/**
 * Admin — Bırakma partisi (ayrıntı + işlemler). Sözleşme: web-brifler/31.
 *
 * GET    → Ok<BatchDetailDto>                                   batches.read
 * PATCH  { title?, plannedOn?, notes?, monitoringReportUrl? } → Ok<{ batch, changed }>
 *        Yalnız değişen alanlar: plan alanları batches.plan; izleme raporu herkese açık → monitoring.publish (MFA).
 * POST   { action:"assign", orderIds[] }   batches.assign — parti ve her kaynak sipariş kapsamda
 *        { action:"unassign", orderId }    batches.assign — sipariş BU partide olmalı
 *        { action:"release", releasedOn }  batches.release (MFA) — GERİ ALINAMAZ
 *        { action:"publish_video", videoUrl } monitoring.publish (MFA) — ilk yayımda müşterilere bildirim
 * DELETE → yalnız boş parti                                     batches.plan
 *
 * Her izin partinin sahasını kapsamalı. Ret kararı iş servisi ve e-posta çağrısından önce verilir.
 * İş kuralları ve atomiklik lib/orders/batches.ts'dedir (değişmedi).
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = z.string().regex(UUID);

const BATCH_ERROR: Record<BatchError, { status: number; message: string }> = {
  not_found: { status: 404, message: "Parti ya da sipariş bulunamadı." },
  invalid_state: { status: 409, message: "Parti ya da sipariş bu işlem için uygun durumda değil." },
  mismatch: { status: 409, message: "Sipariş bu partinin sahasına ya da sezonuna ait değil." },
  capacity_not_held: { status: 409, message: "Kapasitesi ayrılamamış sipariş partiye alınamaz." },
  invalid_date: { status: 400, message: "Tarih geçersiz." },
  empty: { status: 400, message: "Partide işlenecek sipariş yok." },
  unavailable: { status: 503, message: "Veri alınamadı. Lütfen yeniden deneyin." },
};
const batchFail = (error: BatchError, detail?: string | null) =>
  fail(BATCH_ERROR[error].status, error, BATCH_ERROR[error].message, detail ? { detail } : undefined);

const unsupported = (permission: Permission) =>
  fail(403, "scope_unsupported", "Parti yetkiniz yalnız kişiye atanmış işleri kapsıyor; partiler için atama modeli yok.", { permission, permissions: [permission] });

type Ctx = { params: Promise<{ id: string }> };

/** Yazma uçları: oturum + parti okuma kapsamı + kimlik + kapsamdaki parti. */
async function writableBatch(request: NextRequest, params: Ctx["params"]) {
  const guard = await requireAdminAccess(request);
  if (guard.error) return { error: guard.error } as const;
  const read = permissionScope(guard.access, "batches.read");
  if (!read) {
    return {
      error: onlyAssigned(guard.access, "batches.read")
        ? unsupported("batches.read")
        : fail(403, "forbidden", "Partileri okuma yetkiniz yok.", { reason: "missing_permission", permissions: ["batches.read"] }),
    } as const;
  }
  const { id } = await params;
  if (!UUID.test(id)) return { error: fail(400, "invalid_id", "Geçersiz parti kimliği.") } as const;
  return { guard, read, id } as const;
}

async function batchIn(read: NonNullable<ReturnType<typeof permissionScope>>, id: string) {
  const db = createServiceRoleClient();
  const batch = await loadBatchRow(db, read, id);
  if (batch === null) return { error: unavailable() } as const;
  if (batch === "not_found") return { error: fail(404, "not_found", "Parti bulunamadı.") } as const;
  return { db, batch, landId: String(batch.land_id) } as const;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const guard = await requirePermission(request, "batches.read", { scope: "any" });
  if (guard.error) return guard.error;
  const read = permissionScope(guard.access, "batches.read");
  if (!read) return unsupported("batches.read");
  const { id } = await params;
  if (!UUID.test(id)) return fail(400, "invalid_id", "Geçersiz parti kimliği.");

  const found = await batchIn(read, id);
  if ("error" in found) return found.error;
  const detail = await loadBatchDetail(found.db, {
    access: guard.access, read, assurance: guard.assurance, enforced: mfaEnforced(), satisfied: (p) => mfaSatisfied(p, guard.assurance),
  }, found.batch);
  return detail ? ok(detail) : unavailable();
}

const patchSchema = z.object({
  title: z.string().trim().max(120).nullable().optional(),
  plannedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  monitoringReportUrl: z.string().trim().max(500).regex(/^https:\/\/\S+$/).nullable().optional(),
});
const PATCH_COLUMN = { title: "title", plannedOn: "planned_on", notes: "notes", monitoringReportUrl: "monitoring_report_url" } as const;
type PatchField = keyof typeof PATCH_COLUMN;

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const ctx = await writableBatch(request, params);
  if ("error" in ctx) return ctx.error;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(400, "invalid_body", "Geçersiz istek.", { fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "body"))] });
  }
  const found = await batchIn(ctx.read, ctx.id);
  if ("error" in found) return found.error;
  const { db, batch, landId } = found;
  const { guard, id } = ctx;

  // Yalnız gerçekten değişen alanlar (panel formu hepsini gönderir). Boş metin null sayılır.
  const norm = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
  const changes: Partial<Record<PatchField, string | null>> = {};
  for (const field of Object.keys(PATCH_COLUMN) as PatchField[]) {
    const value = parsed.data[field];
    if (value === undefined) continue;
    if (norm(value) !== norm(batch[PATCH_COLUMN[field]])) changes[field] = norm(value);
  }
  const changed = Object.keys(changes) as PatchField[];
  if (!changed.length) {
    const caps = { plan: scopeCovers(permissionScope(guard.access, "batches.plan"), landId), publish: scopeCovers(permissionScope(guard.access, "monitoring.publish"), landId) };
    if (!caps.plan && !caps.publish) return permissionSetResponse({ code: "forbidden", reason: "missing_permission", permissions: ["batches.plan"] });
    const summary = await loadBatchSummary(db, guard.access, batch);
    return summary ? ok({ batch: summary, changed: [] }) : unavailable();
  }

  const required = new Set<Permission>(changed.map((f) => (f === "monitoringReportUrl" ? "monitoring.publish" : "batches.plan")));
  const denial = evaluatePermissionSet(guard.access, guard.assurance, [...required].map((permission) => ({ permission, target: { siteId: landId } })));
  if (denial) return permissionSetResponse(denial);

  const result = await updateBatch(id, changes, db);
  if (!result.ok) return batchFail(result.error, result.detail);
  const warnings = await auditLog(db, {
    admin: guard.admin,
    action: "UPDATE",
    entity: "release_batch",
    entityId: id,
    details: {
      changed,
      ...("monitoringReportUrl" in changes ? { monitoringReportUrl: { from: batch.monitoring_report_url ?? null, to: changes.monitoringReportUrl ?? null } } : {}),
    },
    ip: getClientIP(request),
  });
  const summary = await loadBatchSummary(db, guard.access, result.batch as unknown as Record<string, unknown>);
  if (!summary) {
    return fail(503, "unavailable", "Parti güncellendi ancak güncel kayıt okunamadı. Yenileyin; işlemi tekrarlamayın.", { applied: true });
  }
  return ok({ batch: summary, changed }, warnings);
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), orderIds: z.array(uuid).min(1).max(500) }),
  z.object({ action: z.literal("unassign"), orderId: uuid }),
  z.object({ action: z.literal("release"), releasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ action: z.literal("publish_video"), videoUrl: z.string().trim().min(10).max(300) }),
]);
const ACTION_PERMISSION: Record<z.infer<typeof actionSchema>["action"], Permission> = {
  assign: "batches.assign",
  unassign: "batches.assign",
  release: "batches.release",
  publish_video: "monitoring.publish",
};

export async function POST(request: NextRequest, { params }: Ctx) {
  const ctx = await writableBatch(request, params);
  if ("error" in ctx) return ctx.error;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(400, "invalid_body", "Geçersiz istek.", { fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "body"))] });
  }
  const input = parsed.data;
  const found = await batchIn(ctx.read, ctx.id);
  if ("error" in found) return found.error;
  const { db, landId } = found;
  const { guard, read, id } = ctx;

  const denial = evaluatePermissionSet(guard.access, guard.assurance, [{ permission: ACTION_PERMISSION[input.action], target: { siteId: landId } }]);
  if (denial) return permissionSetResponse(denial);

  // Kaynak siparişler: okuma kapsamında olmalı (değilse yok sayılır → 404) ve atama izni sahalarını kapsamalı.
  if (input.action === "assign" || input.action === "unassign") {
    const ids = input.action === "assign" ? [...new Set(input.orderIds)] : [input.orderId];
    const rows = await sourceOrders(db, read, ids);
    if (!rows) return unavailable();
    if (rows.length !== ids.length) return fail(404, "not_found", "Sipariş bulunamadı.", { missing: ids.length - rows.length });
    const assignScope = permissionScope(guard.access, "batches.assign");
    const outside = rows.filter((o) => !scopeCovers(assignScope, typeof o.land_id === "string" ? o.land_id : null));
    if (outside.length) {
      return fail(403, "forbidden", "Siparişlerden biri atama yetkinizin saha kapsamı dışında.", { reason: "out_of_scope", permissions: ["batches.assign"] });
    }
    // Yanlış parti adresinden başka partinin siparişi çıkarılamaz.
    if (input.action === "unassign" && rows[0].batch_id !== id) {
      return fail(409, "mismatch", "Sipariş bu partide değil.", { reason: "order_not_in_batch" });
    }
  }

  const origin = publicOrigin(request.nextUrl.origin);
  const ip = getClientIP(request);

  if (input.action === "publish_video") {
    const published = await publishBatchVideo(id, input.videoUrl, db);
    const warnings = await auditLog(db, { admin: guard.admin, action: "UPDATE", entity: "release_batch", entityId: id, details: { action: "publish_video", ...published }, ip });
    if (!published.ok) {
      if (published.error === "invalid_url") return fail(400, "invalid_url", "Video: YouTube bağlantısı olmalı.");
      if (published.error === "invalid_state") return fail(409, "invalid_state", "Video yalnız bırakılmış partiye eklenir.");
      return published.error === "not_found" ? fail(404, "not_found", "Parti bulunamadı.") : unavailable();
    }
    // İlk yayımda müşterilere bildirim gider (kalanını zamanlanmış iş tamamlar).
    if (published.firstPublication) after(() => sendPendingVideoEmails(origin));
    return ok({ published: true, firstPublication: published.firstPublication }, warnings);
  }

  const result =
    input.action === "assign"
      ? await assignOrders(id, [...new Set(input.orderIds)], guard.admin.user_id, db)
      : input.action === "unassign"
        ? await unassignOrder(input.orderId, guard.admin.user_id, db)
        : await completeRelease(id, input.releasedOn, guard.admin.user_id, db);
  if (input.action === "release" && result.ok) after(() => sendPendingCertificateEmails(origin));

  const warnings = await auditLog(db, {
    admin: guard.admin,
    action: "UPDATE",
    entity: "release_batch",
    entityId: id,
    details: { action: input.action, ...(result.ok ? result : { ok: false, error: result.error, detail: result.detail ?? null }) },
    ip,
  });
  if (!result.ok) return batchFail(result.error, result.detail);
  const data = Object.fromEntries(Object.entries(result).filter(([key]) => key !== "ok"));
  return ok(data, warnings);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const ctx = await writableBatch(request, params);
  if ("error" in ctx) return ctx.error;
  const found = await batchIn(ctx.read, ctx.id);
  if ("error" in found) return found.error;
  const denial = evaluatePermissionSet(ctx.guard.access, ctx.guard.assurance, [{ permission: "batches.plan", target: { siteId: found.landId } }]);
  if (denial) return permissionSetResponse(denial);

  const result = await deleteBatch(ctx.id, found.db);
  if (!result.ok) return batchFail(result.error, result.detail);
  const warnings = await auditLog(found.db, { admin: ctx.guard.admin, action: "DELETE", entity: "release_batch", entityId: ctx.id, ip: getClientIP(request) });
  return ok({ deleted: true, id: ctx.id }, warnings);
}
