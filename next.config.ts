import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * Production headers — güvenlik, performans ve uzun-vadeli cache.
 *
 * Vercel'in default'larıyla uyumlu; özelleştirme:
 *  - Static assets (görseller, fontlar) için immutable cache
 *  - Vitrin sayfaları için s-maxage + revalidate (CDN cache)
 *  - Security: HSTS, X-Content-Type-Options, Referrer-Policy
 *  - Performance: Permissions-Policy ile gereksiz API'leri kapat
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["iyzipay"],

  // React Strict Mode — geliştirme sırasında side-effect erken yakalanır
  reactStrictMode: true,

  // Resim optimizasyonu — modern formatlar
  images: {
    formats: ["image/avif", "image/webp"],
    // Vitrin sayfalarındaki görseller için sane defaults
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 gün
  },

  // Compress + production source map (size analizi için, prod build'de zaten gzip'lenir)
  compress: true,
  productionBrowserSourceMaps: false,

  // Security + cache headers
  async headers() {
    return [
      // Tüm route'lar — güvenlik header'ları
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Sipariş ve ödeme sonucu sayfaları ile müşteri sipariş uçları (belge, sertifika, bağlantı kapısı):
      // hiçbir isteğe Referer gönderilmez. Sayfadaki `<meta name="referrer">` önyükleme bağlantılarından
      // sonra geldiği için tek başına yetmez. Buradaki kurallar rota yanıtının kendi başlığının da ÜSTÜNE
      // yazılır (yukarıdaki genel kural uçların `no-referrer` başlığını eziyordu); aynı anahtar için son
      // eşleşen kural kazanır.
      ...[
        ...["", "/tr", "/en", "/ru"].flatMap((prefix) => [`${prefix}/siparis/:path*`, `${prefix}/odeme/sonuc/:path*`]),
        "/api/public/siparis/:path*",
      ].map((source) => ({
        source,
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      })),
      // Static assets (next/image işlediği görseller) — uzun cache
      {
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Brand assets — uzun cache
      {
        source: "/og.(jpg|webp)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Favicon / icon — orta süreli cache
      {
        source: "/(favicon.ico|icon.png|apple-icon.png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, must-revalidate",
          },
        ],
      },
      // sitemap/robots — CDN'de 1 saat tut
      {
        source: "/(sitemap.xml|robots.txt)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=3600",
          },
        ],
      },
    ];
  },

  // Vitrin static pages için bundle size'ı azalt
  experimental: {
    // Sadece kullanılan motion özelliklerini bundle'la
    optimizePackageImports: ["framer-motion", "lucide-react"],
    // İyimser rota tahmini KAPALI (Next 16.3'te varsayılan açık). Tahmin, dil parametresinin adreste
    // olduğunu varsayar; /en, /ru (ya da /tr) adresi görülen belgede öneksiz TR adresini (as-needed:
    // /hakkimizda → /tr/hakkimizda yeniden yazması) "/[locale=hakkimizda]" sanar. Yalnız baş eksikken
    // atılan ön yükleme bu sapmayı denetlemediği için görünür her tek parçalı TR bağlantısı sonsuz
    // döngüye girer (dil değiştiriciyle EN→TR geçişinde, /tr açılışında). Kapalıyken rota ağacı
    // sunucudan alınır (canlıdaki 16.1 davranışı). Açmadan önce: npm run test:prefetch.
    optimisticRouting: false,
  },
};

export default withBundleAnalyzer(withNextIntl(nextConfig));
