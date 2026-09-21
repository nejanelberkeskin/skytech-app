/**
 * Proje Uygulama Sahaları — SUNUCU tarafı veri erişimi (service role).
 *
 * • Yalnız vitrine çıkabilecek sütunlar seçilir; kapasite sayıları hiç okunmaz.
 * • Migration 015 henüz uygulanmamışsa (yeni sütunlar yoksa) sayfa düşmez:
 *   geliştirmede örnek veriler, canlıda eski sütunlardan türetilen sade kayıtlar döner.
 * • Sayfalar ISR ile üretilir (`export const revalidate = 300`); sipariş anındaki
 *   doğrulama ayrıca API'de canlı yapılır.
 */
import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SEED_TYPES_FALLBACK } from "@/lib/seed-data";
import { SITE_FIXTURES } from "./fixtures";
import { SLUG_RE, slugify } from "./slug";
import {
  WORK_TYPES,
  type ProjectSite,
  type SiteLocale,
  type SitePhase,
  type SiteSpecies,
  type WorkType,
} from "./types";

const SITE_COLUMNS =
  "id, slug, name, region, province, district, area_hectares, is_fire_affected, fire_year, " +
  "work_type, species_slugs, name_i18n, summary_i18n, cover_image, gallery, video_url, " +
  "status, lat, lng, sort_order";
const LEGACY_COLUMNS = "id, name, region, status, lat, lng";

/** Vitrinde listelenen DB durumları (`closed` listelenmez). */
const LISTED_STATUSES = ["open", "full", "scheduled", "seeded", "monitoring"] as const;

const PHASE_BY_STATUS: Record<string, SitePhase> = {
  open: "open",
  full: "full",
  scheduled: "scheduled",
  seeded: "released",
  monitoring: "monitoring",
};

const SPECIES_IMAGES = new Set(["kizilcam", "karacam", "sedir", "ardic"]);

type Row = Record<string, unknown>;

export { slugify };

function pickI18n(value: unknown, locale: SiteLocale): string | null {
  if (!value || typeof value !== "object") return null;
  const map = value as Record<string, unknown>;
  const hit = map[locale] ?? map.tr;
  return typeof hit === "string" && hit.trim() ? hit.trim() : null;
}

function asWorkType(value: unknown): WorkType {
  return (WORK_TYPES as readonly string[]).includes(value as string)
    ? (value as WorkType)
    : "ormanlastirma_genclestirme";
}

/** Konumu ~1 km hassasiyete yuvarlar; tam koordinat vitrine çıkmaz. */
function approx(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
}

async function loadSpecies(slugs: string[]): Promise<Map<string, SiteSpecies>> {
  const out = new Map<string, SiteSpecies>();
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return out;

  const image = (slug: string) => (SPECIES_IMAGES.has(slug) ? `/images/tohumlar/${slug}.webp` : null);
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("seed_catalog")
      .select("slug, name, latin_name")
      .in("slug", unique);
    if (error) throw error;
    for (const s of data ?? []) {
      const slug = s.slug as string;
      out.set(slug, { slug, name: s.name as string, latinName: (s.latin_name as string) ?? "", image: image(slug) });
    }
  } catch {
    // katalog okunamadı → bilinen yedek liste
  }
  for (const slug of unique) {
    if (out.has(slug)) continue;
    const fb = SEED_TYPES_FALLBACK.find((s) => s.id === slug);
    if (fb) out.set(slug, { slug, name: fb.name, latinName: fb.latinName, image: image(slug) });
  }
  return out;
}

function toSite(row: Row, locale: SiteLocale, species: Map<string, SiteSpecies>): ProjectSite | null {
  const status = String(row.status ?? "");
  const phase = PHASE_BY_STATUS[status];
  const baseName = typeof row.name === "string" ? row.name : "";
  if (!phase || !baseName) return null;

  const slug = typeof row.slug === "string" && row.slug ? row.slug : slugify(baseName);
  const area = typeof row.area_hectares === "number" ? row.area_hectares : Number(row.area_hectares);

  return {
    id: String(row.id),
    slug,
    name: pickI18n(row.name_i18n, locale) ?? baseName,
    province: (row.province as string | null) ?? (row.region as string | null) ?? null,
    district: (row.district as string | null) ?? null,
    areaHectares: Number.isFinite(area) && area > 0 ? area : null,
    isFireAffected: row.is_fire_affected === true,
    fireYear: typeof row.fire_year === "number" ? row.fire_year : null,
    workType: asWorkType(row.work_type),
    species: strings(row.species_slugs)
      .map((s) => species.get(s))
      .filter((s): s is SiteSpecies => Boolean(s)),
    summary: pickI18n(row.summary_i18n, locale),
    coverImage: typeof row.cover_image === "string" && row.cover_image ? row.cover_image : null,
    gallery: strings(row.gallery),
    lat: approx(row.lat),
    lng: approx(row.lng),
    phase,
    acceptsOrders: phase === "open",
    videoUrl: typeof row.video_url === "string" && row.video_url ? row.video_url : null,
  };
}

async function queryRows(): Promise<{ rows: Row[]; legacy: boolean }> {
  const supabase = createServiceRoleClient();
  const run = (columns: string) =>
    supabase
      .from("lands")
      .select(columns)
      .eq("is_public", true)
      .in("status", [...LISTED_STATUSES])
      .order("name", { ascending: true });

  const full = await run(SITE_COLUMNS);
  if (!full.error) {
    const rows = ((full.data ?? []) as unknown as Row[]).sort(
      (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
    );
    return { rows, legacy: false };
  }
  // 42703 = undefined_column → migration 015 henüz uygulanmamış
  if (full.error.code !== "42703") throw full.error;
  const legacy = await run(LEGACY_COLUMNS);
  if (legacy.error) throw legacy.error;
  return { rows: (legacy.data ?? []) as unknown as Row[], legacy: true };
}

/** Yayındaki tüm Proje Uygulama Sahaları (istenen dilde). Hata durumunda boş liste. */
export const getProjectSites = cache(async (locale: SiteLocale = "tr"): Promise<ProjectSite[]> => {
  try {
    const { rows, legacy } = await queryRows();
    if (legacy && process.env.NODE_ENV !== "production") return SITE_FIXTURES;
    const species = await loadSpecies(rows.flatMap((r) => strings(r.species_slugs)));
    return rows.map((r) => toSite(r, locale, species)).filter((s): s is ProjectSite => s !== null);
  } catch (e) {
    console.error("[sites] sahalar okunamadı:", e instanceof Error ? e.message : e);
    return [];
  }
});

export async function getProjectSiteBySlug(slug: string, locale: SiteLocale = "tr"): Promise<ProjectSite | null> {
  if (!SLUG_RE.test(slug)) return null;
  const sites = await getProjectSites(locale);
  return sites.find((s) => s.slug === slug) ?? null;
}
