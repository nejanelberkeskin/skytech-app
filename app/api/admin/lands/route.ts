import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";
import { siteAdminSchema, siteFieldErrors, toLandRow } from "@/lib/sites/admin";
import { slugify } from "@/lib/sites/slug";

/**
 * /api/admin/lands — Proje Uygulama Sahaları yönetimi (SUPER_ADMIN, ENGINEER).
 *
 * GET              → saha listesi; `?include=species` ile tür seçenekleri de döner
 * POST             → yeni saha (şema: lib/sites/admin.ts — panel formuyla ortak)
 * PUT              → { id, maintenance } hızlı yayından alma/açma  YA DA  { id, ...tam form }
 * DELETE           → yalnız boş saha (SUPER_ADMIN)
 *
 * Kapasite sayıları yalnız bu uçta ve panelde görünür; vitrine hiçbir yoldan çıkmaz.
 */

const ROLES = ["SUPER_ADMIN", "ENGINEER"] as const;

// GET — Tüm sahaları listele
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request, [...ROLES]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("lands")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (request.nextUrl.searchParams.get("include") !== "species") {
    return NextResponse.json(data);
  }

  // Tür seçenekleri: katalogdaki tüm türler (pasif olan da seçilebilir; satış değil, bilgi alanı).
  const { data: species } = await supabase
    .from("seed_catalog")
    .select("slug, name, latin_name")
    .order("sort_order", { ascending: true });
  return NextResponse.json({ lands: data, species: species ?? [] });
}

/** Seçilen türlerin katalogda var olduğunu doğrular; olmayanları döner. */
async function unknownSpecies(supabase: SupabaseClient, slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const { data } = await supabase.from("seed_catalog").select("slug").in("slug", slugs);
  const known = new Set((data ?? []).map((r) => r.slug as string));
  return slugs.filter((s) => !known.has(s));
}

/** Boşta bir adres bulur: `ad`, `ad-2`, `ad-3`… (`exceptId`: düzenlenen kaydın kendisi). */
async function freeSlug(supabase: SupabaseClient, base: string, exceptId?: string): Promise<string | null> {
  const root = base || "saha";
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    let query = supabase.from("lands").select("id").eq("slug", candidate).limit(1);
    if (exceptId) query = query.neq("id", exceptId);
    const { data, error } = await query;
    if (error) return null;
    if (!data || data.length === 0) return candidate;
  }
  return null;
}

// POST — Yeni saha ekle
export async function POST(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, [...ROLES]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();

  const parsed = siteAdminSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = siteFieldErrors(parsed.error.issues);
    return NextResponse.json({ error: Object.values(fields)[0] ?? "Geçersiz veri.", fields }, { status: 400 });
  }
  const data = parsed.data;

  const missing = await unknownSpecies(supabase, data.species_slugs);
  if (missing.length) {
    return NextResponse.json(
      { error: `Katalogda olmayan tür: ${missing.join(", ")}`, fields: { species_slugs: "Katalogda olmayan tür seçildi." } },
      { status: 400 }
    );
  }

  // Adres verilmişse aynen kullanılmak istenir → doluysa hata; verilmemişse addan üretilir.
  let slug: string | null;
  if (data.slug) {
    slug = (await freeSlug(supabase, data.slug)) === data.slug ? data.slug : null;
    if (!slug) {
      return NextResponse.json(
        { error: "Bu adres başka bir sahada kullanılıyor.", fields: { slug: "Bu adres kullanılıyor." } },
        { status: 409 }
      );
    }
  } else {
    slug = await freeSlug(supabase, slugify(data.name));
    if (!slug) return NextResponse.json({ error: "Adres üretilemedi." }, { status: 500 });
  }

  const { data: row, error } = await supabase
    .from("lands")
    .insert({ ...toLandRow(data), slug, filled_seeds: 0, reserved_seeds: 0 })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const warnings = await auditLog(supabase, {
    admin: admin!,
    action: "CREATE",
    entity: "land",
    entityId: row.id,
    details: { name: data.name, slug, province: data.province, status: data.status, is_public: data.is_public },
    ip: getClientIP(req),
  });

  return NextResponse.json({ ...row, warnings }, { status: 201 });
}

// PUT — Saha güncelle (tam form) ya da hızlı yayından alma/açma
export async function PUT(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, [...ROLES]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";

  if (!id) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("lands")
    .select("filled_seeds, reserved_seeds, slug")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Saha bulunamadı." }, { status: 404 });
  }

  let updates: Record<string, unknown>;

  if (typeof body?.maintenance === "boolean") {
    // Hızlı düğme: yayından al (listelenmez, talep alınmaz) / yeniden yayına al.
    // Durum (evre) değişmez; "full" artık vitrinde "Kontenjan doldu" anlamına geliyor.
    updates = { is_public: !body.maintenance };
  } else {
    const parsed = siteAdminSchema.safeParse(body);
    if (!parsed.success) {
      const fields = siteFieldErrors(parsed.error.issues);
      return NextResponse.json({ error: Object.values(fields)[0] ?? "Geçersiz veri.", fields }, { status: 400 });
    }
    const data = parsed.data;

    const minRequired = (existing.filled_seeds ?? 0) + (existing.reserved_seeds ?? 0);
    if (data.capacity_seeds < minRequired) {
      const message = `Kapasite ${minRequired.toLocaleString("tr-TR")}'den az olamaz (bırakılan + ayrılan).`;
      return NextResponse.json({ error: message, fields: { capacity_seeds: message } }, { status: 400 });
    }

    const missing = await unknownSpecies(supabase, data.species_slugs);
    if (missing.length) {
      return NextResponse.json(
        { error: `Katalogda olmayan tür: ${missing.join(", ")}`, fields: { species_slugs: "Katalogda olmayan tür seçildi." } },
        { status: 400 }
      );
    }

    // Adres: boşsa mevcut korunur (yoksa addan üretilir); değiştiyse boşta olmalı.
    let slug = (existing.slug as string | null) ?? null;
    if (data.slug && data.slug !== slug) {
      if ((await freeSlug(supabase, data.slug, id)) !== data.slug) {
        return NextResponse.json(
          { error: "Bu adres başka bir sahada kullanılıyor.", fields: { slug: "Bu adres kullanılıyor." } },
          { status: 409 }
        );
      }
      slug = data.slug;
    } else if (!slug) {
      slug = await freeSlug(supabase, slugify(data.name), id);
    }

    updates = { ...toLandRow(data), slug };
  }

  const { data: row, error } = await supabase.from("lands").update(updates).eq("id", id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const warnings = await auditLog(supabase, {
    admin: admin!,
    action: "UPDATE",
    entity: "land",
    entityId: id,
    details: updates,
    ip: getClientIP(req),
  });

  return NextResponse.json({ ...row, warnings });
}

// DELETE — Saha sil (yalnız boş sahalar)
export async function DELETE(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  }

  const { data: land, error: fetchErr } = await supabase
    .from("lands")
    .select("filled_seeds, reserved_seeds, name")
    .eq("id", id)
    .single();

  if (fetchErr || !land) {
    return NextResponse.json({ error: "Saha bulunamadı." }, { status: 404 });
  }

  if (land.filled_seeds > 0 || land.reserved_seeds > 0) {
    return NextResponse.json(
      {
        error: `"${land.name}" sahasında ${land.filled_seeds} bırakılmış ve ${land.reserved_seeds} ayrılmış tohum topu kaydı var; silinemez. Yayından almak için "Yayından al" düğmesini kullanın.`,
      },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("lands").delete().eq("id", id);

  if (error) {
    // Talep ya da sipariş kaydı bu sahaya bağlıysa (FK) silinemez.
    const message =
      error.code === "23503"
        ? `"${land.name}" sahasına bağlı talep ya da sipariş kaydı var; silinemez. Yayından almak için "Yayından al" düğmesini kullanın.`
        : error.message;
    return NextResponse.json({ error: message }, { status: error.code === "23503" ? 409 : 500 });
  }

  const warnings = await auditLog(supabase, {
    admin: admin!,
    action: "DELETE",
    entity: "land",
    entityId: id,
    details: { name: land.name },
    ip: getClientIP(req),
  });

  return NextResponse.json({ success: true, warnings });
}
