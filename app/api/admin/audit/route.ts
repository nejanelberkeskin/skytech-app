import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { maskAuditDetails } from "@/lib/admin/audit-read";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ok, unavailable } from "@/lib/api/envelope";

/**
 * GET /api/admin/audit — işlem kaydı (web-brifler/19 §6.4). İzin: audit.read.
 * Hassas alanlar maskelenir; parola, belirteç, anahtar ve tam kimlik/vergi numarası dönmez.
 */
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "audit.read");
  if (guard.error) return guard.error;
  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number.parseInt(params.get("limit") ?? "50", 10) || 50, 1), 200);
  const db = createServiceRoleClient();
  let query = db
    .from("admin_audit_logs")
    .select("id, created_at, admin_id, admin_email, action, entity, entity_id, details, ip_address")
    .order("created_at", { ascending: false })
    .limit(limit);
  for (const [key, column] of [["entity", "entity"], ["entityId", "entity_id"], ["action", "action"], ["actorId", "admin_id"]] as const) {
    const value = params.get(key);
    if (value) query = query.eq(column, value);
  }
  const from = params.get("from");
  const to = params.get("to");
  if (from && ISO.test(from)) query = query.gte("created_at", from);
  if (to && ISO.test(to)) query = query.lte("created_at", to);
  const cursor = params.get("cursor");
  if (cursor && ISO.test(cursor)) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) return unavailable();
  const entries = (data ?? []).map((row) => ({
    id: row.id as string,
    at: new Date(row.created_at as string).toISOString(),
    actor: { id: row.admin_id as string, label: (row.admin_email as string) ?? "" },
    action: row.action as string,
    entity: row.entity as string,
    entityId: (row.entity_id as string) ?? null,
    details: maskAuditDetails(row.details),
    ip: (row.ip_address as string) ?? null,
  }));
  return ok({ entries, nextCursor: entries.length === limit ? entries[entries.length - 1].at : null });
}
