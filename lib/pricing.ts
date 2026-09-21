/**
 * Tohum topu bıraktırma hizmeti — fiyat ve adet kuralları (TEK KAYNAK).
 *
 * İstemci de sunucu da buradan okur; form, şema, e-posta ve ileride sipariş
 * çekirdeği aynı sayıları kullanır. Para her yerde KURUŞ cinsinden tam sayıdır
 * (kayan nokta yok). Sipariş çekirdeği geldiğinde birim bedel yönetim
 * panelinden ayarlanabilir olacak; o zaman bu dosya yalnız varsayılanı taşır ve
 * tutar HER ZAMAN sunucuda yeniden hesaplanır — istemciden gelen tutara güvenilmez.
 */

/** Tohum topu başına hizmet bedeli — 10,00 TL, KDV dâhil. */
export const UNIT_PRICE_KURUS = 1_000;

/** Bir talepte/siparişte en az ve en çok tohum topu adedi. */
export const RELEASE_QTY = { min: 20, max: 100_000 } as const;

/** Hazır adet seçenekleri; bunların dışında serbest giriş de yapılabilir. */
export const QUANTITY_PRESETS = [50, 100, 200, 500, 5_000] as const;

export const DEFAULT_QUANTITY = 100;

/**
 * Birim bedel ve tahmini tutar talep formunda gösterilsin mi?
 * Varsayılan AÇIK; NEXT_PUBLIC_PRICING_VISIBLE=false ile gizlenir.
 */
export const PRICING_VISIBLE = process.env.NEXT_PUBLIC_PRICING_VISIBLE !== "false";

export type PriceLocale = "tr" | "en" | "ru";

/** Geçerli adet için toplam (kuruş); geçersiz adette null. */
export function totalKurus(quantity: number | null | undefined): number | null {
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) return null;
  if (quantity < RELEASE_QTY.min || quantity > RELEASE_QTY.max) return null;
  return quantity * UNIT_PRICE_KURUS;
}

/*
 * Biçimlendirme bilinçli olarak Intl'e bırakılmadı: sunucu (Node ICU) ile
 * tarayıcı ICU'su ayırıcı karakterlerde ayrışabiliyor ve bu, hydration
 * uyuşmazlığına yol açıyor. Aşağıdaki kurallar üç dil için sabittir.
 */
const GROUP: Record<PriceLocale, string> = { tr: ".", en: ",", ru: " " };
const DECIMAL: Record<PriceLocale, string> = { tr: ",", en: ".", ru: "," };

/** 5000 → "5.000" (tr) · "5,000" (en) · "5 000" (ru) */
export function formatCount(n: number, locale: PriceLocale): string {
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, GROUP[locale]);
}

/** 200000 → "2.000 TL" (tr) · "₺2,000" (en) · "2 000 ₺" (ru); kuruş varsa iki hane. */
export function formatTry(kurus: number, locale: PriceLocale): string {
  const whole = Math.trunc(kurus / 100);
  const frac = Math.abs(kurus % 100);
  const num = formatCount(whole, locale) + (frac ? DECIMAL[locale] + String(frac).padStart(2, "0") : "");
  if (locale === "en") return `₺${num}`;
  return `${num} ${locale === "tr" ? "TL" : "₺"}`;
}
