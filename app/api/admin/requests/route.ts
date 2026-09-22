import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";
import { REQUEST_STATUSES, REQUEST_TYPES } from "@/lib/requests/schema";
import type { ServiceRequestStatus } from "@/lib/types";

/**
 * Admin — Talep yönetimi
 *
 * GET   /api/admin/requests?status=&type=&q=&page=&pageSize=
 *       → { items, total, page, pageSize, counts }
 * PATCH /api/admin/requests  { id, status?, adminNote? }
 *       → { ok, item }
 *
 * Roller: SUPER_ADMIN, FINANCE, OPERATIONS (lib/rbac.ts "talepler" modülü).
 * Her PATCH admin_audit_logs'a yazılır.
 */

const ROLES = ["SUPER_ADMIN", "FINANCE", "OPERATIONS"] as const;
// ip_hash / client_token / user_agent panele taşınmaz — iş için gerekmez.
const SELECT = [
  "id", "request_no", "type", "status", "user_id", "contact_name", "email", "phone", "company",
  "locale", "land_id", "total_seeds", "seed_items", "details", "message", "consent_at",
  "consent_version", "source_path", "admin_note", "handled_by", "handled_at", "created_at", "updated_at",
  "land:lands(name, region)",
].join(", ");

/** PostgREST filtre sözdizimine karışabilecek karakterleri at; boşsa null. */
function sanitizeSearch(q: string | null): string | null {
  if (!q) return null;
  const clean = q.replace(/[^\p{L}\p{N}@+.\s-]/gu, "").trim().slice(0, 60);
  return clean.length >= 2 ? clean : null;
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request, [...ROLES]);
  if (authError) return authError;

  const sp = new URL(request.url).searchParams;
  const status = sp.get("status");
  const type = sp.get("type");
  const q = sanitizeSearch(sp.get("q"));
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(sp.get("pageSize") ?? "25", 10) || 25));

  if (status && !(REQUEST_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  if (type && !(REQUEST_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  let query = supabase
    .from("service_requests")
    .select(SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (q) {
    // Talep numarası büyük harfe çevrilir; telefon "0532…" yazılırsa baştaki 0
    // atılır (kayıtlar +90… biçiminde). Diğer alanlarda ilike.
    const like = `%${q}%`;
    const digits = q.replace(/[^\d]/g, "").replace(/^0+/, "");
    const filters = [
      `request_no.ilike.${like.toUpperCase()}`,
      `contact_name.ilike.${like}`,
      `email.ilike.${like}`,
      `company.ilike.${like}`,
    ];
    if (digits.length >= 3) filters.push(`phone.ilike.%${digits}%`);
    query = query.or(filters.join(","));
  }

  const [listRes, ...countRes] = await Promise.all([
    query,
    ...REQUEST_STATUSES.map((s) =>
      supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", s)
    ),
  ]);

  if (listRes.error) {
    console.error("[admin/requests] liste hatası:", listRes.error.message);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const counts = Object.fromEntries(
    REQUEST_STATUSES.map((s, i) => [s, countRes[i].count ?? 0])
  ) as Record<ServiceRequestStatus, number>;

  return NextResponse.json({
    items: listRes.data ?? [],
    total: listRes.count ?? 0,
    page,
    pageSize,
    counts,
  });
}

export async function PATCH(request: NextRequest) {
  const { admin, error: authError } = await requireAdmin(request, [...ROLES]);
  if (authError || !admin) return authError ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { id?: unknown; status?: unknown; adminNote?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !(REQUEST_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (body.adminNote !== undefined) {
    if (typeof body.adminNote !== "string" || body.adminNote.length > 4000) {
      return NextResponse.json({ error: "invalid_note" }, { status: 400 });
    }
    patch.admin_note = body.adminNote.trim() || null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }
  patch.handled_by = admin.user_id;
  patch.handled_at = new Date().toISOString();

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("service_requests")
    .update(patch)
    .eq("id", id)
    .select(SELECT)
    .maybeSingle();

  if (error) {
    console.error("[admin/requests] güncelleme hatası:", error.message);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const warnings = await auditLog(supabase, {
    admin,
    action: "UPDATE",
    entity: "service_request",
    entityId: id,
    details: { status: patch.status ?? null, adminNoteChanged: body.adminNote !== undefined },
    ip: getClientIP(request),
  });

  return NextResponse.json({ ok: true, item: data, warnings });
}
