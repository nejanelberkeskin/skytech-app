import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";

// GET — Tüm arazileri listele
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request, ["SUPER_ADMIN", "ENGINEER"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("lands")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST — Yeni arazi ekle
export async function POST(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN", "ENGINEER"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const body = await req.json();

  const { name, region, capacity_seeds, is_public } = body;

  if (!name || !capacity_seeds) {
    return NextResponse.json(
      { error: "name ve capacity_seeds zorunludur." },
      { status: 400 }
    );
  }

  if (Number(capacity_seeds) <= 0) {
    return NextResponse.json(
      { error: "Kapasite 0'dan büyük olmalıdır." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("lands")
    .insert({
      name: name.trim(),
      region: region?.trim() || null,
      capacity_seeds: Number(capacity_seeds),
      filled_seeds: 0,
      reserved_seeds: 0,
      status: "open",
      is_public: is_public ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(supabase, {
    admin: admin!,
    action: "CREATE",
    entity: "land",
    entityId: data.id,
    details: { name, region, capacity_seeds, is_public },
    ip: getClientIP(req),
  });

  return NextResponse.json(data, { status: 201 });
}

// PUT — Arazi güncelle (kapasite, bölge, bakım modu, is_public)
export async function PUT(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN", "ENGINEER"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const body = await req.json();
  const { id, name, region, capacity_seeds, is_public, maintenance } = body;

  if (!id) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  }

  // Mevcut arazi verisi
  const { data: existing, error: fetchErr } = await supabase
    .from("lands")
    .select("filled_seeds, reserved_seeds")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Arazi bulunamadı." }, { status: 404 });
  }

  if (capacity_seeds != null) {
    const minRequired = existing.filled_seeds + existing.reserved_seeds;
    if (Number(capacity_seeds) < minRequired) {
      return NextResponse.json(
        {
          error: `Kapasite ${minRequired.toLocaleString("tr-TR")}'den az olamaz (mevcut ekili + rezerve).`,
        },
        { status: 400 }
      );
    }
  }

  const updates: Record<string, unknown> = {};
  if (name != null)           updates.name = name.trim();
  if (region != null)         updates.region = region.trim() || null;
  if (capacity_seeds != null) updates.capacity_seeds = Number(capacity_seeds);
  if (is_public != null)      updates.is_public = is_public;
  // Bakım modu: is_public = false + status = "full" → kapalı
  if (maintenance === true) {
    updates.is_public = false;
    updates.status = "full";
  } else if (maintenance === false) {
    updates.is_public = true;
    updates.status = "open";
  }

  const { data, error } = await supabase
    .from("lands")
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
    entity: "land",
    entityId: id,
    details: updates,
    ip: getClientIP(req),
  });

  return NextResponse.json(data);
}

// DELETE — Arazi sil (sadece boş arazileri sil)
export async function DELETE(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  }

  // Önce arazi verilerini kontrol et
  const { data: land, error: fetchErr } = await supabase
    .from("lands")
    .select("filled_seeds, reserved_seeds, name")
    .eq("id", id)
    .single();

  if (fetchErr || !land) {
    return NextResponse.json({ error: "Arazi bulunamadı." }, { status: 404 });
  }

  if (land.filled_seeds > 0 || land.reserved_seeds > 0) {
    return NextResponse.json(
      {
        error: `"${land.name}" arazisinde ${land.filled_seeds} ekili ve ${land.reserved_seeds} rezerve tohum bulunmaktadır. Silmeden önce tüm tohumları temizleyin.`,
      },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("lands").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(supabase, {
    admin: admin!,
    action: "DELETE",
    entity: "land",
    entityId: id,
    details: { name: land.name },
    ip: getClientIP(req),
  });

  return NextResponse.json({ success: true });
}
