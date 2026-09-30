/**
 * Saha sayfalarından çıkan bağlantılar — TEK KAYNAK.
 *
 * Sahaya katılım sihirbazı `/sahalar/[slug]/katil` adresindedir (satış açıksa sipariş,
 * değilse talep kipinde). Kendi arazi başvurusu `/kendi-arazim` sayfasındadır; eski adres
 * `/talep/arazime-ekim` middleware'de kalıcı olarak buraya yönlenir (lib/site-config.ts).
 */
import type { ProjectSite } from "./types";

export const SITES_HREF = "/sahalar";

/** "Bu sahaya katıl" çağrısının hedefi: o sahanın sihirbazı. */
export function siteOrderHref(site: Pick<ProjectSite, "slug">): string {
  return `/sahalar/${site.slug}/katil`;
}

/** "Kendi arazim için işlem yaptırmak istiyorum" bağlantısı: tanıtım ve başvuru sayfası. */
export const OWN_LAND_HREF = "/kendi-arazim";

export function siteDetailHref(site: Pick<ProjectSite, "slug">): string {
  return `${SITES_HREF}/${site.slug}`;
}
