import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";

// GET — Tüm ürünleri listele
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request, ["SUPER_ADMIN", "OPERATIONS"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("seed_catalog")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST — Yeni ürün ekle
export async function POST(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN", "OPERATIONS"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const body = await req.json();

  const { slug, name, latin_name, emoji, color, description, price, stock, max_order_qty, is_active, sort_order } = body;

  if (!slug || !name || price == null) {
    return NextResponse.json({ error: "slug, name ve price zorunludur." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("seed_catalog")
    .insert({
      slug,
      name,
      latin_name: latin_name || "",
      emoji: emoji || "🌱",
      color: color || "from-green-600 to-green-800",
      description: description || "",
      price,
      stock: stock ?? 0,
      max_order_qty: max_order_qty ?? 500,
      is_active: is_active ?? true,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(supabase, {
    admin: admin!,
    action: "CREATE",
    entity: "catalog",
    entityId: data.id,
    details: { slug, name, price, stock, is_active },
    ip: getClientIP(req),
  });

  return NextResponse.json(data, { status: 201 });
}

// PUT — Ürün güncelle
export async function PUT(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN", "OPERATIONS"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("seed_catalog")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(supabase, {
    admin: admin!,
    action: "UPDATE",
    entity: "catalog",
    entityId: id,
    details: updates,
    ip: getClientIP(req),
  });

  return NextResponse.json(data);
}

// DELETE — Ürün sil
export async function DELETE(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  }

  const { error } = await supabase
    .from("seed_catalog")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(supabase, {
    admin: admin!,
    action: "DELETE",
    entity: "catalog",
    entityId: id,
    details: {},
    ip: getClientIP(req),
  });

  return NextResponse.json({ success: true });
}
