/**
 * Saha yönetimi: alan → izin kuralları ve gerçek değişiklik farkı — saf fonksiyonlar. Sözleşme: web-brifler/30 §2.
 *
 * - `sites.edit`: tanıtım, konum, plan alanları; vitrindeki görünürlüğü ve sipariş kabulünü DEĞİŞTİRMEYEN durum geçişleri.
 * - `sites.publish` (MFA): `is_public`; vitrinde listelenmeyi ya da sipariş kabulünü değiştiren durum geçişleri
 *   (`closed` ↔ listelenen durumlar, `open` ↔ diğerleri). Yayında olmayan sahada durum geçişi vitrini etkilemez.
 * - `sites.capacity.manage` (MFA): `capacity_seeds`.
 * Form bütün alanları gönderse de yalnız gerçekten değişen kolonlar izin ister ve yazılır.
 */
import type { Permission } from "@/lib/admin/permissions";

export const SITE_COLUMNS = [
  "name", "slug", "region", "province", "district", "area_hectares", "is_fire_affected", "fire_year", "work_type",
  "species_slugs", "name_i18n", "summary_i18n", "cover_image", "video_url", "sort_order", "status", "is_public",
  "capacity_seeds",
] as const;
export type SiteColumn = (typeof SITE_COLUMNS)[number];
export type SiteChanges = Partial<Record<SiteColumn, unknown>>;
type Row = Record<string, unknown>;

/** Vitrin etkisi: listelenir mi, sipariş alır mı (lib/sites/data.ts ve 016 `reserve_release_capacity` ile aynı kural). */
export function siteVisibility(isPublic: unknown, status: unknown) {
  const pub = isPublic === true;
  return { listed: pub && status !== "closed", acceptsOrders: pub && status === "open" };
}

const NUMERIC: ReadonlySet<SiteColumn> = new Set(["area_hectares", "fire_year", "sort_order", "capacity_seeds"]);
const OBJECTS: ReadonlySet<SiteColumn> = new Set(["name_i18n", "summary_i18n"]);

function canonical(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "{}";
  const entries = Object.entries(value as Row).filter(([, v]) => typeof v === "string" && v !== "").sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

function same(column: SiteColumn, before: unknown, after: unknown): boolean {
  if (NUMERIC.has(column)) {
    const a = before === null || before === undefined || before === "" ? null : Number(before);
    const b = after === null || after === undefined || after === "" ? null : Number(after);
    return a === b;
  }
  if (OBJECTS.has(column)) return canonical(before) === canonical(after);
  if (column === "species_slugs") {
    const a = Array.isArray(before) ? before.map(String) : [];
    const b = Array.isArray(after) ? after.map(String) : [];
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return (before ?? null) === (after ?? null);
}

/** Yalnız değişen kolonlar (`next`te olmayan kolon değişmemiş sayılır). */
export function diffSite(before: Row, next: SiteChanges): SiteChanges {
  const out: SiteChanges = {};
  for (const column of SITE_COLUMNS) {
    if (!(column in next)) continue;
    if (!same(column, before[column], next[column])) out[column] = next[column];
  }
  return out;
}

/** Değişikliklerin gerektirdiği izinler (30 §2). Boş değişiklik → boş liste. */
export function requiredSitePermissions(before: Row, changes: SiteChanges): Permission[] {
  const need = new Set<Permission>();
  for (const column of Object.keys(changes) as SiteColumn[]) {
    if (column === "is_public") need.add("sites.publish");
    else if (column === "capacity_seeds") need.add("sites.capacity.manage");
    else if (column === "status") {
      // Durum geçişi mevcut yayın durumuyla değerlendirilir; `is_public` de değişiyorsa o ayrıca publish ister.
      const was = siteVisibility(before.is_public, before.status);
      const will = siteVisibility(before.is_public, changes.status);
      need.add(was.listed !== will.listed || was.acceptsOrders !== will.acceptsOrders ? "sites.publish" : "sites.edit");
    } else need.add("sites.edit");
  }
  return [...need];
}

/** Yeni saha: kapasite her zaman belirlenir; yayında açılıyorsa yayın izni de gerekir (30 §3). */
export function requiredCreatePermissions(isPublic: boolean): Permission[] {
  return ["sites.read", "sites.edit", "sites.capacity.manage", ...(isPublic ? (["sites.publish"] as const) : [])];
}
