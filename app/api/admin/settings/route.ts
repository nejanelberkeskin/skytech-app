import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";

// GET — Sistem ayarlarını getir
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request, ["SUPER_ADMIN"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// PUT — Sistem ayarlarını güncelle
export async function PUT(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const body = await req.json();

  const { reservation_ttl_minutes, maintenance_mode, overflow_tolerance_pct, updated_by } = body;

  // Tek satırlık tabloyu güncelle
  const { data: existing } = await supabase
    .from("system_settings")
    .select("id")
    .limit(1)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Ayarlar kaydı bulunamadı." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (reservation_ttl_minutes != null) updates.reservation_ttl_minutes = reservation_ttl_minutes;
  if (maintenance_mode != null) updates.maintenance_mode = maintenance_mode;
  if (overflow_tolerance_pct != null) updates.overflow_tolerance_pct = overflow_tolerance_pct;
  if (updated_by) updates.updated_by = updated_by;

  const { data, error } = await supabase
    .from("system_settings")
    .update(updates)
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(supabase, {
    admin: admin!,
    action: "UPDATE",
    entity: "setting",
    entityId: existing.id,
    details: updates,
    ip: getClientIP(req),
  });

  return NextResponse.json(data);
}
