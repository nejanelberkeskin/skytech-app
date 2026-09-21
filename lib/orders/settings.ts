/**
 * Satış ayarları — SUNUCU tarafı. Tek satırlık `sales_settings` tablosundan okunur;
 * tablo okunamazsa lib/pricing.ts'teki varsayılanlara düşer (sipariş akışı durmaz).
 *
 * İstemci (sihirbaz) anlık gösterim için lib/pricing.ts sabitlerini kullanır; BAĞLAYICI
 * tutar her zaman buradan gelen değerlerle sunucuda hesaplanır ve 4. adımda gösterilir.
 * İkisi ayrışırsa uyarı loglanır — fiyat değişikliğinde sabitler de güncellenmelidir
 * (yönetim panelindeki "Ayarlar" ekranı geldiğinde sihirbaz fiyatı sunucudan alacak).
 */
import { createServiceRoleClient } from "@/lib/supabase/server";
import { LEGAL_DOCUMENTS_VERSION } from "@/lib/legal/version";
import { QUANTITY_PRESETS, RELEASE_QTY, UNIT_PRICE_KURUS } from "@/lib/pricing";
import { DEFAULT_PREP_DAYS } from "./schedule";

export interface SalesSettings {
  unitPriceKurus: number;
  minQuantity: number;
  maxQuantity: number;
  quantityPresets: number[];
  vatRate: number;
  invoiceTiming: "on_payment" | "on_performance";
  prepDays: number;
  paymentTtlMinutes: number;
}

export const DEFAULT_SALES_SETTINGS: SalesSettings = {
  unitPriceKurus: UNIT_PRICE_KURUS,
  minQuantity: RELEASE_QTY.min,
  maxQuantity: RELEASE_QTY.max,
  quantityPresets: [...QUANTITY_PRESETS],
  vatRate: 20,
  invoiceTiming: "on_performance",
  prepDays: DEFAULT_PREP_DAYS,
  paymentTtlMinutes: 45,
};

export async function getSalesSettings(): Promise<SalesSettings> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("sales_settings").select("*").eq("id", true).maybeSingle();
    if (error || !data) throw error ?? new Error("ayar satırı yok");
    const settings: SalesSettings = {
      unitPriceKurus: Number(data.unit_price_kurus),
      minQuantity: Number(data.min_quantity),
      maxQuantity: Number(data.max_quantity),
      quantityPresets: Array.isArray(data.quantity_presets) ? data.quantity_presets.map(Number) : DEFAULT_SALES_SETTINGS.quantityPresets,
      vatRate: Number(data.vat_rate),
      invoiceTiming: data.invoice_timing === "on_payment" ? "on_payment" : "on_performance",
      prepDays: Number(data.prep_days),
      paymentTtlMinutes: Number(data.payment_ttl_minutes),
    };
    if (settings.unitPriceKurus !== UNIT_PRICE_KURUS || settings.minQuantity !== RELEASE_QTY.min) {
      console.warn("[siparis] sales_settings ile lib/pricing.ts sabitleri farklı — sihirbazdaki anlık fiyat güncel olmayabilir");
    }
    return settings;
  } catch {
    return DEFAULT_SALES_SETTINGS;
  }
}

/**
 * Müşteriye gösterilen teklifin sürümü: hukuki metin şablonu + tutarı ve takvimi belirleyen
 * ayarlar. Önizleme bu değeri döner, sihirbaz siparişle birlikte geri gönderir; arada fiyat,
 * KDV ya da hazırlık süresi değiştiyse sipariş "documents_stale" ile reddedilir ve müşteri
 * güncel tutarı görüp YENİDEN onaylar. Böylece onaylanan metin ile saklanan metin aynı kalır.
 */
export function quoteVersion(settings: SalesSettings): string {
  return `${LEGAL_DOCUMENTS_VERSION}~${settings.unitPriceKurus}.${settings.vatRate}.${settings.prepDays}`;
}

/** Birim fiyat ve KDV oranına göre KESİN tutar (hepsi kuruş; KDV dâhil toplamın içindeki vergi ayrılır). */
export function orderTotals(quantity: number, settings: Pick<SalesSettings, "unitPriceKurus" | "vatRate">) {
  const totalKurus = quantity * settings.unitPriceKurus;
  return {
    quantity,
    unitPriceKurus: settings.unitPriceKurus,
    totalKurus,
    vatKurus: vatPortion(totalKurus, settings.vatRate),
    vatRate: settings.vatRate,
  };
}

/** KDV dâhil toplamın içindeki vergi (kuruş). */
export function vatPortion(totalKurus: number, vatRate: number): number {
  return Math.round((totalKurus * vatRate) / (100 + vatRate));
}
