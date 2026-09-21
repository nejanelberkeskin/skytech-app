/**
 * Proje Uygulama Sahası — yönetim paneli doğrulama şeması (istemci ve sunucu ORTAK).
 *
 * Panel formu da `POST/PUT /api/admin/lands` da aynı şemayı kullanır; kurallar
 * migration 015'teki CHECK kısıtlarıyla birebir tutulur ki hata veritabanından
 * değil, anlaşılır bir alan iletisiyle dönsün.
 */
import { z } from "zod";
import { SLUG_RE } from "./slug";
import { WORK_TYPES } from "./types";

/** DB `land_status` enum'u. Vitrindeki karşılıkları için bkz. lib/sites/types.ts → SitePhase. */
export const LAND_STATUSES = ["open", "full", "scheduled", "seeded", "monitoring", "closed"] as const;
export type LandStatus = (typeof LAND_STATUSES)[number];

export const LAND_STATUS_LABELS: Record<LandStatus, string> = {
  open: "Katılıma açık",
  full: "Kontenjan doldu",
  scheduled: "Bırakma planlandı",
  seeded: "Bırakma tamamlandı",
  monitoring: "İzleme sürüyor",
  closed: "Kapalı (listelenmez)",
};

export const WORK_TYPE_LABELS: Record<(typeof WORK_TYPES)[number], string> = {
  ormanlastirma: "Ormanlaştırma",
  genclestirme: "Gençleştirme",
  ormanlastirma_genclestirme: "Ormanlaştırma – Gençleştirme",
};

export const SITE_LIMITS = {
  name: { min: 2, max: 120 },
  place: 80,
  summary: 800,
  species: 6,
  areaMax: 999_999.99,
  fireYearMin: 1980,
  capacityMax: 100_000_000,
} as const;

const clean = (v: string) => v.replace(/\s+/g, " ").trim();

const optionalText = (max: number, message: string) =>
  z
    .string()
    .max(max * 2, message)
    .transform(clean)
    .pipe(z.string().max(max, message))
    .transform((v) => (v ? v : null))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

/** Kapak: site içi görsel yolu ya da https adresi. */
const COVER_RE = /^(\/images\/[\w\-./]+\.(?:webp|jpe?g|png)|https:\/\/[^\s]+)$/i;
/** Video: yalnız YouTube (müşteri çalışmayı YouTube'a herkese açık yüklüyor). */
const VIDEO_RE = /^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]{6,}[^\s]*$/i;

export const siteAdminSchema = z
  .object({
    name: z
      .string("Saha adı zorunludur.")
      .transform(clean)
      .pipe(
        z
          .string()
          .min(SITE_LIMITS.name.min, "Saha adı en az 2 karakter olmalı.")
          .max(SITE_LIMITS.name.max, "Saha adı çok uzun.")
      ),
    /** Boş bırakılırsa sunucu addan üretir (düzenlemede mevcut adres korunur). */
    slug: z
      .string()
      .transform((v) => v.trim().toLowerCase())
      .pipe(
        z
          .string()
          .max(80, "Adres çok uzun.")
          .refine((v) => v === "" || SLUG_RE.test(v), "Adres yalnız küçük harf, rakam ve tire içerebilir.")
      )
      .optional()
      .transform((v) => (v ? v : null)),
    province: optionalText(SITE_LIMITS.place, "İl adı çok uzun."),
    district: optionalText(SITE_LIMITS.place, "İlçe adı çok uzun."),
    area_hectares: z
      .number("Hektar sayı olmalı.")
      .positive("Hektar 0'dan büyük olmalı.")
      .max(SITE_LIMITS.areaMax, "Hektar değeri çok büyük.")
      .transform((v) => Math.round(v * 100) / 100)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    is_fire_affected: z.boolean().default(false),
    fire_year: z
      .number("Yangın yılı sayı olmalı.")
      .int("Yangın yılı tam sayı olmalı.")
      .min(SITE_LIMITS.fireYearMin, `Yangın yılı ${SITE_LIMITS.fireYearMin} ve sonrası olmalı.`)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    work_type: z.enum(WORK_TYPES, "Çalışma türü seçin."),
    species_slugs: z
      .array(z.string().regex(/^[a-z0-9-]{2,40}$/, "Geçersiz tür."))
      .max(SITE_LIMITS.species, `En çok ${SITE_LIMITS.species} tür seçilebilir.`)
      .default([])
      .transform((list) => [...new Set(list)]),
    name_en: optionalText(SITE_LIMITS.name.max, "İngilizce ad çok uzun."),
    name_ru: optionalText(SITE_LIMITS.name.max, "Rusça ad çok uzun."),
    summary_tr: optionalText(SITE_LIMITS.summary, "Türkçe tanıtım çok uzun."),
    summary_en: optionalText(SITE_LIMITS.summary, "İngilizce tanıtım çok uzun."),
    summary_ru: optionalText(SITE_LIMITS.summary, "Rusça tanıtım çok uzun."),
    cover_image: z
      .string()
      .transform((v) => v.trim())
      .pipe(
        z
          .string()
          .max(500, "Kapak adresi çok uzun.")
          .refine((v) => v === "" || (COVER_RE.test(v) && !v.includes("..")), "Kapak: /images/… yolu ya da https:// adresi olmalı.")
      )
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    video_url: z
      .string()
      .transform((v) => v.trim())
      .pipe(
        z
          .string()
          .max(300, "Video adresi çok uzun.")
          .refine((v) => v === "" || VIDEO_RE.test(v), "Video: https:// ile başlayan bir YouTube bağlantısı olmalı.")
      )
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    sort_order: z.number().int("Sıra tam sayı olmalı.").min(-9999).max(9999).default(0),
    status: z.enum(LAND_STATUSES, "Durum seçin."),
    is_public: z.boolean().default(true),
    capacity_seeds: z
      .number("Kapasite sayı olmalı.")
      .int("Kapasite tam sayı olmalı.")
      .positive("Kapasite 0'dan büyük olmalı.")
      .max(SITE_LIMITS.capacityMax, "Kapasite çok büyük."),
  })
  .superRefine((v, ctx) => {
    const thisYear = new Date().getFullYear();
    if (v.fire_year !== null && v.fire_year > thisYear) {
      ctx.addIssue({ code: "custom", path: ["fire_year"], message: "Yangın yılı gelecekte olamaz." });
    }
    if (v.fire_year !== null && !v.is_fire_affected) {
      ctx.addIssue({ code: "custom", path: ["fire_year"], message: "Yangın yılı yalnız yangın sahalarında girilir." });
    }
  });

export type SiteAdminInput = z.input<typeof siteAdminSchema>;
export type SiteAdminData = z.output<typeof siteAdminSchema>;

/** Doğrulanmış form verisini `lands` satırına çevirir (slug ve kapasite denetimi çağıranda). */
export function toLandRow(data: SiteAdminData) {
  const i18n = (pairs: [string, string | null][]) =>
    Object.fromEntries(pairs.filter((p): p is [string, string] => Boolean(p[1])));
  return {
    name: data.name,
    // `region`: eski ekranların (rezervasyon, e-posta) okuduğu alan — ille eşit tutulur.
    region: data.province,
    province: data.province,
    district: data.district,
    area_hectares: data.area_hectares,
    is_fire_affected: data.is_fire_affected,
    fire_year: data.is_fire_affected ? data.fire_year : null,
    work_type: data.work_type,
    species_slugs: data.species_slugs,
    name_i18n: i18n([["en", data.name_en], ["ru", data.name_ru]]),
    summary_i18n: i18n([["tr", data.summary_tr], ["en", data.summary_en], ["ru", data.summary_ru]]),
    cover_image: data.cover_image,
    video_url: data.video_url,
    sort_order: data.sort_order,
    status: data.status,
    is_public: data.is_public,
    capacity_seeds: data.capacity_seeds,
  };
}

/** İlk alan hatasını `{ alan: ileti }` haritasına çevirir. */
export function siteFieldErrors(issues: z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
