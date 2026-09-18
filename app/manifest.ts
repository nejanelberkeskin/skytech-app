import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo";

/**
 * Web App Manifest — telefon ekranına eklenirken kullanılır, ayrıca
 * Google'a "site web app" sinyali verir (PWA olmasa bile).
 *
 * Next.js otomatik olarak /manifest.webmanifest endpoint'i üretir.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Tohum Toplarıyla Geleceği Ekin`,
    short_name: SITE_NAME,
    description:
      "Yangından etkilenmiş sahalara dronla tohum topu bırakma: ormanlaştırma, gençleştirme ve izleme.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1f12",
    theme_color: "#1B6B3A",
    orientation: "portrait-primary",
    lang: "tr-TR",
    categories: ["business", "productivity", "sustainability"],
    icons: [
      // Tarayıcı sekmesi / Google arama sonucu. 192 = 48'in katı (Google şartı).
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      // Android maskable: içerik merkez %80 güvenli bölgede, kenarlarda boşluk yok.
      // Ayrı dosya olmalı — "any" ikonu maskelenirse kenarları kırpılır.
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
