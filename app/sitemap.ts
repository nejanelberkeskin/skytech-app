import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { TRANSACTIONS_ENABLED, isSuspendedRoute } from "@/lib/site-config";

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
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
}

const VITRIN_PAGES: SitemapEntry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/tohum-topu", changeFrequency: "monthly", priority: 0.9 },
  { path: "/tohumlarimiz", changeFrequency: "monthly", priority: 0.85 },
  { path: "/dron-teknolojisi", changeFrequency: "monthly", priority: 0.9 },
  { path: "/karbon-programi", changeFrequency: "monthly", priority: 0.9 },
  { path: "/projeler", changeFrequency: "weekly", priority: 0.85 },
  { path: "/kurumsal-cozumler", changeFrequency: "monthly", priority: 0.9 },
  { path: "/hakkimizda", changeFrequency: "monthly", priority: 0.7 },
  { path: "/iletisim", changeFrequency: "yearly", priority: 0.6 },
  { path: "/bilgi-al", changeFrequency: "yearly", priority: 0.6 },
];

const APP_ENTRY_PAGES: SitemapEntry[] = [
  // Uygulama akışlarının "girişi" kabul edilen anonim sayfalar
  { path: "/lands", changeFrequency: "weekly", priority: 0.7 },
  { path: "/bireysel/satin-al", changeFrequency: "weekly", priority: 0.85 },
  { path: "/bireysel/satin-al/arazi", changeFrequency: "weekly", priority: 0.7 },
  { path: "/kurumsal", changeFrequency: "monthly", priority: 0.7 },
  { path: "/kurumsal/teklif-al", changeFrequency: "monthly", priority: 0.7 },
  { path: "/kargo-takip", changeFrequency: "yearly", priority: 0.4 },
  // /auth/login ve /auth/register: arama sonucunda görünmesinde fayda yok,
  // dahil etmiyoruz (robots.txt disallow'da da var).
];

const LOCALES = ["tr", "en", "ru"] as const;
const DEFAULT_LOCALE = "tr";

function localizedUrl(path: string, locale: string): string {
  if (locale === DEFAULT_LOCALE) return `${SITE_URL}${path}`;
  return `${SITE_URL}/${locale}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  // Transaction'lar askıdayken 307 ile /yakinda'ya yönlenen sayfaları
  // sitemap'e koymayoruz — yönlendirilen URL'ler arama motorlarına verilmemeli.
  const all: SitemapEntry[] = [...VITRIN_PAGES, ...APP_ENTRY_PAGES].filter(
    (entry) => TRANSACTIONS_ENABLED || !isSuspendedRoute(entry.path)
  );

  // Her sayfa için 3 dilde URL üret + alternates ile hreflang sinyali ver
  return all.flatMap((entry) =>
    LOCALES.map((locale) => ({
      url: localizedUrl(entry.path, locale),
      lastModified,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [l, localizedUrl(entry.path, l)])
        ),
      },
    }))
  );
}
