/**
 * GA4 (Google Analytics 4) — ölçüm kimliği, çerez tercihi ve client-side event helper'ları.
 *
 * Google Analytics YALNIZ ziyaretçi izin verdiğinde yüklenir
 * (components/analytics/GoogleAnalytics.tsx): izin yokken `gtag.js` indirilmez ve Google'a
 * hiçbir istek gitmez. Tercih localStorage'da tutulur; CookieConsentBanner yazar, GoogleAnalytics
 * `CONSENT_CHANGE_EVENT` ile anında haberdar olur. Bu dosyadaki fonksiyonlar her koşulda
 * güvenlidir: gtag yüklenmemiş ya da engellenmişse sessizce no-op olur.
 */

export const GA_MEASUREMENT_ID = "G-E938FSNCWT";

/** localStorage anahtarı — çerez tercihi burada saklanır: "granted" | "denied". */
export const CONSENT_STORAGE_KEY = "skytech_cookie_consent";

/** Tercih değiştiğinde aynı sekmede yayımlanan olay (başka sekmeler `storage` olayını alır). */
export const CONSENT_CHANGE_EVENT = "skytech-cookie-consent-change";

export type CookieConsent = "granted" | "denied";

/** Kayıtlı tercih; yoksa (ya da depolama erişilemezse) null. */
export function readConsent(): CookieConsent | null {
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    return null;
  }
}

/** `useSyncExternalStore` aboneliği: tercih bu sekmede ya da başka bir sekmede değişince haber verir. */
export function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Tercihi kaydeder ve dinleyenlere (GoogleAnalytics) duyurur. İzin geri alınırsa GA çerezleri silinir. */
export function writeConsent(consent: CookieConsent): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);
  } catch {
    /* depolama kapalı: tercih yalnız bu sayfa için geçerli olur */
  }
  updateConsent(consent === "granted");
  if (consent === "denied") clearAnalyticsCookies();
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

/** `_ga`, `_ga_<ölçüm kimliği>` ve benzeri GA çerezlerini bu alan adı ve üst alan adları için siler. */
export function clearAnalyticsCookies(): void {
  if (typeof document === "undefined") return;
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0]?.trim() ?? "")
    .filter((n) => n === "_ga" || n.startsWith("_ga_") || n === "_gid" || n.startsWith("_gat") || n.startsWith("_gcl_"));
  if (names.length === 0) return;
  const parts = window.location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => parts.slice(i).join(".")).filter((d) => d.includes("."))];
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=.${domain}` : ""}`;
    }
  }
}

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
 * Tercihi, o an yüklüyse Consent Mode v2'ye işler (ör. izin sonradan geri alındığında
 * sayfadaki GA'nın çerez yazmayı bırakması için). GA yüklü değilse no-op.
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
