/**
 * Arayüz dili yardımcıları (müşteri ekranları). Saf; istemcide ve sunucuda kullanılabilir.
 * - `uiLocale`: next-intl dilini etiket sözlüklerinin anahtarına çevirir (bilinmeyen → "tr").
 * - `intlLocale`: Intl biçim yerel ayarı. TR "tr-TR" (önceki biçimle birebir), EN "en-GB" (sitedeki gün-ay-yıl
 *   düzeni; sipariş ve sertifika sayfalarıyla aynı), RU "ru-RU".
 */
export type UiLocale = "tr" | "en" | "ru";

export function uiLocale(locale: string): UiLocale {
  return locale === "en" || locale === "ru" ? locale : "tr";
}

export function intlLocale(locale: string): string {
  return locale === "en" ? "en-GB" : locale === "ru" ? "ru-RU" : "tr-TR";
}
