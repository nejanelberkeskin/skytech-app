import type { NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getClientIP } from "@/lib/admin-auth";
import { requirePermission } from "@/lib/admin/permissions";
import { onlyAssigned, permissionScope } from "@/lib/admin/record-scope";
import { auditLog } from "@/lib/admin/audit";
import { fail, ok, unavailable } from "@/lib/api/envelope";
import { loadRequestList, sanitizeRequestSearch, updateRequest } from "@/lib/requests/admin-read";
import type { RequestStatus, RequestType } from "@/lib/requests/admin-dto";
import { REQUEST_STATUSES, REQUEST_TYPES } from "@/lib/requests/schema";

/**
 * Admin — Talep yönetimi. Sözleşme: web-brifler/29.
 *
 * GET   /api/admin/requests?status=&type=&q=&page=&pageSize= → Ok<RequestListDto>
 *       İzin: requests.read (all ya da sites; sahasız talep yalnız all). İletişim alanları ayrıca
 *       customers.contact.read ile ve kayıt bazında kapsamla; kapsam dışı iletişim sorgulanmaz.
 * PATCH /api/admin/requests  { id, status?, adminNote? } → Ok<RequestItem>
 *       İzin: requests.update; kayıt güncelleme kapsamında olmalı (sorgu içinde denetlenir).
 *       `handled_by` son işlem yapandır, atama değildir. Her PATCH admin_audit_logs'a yazılır.
 */
export const dynamic = "force-dynamic";

const unsupported = (permission: string) =>
  fail(403, "scope_unsupported", "Talep yetkiniz yalnız kişiye atanmış işleri kapsıyor; talepler için atama modeli henüz yok.", { permission, permissions: [permission] });

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "requests.read", { scope: "any" });
  if (guard.error) return guard.error;
  const read = permissionScope(guard.access, "requests.read");
  if (!read) return unsupported("requests.read");

  const sp = new URL(request.url).searchParams;
  const status = sp.get("status");
  const type = sp.get("type");
  const invalid = (param: string) => fail(400, "invalid_query", "Geçersiz sorgu parametresi.", { param });
  if (status && !(REQUEST_STATUSES as readonly string[]).includes(status)) return invalid("status");
  if (type && !(REQUEST_TYPES as readonly string[]).includes(type)) return invalid("type");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(sp.get("pageSize") ?? "25", 10) || 25));

  const list = await loadRequestList(createServiceRoleClient(), guard.access, read, {
    status: (status as RequestStatus | null) ?? null,
    type: (type as RequestType | null) ?? null,
    q: sanitizeRequestSearch(sp.get("q")),
    page,
    pageSize,
  });
  if (!list) {
    console.error("[admin/requests] liste okunamadı");
    return unavailable();
  }
  return ok(list);
}

const patchSchema = z
  .object({
    id: z.string().trim().regex(/^[0-9a-f-]{36}$/i),
    status: z.enum(REQUEST_STATUSES).optional(),
    adminNote: z.string().max(4000).optional(),
  })
  .strict()
  .refine((b) => b.status !== undefined || b.adminNote !== undefined, { message: "nothing_to_update", path: ["body"] });

export async function PATCH(request: NextRequest) {
  const guard = await requirePermission(request, "requests.update", { scope: "any" });
  if (guard.error) return guard.error;
  if (!permissionScope(guard.access, "requests.update")) return unsupported("requests.update");
  // Güncellenen kaydı okuyabilmek için okuma izni de gerekir (yanıt aynı DTO'dur).
  const read = permissionScope(guard.access, "requests.read");
  if (!read) {
    return onlyAssigned(guard.access, "requests.read")
      ? unsupported("requests.read")
      : fail(403, "forbidden", "Talepleri okuma yetkiniz yok.", { reason: "missing_permission", permissions: ["requests.read"], permission: "requests.read" });
  }

  const raw = await request.json().catch(() => null);
  const body = patchSchema.safeParse(raw);
  if (!body.success) {
    return fail(400, "invalid_body", "Geçersiz istek: kimlik ve en az bir alan (durum ya da not) gerekli.", {
      fields: [...new Set(body.error.issues.map((i) => i.path.join(".") || "body"))],
    });
  }
  const patch = {
    ...(body.data.status !== undefined ? { status: body.data.status } : {}),
    ...(body.data.adminNote !== undefined ? { admin_note: body.data.adminNote.trim() || null } : {}),
  };

  const supabase = createServiceRoleClient();
  const result = await updateRequest(supabase, guard.access, read, guard.admin.user_id, body.data.id, patch);
  if (!result.ok) {
    if (result.error === "not_found") return fail(404, "not_found", "Talep bulunamadı.");
    if (result.error === "out_of_scope") {
      return fail(403, "forbidden", "Bu talep güncelleme yetkinizin saha kapsamı dışında.", { reason: "out_of_scope", permissions: ["requests.update"] });
    }
    return unavailable();
  }

  // Güncelleme uygulandı: audit her durumda yazılır (yeniden okuma başarısız olsa bile).
  const warnings = await auditLog(supabase, {
    admin: guard.admin,
    action: "UPDATE",
    entity: "service_request",
    entityId: body.data.id,
    details: { status: body.data.status ?? null, adminNoteChanged: body.data.adminNote !== undefined },
    ip: getClientIP(request),
  });
  if (!result.item) {
    return fail(503, "unavailable", "Güncelleme kaydedildi ancak güncel kayıt okunamadı. Listeyi yenileyin; işlemi tekrarlamayın.", { applied: true });
  }
  return ok(result.item, warnings);
}
