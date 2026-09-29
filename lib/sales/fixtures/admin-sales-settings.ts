/**
 * Tipli örnek yanıtlar — satış ayarları arayüzü gerçek veri olmadan çalışsın diye. Sözleşme: web-brifler/32 §7.
 * Kişisel veri yoktur; e-postalar `example.invalid`.
 */
import type { ApiErrorBody } from "@/lib/api/envelope";
import type { SalesSettings } from "@/lib/orders/settings-schema";
import type { SalesSettingsDto, SalesSettingsMutationDto, SalesState } from "../admin-dto";

const values: SalesSettings = {
  unitPriceKurus: 1000, minQuantity: 20, maxQuantity: 100000, quantityPresets: [50, 100, 200, 500, 5000],
  vatRate: 20, invoiceTiming: "on_performance", prepDays: 21, paymentTtlMinutes: 45, ordersPaused: false,
};
const state: SalesState = { ordersPaused: false, accepting: true, updatedAt: "2026-09-29T08:00:00.000000+00:00", repairRequired: false };

/** Sahip: bütün gruplar; e-posta ve zamanlayıcı "tanımlı" ama çalıştığı doğrulanmamış. */
export const SALES_SETTINGS_OWNER: SalesSettingsDto = {
  groups: ["state", "settings", "openCheckouts", "history", "readiness"],
  state,
  settings: { values, raw: { ...values }, fieldErrors: {}, defaults: values, quoteVersion: "2026-09-taslak~1000.20.21" },
  openCheckouts: 2,
  history: [{ by: "sahip@example.invalid", at: "2026-09-28T10:00:00.000Z", changes: [{ field: "ordersPaused", from: true, to: false }] }],
  readiness: {
    accepting: true,
    environment: "production",
    items: [
      {
        key: "email", level: "warning", label: "E-posta tanımlı; teslim doğrulanmadı",
        detail: "Gönderim anahtarı tanımlı. Son kabul edilen gönderim: 28.09.2026 13:00 (sağlayıcı kabul etti; müşteriye teslim edildiği kanıtlanmadı). Alan adı doğrulaması ve teslim takibi bu kontrolde yapılmaz.",
        configured: true, verification: "not_verified", lastResult: { at: "2026-09-28T10:00:00.000Z", ok: true, source: "provider" },
      },
      {
        key: "cron", level: "warning", label: "Zamanlayıcının çalıştığı doğrulanmadı",
        detail: "İş uçlarının kimlik doğrulama anahtarı tanımlı. Zamanlayıcının başarılı çalışma kaydı yok. Son elle çalıştırma: 28.09.2026 12:00 (zamanlayıcıyı kanıtlamaz).",
        configured: true, verification: "not_verified", lastResult: { at: "2026-09-28T09:00:00.000Z", ok: true, source: "admin" },
      },
    ],
  },
  capabilities: { pause: true, resume: true, pricing: true },
  mfa: { enforced: true, satisfied: false, enrolled: true },
};

/** Yalnız durdurma yetkisi: durum ve sürüm; fiyat değerleri, sayaç, geçmiş ve hazırlık yok. */
export const SALES_SETTINGS_PAUSE_ONLY: SalesSettingsDto = {
  groups: ["state"],
  state,
  capabilities: { pause: true, resume: false, pricing: false },
  mfa: { enforced: true, satisfied: false, enrolled: false },
};

/** Yalnız hazırlık okuma: durum/değer yok, hazırlık maddeleri var. */
export const SALES_SETTINGS_READINESS_ONLY: SalesSettingsDto = {
  groups: ["readiness"],
  readiness: SALES_SETTINGS_OWNER.readiness,
  capabilities: { pause: false, resume: false, pricing: false },
  mfa: { enforced: true, satisfied: false, enrolled: false },
};

/** Durdurma sonrası (yalnız durdurma yetkisi). */
export const SALES_MUTATION_PAUSE: SalesSettingsMutationDto = {
  state: { ...state, ordersPaused: true, accepting: false, updatedAt: "2026-09-29T08:05:00.000000+00:00" },
  changed: ["ordersPaused"],
  quoteChanged: false,
};

export const SALES_ERRORS: Record<string, ApiErrorBody> = {
  pricingMissing: { code: "forbidden", message: "Bu değişiklik için yetkiniz yok.", details: { reason: "missing_permission", permissions: ["sales.pricing.manage"] } },
  resumeMissing: { code: "forbidden", message: "Bu değişiklik için yetkiniz yok.", details: { reason: "missing_permission", permissions: ["sales.resume"] } },
  mfaRequired: {
    code: "mfa_required", message: "Bu değişiklik iki aşamalı doğrulama ister.",
    details: { permissions: ["sales.resume"], enrolled: true, reason: "stale", freshnessMinutes: 15 },
  },
  scopeUnsupported: {
    code: "scope_unsupported", message: "Bu ekran sınırlı kapsamı (saha/atanmış iş) henüz uygulamıyor; yetkiniz bütün kayıtları kapsamıyor.",
    details: { permission: "sales.pause", scopes: [{ kind: "sites", siteIds: ["20000000-0000-4000-8000-0000000000aa"] }] },
  },
  conflict: { code: "conflict", message: "Ayarlar siz açtıktan sonra değişti. Güncel hâli yükleyip yeniden deneyin." },
  validation: { code: "validation", message: "Ayarlarda düzeltilmesi gereken alanlar var.", details: { fields: { maxQuantity: "maxBelowMin" } } },
  repairRequired: { code: "repair_required", message: "Ayar kaydı geçersiz; fiyat yetkilisi tam formla onarmalı. Bu durumda sipariş alımı zaten kapalıdır." },
  repairRequiresPause: { code: "repair_requires_pause", message: "Geçersiz kayıt onarılırken sipariş alımı durdurulmuş kalmalı.", details: { fields: { ordersPaused: "repair_requires_pause" } } },
  unavailable: { code: "unavailable", message: "Veri alınamadı. Lütfen yeniden deneyin." },
};
