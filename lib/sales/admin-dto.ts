/**
 * Satış ayarları yönetimi yanıt tipleri — istemciyle ortak. Sözleşme: web-brifler/32.
 *
 * Yanıt izin gruplarına bölünür; her grup yalnız izni varsa sorgulanır ve döner:
 *   state         satış durumu + sürüm (CAS)   → sales.pause / sales.resume / sales.pricing.manage (herhangi biri)
 *   settings      fiyat, KDV, adet, takvim…     → sales.pricing.manage
 *   openCheckouts ödeme bekleyen sipariş sayısı → orders.read
 *   history       son değişiklikler (audit)    → audit.read
 *   readiness     satışa hazırlık              → system.readiness.read
 * Hepsi bütün kayıt (`all`) kapsamı ister: ayarlar küreseldir.
 */
import type { SalesReadiness } from "@/lib/orders/readiness";
import type { SalesSettings } from "@/lib/orders/settings-schema";

export type SalesSettingsGroup = "state" | "settings" | "openCheckouts" | "history" | "readiness";

export interface SalesState {
  /** Geçersiz kayıtta sipariş alımı kapalı sayılır (true). */
  ordersPaused: boolean;
  /** Sipariş uçlarının şu anki kararı (bayrak + sağlayıcı + hukuki metin + durdurma). */
  accepting: boolean;
  /** Sürüm: PUT'ta `expectedUpdatedAt` olarak geri gönderilir. */
  updatedAt: string;
  /** Kayıt geçersiz; yalnız fiyat yetkilisi tam formla onarır. */
  repairRequired: boolean;
}

export interface SalesSettingsValues {
  /** Geçerli ayarlar; kayıt geçersizse null (onarım: `raw` + `fieldErrors`). */
  values: SalesSettings | null;
  raw: Record<string, unknown>;
  fieldErrors: Record<string, string>;
  defaults: SalesSettings;
  quoteVersion: string | null;
}

export interface SalesSettingsHistoryEntry {
  by: string | null;
  at: string;
  changes: { field: string; from: unknown; to: unknown }[];
}

export interface SalesSettingsCapabilities {
  /** Sipariş alımını durdurma (MFA gerekmez: acil durum). */
  pause: boolean;
  /** Yeniden açma (MFA). */
  resume: boolean;
  /** Fiyat, KDV, adet, fatura zamanı, hazırlık ve ödeme süresi (MFA). */
  pricing: boolean;
}

export interface SalesSettingsDto {
  groups: SalesSettingsGroup[];
  state?: SalesState;
  settings?: SalesSettingsValues;
  openCheckouts?: number;
  history?: SalesSettingsHistoryEntry[];
  readiness?: SalesReadiness;
  capabilities: SalesSettingsCapabilities;
  /** Yeniden açma ve fiyat değişikliği için yeniden doğrulama durumu. */
  mfa: { enforced: boolean; satisfied: boolean; enrolled: boolean };
}

export interface SalesSettingsMutationDto {
  state: SalesState;
  settings?: SalesSettingsValues;
  /** Gerçekten değişen alanlar; boşsa yazma ve audit yapılmadı. */
  changed: (keyof SalesSettings)[];
  /** Teklif sürümü değişti mi (fiyat, KDV, hazırlık). */
  quoteChanged: boolean;
  history?: SalesSettingsHistoryEntry[];
}
