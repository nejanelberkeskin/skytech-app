/**
 * Merkezi SEO konfigürasyonu — site metadata, canonical URL, OG/Twitter
 * varsayılanları, telefon/adres bilgileri.
 *
 * Tüm sayfalar bu helper'lar üzerinden metadata oluşturmalı; böylece
 * yeni sayfa açtığımızda sadece title/description ve canonical path
 * vererek tüm SEO tag'leri otomatik geliyor.
 */

import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://skytechgreen.com";

export const SITE_NAME = "Skytech Green";
export const SITE_TAGLINE = "Tohum Toplarıyla Geleceği Ekin";
export const SITE_DESCRIPTION =
  "Dron teknolojisi ve tohum topu ile karbon nötr ağaçlandırma. " +
  "Bireysel ve kurumsal çözümler, ölçülebilir etki, şeffaf tedarik zinciri.";

export const SITE_LOCALE = "tr_TR";
export const SITE_LANGUAGE = "tr";

export const ORG_LEGAL_NAME = "Skytech Green Teknoloji A.Ş.";
export const ORG_FOUNDED = "2021";
export const ORG_AREA_SERVED = "Türkiye";
export const ORG_ADDRESS = {
  street: "Saray Mah. 60 Cad. No:22",
  district: "Kahramankazan",
  city: "Ankara",
  country: "Türkiye",
  countryCode: "TR",
};
export const ORG_CONTACT = {
  email: "info@skytechgreen.com",
  phone: "+90 530 127 64 35",
};
export const ORG_SAMEAS = [
  // İleride sosyal medya hesapları eklenince burayı doldurabiliriz
  // "https://www.linkedin.com/company/skytechgreen",
  // "https://twitter.com/skytechgreen",
  // "https://www.instagram.com/skytechgreen",
];

export const DEFAULT_OG_IMAGE = {
  url: "/og.jpg",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
};

/**
 * Build sırasında dondurulan "son güncelleme" tarihi.
 * Footer'da kullanıcıya ve crawler'lara güncellik sinyali verir.
 * Her deploy'da otomatik tazelenir.
 */
export const BUILD_DATE_ISO = new Date().toISOString();
export const BUILD_DATE_TR = new Date().toLocaleDateString("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/* ────────────────────────────────────────────────────────────── */

/** Bir path için absolute canonical URL üretir. */
export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}

interface PageMetaInput {
  /** Sayfanın <title> içeriği — site adı otomatik eklenir. */
  title: string;
  /** Sayfa açıklaması (150-160 karakter ideal). */
  description: string;
  /** Sayfanın yolu — `/`, `/projeler`, `/tohum-topu` gibi. */
  path: string;
  /** Override OG/Twitter image (yoksa default). */
  image?: { url: string; width?: number; height?: number; alt?: string };
  /** Sayfaya özel keyword'ler (opsiyonel). */
  keywords?: string[];
  /** Bu sayfayı noindex yap (default false). */
  noindex?: boolean;
  /** Yayın tarihi — Article için. */
  publishedTime?: string;
  /** Güncelleme tarihi — Article için. */
  modifiedTime?: string;
  /** OG type — default "website", article için "article". */
  ogType?: "website" | "article";
}

/**
 * Sayfa metadata'sı üretici — Next.js Metadata objesi döner.
 *
 *   export const metadata = buildPageMetadata({
 *     title: "Tohum Topu",
 *     description: "...",
 *     path: "/tohum-topu",
 *   });
 */
export function buildPageMetadata(input: PageMetaInput): Metadata {
  const url = absoluteUrl(input.path);
  const titleFull =
    input.path === "/" ? `${SITE_NAME} — ${SITE_TAGLINE}` : `${input.title} | ${SITE_NAME}`;

  const image = input.image
    ? {
        url: absoluteUrl(input.image.url),
        width: input.image.width ?? 1200,
        height: input.image.height ?? 630,
        alt: input.image.alt ?? input.title,
      }
    : {
        url: absoluteUrl(DEFAULT_OG_IMAGE.url),
        width: DEFAULT_OG_IMAGE.width,
        height: DEFAULT_OG_IMAGE.height,
        alt: DEFAULT_OG_IMAGE.alt,
      };

  return {
    title: titleFull,
    description: input.description,
    keywords: input.keywords,
    alternates: {
      canonical: url,
      languages: {
        "tr-TR": url,
        // EN sürümü yayına alınınca buraya `${url}?lang=en` veya prefix path eklenecek
        "x-default": url,
      },
    },
    robots: input.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
    openGraph: {
      type: input.ogType ?? "website",
      url,
      siteName: SITE_NAME,
      title: titleFull,
      description: input.description,
      locale: SITE_LOCALE,
      images: [image],
      ...(input.publishedTime && { publishedTime: input.publishedTime }),
      ...(input.modifiedTime && { modifiedTime: input.modifiedTime }),
    },
    twitter: {
      card: "summary_large_image",
      title: titleFull,
      description: input.description,
      images: [image.url],
    },
  };
}
