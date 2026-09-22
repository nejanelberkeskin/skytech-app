/**
 * Saha sayfalarından çıkan bağlantılar — TEK KAYNAK.
 *
 * Sahaya katılım sihirbazı `/sahalar/[slug]/katil` adresindedir (satış açıksa sipariş,
 * değilse talep kipinde). Kendi arazi başvurusu şimdilik `/talep/arazime-ekim`'de; yeni
 * adresi (`/kendi-arazim`) geldiğinde yalnız bu dosya değişir, saha arayüzüne dokunulmaz.
 */
import type { ProjectSite } from "./types";

export const SITES_HREF = "/sahalar";

/** "Bu sahaya katıl" çağrısının hedefi: o sahanın sihirbazı. */
export function siteOrderHref(site: Pick<ProjectSite, "slug">): string {
  return `/sahalar/${site.slug}/katil`;
}

/** "Kendi arazim için işlem yaptırmak istiyorum" bağlantısı. */
export const OWN_LAND_HREF = "/talep/arazime-ekim";

export function siteDetailHref(site: Pick<ProjectSite, "slug">): string {
  return `${SITES_HREF}/${site.slug}`;
}
