/**
 * Saha verisinin gösterim biçimleri — saf işlevler (istemcide de sunucuda da çalışır).
 * Ayırıcılar Intl'e bırakılmaz; sunucu ile tarayıcı ICU'su ayrışırsa hydration
 * uyuşmazlığı çıkıyor (bkz. lib/pricing.ts).
 */
import { formatCount } from "@/lib/pricing";
import type { SiteLocale } from "./types";

const DECIMAL: Record<SiteLocale, string> = { tr: ",", en: ".", ru: "," };

/** 42.5 → "42,5" (tr, ru) · "42.5" (en); 1200 → "1.200"; en çok iki ondalık, sondaki sıfırlar atılır. */
export function formatHectares(value: number, locale: SiteLocale): string {
  const rounded = Math.round(value * 100) / 100;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 100);
  const fracText = frac === 0 ? "" : DECIMAL[locale] + String(frac).padStart(2, "0").replace(/0$/, "");
  return formatCount(whole, locale) + fracText;
}

/** "Orhaneli, Bursa" — eksik parça atlanır; ikisi de yoksa null. */
export function formatSiteLocation(site: { district: string | null; province: string | null }): string | null {
  const parts = [site.district, site.province].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join(", ") : null;
}
