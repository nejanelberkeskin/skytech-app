import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

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

export default function sitemap(): MetadataRoute.Sitemap {
  // Build sırasında deploy zamanını "lastModified" olarak kullanıyoruz —
  // sayfa içerik güncellendiğinde rebuild olduğu için sinyali doğru.
  const lastModified = new Date();

  const all: SitemapEntry[] = [...VITRIN_PAGES, ...APP_ENTRY_PAGES];

  return all.map((entry) => ({
    url: `${SITE_URL}${entry.path}`,
    lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
