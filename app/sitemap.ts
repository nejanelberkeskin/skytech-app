import type { MetadataRoute } from "next";
import { isTurkishLegalPage } from "@/lib/seo-policy";
import { localeUrl } from "@/lib/seo";
import { getProjectSites } from "@/lib/sites/data";
import { OWN_LAND_HREF, SITES_HREF, siteDetailHref } from "@/lib/sites/links";
import { isSuspendedRoute } from "@/lib/site-config";
import { LEGAL_PAGES_ENABLED, SALES_LEGAL_PAGES } from "@/lib/legal/visibility";
import { isDraftLegalVersion } from "@/lib/legal/version";

/**
 * sitemap.xml — Next.js otomatik /sitemap.xml'i bu fonksiyondan üretir.
 *
 * Sadece public/indexable vitrin sayfaları ve birkaç anonim akış girişi.
 * Auth-protected sayfalar (/hesabim, /admin, /kurumsal/panel) ve API
 * endpoint'leri robots.txt tarafından disallow edildiği için zaten Google'a
 * gönderilmemeli — sitemap'e de almıyoruz.
 */

interface SitemapEntry {
  path: string;
  changeFrequency:
    "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
}

const VITRIN_PAGES: SitemapEntry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/satin-al", changeFrequency: "weekly", priority: 0.9 },
  { path: "/kaplamali-tohum", changeFrequency: "monthly", priority: 0.9 },
  { path: "/tohum-topu", changeFrequency: "monthly", priority: 0.9 },
  { path: "/tohumlarimiz", changeFrequency: "monthly", priority: 0.85 },
  { path: "/dron-teknolojisi", changeFrequency: "monthly", priority: 0.9 },
  { path: "/karbon-programi", changeFrequency: "monthly", priority: 0.9 },
  { path: "/projeler", changeFrequency: "weekly", priority: 0.85 },
  { path: "/kurumsal-cozumler", changeFrequency: "monthly", priority: 0.9 },
  { path: "/hakkimizda", changeFrequency: "monthly", priority: 0.7 },
  { path: "/iletisim", changeFrequency: "yearly", priority: 0.6 },
  { path: "/bilgi-al", changeFrequency: "yearly", priority: 0.6 },
  // Kendi arazi başvurusu. /talep, /talep/tohum, /talep/acik-arazi (sahalara) ve
  // /talep/arazime-ekim (buraya) yönleniyor — yönlendirilen adres sitemap'e konmaz.
  // Talep kapalıyken isSuspendedRoute bu satırı eler.
  { path: OWN_LAND_HREF, changeFrequency: "monthly", priority: 0.8 },
  { path: "/gizlilik-politikasi", changeFrequency: "yearly", priority: 0.3 },
  { path: "/kullanim-kosullari", changeFrequency: "yearly", priority: 0.3 },
  { path: "/kvkk", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cerez-politikasi", changeFrequency: "yearly", priority: 0.3 },
];

const LOCALES = ["tr", "en", "ru"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sites = await getProjectSites("tr").catch(() => []);
  const sitePages: SitemapEntry[] = [
    { path: SITES_HREF, changeFrequency: "weekly", priority: 0.9 },
    ...sites.map((site) => ({
      path: siteDetailHref(site),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
  // No reliable per-page publication timestamp is available. Omit lastmod rather than stamping every deployment.
  // Bayraklarla /yakinda'ya yönlenen sayfaları sitemap'e koymayoruz —
  // yönlendirilen URL'ler arama motorlarına verilmemeli.
  // Satış hukuk sayfaları yalnız yayımlandıklarında (bayrak açık, metin taslak değil) listelenir.
  const legalPages: SitemapEntry[] =
    LEGAL_PAGES_ENABLED && !isDraftLegalVersion()
      ? SALES_LEGAL_PAGES.map((page) => ({ path: page.path, changeFrequency: "yearly" as const, priority: 0.3 }))
      : [];
  const all: SitemapEntry[] = [
    ...VITRIN_PAGES,
    ...sitePages,
    ...legalPages,
  ].filter((entry) => !isSuspendedRoute(entry.path));

  // Her sayfa için 3 dilde URL üret + alternates ile hreflang sinyali ver
  return all.flatMap((entry) =>
    (isTurkishLegalPage(entry.path) ? (["tr"] as const) : LOCALES).map((locale) => ({
      url: localeUrl(entry.path, locale),
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      alternates: {
        languages: Object.fromEntries(
          (isTurkishLegalPage(entry.path) ? (["tr"] as const) : LOCALES).map((l) => [l, localeUrl(entry.path, l)]),
        ),
      },
    })),
  );
}
