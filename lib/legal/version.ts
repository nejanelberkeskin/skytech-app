/**
 * Hukuki metin şablonlarının sürümü.
 *
 * Şablonlardaki (lib/legal/templates/*) herhangi bir METİN değişikliğinde artırılır.
 * Sürüm; her siparişe (`release_orders.documents_version`) ve her belge kopyasına
 * yazılır. Müşteri 4. adımda eski sürümü görmüşse sunucu siparişi reddeder
 * (`documents_stale`) ve metinler yeniden onaylatılır.
 *
 * Biçim: YYYY-AA.sıra[-taslak]
 *   "-taslak" → hukuk incelemesinden GEÇMEMİŞ metin. Satış bayrağı açılmadan önce
 *   inceleme tamamlanmalı ve ek kaldırılmalıdır (açılış kontrol listesi).
 */
export const LEGAL_DOCUMENTS_VERSION = "2026-09.1-taslak";

export const isDraftLegalVersion = (version: string = LEGAL_DOCUMENTS_VERSION) => version.endsWith("-taslak");

/**
 * Metinlerin yürürlük tarihi ("1 Ekim 2026" biçiminde). Hukuk incelemesi bitip
 * "-taslak" eki kaldırılırken BİRLİKTE doldurulur.
 */
export const LEGAL_EFFECTIVE_DATE = "";

/** Hukuk sayfalarının başlığında görünen yürürlük bilgisi. */
export const LEGAL_EFFECTIVE_LABEL = isDraftLegalVersion() ? "Taslak — hukuk incelemesinde" : LEGAL_EFFECTIVE_DATE || "—";
