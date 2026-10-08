/**
 * Saha yönetimi veri erişimi — YALNIZ SUNUCU. Sözleşme: web-brifler/30.
 *
 * Okuma kapsamı sorguya eklenir (`lands.id`). Güncelleme yalnız değişen kolonları yazar; izin kararının
 * dayandığı alanlar (`is_public`, `status`; kapasite değişiyorsa bırakılan/ayrılan adetler) UPDATE koşuluna
 * girer: arada değiştiyse güncelleme uygulanmaz (`conflict`). Kapasite ayırma işlemi (016) değişmedi.
 * Hata `null`/`unavailable` döner; sahte boş liste yok.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EffectiveAccess } from "@/lib/admin/permissions";
import { permissionScope, scopeCovers, type RecordScope } from "@/lib/admin/record-scope";
import type { SiteChanges } from "./admin-access";
import { SITE_ADMIN_COLUMNS, type SiteAdminItem, type SiteSpeciesOption } from "./admin-dto";

type Db = SupabaseClient;
type Row = Record<string, unknown>;

export function siteCapabilities(access: EffectiveAccess, siteId: string): SiteAdminItem["capabilities"] {
  return {
    edit: scopeCovers(permissionScope(access, "sites.edit"), siteId),
    publish: scopeCovers(permissionScope(access, "sites.publish"), siteId),
    capacity: scopeCovers(permissionScope(access, "sites.capacity.manage"), siteId),
  };
}

export async function loadSiteRows(db: Db, read: RecordScope): Promise<Row[] | null> {
  let q = db.from("lands").select(SITE_ADMIN_COLUMNS).order("sort_order", { ascending: true }).order("name", { ascending: true });
  if (read.kind === "sites") q = q.in("id", read.siteIds);
  const { data, error } = await q;
  return error ? null : ((data ?? []) as unknown as Row[]);
}

export async function loadSpeciesOptions(db: Db): Promise<SiteSpeciesOption[] | null> {
  const { data, error } = await db.from("seed_catalog").select("slug, name, latin_name").order("sort_order", { ascending: true });
  if (error) return null;
  return ((data ?? []) as Row[]).map((r) => ({
    slug: String(r.slug),
    name: typeof r.name === "string" ? r.name : String(r.slug),
    latinName: typeof r.latin_name === "string" ? r.latin_name : null,
  }));
}

/** Okuma kapsamındaki tek saha; yok ya da kapsam dışı → "not_found" (varlık sızmaz); hata → null. */
export async function loadSiteRow(db: Db, read: RecordScope, id: string): Promise<Row | "not_found" | null> {
  let q = db.from("lands").select(SITE_ADMIN_COLUMNS).eq("id", id);
  if (read.kind === "sites") q = q.in("id", read.siteIds);
  const { data, error } = await q.maybeSingle();
  if (error) return null;
  return data ? (data as unknown as Row) : "not_found";
}

/** Katalogda olmayan türler; okuma hatası → null. */
export async function unknownSpecies(db: Db, slugs: string[]): Promise<string[] | null> {
  if (!slugs.length) return [];
  const { data, error } = await db.from("seed_catalog").select("slug").in("slug", slugs);
  if (error) return null;
  const known = new Set(((data ?? []) as Row[]).map((r) => String(r.slug)));
  return slugs.filter((s) => !known.has(s));
}

/** Adres boşta mı? (`exceptId`: düzenlenen kaydın kendisi). Hata → null. */
export async function isSlugFree(db: Db, slug: string, exceptId?: string): Promise<boolean | null> {
  let q = db.from("lands").select("id").eq("slug", slug).limit(1);
  if (exceptId) q = q.neq("id", exceptId);
  const { data, error } = await q;
  if (error) return null;
  return !data || data.length === 0;
}

/** Boşta bir adres üretir: `ad`, `ad-2`, `ad-3`… Hata → "unavailable"; 50 denemede boş yoksa null. */
export async function generateSlug(db: Db, base: string, exceptId?: string): Promise<string | null | "unavailable"> {
  const root = base || "saha";
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const free = await isSlugFree(db, candidate, exceptId);
    if (free === null) return "unavailable";
    if (free) return candidate;
  }
  return null;
}

/** PostgREST'te NULL eşitliği `is` ile yazılır. */
function matching<Q extends { eq: (c: string, v: unknown) => Q; is: (c: string, v: null) => Q }>(q: Q, column: string, value: unknown): Q {
  return value === null || value === undefined ? q.is(column, null) : q.eq(column, value);
}

export type UpdateOutcome = { ok: true; row: Row } | { ok: false; error: "conflict" | "slug_taken" | "unavailable" };

export async function applySiteUpdate(db: Db, before: Row, changes: SiteChanges): Promise<UpdateOutcome> {
  let q = db.from("lands").update(changes).eq("id", String(before.id));
  q = matching(q, "is_public", before.is_public);
  q = matching(q, "status", before.status);
  if ("capacity_seeds" in changes) {
    q = matching(q, "filled_seeds", before.filled_seeds);
    q = matching(q, "reserved_seeds", before.reserved_seeds);
  }
  const { data, error } = await q.select(SITE_ADMIN_COLUMNS).maybeSingle();
  if (error) return { ok: false, error: error.code === "23505" ? "slug_taken" : "unavailable" };
  return data ? { ok: true, row: data as unknown as Row } : { ok: false, error: "conflict" };
}

export async function insertSite(db: Db, row: Row): Promise<{ ok: true; row: Row } | { ok: false; error: "slug_taken" | "unavailable" }> {
  const { data, error } = await db.from("lands").insert(row).select(SITE_ADMIN_COLUMNS).single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "slug_taken" : "unavailable" };
  return { ok: true, row: data as unknown as Row };
}

export type DeleteOutcome =
  | { ok: true; name: string }
  | { ok: false; error: "not_found" | "conflict" | "in_use" | "unavailable" }
  | { ok: false; error: "not_empty"; name: string; filled: number; reserved: number };

/**
 * Yalnız boş saha silinir; sayaçlar kontrolden sonra değişirse silinmez (conflict). Sipariş bağı → in_use:
 * `release_orders.land_id` ON DELETE RESTRICT → 23001, NO ACTION bağları → 23503 (ikisi de aynı anlam).
 */
export async function deleteEmptySite(db: Db, id: string): Promise<DeleteOutcome> {
  const found = await db.from("lands").select("id, name, filled_seeds, reserved_seeds").eq("id", id).maybeSingle();
  if (found.error) return { ok: false, error: "unavailable" };
  if (!found.data) return { ok: false, error: "not_found" };
  const land = found.data as Row;
  const name = typeof land.name === "string" ? land.name : "";
  const filled = Number(land.filled_seeds ?? 0);
  const reserved = Number(land.reserved_seeds ?? 0);
  if (filled > 0 || reserved > 0) return { ok: false, error: "not_empty", name, filled, reserved };

  let q = db.from("lands").delete({ count: "exact" }).eq("id", id);
  q = matching(q, "filled_seeds", land.filled_seeds);
  q = matching(q, "reserved_seeds", land.reserved_seeds);
  const { error, count } = await q;
  if (error) return { ok: false, error: error.code === "23503" || error.code === "23001" ? "in_use" : "unavailable" };
  return count ? { ok: true, name } : { ok: false, error: "conflict" };
}
