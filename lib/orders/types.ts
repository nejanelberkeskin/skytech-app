/**
 * Tohum topu bıraktırma siparişi — alan sözlüğü (saf tipler ve sabitler).
 *
 * Satılan şey bir HİZMETTİR: seçilen Proje Uygulama Sahasına, sözleşmede yazan
 * son tarihe kadar, belirtilen adette tohum topunun dronla bırakılması. Kargo,
 * ürün teslimi ya da tür seçimi yoktur; bağış değildir.
 *
 * Tablolar: supabase/migrations/016_release_orders.sql
 */

/** Sipariş numarası: SG-2026-XXXXXX (karıştırılan karakterler yok: 0/O, 1/I/L). */
export const ORDER_NO_RE = /^SG-\d{4}-[A-HJKMNP-Z2-9]{6}$/;

/* ── Durumlar ─────────────────────────────────────────────────────────────── */

export const ORDER_STATUSES = [
  "draft", //                 sihirbaz tamamlandı, ödeme başlatılmadı
  "awaiting_payment", //      ödeme sayfasına gönderildi
  "payment_failed", //        ödeme reddedildi / yarıda kaldı (yeniden denenebilir)
  "expired", //               ödeme süresi doldu; ayrılan kapasite geri verildi
  "paid", //                  ödeme alındı; 14 günlük cayma süresi işliyor
  "confirmed", //             cayma süresi doldu; bırakma partisine alınabilir
  "scheduled", //             bir bırakma partisine atandı
  "released", //              tohum topları sahaya bırakıldı; sertifika düzenlendi
  "monitoring", //            izleme dönemi (Nisan–Eylül)
  "completed", //             çalışma videosu paylaşıldı; süreç kapandı
  "withdrawal_requested", //  müşteri cayma bildirdi; iade bekliyor
  "cancelled_by_seller", //   satıcı ifa edemiyor; iade bekliyor
  "refunded", //              bedel iade edildi; sertifika (varsa) iptal
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Bu durumlarda sipariş için sahada kapasite AYRILMIŞ tutulur. */
export const CAPACITY_HOLDING_STATUSES: readonly OrderStatus[] = [
  "draft",
  "awaiting_payment",
  "payment_failed",
  "paid",
  "confirmed",
  "scheduled",
  "withdrawal_requested",
  "cancelled_by_seller",
];

/** Bedeli tahsil edilmiş ve iade edilmemiş durumlar (ciro, fatura, rapor). */
export const PAID_STATUSES: readonly OrderStatus[] = [
  "paid",
  "confirmed",
  "scheduled",
  "released",
  "monitoring",
  "completed",
  "withdrawal_requested",
  "cancelled_by_seller",
];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["expired", "completed", "refunded"];

/* ── Alıcı ve fatura ──────────────────────────────────────────────────────── */

export const BUYER_TYPES = ["individual", "corporate"] as const;
export type BuyerType = (typeof BUYER_TYPES)[number];

export interface InvoiceAddress {
  /** İl plaka kodu ("01"…"81") — lib/tr-iller.ts */
  province: string;
  district: string;
  line: string;
  postalCode: string | null;
}

export interface IndividualInvoice {
  type: "individual";
  address: InvoiceAddress;
  /** İsteğe bağlı; verilmezse e-Arşiv faturada 11111111111 kullanılır. */
  tckn: string | null;
}

export interface CorporateInvoice {
  type: "corporate";
  companyTitle: string;
  /** VKN (10 hane) ya da şahıs işletmesinde TCKN (11 hane). */
  taxId: string;
  taxOffice: string;
  address: InvoiceAddress;
  authorizedPerson: string;
  mersis: string | null;
  kep: string | null;
  poNumber: string | null;
  /** e-Fatura mükellefi mi? (fatura türünü belirler) */
  eInvoiceUser: boolean;
}

export type InvoiceInfo = IndividualInvoice | CorporateInvoice;

/* ── Onaylar ──────────────────────────────────────────────────────────────── */

/**
 * Her kutu AYRI ve işaretsiz sunulur; tıklanma anı ve gösterilen metnin sürümü
 * saklanır. KVKK kutusu rıza DEĞİL, "okudum, bilgi edindim" beyanıdır. Ticari
 * ileti izni isteğe bağlıdır ve satışın şartı yapılamaz.
 */
export const CONSENT_KEYS = ["preInfo", "contract", "kvkkRead", "marketing", "corporateAuthority"] as const;
export type ConsentKey = (typeof CONSENT_KEYS)[number];

export interface ConsentRecord {
  granted: boolean;
  /** ISO zaman damgası — sunucu saatine göre. */
  at: string;
  /** Gösterilen metnin şablon sürümü (ör. "2026-10.1"). */
  version: string;
}

export type OrderConsents = Partial<Record<ConsentKey, ConsentRecord>>;

/* ── Saha anlık görüntüsü ─────────────────────────────────────────────────── */

/**
 * Sipariş anında sahanın müşteriye gösterilen hâli. Saha kaydı sonradan değişse
 * de sözleşme ve sertifika bu kopyaya dayanır.
 */
export interface SiteSnapshot {
  id: string;
  slug: string;
  name: string;
  province: string | null;
  district: string | null;
  areaHectares: number | null;
  isFireAffected: boolean;
  fireYear: number | null;
  workType: "ormanlastirma" | "genclestirme" | "ormanlastirma_genclestirme";
  species: { slug: string; name: string; latinName: string }[];
}

/* ── Belgeler ─────────────────────────────────────────────────────────────── */

export const DOCUMENT_KINDS = ["pre_info", "contract", "withdrawal_form", "kvkk_notice"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/* ── Olaylar (denetim izi) ────────────────────────────────────────────────── */

export const ORDER_EVENT_TYPES = [
  "order_created",
  "consent_recorded",
  "documents_generated",
  "payment_started",
  "payment_succeeded",
  "payment_failed",
  "order_expired",
  "email_sent",
  "email_failed",
  "status_changed",
  "withdrawal_requested",
  "withdrawal_cancelled",
  "refund_started",
  "refund_succeeded",
  "refund_failed",
  "invoice_issued",
  "batch_assigned",
  "release_completed",
  "certificate_issued",
  "certificate_cancelled",
  "video_notified",
  "admin_note",
] as const;
export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

/** Olayı kimin yaptığı: müşteri, sistem (zamanlanmış iş / geri çağrı) ya da yönetici. */
export type OrderActor = "customer" | "system" | `admin:${string}`;
