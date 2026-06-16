import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt — Next.js otomatik /robots.txt'i bu fonksiyondan üretir.
 *
 * Politika:
 * - Tüm public crawler'lar açık.
 * - AI search bot'ları (OpenAI ChatGPT Search, Perplexity) AÇIK — GEO için kritik.
 * - Auth-protected sayfalar (admin, hesabim, kurumsal/panel) ve checkout
 *   akışı disallow — index edilmemeli.
 * - API endpoint'leri ve _next internal yolları disallow.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Genel bot'lar — vitrin tamamen açık
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/hesabim",
          "/hesabim/",
          "/kurumsal/panel",
          "/kurumsal/panel/",
          "/kurumsal/giris",
          "/auth/",
          "/checkout/",
          "/bireysel/odeme",
          "/bireysel/satin-al/siparis",
          "/api/",
          "/_next/",
          "/davet/",
          "/bakim",
          "/fatura/",
        ],
      },

      // OpenAI ChatGPT Search bot — AI search'te görünür kalsın
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: [
          "/admin",
          "/hesabim",
          "/kurumsal/panel",
          "/auth/",
          "/api/",
          "/checkout/",
        ],
      },

      // Perplexity — AI cevap motorunda kaynak gösterilebilmek için
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: [
          "/admin",
          "/hesabim",
          "/kurumsal/panel",
          "/auth/",
          "/api/",
          "/checkout/",
        ],
      },

      // Google'ın AI Overviews / AI Mode için kullandığı bot
      {
        userAgent: "Google-Extended",
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
