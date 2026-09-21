/**
 * Saha sayfalarından çıkan bağlantılar — TEK KAYNAK.
 *
 * Sipariş sihirbazı (`/sahalar/[slug]/katil`) ve kendi arazi başvurusunun yeni
 * adresi (`/kendi-arazim`) ayrı PR'larla geliyor. O zamana kadar bağlantılar
 * bugünkü talep formlarına gider; sihirbaz yayına girince yalnız bu dosya
 * değişir, saha arayüzüne dokunulmaz.
 */
import type { ProjectSite } from "./types";

export const SITES_HREF = "/sahalar";

/**
 * "Bu sahaya tohum topu bıraktır" çağrısının hedefi. Talep formu `?saha=<slug>`
 * ile o sahayı seçili açar. Sihirbaz gelince: `/sahalar/${site.slug}/katil`.
 */
export function siteOrderHref(site: Pick<ProjectSite, "slug">): string {
  return `/talep/acik-arazi?saha=${encodeURIComponent(site.slug)}`;
}

/** "Kendi arazim için işlem yaptırmak istiyorum" bağlantısı. */
export const OWN_LAND_HREF = "/talep/arazime-ekim";

export function siteDetailHref(site: Pick<ProjectSite, "slug">): string {
  return `${SITES_HREF}/${site.slug}`;
}
