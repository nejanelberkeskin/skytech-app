// ── Lands ────────────────────────────────────────────────────────────────────
export interface Land {
  id: string;
  name: string;
  region: string | null;
  capacity_seeds: number;
  filled_seeds: number;
  reserved_seeds: number;
  status: "open" | "full" | "scheduled" | "seeded" | "monitoring" | "closed";
  is_public: boolean;
  created_at: string;
  // ── Proje Uygulama Sahası alanları (migration 015) — yalnız yönetim uçları tam satırı okur
  slug?: string | null;
  province?: string | null;
  district?: string | null;
  area_hectares?: number | string | null; // numeric → PostgREST metin döndürebilir
  is_fire_affected?: boolean;
  fire_year?: number | null;
  work_type?: "ormanlastirma" | "genclestirme" | "ormanlastirma_genclestirme";
  species_slugs?: string[];
  name_i18n?: Record<string, string>;
  summary_i18n?: Record<string, string>;
  cover_image?: string | null;
  gallery?: string[];
  video_url?: string | null;
  sort_order?: number;
  updated_at?: string;
}

// ── Auth / Profiles ──────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  created_at: string;
  // ── Referral / Affiliate ────────────────────────────────────────────────
  referral_code?: string;    // Kullanıcıya özel 6-8 haneli benzersiz kod (profiles tablosunda)
  earned_seeds?: number;     // Davetlerden kazanılan toplam tohum (default 0)
  // ── Ödeme Sayaçları ──────────────────────────────────────────────────
  total_seeds?: number;        // Satın alınan toplam tohum (ödeme onaylı siparişlerden)
  carbon_offset_kg?: number;   // Tahmini toplam karbon nötrleme (kg) — tohum × 0.025
}

// ── Certificates ─────────────────────────────────────────────────────────────
export interface Certificate {
  id: string;
  user_id: string;
  order_id: string | null;
  recipient_name: string;
  tree_count: number;
  forest_name: string;
  certificate_url: string | null;
  created_at: string;
}

// ── Seed Catalog (Dynamic Product Management) ───────────────────────────────
export interface SeedProduct {
  id: string;
  slug: string;          // "kizilcam", "mese" etc.
  name: string;
  latin_name: string;
  emoji: string;
  color: string;         // tailwind gradient e.g. "from-green-600 to-green-800"
  description: string;
  price: number;         // TL per seed
  stock: number;         // mevcut stok
  max_order_qty: number; // maksimum sipariş limiti
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ── Corporate Quotes (B2B Proforma) ─────────────────────────────────
export type QuoteStatus = "PENDING" | "QUOTED" | "PAID" | "REJECTED" | "EXPIRED";

export interface CorporateQuote {
  id: string;
  user_id: string;
  company_name: string;
  tax_office: string | null;
  tax_no: string | null;
  contact_person: string;
  corporate_email: string;
  phone: string | null;
  need_types: string[];            // ["orman", "sertifika", "karbon"]
  need_details: string | null;
  seed_count: string;              // "1.000 – 5.000" etc.
  budget_range: string | null;
  timeline: string | null;
  notes: string | null;
  status: QuoteStatus;
  // Admin pricing
  approved_price: number | null;
  approved_seed_count: number | null;
  admin_note: string | null;
  quoted_at: string | null;
  quoted_by: string | null;
  paid_at: string | null;
  payment_id: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Email Logs ──────────────────────────────────────────────────────
export interface EmailLog {
  id: string;
  recipient_email: string;
  template: string;
  subject: string;
  related_id: string | null;
  status: "sent" | "failed" | "bounced";
  resend_id: string | null;
  error_message: string | null;
  created_at: string;
}

// ── Employee Allocation (B2B çalışan dağıtımı) ───────────────────────────────
/**
 * Kurumsal müşterinin çalışanlarına bireysel ekim sertifikası dağıtması.
 * Admin PAID teklifinden sonra "Çalışanlara Dağıt" akışıyla oluşturulur.
 */
export interface EmployeeAllocation {
  id: string;
  quote_id: string;              // İlgili kurumsal teklif
  company_id: string;            // Firma kullanıcı ID'si
  recipient_name: string;        // Çalışanın adı soyadı
  recipient_email: string;       // Çalışanın e-postası
  seeds_allocated: number;       // Dağıtılan tohum sayısı
  certificate_id: string | null; // Oluşturulan sertifika ID'si
  email_sent: boolean;           // Sertifika e-postası gönderildi mi
  created_at: string;
}

// ── Company Profile (B2B şirket ormanı vitrini) ───────────────────────────────
/**
 * Ödeme tamamlanan firmalar için herkese açık PR sayfasına ait profil.
 * Slug, /orman/[company-slug] URL'inde kullanılır.
 */
export interface CompanyProfile {
  id: string;                    // = user_id
  company_name: string;
  slug: string;                  // URL dostu isim: "skytech-green-enerji"
  logo_url: string | null;
  website_url: string | null;
  sector: string | null;         // "Enerji", "Finans", "Perakende" ...
  employee_count: number | null;
  carbon_goal: string | null;    // "Karbon nötr 2030" etc.
  is_public: boolean;            // Orman sayfası herkese açık mı
  created_at: string;
  updated_at: string;
}

// ── Embed Widget Config (Kurumsal rozet) ─────────────────────────────────────
/**
 * Firmaların kendi sitelerine gömecekleri canlı veri rozeti konfigürasyonu.
 * /embed/rozet/[company_id] endpointinde kullanılır.
 */
export interface EmbedWidgetConfig {
  company_id: string;
  theme: "dark" | "light" | "auto";
  show_co2: boolean;
  show_seeds: boolean;
  show_logo: boolean;
  custom_label: string | null;   // null = "Carbon Neutral Partner"
}

// ── Service Requests (ödeme almadan toplanan talepler) ───────────────────────
/**
 * /talep/* formlarından gelen kayıtlar. Yazma yalnız service_role (API route);
 * giriş yapmış kullanıcı kendi (user_id bağlı) taleplerini RLS ile okur.
 * Şema: supabase/migrations/014_service_requests.sql
 */
export type ServiceRequestType = "seed_purchase" | "land_application" | "open_land_seeding";
export type ServiceRequestStatus = "new" | "contacted" | "quoted" | "converted" | "closed" | "spam";

export interface ServiceRequestSeedItem {
  slug: string;      // seed_catalog.slug
  name: string;      // kayıt anındaki katalog adı (katalog değişse de talep okunur kalsın)
  quantity: number;
}

export interface ServiceRequest {
  id: string;
  request_no: string;                  // "TLP-A3K9PX"
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  user_id: string | null;
  contact_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  locale: "tr" | "en" | "ru";
  land_id: string | null;
  total_seeds: number | null;
  seed_items: ServiceRequestSeedItem[];
  details: Record<string, unknown>;    // türe özel alanlar — lib/requests/schema.ts
  message: string | null;
  consent_at: string;
  consent_version: string;
  ip_hash: string | null;
  user_agent: string | null;
  source_path: string | null;
  admin_note: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
}
