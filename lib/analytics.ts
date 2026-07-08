/**
 * GA4 (Google Analytics 4) — ölçüm kimliği + client-side event helper'ları.
 *
 * Consent Mode v2 varsayılanları components/analytics/GoogleAnalytics.tsx
 * içinde ayarlanır (analytics_storage ve ad_* sinyalleri varsayılan olarak
 * "denied"). components/analytics/CookieConsentBanner.tsx kullanıcının
 * tercihini localStorage'a yazar ve updateConsent() ile gerçek zamanlı
 * günceller. Bu dosyadaki fonksiyonlar her koşulda güvenli: gtag yüklenmemiş
 * veya engellenmişse sessizce no-op olur.
 */

export const GA_MEASUREMENT_ID = "G-E938FSNCWT";

/** localStorage anahtarı — çerez tercihi burada saklanır: "granted" | "denied". */
export const CONSENT_STORAGE_KEY = "skytech_cookie_consent";

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

/**
 * Kullanıcı çerez tercihini Consent Mode v2'ye işler. `granted` true ise
 * analytics + reklam sinyallerinin tamamı "granted" olur; false ise hepsi
 * "denied" kalır (varsayılan zaten denied, ama tercih değiştirmeyi de
 * destekler — bkz. footer "Çerez Tercihleri" linki).
 */
export function updateConsent(granted: boolean): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const state = granted ? "granted" : "denied";
  window.gtag("consent", "update", {
    analytics_storage: state,
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
  });
}
