/**
 * Tohum topu bıraktırma hizmeti — fiyat ve adet kurallarının VARSAYILANLARI ve biçimlendirme.
 *
 * Geçerli değerler yönetim panelindeki "Satış Ayarları"ndan gelir (`sales_settings` tablosu,
 * `lib/orders/settings.ts`). Buradaki sabitler yalnız o tablo okunamadığında kullanılan
 * varsayılanlardır. Para her yerde KURUŞ cinsinden tam sayıdır (kayan nokta yok); tutar HER ZAMAN
 * sunucuda yeniden hesaplanır — istemciden gelen tutara güvenilmez.
 */

/** Tohum topu başına hizmet bedeli — 10,00 TL, KDV dâhil (varsayılan). */
export const UNIT_PRICE_KURUS = 1_000;

/** Bir talepte/siparişte en az ve en çok tohum topu adedi (varsayılan). */
export const RELEASE_QTY = { min: 20, max: 100_000 } as const;

/** Hazır adet seçenekleri; bunların dışında serbest giriş de yapılabilir (varsayılan). */
export const QUANTITY_PRESETS = [50, 100, 200, 500, 5_000] as const;

export const DEFAULT_QUANTITY = 100;

/**
 * Adet için MUTLAK sınırlar — şemalar yalnız bunu denetler. Geçerli en az / en çok adet satış
 * ayarlarından gelir ve sipariş, önizleme ve talep uçlarında ayrıca denetlenir.
 */
export const QTY_HARD_LIMITS = { min: 1, max: 1_000_000 } as const;

/** Sihirbazın ve herkese açık sayfaların gördüğü fiyat/adet kuralları (satış ayarlarının alt kümesi). */
export interface PublicPricing {
  unitPriceKurus: number;
  minQuantity: number;
  maxQuantity: number;
  quantityPresets: number[];
}

export const DEFAULT_PUBLIC_PRICING: PublicPricing = {
  unitPriceKurus: UNIT_PRICE_KURUS,
  minQuantity: RELEASE_QTY.min,
  maxQuantity: RELEASE_QTY.max,
  quantityPresets: [...QUANTITY_PRESETS],
};

/** Sihirbazın açılıştaki adedi: varsayılan, ayarlardaki sınırların içine çekilir. */
export function initialQuantity(pricing: PublicPricing): number {
  return Math.min(Math.max(DEFAULT_QUANTITY, pricing.minQuantity), pricing.maxQuantity);
}

/**
 * Birim bedel ve tahmini tutar talep formunda gösterilsin mi?
 * Varsayılan AÇIK; NEXT_PUBLIC_PRICING_VISIBLE=false ile gizlenir.
 */
export const PRICING_VISIBLE = process.env.NEXT_PUBLIC_PRICING_VISIBLE !== "false";

export type PriceLocale = "tr" | "en" | "ru";

/** Geçerli adet için toplam (kuruş); geçersiz adette null. */
export function totalKurus(
  quantity: number | null | undefined,
  pricing: PublicPricing = DEFAULT_PUBLIC_PRICING,
): number | null {
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) return null;
  if (quantity < pricing.minQuantity || quantity > pricing.maxQuantity) return null;
  return quantity * pricing.unitPriceKurus;
}

/** Adet, ayarlardaki sınırların dışındaysa hata anahtarı (şemalarla aynı adlar); içindeyse null. */
export function quantityRangeError(
  quantity: number,
  pricing: Pick<PublicPricing, "minQuantity" | "maxQuantity">,
): "quantityMin" | "quantityMax" | null {
  if (quantity < pricing.minQuantity) return "quantityMin";
  if (quantity > pricing.maxQuantity) return "quantityMax";
  return null;
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
