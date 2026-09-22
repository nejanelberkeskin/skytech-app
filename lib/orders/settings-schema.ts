/**
 * Satış ayarları — tip, kurallar ve karşılaştırma (SAF: istemci de sunucu da kullanır).
 *
 * Sınırlar veritabanı kısıtlarıyla (016 `sales_settings`) aynıdır; üstüne çapraz kurallar
 * eklenir (en çok ≥ en az, hazır seçenekler sınırlar içinde ve artan sırada). Okuma/yazma
 * `lib/orders/settings.ts`'te, yönetim ekranı `/admin/satis-ayarlari`'nda.
 */
import { z } from "zod";
import { QTY_HARD_LIMITS, type PublicPricing } from "@/lib/pricing";

export type InvoiceTiming = "on_payment" | "on_performance";

export interface SalesSettings {
  unitPriceKurus: number;
  minQuantity: number;
  maxQuantity: number;
  quantityPresets: number[];
  vatRate: number;
  invoiceTiming: InvoiceTiming;
  prepDays: number;
  paymentTtlMinutes: number;
  /** Yönetimden sipariş alımı durduruldu: yeni sipariş ve ödeme alınmaz, sihirbaz talep kipinde açılır. */
  ordersPaused: boolean;
}

export const SETTINGS_LIMITS = {
  /** 1,00 TL – 1.000,00 TL (KDV dâhil) */
  unitPriceKurus: { min: 100, max: 100_000 },
  minQuantity: { min: QTY_HARD_LIMITS.min, max: 10_000 },
  maxQuantity: { min: QTY_HARD_LIMITS.min, max: QTY_HARD_LIMITS.max },
  presets: { min: 1, max: 6 },
  vatRate: { min: 0, max: 99.99 },
  /** Cayma süresi (14 gün) + en az bir günlük hazırlık; veritabanı kısıtı 15–120. */
  prepDays: { min: 15, max: 120 },
  paymentTtlMinutes: { min: 10, max: 1_440 },
} as const;

/** Türkiye'de uygulanan KDV oranları — bunların dışındaki bir değer ekranda uyarı alır. */
export const KNOWN_VAT_RATES = [0, 1, 10, 20] as const;

const L = SETTINGS_LIMITS;
const whole = (min: number, max: number) => z.number("invalid").int("invalid").min(min, "range").max(max, "range");

export const salesSettingsSchema = z
  .object({
    unitPriceKurus: whole(L.unitPriceKurus.min, L.unitPriceKurus.max),
    minQuantity: whole(L.minQuantity.min, L.minQuantity.max),
    maxQuantity: whole(L.maxQuantity.min, L.maxQuantity.max),
    quantityPresets: z
      .array(whole(QTY_HARD_LIMITS.min, QTY_HARD_LIMITS.max), "invalid")
      .min(L.presets.min, "presetsCount")
      .max(L.presets.max, "presetsCount"),
    vatRate: z
      .number("invalid")
      .min(L.vatRate.min, "range")
      .max(L.vatRate.max, "range")
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, "vatDecimals"),
    invoiceTiming: z.enum(["on_payment", "on_performance"], "invalid"),
    prepDays: whole(L.prepDays.min, L.prepDays.max),
    paymentTtlMinutes: whole(L.paymentTtlMinutes.min, L.paymentTtlMinutes.max),
    ordersPaused: z.boolean("invalid"),
  })
  // Çapraz kurallar, başka bir alan hatalı olsa da çalışır (formda bütün hatalar tek seferde görünsün);
  // bu yüzden değerler burada yeniden denetlenir.
  .superRefine(
    (s, ctx) => {
      const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
      const { minQuantity: min, maxQuantity: max } = s;
      const presets = Array.isArray(s.quantityPresets) && s.quantityPresets.every(num) ? s.quantityPresets : null;
      if (num(min) && num(max) && max < min) {
        ctx.addIssue({ code: "custom", path: ["maxQuantity"], message: "maxBelowMin" });
      }
      if (presets && num(min) && num(max) && presets.some((p) => p < min || p > max)) {
        ctx.addIssue({ code: "custom", path: ["quantityPresets"], message: "presetOutOfRange" });
      }
      if (presets?.some((p, i, all) => i > 0 && p <= all[i - 1])) {
        ctx.addIssue({ code: "custom", path: ["quantityPresets"], message: "presetsOrder" });
      }
    },
    { when: (payload) => typeof payload.value === "object" && payload.value !== null },
  );

/** Alan → ilk hata anahtarı (yönetim ekranı Türkçe metne çevirir). */
export function settingsFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fields[key] ??= issue.message;
  }
  return fields;
}

export function publicPricing(s: SalesSettings): PublicPricing {
  return {
    unitPriceKurus: s.unitPriceKurus,
    minQuantity: s.minQuantity,
    maxQuantity: s.maxQuantity,
    quantityPresets: [...s.quantityPresets],
  };
}

export type SettingsChange = { field: keyof SalesSettings; from: unknown; to: unknown };

/** İki ayar arasındaki farklar (denetim kaydı ve onay penceresi için). */
export function diffSettings(before: SalesSettings | Record<string, unknown>, after: SalesSettings): SettingsChange[] {
  const changes: SettingsChange[] = [];
  for (const field of Object.keys(after) as (keyof SalesSettings)[]) {
    const a = before[field];
    const b = after[field];
    const same = Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => v === b[i]) : a === b;
    if (!same) changes.push({ field, from: a, to: b });
  }
  return changes;
}

/**
 * Teklif sürümünü (`quoteVersion`) değiştiren alanlar: bunlardan biri değişirse ödeme adımındaki
 * müşteri güncel tutarı / takvimi görüp yeniden onaylar (`documents_stale`).
 */
export const QUOTE_FIELDS: readonly (keyof SalesSettings)[] = ["unitPriceKurus", "vatRate", "prepDays"];
