import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";
import type { UserRole } from "@/lib/rbac";

const VALID_ROLES: UserRole[] = ["SUPER_ADMIN", "FINANCE", "OPERATIONS", "ENGINEER"];

// ── GET — Tüm admin personeli listele ────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request, ["SUPER_ADMIN"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

// ── POST — Yeni personel davet et ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const body = await req.json();
  const { email, full_name, role, password } = body;

  if (!email || !full_name || !role) {
    return NextResponse.json(
      { error: "email, full_name ve role zorunludur." },
      { status: 400 }
    );
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  // Aynı e-posta zaten admin_users'da var mı?
  const { data: existing } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Bu e-posta adresi zaten sistemde kayıtlı." },
      { status: 409 }
    );
  }

  // Supabase Auth'ta kullanıcı oluştur
  const tempPassword = password || `Skytech@${Math.random().toString(36).slice(2, 10)}`;

  const { data: authUser, error: createAuthErr } = await supabase.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: full_name.trim(), role },
  });

  if (createAuthErr) {
    // Auth kullanıcısı zaten varsa direkt admin_users'a ekle
    if (!createAuthErr.message.includes("already registered")) {
      return NextResponse.json({ error: createAuthErr.message }, { status: 500 });
    }
    // Mevcut auth kullanıcısını e-posta ile bul
    const { data: existingAuth } = await supabase.auth.admin.listUsers();
    const found = existingAuth?.users.find(
      (u) => u.email === email.toLowerCase().trim()
    );
    if (!found) {
      return NextResponse.json(
        { error: "Auth kullanıcısı oluşturulamadı." },
        { status: 500 }
      );
    }

    const { data: adminRecord, error: insertErr } = await supabase
      .from("admin_users")
      .insert({
        user_id: found.id,
        email: email.toLowerCase().trim(),
        full_name: full_name.trim(),
        role,
        is_active: true,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    await auditLog(supabase, {
      admin: admin!,
      action: "CREATE",
      entity: "admin_user",
      entityId: adminRecord.id,
      details: { email, full_name, role },
      ip: getClientIP(req),
    });

    return NextResponse.json(
      { ...adminRecord, temp_password: undefined },
      { status: 201 }
    );
  }

  // admin_users tablosuna kayıt ekle
  if (!authUser?.user) {
    return NextResponse.json({ error: "Auth kullanıcısı oluşturulamadı." }, { status: 500 });
  }

  const { data: adminRecord, error: insertErr } = await supabase
    .from("admin_users")
    .insert({
      user_id: authUser.user.id,
      email: email.toLowerCase().trim(),
      full_name: full_name.trim(),
      role,
      is_active: true,
    })
    .select()
    .single();

  if (insertErr) {
    // Auth kaydını geri al
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await auditLog(supabase, {
    admin: admin!,
    action: "CREATE",
    entity: "admin_user",
    entityId: adminRecord.id,
    details: { email, full_name, role },
    ip: getClientIP(req),
  });

  return NextResponse.json(
    { ...adminRecord, temp_password: tempPassword },
    { status: 201 }
  );
}

// ── PUT — Rol veya durum güncelle ─────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const body = await req.json();
  const { id, role, is_active, full_name } = body;

  if (!id) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  }

  if (role && !VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (role != null)      updates.role = role;
  if (is_active != null) updates.is_active = is_active;
  if (full_name != null) updates.full_name = full_name.trim();

  const { data, error } = await supabase
    .from("admin_users")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Rol değiştiyse auth metadata'yı da güncelle
  if (role && data?.user_id) {
    await supabase.auth.admin.updateUserById(data.user_id, {
      user_metadata: { role },
    });
  }

  await auditLog(supabase, {
    admin: admin!,
    action: "UPDATE",
    entity: "admin_user",
    entityId: id,
    details: updates,
    ip: getClientIP(req),
  });

  return NextResponse.json(data);
}

// ── DELETE — Personeli sistemden kaldır ──────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  }

  // Önce admin kaydını bul (user_id için)
  const { data: adminUser, error: fetchErr } = await supabase
    .from("admin_users")
    .select("user_id, role, email")
    .eq("id", id)
    .single();

  if (fetchErr || !adminUser) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  if (adminUser.role === "SUPER_ADMIN") {
    // Diğer süper adminlerin sayısını kontrol et
    const { count } = await supabase
      .from("admin_users")
      .select("id", { count: "exact" })
      .eq("role", "SUPER_ADMIN")
      .eq("is_active", true);

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Sistemde en az bir aktif Super Admin bulunmalıdır." },
        { status: 409 }
      );
    }
  }

  const { error: deleteErr } = await supabase
    .from("admin_users")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  await auditLog(supabase, {
    admin: admin!,
    action: "DELETE",
    entity: "admin_user",
    entityId: id,
    details: { email: adminUser.email, role: adminUser.role },
    ip: getClientIP(req),
  });

  return NextResponse.json({ success: true });
}
