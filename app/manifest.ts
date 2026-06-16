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
      "Dron teknolojisi ve tohum topu ile karbon nötr ağaçlandırma platformu.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1f12",
    theme_color: "#1B6B3A",
    orientation: "portrait-primary",
    lang: "tr-TR",
    categories: ["business", "productivity", "sustainability"],
    icons: [
      {
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
