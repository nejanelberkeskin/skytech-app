/**
 * Merkezi SEO konfigürasyonu — site metadata, canonical URL, OG/Twitter
 * varsayılanları, telefon/adres bilgileri.
 *
 * Tüm sayfalar bu helper'lar üzerinden metadata oluşturmalı; böylece
 * yeni sayfa açtığımızda sadece title/description ve canonical path
 * vererek tüm SEO tag'leri otomatik geliyor.
 */

import type { Metadata } from "next";
import { seoKeywords } from "./seo-keywords";

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

/** Desteklenen diller ve varsayılan (prefix'siz) dil. */
export const LOCALES = ["tr", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";

/** OpenGraph `og:locale` değerleri. */
export const LOCALE_TO_OG_LOCALE: Record<string, string> = {
  tr: "tr_TR",
  en: "en_US",
  ru: "ru_RU",
};

/** Diğer dillerin `og:locale:alternate` listesi (verilen aktif dil hariç). */
export function ogLocaleAlternates(active: string): string[] {
  return LOCALES.filter((l) => l !== active).map((l) => LOCALE_TO_OG_LOCALE[l]);
}

export const ORG_LEGAL_NAME = "Skytech Havacılık A.Ş.";
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
  // Birincil hat (sabit) — şemalarda bu kullanılır; ikincil mobil hat sayfalarda listelenir.
  phone: "+90 850 308 26 00",
  phoneSecondary: "+90 530 127 64 35",
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

/** Varsayılan OG görseli alt metni — aktif locale'e göre. */
export const DEFAULT_OG_ALT: Record<string, string> = {
  tr: `${SITE_NAME} — Tohum Toplarıyla Geleceği Ekin`,
  en: `${SITE_NAME} — Plant the Future with Seed Balls`,
  ru: `${SITE_NAME} — Сажайте будущее семенными шарами`,
};

/** Locale'e göre varsayılan OG alt metni (fallback tr). */
export function defaultOgAlt(locale: string): string {
  return DEFAULT_OG_ALT[locale] ?? DEFAULT_OG_ALT.tr;
}

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

/**
 * Locale-prefix'li absolute URL. Varsayılan dil (tr) prefix almaz.
 *   localeUrl("/tohum-topu", "tr") → https://.../tohum-topu
 *   localeUrl("/tohum-topu", "en") → https://.../en/tohum-topu
 *   localeUrl("/", "ru")           → https://.../ru
 */
export function localeUrl(path: string, locale: string): string {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return `${SITE_URL}${clean || "/"}`;
  return `${SITE_URL}/${locale}${clean}`;
}

/** hreflang alternates haritası — tr/en/ru + x-default (tr). */
export function hreflangMap(path: string): Record<string, string> {
  return {
    tr: localeUrl(path, "tr"),
    en: localeUrl(path, "en"),
    ru: localeUrl(path, "ru"),
    "x-default": localeUrl(path, "tr"),
  };
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
export function buildPageMetadata(
  input: PageMetaInput,
  locale: string = DEFAULT_LOCALE
): Metadata {
  const url = localeUrl(input.path, locale);
  const titleFull =
    input.path === "/" ? `${SITE_NAME} — ${input.title}` : `${input.title} | ${SITE_NAME}`;

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
        alt: defaultOgAlt(locale),
      };

  return {
    // `absolute` root layout'un title.template'inin bir daha üzerine binmesini
    // (çift "| Skytech Green" — Bing bunu "title too long" diye işaretledi) engeller.
    title: { absolute: titleFull },
    description: input.description,
    // Sayfa açıkça keyword vermezse locale'e göre merkezi kümeden doldur
    // (Yandex + GEO crawler'ları için üç dilde ayrı listeler).
    keywords: input.keywords ?? seoKeywords(input.path, locale),
    alternates: {
      canonical: url,
      languages: hreflangMap(input.path),
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
      locale: LOCALE_TO_OG_LOCALE[locale] ?? SITE_LOCALE,
      alternateLocale: ogLocaleAlternates(locale),
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
