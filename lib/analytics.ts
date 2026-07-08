/**
 * GA4 (Google Analytics 4) — ölçüm kimliği + client-side event helper'ları.
 *
 * Consent Mode v2 varsayılanları components/analytics/GoogleAnalytics.tsx
 * içinde ayarlanır (henüz çerez onay banner'ı olmadığı için analytics_storage
 * ve ad_* sinyalleri varsayılan olarak "denied" — banner eklenince granted'e
 * çekilecek). Bu dosyadaki fonksiyonlar her koşulda güvenli: gtag yüklenmemiş
 * veya engellenmişse sessizce no-op olur.
 */

export const GA_MEASUREMENT_ID = "G-E938FSNCWT";

type GtagEventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Genel GA4 event gönderici — gtag yoksa (engellenmiş/yüklenmemiş) sessizce çıkar. */
export function trackEvent(name: string, params?: GtagEventParams): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

/**
 * Lead dönüşüm event'i — bilgi-al formu başarıyla gönderildiğinde tetiklenir.
 * GA4'te "Anahtar olay" (key event) olarak işaretlenip Google Ads'e
 * dönüşüm olarak aktarılacak (reklam fazı).
 */
export function trackLead(params?: { subject?: string }): void {
  trackEvent("generate_lead", params);
}
