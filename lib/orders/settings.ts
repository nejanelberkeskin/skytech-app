/**
 * Satış ayarları — SUNUCU tarafı. Tek satırlık `sales_settings` tablosundan okunur;
 * tablo okunamazsa sipariş kabulü durur; gösterim fiyatı bağlayıcı değildir.
 *
 * Yönetim panelindeki "Satış Ayarları" (`/admin/satis-ayarlari`) bu satırı değiştirir. Bağlayıcı
 * tutar her zaman buradaki değerlerle sunucuda hesaplanır (önizleme, sipariş, ödeme); sihirbaz ve
 * herkese açık sayfalar aynı değerleri `lib/orders/public-pricing.ts` üzerinden görür.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { LEGAL_DOCUMENTS_VERSION } from "@/lib/legal/version";
import { QUANTITY_PRESETS, RELEASE_QTY, UNIT_PRICE_KURUS } from "@/lib/pricing";
import { DEFAULT_PREP_DAYS } from "./schedule";
import { salesSettingsSchema, settingsFieldErrors } from "./settings-schema";
import type { SalesSettings } from "./settings-schema";

export type { SalesSettings } from "./settings-schema";

/** Herkese açık sayfalardaki önbelleğin etiketi — ayar kaydedilince hemen geçersiz kılınır. */
export const SALES_SETTINGS_TAG = "sales-settings";

export const DEFAULT_SALES_SETTINGS: SalesSettings = {
  unitPriceKurus: UNIT_PRICE_KURUS,
  minQuantity: RELEASE_QTY.min,
  maxQuantity: RELEASE_QTY.max,
  quantityPresets: [...QUANTITY_PRESETS],
  vatRate: 20,
  invoiceTiming: "on_performance",
  prepDays: DEFAULT_PREP_DAYS,
  paymentTtlMinutes: 45,
  ordersPaused: false,
};

const COLUMNS =
  "unit_price_kurus, min_quantity, max_quantity, quantity_presets, vat_rate, invoice_timing, prep_days, payment_ttl_minutes, orders_paused, updated_at, updated_by";

/** Preserve malformed values for the authorized repair screen; never silently default them. */
function rowToSettings(data: Record<string, unknown>): Record<string, unknown> {
  return {
    unitPriceKurus: data.unit_price_kurus,
    minQuantity: data.min_quantity,
    maxQuantity: data.max_quantity,
    quantityPresets: data.quantity_presets,
    vatRate: data.vat_rate,
    invoiceTiming: data.invoice_timing,
    prepDays: data.prep_days,
    paymentTtlMinutes: data.payment_ttl_minutes,
    ordersPaused: data.orders_paused,
  };
}

export interface SalesSettingsRecord {
  settings: SalesSettings;
  updatedAt: string;
  updatedBy: string | null;
}

export interface AdminSalesSettingsRecord {
  settings: SalesSettings | null;
  rawSettings: Record<string, unknown>;
  fieldErrors: Record<string, string>;
  updatedAt: string;
  updatedBy: string | null;
}

/** Only the protected admin endpoint may expose invalid raw values and a repair version. */
export async function loadAdminSalesSettings(
  supabase: SupabaseClient = createServiceRoleClient(),
): Promise<AdminSalesSettingsRecord> {
  const { data, error } = await supabase.from("sales_settings").select(COLUMNS).eq("id", true).maybeSingle();
  if (error || !data) throw error ?? new Error("ayar satırı yok");
  const row = data as Record<string, unknown>;
  if (typeof row.updated_at !== "string") throw new Error("ayar sürümü yok");
  const rawSettings = rowToSettings(row);
  const parsed = salesSettingsSchema.safeParse(rawSettings);
  return {
    settings: parsed.success ? parsed.data : null,
    rawSettings,
    fieldErrors: parsed.success ? {} : settingsFieldErrors(parsed.error),
    updatedAt: row.updated_at,
    updatedBy: typeof row.updated_by === "string" ? row.updated_by : null,
  };
}

/** Binding/public reads remain strict: malformed records never supply prices or reopen sales. */
export async function loadSalesSettings(
  supabase: SupabaseClient = createServiceRoleClient(),
): Promise<SalesSettingsRecord> {
  const record = await loadAdminSalesSettings(supabase);
  if (!record.settings) throw new Error("ayar satırı geçersiz");
  return { settings: record.settings, updatedAt: record.updatedAt, updatedBy: record.updatedBy };
}

/** Ayar okuması/doğrulaması başarısızsa sipariş kapısını kapatır. */
export async function getSalesSettings(): Promise<SalesSettings> {
  try {
    return (await loadSalesSettings()).settings;
  } catch {
    // Binding operations must never resume sales using a fallback price.
    return { ...DEFAULT_SALES_SETTINGS, ordersPaused: true };
  }
}

export type UpdateSalesSettingsResult =
  | { ok: true; record: SalesSettingsRecord }
  | { ok: false; error: "conflict" | "unavailable" };

/**
 * Ayarları yazar. `expectedUpdatedAt`, düzenleyenin ekranı açtığında gördüğü sürümdür: arada
 * başka biri kaydettiyse hiçbir şey yazılmaz ve "conflict" döner (sessizce üzerine yazılmaz).
 */
export async function updateSalesSettings(
  supabase: SupabaseClient,
  next: SalesSettings,
  expectedUpdatedAt: string,
  adminId: string,
): Promise<UpdateSalesSettingsResult> {
  const { data, error } = await supabase
    .from("sales_settings")
    .update({
      unit_price_kurus: next.unitPriceKurus,
      min_quantity: next.minQuantity,
      max_quantity: next.maxQuantity,
      quantity_presets: next.quantityPresets,
      vat_rate: next.vatRate,
      invoice_timing: next.invoiceTiming,
      prep_days: next.prepDays,
      payment_ttl_minutes: next.paymentTtlMinutes,
      orders_paused: next.ordersPaused,
      updated_by: adminId,
    })
    .eq("id", true)
    .eq("updated_at", expectedUpdatedAt)
    .select(COLUMNS);
  if (error) return { ok: false, error: "unavailable" };
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return { ok: false, error: "conflict" };
  return {
    ok: true,
    record: { settings: salesSettingsSchema.parse(rowToSettings(row)), updatedAt: String(row.updated_at), updatedBy: (row.updated_by as string | null) ?? null },
  };
}

/**
 * Müşteriye gösterilen teklifin sürümü: hukuki metin şablonu + tutarı ve takvimi belirleyen
 * ayarlar. Önizleme bu değeri döner, sihirbaz siparişle birlikte geri gönderir; arada fiyat,
 * KDV ya da hazırlık süresi değiştiyse sipariş "documents_stale" ile reddedilir ve müşteri
 * güncel tutarı görüp YENİDEN onaylar. Böylece onaylanan metin ile saklanan metin aynı kalır.
 * (Alanlar `settings-schema.ts` → `QUOTE_FIELDS` ile aynı tutulmalı.)
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
