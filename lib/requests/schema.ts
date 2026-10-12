/**
 * Talep formları — istemci ve sunucunun ORTAK doğrulama şemaları.
 *
 * Hata mesajları i18n anahtarıdır ("requestForms.errors.<anahtar>"); istemci
 * `t(issue.message)` ile çevirir, sunucu aynı anahtarı döner. Böylece kural
 * tek yerde yaşar, iki tarafta da aynı biçimde uygulanır.
 *
 * Sunucu ek olarak: honeypot, doldurma süresi, rate limit, katalog/arazi
 * varlığı, IP hash — bkz. app/api/public/talep/route.ts
 */
import { ANONYMOUS_CERTIFICATE_NAME, isCompanyCertificateName } from "@/lib/certificates/publication";
import { z } from "zod";
import { TR_IL_KODLARI } from "@/lib/tr-iller";
import { QTY_HARD_LIMITS, RELEASE_QTY } from "@/lib/pricing";
import { CERTIFICATE_NAME } from "@/lib/certificates/types";

/* ── Sabitler ─────────────────────────────────────────────────────────────── */

/**
 * DB'deki tür kümesi. `seed_purchase` (doğrudan tohum talebi) 2026-09'da
 * kaldırıldı: yeni kayıt kabul edilmez, yalnız eski kayıtlar okunabilsin diye
 * listede durur. Yeni talep alınan türler: `ACTIVE_REQUEST_TYPES`.
 */
export const REQUEST_TYPES = ["seed_purchase", "land_application", "open_land_seeding"] as const;
export const ACTIVE_REQUEST_TYPES = ["open_land_seeding", "land_application"] as const;
export const REQUEST_STATUSES = ["new", "contacted", "quoted", "converted", "closed", "spam"] as const;
export const LOCALES = ["tr", "en", "ru"] as const;

export const LAND_CONDITIONS = ["burnt", "mine", "erosion", "idle", "other"] as const;
export const OWNERSHIP_TYPES = ["own", "institution", "cooperative", "other"] as const;
export const TIMING_OPTIONS = ["this_season", "six_months", "flexible"] as const;
export const AREA_UNITS = ["dekar", "hektar"] as const;

export { RELEASE_QTY, CERTIFICATE_NAME };
export const AREA = { min: 0.1, max: 1_000_000 } as const;
export const MIN_FILL_MS = 3_000; // bu süreden hızlı gönderim → bot şüphesi

/**
 * KVKK onay kutusu metninin sürümü — metin değişirse artırılır, kayıtta saklanır.
 * 2026-09-21: kutu "açık rıza" dilinden çıkarıldı. Talebe dönüş için veri işleme
 * rızaya değil talebin kendisine dayanır (KVKK m.5/2-c); kutu yalnız aydınlatma
 * metninin okunduğunu ve iletişim isteğini beyan eder. Rıza gerektiren izinler
 * (ticari ileti) sipariş akışında AYRI ve isteğe bağlı kutuyla alınacak.
 */
export const CONSENT_VERSION = "2026-09-21";

/* ── Yardımcılar ──────────────────────────────────────────────────────────── */

/**
 * Telefonu E.164'e normalize eder. Türkiye numaraları için "05xx", "5xx",
 * "90 5xx", "+90 5xx" biçimlerinin hepsi "+905xxxxxxxxx" olur. Diğer ülkeler
 * "+" ile başlıyorsa olduğu gibi (rakamlar) kabul edilir. Geçersizse null.
 */
export function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s().-]/g, "");
  if (!s) return null;
  let digits: string;
  if (s.startsWith("+")) {
    digits = s.slice(1);
    if (!/^\d{8,15}$/.test(digits)) return null;
    // +90 ile başlayan TR numarası: 10 haneli ulusal kısım, 5 ile başlamalı (mobil)
    // ya da sabit hat (2xx/3xx/4xx/8xx). Diğer ülkelerde format kontrolü yapılmaz.
    if (digits.startsWith("90") && !/^90[2-58]\d{9}$/.test(digits)) return null;
    return `+${digits}`;
  }
  if (!/^\d+$/.test(s)) return null;
  if (/^0[2-58]\d{9}$/.test(s)) return `+9${s}`;        // 05xx xxx xx xx → +905xx…
  if (/^[2-58]\d{9}$/.test(s)) return `+90${s}`;        // 5xx xxx xx xx
  if (/^90[2-58]\d{9}$/.test(s)) return `+${s}`;        // 905xx…
  return null;
}

/** Kontrol karakterlerini temizle, boşlukları sadeleştir. */
export function cleanText(v: string): string {
  return v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\s+/g, " ").trim();
}

/** Çok satırlı metin: satır sonları korunur, diğer kontrol karakterleri temizlenir. */
export function cleanMultiline(v: string): string {
  return v
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const optionalText = (max: number) =>
  z
    .string()
    .max(max, "tooLong")
    .transform((v) => cleanText(v))
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalMultiline = (max: number) =>
  z
    .string()
    .max(max, "tooLong")
    .transform((v) => cleanMultiline(v))
    .optional()
    .transform((v) => (v ? v : undefined));

/* ── Ortak iletişim bloğu ─────────────────────────────────────────────────── */

export const contactSchema = z
  .object({
    contactName: z
      .string("nameRequired")
      .transform((v) => cleanText(v))
      .pipe(z.string().min(2, "nameShort").max(120, "tooLong")),
    email: z
      .string()
      .max(200, "tooLong")
      .transform((v) => v.trim().toLowerCase())
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(z.email("emailInvalid").optional()),
    phone: z
      .string()
      .max(40, "tooLong")
      .optional()
      .transform((v) => (v && v.trim() ? v.trim() : undefined))
      .superRefine((v, ctx) => {
        if (v !== undefined && normalizePhone(v) === null) {
          ctx.addIssue({ code: "custom", message: "phoneInvalid" });
        }
      })
      .transform((v) => (v === undefined ? undefined : (normalizePhone(v) as string))),
    company: optionalText(160),
    message: optionalMultiline(2000),
    consent: z.literal(true, "consentRequired"),
    locale: z.enum(LOCALES).default("tr"),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "contactRequired" });
    }
  });

/* ── Tür şemaları ─────────────────────────────────────────────────────────── */

const provinceSchema = z
  .string("provinceRequired")
  .min(1, "provinceRequired")
  .refine((v) => TR_IL_KODLARI.includes(v), "provinceInvalid");

export const landApplicationSchema = z.object({
  type: z.literal("land_application"),
  province: provinceSchema,
  district: optionalText(80),
  areaValue: z
    .number("areaRequired")
    .min(AREA.min, "areaMin")
    .max(AREA.max, "areaMax"),
  areaUnit: z.enum(AREA_UNITS, "areaUnitInvalid"),
  conditions: z.array(z.enum(LAND_CONDITIONS)).min(1, "conditionRequired").max(LAND_CONDITIONS.length),
  ownership: z.enum(OWNERSHIP_TYPES, "ownershipRequired"),
  timing: z.enum(TIMING_OPTIONS, "timingRequired"),
  mapLink: z
    .string()
    .max(500, "tooLong")
    .transform((v) => v.trim())
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.url({ protocol: /^https?$/, message: "urlInvalid" }).optional()),
  accessNotes: optionalMultiline(1500),
});

/**
 * Katılım Sertifikası'nda görünecek ad. Harf (her alfabe), rakam, boşluk ve ad
 * yazımında geçen birkaç işaret kabul edilir; bağlantı, emoji ve süs karakteri
 * sertifika görselinde bozuk çıkacağı için reddedilir.
 */
const CERTIFICATE_NAME_RE = /^[\p{L}\p{M}\p{N} .,'’&()/+-]+$/u;

export const certificateNameSchema = z
  .string()
  .max(200, "tooLong")
  .transform((v) => cleanText(v))
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(
    z
      .string()
      .min(CERTIFICATE_NAME.min, "certificateNameShort")
      .max(CERTIFICATE_NAME.max, "certificateNameLong")
      .regex(CERTIFICATE_NAME_RE, "certificateNameInvalid")
      .optional()
  );

/**
 * Proje Uygulama Sahasına tohum topu bıraktırma talebi. (Tür adı DB'de
 * `open_land_seeding` olarak kalır; görünen ad lib/requests/labels.ts'te.)
 */
export const openLandSeedingSchema = z.object({
  type: z.literal("open_land_seeding"),
  landId: z.uuid("landInvalid"),
  // Geçerli en az / en çok adet satış ayarlarındadır; talep ucu ayrıca denetler.
  quantity: z
    .number("quantityInvalid")
    .int("quantityInvalid")
    .min(QTY_HARD_LIMITS.min, "quantityMin")
    .max(QTY_HARD_LIMITS.max, "quantityMax"),
  certificateName: certificateNameSchema,
});

export const requestDetailsSchema = z.discriminatedUnion(
  "type",
  [landApplicationSchema, openLandSeedingSchema],
  // Bilinmeyen/kaldırılmış tür (ör. eski `seed_purchase`) → ham zod iletisi yerine anahtar
  { error: "typeInvalid" }
);

/** API gövdesi: iletişim + tür detayları + bot sinyalleri. */
export const requestPayloadSchema = z.object({
  contact: contactSchema,
  details: requestDetailsSchema,
  /** Honeypot — gerçek kullanıcı görmez; doluysa sunucu sessizce "ok" döner. */
  website: z.string().max(200).optional(),
  /** Form açılışından gönderime geçen süre (ms) — istemci ölçer, sunucu eşik uygular. */
  elapsedMs: z.number().int().nonnegative().max(86_400_000).optional(),
  sourcePath: z.string().max(300).optional(),
  /** Idempotency: form açılışında üretilir; ağ tekrarı aynı token'ı yollar → tek kayıt. */
  clientToken: z.uuid().optional(),
}).superRefine((v, ctx) => {
  // Talepte de üçüncü kişi adı alınmaz: sertifika adı ya iletişim kurulan kişinin kendi adı ya da adsız.
  if (v.details.type !== "open_land_seeding" || !v.details.certificateName) return;
  const name = v.details.certificateName;
  if (name !== ANONYMOUS_CERTIFICATE_NAME && !isCompanyCertificateName(name, v.contact.contactName)) {
    ctx.addIssue({ code: "custom", path: ["details", "certificateName"], message: "certificateNameThirdParty" });
  }
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactData = z.output<typeof contactSchema>;
export type RequestDetailsInput = z.input<typeof requestDetailsSchema>;
export type RequestDetails = z.output<typeof requestDetailsSchema>;
export type RequestPayloadInput = z.input<typeof requestPayloadSchema>;
export type RequestPayload = z.output<typeof requestPayloadSchema>;

/**
 * Zod sonucunu { alanYolu: hataAnahtarı } haritasına çevirir — formlar bunu
 * alan altı mesajlarına, sunucu ise 400 yanıtına koyar. Aynı alan için ilk
 * hata korunur.
 */
export function issuesToFieldErrors(issues: z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join(".") || "_form";
    if (!(path in out)) out[path] = issue.message;
  }
  return out;
}
