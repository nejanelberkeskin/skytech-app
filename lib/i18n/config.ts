/**
 * i18n yapılandırması — Skytech Green vitrin için.
 *
 * Mimari yaklaşım:
 *  - Şu an varsayılan dil "tr". Tüm vitrin metinleri dictionary üzerinden çekilir.
 *  - İleride `app/[lang]/(vitrin)/...` yapısına geçiş için klasör + sözlük + helper hazır.
 *  - Cookie veya pathname segmenti ile dil tespiti yapılır.
 *  - Server component'lerde `getDictionary(lang)`, client'larda `useDictionary()` çağrılır.
 */

export const SUPPORTED_LANGUAGES = ["tr", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "tr";

export const LANGUAGE_LABELS: Record<Language, { native: string; flag: string }> = {
  tr: { native: "Türkçe", flag: "🇹🇷" },
  en: { native: "English", flag: "🇬🇧" },
};

export function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Pathname'den dil çıkar — örn: /en/projeler → "en"
 * Hiç prefix yoksa varsayılan dili döner.
 */
export function getLanguageFromPath(pathname: string): Language {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg && isSupportedLanguage(seg) ? seg : DEFAULT_LANGUAGE;
}

/**
 * Dile göre URL prefix üret — varsayılan dil için boş, diğerleri için /en gibi.
 */
export function localizedHref(href: string, lang: Language): string {
  if (lang === DEFAULT_LANGUAGE) return href;
  if (href.startsWith("http")) return href;
  return `/${lang}${href.startsWith("/") ? href : `/${href}`}`;
}
