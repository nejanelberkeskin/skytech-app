import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import type { UserRole } from "@/lib/rbac";

const VALID_ROLES: UserRole[] = ["SUPER_ADMIN", "FINANCE", "OPERATIONS", "ENGINEER"];

/** Cryptographically secure temp password — Math.random tahmin edilebilir. */
function generateTempPassword(): string {
  // 16 base64url char ≈ 96 bit entropy. Skytech@ prefix Supabase'in karmaşıklık
  // şartını karşılar (büyük/küçük harf + sembol + sayı garantisi).
  return "Skytech@" + randomBytes(12).toString("base64url");
}

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
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const { email, full_name, role, password } = body as Record<string, unknown>;

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof full_name !== "string" || !full_name.trim() || full_name.length > 120 || typeof role !== "string" || (password != null && typeof password !== "string")) {
    return NextResponse.json(
      { error: "email, full_name ve role zorunludur." },
      { status: 400 }
    );
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  // Aynı e-posta zaten admin_users'da var mı?
  const { data: existing, error: existingError } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: "Personel kaydı kontrol edilemedi." }, { status: 503 });
  if (existing) {
    return NextResponse.json(
      { error: "Bu e-posta adresi zaten sistemde kayıtlı." },
      { status: 409 }
    );
  }

  // Supabase Auth'ta kullanıcı oluştur (crypto-secure temp password)
  const tempPassword = password || generateTempPassword();

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
    let found: { id: string } | undefined;
    for (let page = 1; !found; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return NextResponse.json({ error: "Kullanıcı listesi alınamadı." }, { status: 503 });
      found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim());
      if (data.users.length < 1000) break;
    }
    if (!found) {
      return NextResponse.json(
        { error: "Auth kullanıcısı oluşturulamadı." },
        { status: 500 }
      );
    }

    const { data: adminRecord, error: insertErr } = await supabase.rpc("create_admin_user", {
      p_actor: admin!.user_id, p_user: found.id, p_email: email.toLowerCase().trim(), p_name: full_name.trim(), p_role: role,
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json(
      { ...adminRecord, temp_password: undefined },
      { status: 201 }
    );
  }

  // admin_users tablosuna kayıt ekle
  if (!authUser?.user) {
    return NextResponse.json({ error: "Auth kullanıcısı oluşturulamadı." }, { status: 500 });
  }

  const { data: adminRecord, error: insertErr } = await supabase.rpc("create_admin_user", {
    p_actor: admin!.user_id, p_user: authUser.user.id, p_email: email.toLowerCase().trim(), p_name: full_name.trim(), p_role: role,
  });

  if (insertErr) {
    // Auth kaydını geri al
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

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
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const { id, role, is_active, full_name } = body as Record<string, unknown>;

  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  }

  if (role != null && !VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  if ((is_active != null && typeof is_active !== "boolean") || (full_name != null && (typeof full_name !== "string" || !full_name.trim() || full_name.length > 120))) return NextResponse.json({ error: "Geçersiz alan." }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (role != null)      updates.role = role;
  if (is_active != null) updates.is_active = is_active;
  if (full_name != null) updates.full_name = full_name.trim();

  const { data, error } = await supabase.rpc("mutate_admin_user", {
    p_actor: admin!.user_id, p_id: id, p_patch: updates, p_delete: false,
  });
  if (error) return NextResponse.json({ error: error.message.includes("last_active_super_admin") ? "Sistemde en az bir aktif Super Admin bulunmalıdır." : "Güncelleme kaydedilemedi." }, { status: error.message.includes("last_active_super_admin") ? 409 : 503 });
  if (!data) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  // Rol değiştiyse auth metadata'yı da güncelle
  if (role && data?.user_id) {
    await supabase.auth.admin.updateUserById(data.user_id, {
      user_metadata: { role },
    });
  }

  return NextResponse.json(data);
}

// ── DELETE — Personeli sistemden kaldır ──────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const { id } = body as Record<string, unknown>;

  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("mutate_admin_user", {
    p_actor: admin!.user_id, p_id: id, p_patch: {}, p_delete: true,
  });
  if (error) return NextResponse.json({ error: error.message.includes("last_active_super_admin") ? "Sistemde en az bir aktif Super Admin bulunmalıdır." : "Silme işlemi kaydedilemedi." }, { status: error.message.includes("last_active_super_admin") ? 409 : 503 });
  if (!data) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  return NextResponse.json({ success: true });
}
