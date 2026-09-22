/**
 * Sipariş sihirbazı — istemci ve sunucunun ORTAK doğrulama şeması.
 *
 * Hata iletileri i18n anahtarıdır ("orderWizard.errors.<anahtar>"); kalıp talep
 * formlarıyla aynıdır (lib/requests/schema.ts). TUTAR bu şemada YOKTUR: istemci
 * tutar göndermez, gönderse de okunmaz — sunucu lib/pricing.ts ile hesaplar.
 */
import { z } from "zod";
import { isOwnCertificateName } from "@/lib/certificates/publication";
import { TR_IL_KODLARI } from "@/lib/tr-iller";
import { QTY_HARD_LIMITS } from "@/lib/pricing";
import { certificateNameSchema, cleanText, normalizePhone, LOCALES } from "@/lib/requests/schema";
import { isValidTaxId, isValidTckn } from "./tax-ids";
import { ORDER_NO_RE } from "./types";

const requiredText = (min: number, max: number, keys: { required: string; short: string }) =>
  z
    .string(keys.required)
    .max(max * 2, "tooLong")
    .transform((v) => cleanText(v))
    // Boş bırakılan alan "zorunlu", kısa kalan alan "kısa" iletisini alır (ilk hata gösterilir).
    .pipe(z.string().min(1, keys.required).min(min, keys.short).max(max, "tooLong"));

const optionalText = (max: number) =>
  z
    .string()
    .max(max * 2, "tooLong")
    .transform((v) => cleanText(v))
    .pipe(z.string().max(max, "tooLong"))
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const digitsOnly = (v: string) => v.replace(/[\s.-]/g, "");

/* ── Alıcı ────────────────────────────────────────────────────────────────── */

export const buyerSchema = z.object({
  firstName: requiredText(2, 60, { required: "firstNameRequired", short: "firstNameRequired" }),
  lastName: requiredText(2, 60, { required: "lastNameRequired", short: "lastNameRequired" }),
  // Siparişte e-posta ZORUNLU: teyit, sözleşme, fatura ve sertifika e-postayla iletilir.
  email: z
    .string("emailRequired")
    .max(200, "tooLong")
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().min(1, "emailRequired").pipe(z.email("emailInvalid"))),
  phone: z
    .string("phoneRequired")
    .max(40, "tooLong")
    .transform((v) => v.trim())
    .superRefine((v, ctx) => {
      if (!v) ctx.addIssue({ code: "custom", message: "phoneRequired" });
      else if (normalizePhone(v) === null) ctx.addIssue({ code: "custom", message: "phoneInvalid" });
    })
    .transform((v) => normalizePhone(v) as string),
});

/* ── Fatura ───────────────────────────────────────────────────────────────── */

export const addressSchema = z.object({
  province: z
    .string("provinceRequired")
    .min(1, "provinceRequired")
    .refine((v) => TR_IL_KODLARI.includes(v), "provinceInvalid"),
  district: requiredText(2, 80, { required: "districtRequired", short: "districtRequired" }),
  line: requiredText(10, 300, { required: "addressRequired", short: "addressShort" }),
  postalCode: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().refine((v) => v === "" || /^\d{5}$/.test(v), "postalCodeInvalid"))
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});

export const individualInvoiceSchema = z.object({
  type: z.literal("individual"),
  address: addressSchema,
  /** İsteğe bağlı — e-Arşiv faturada verilmezse 11111111111 kullanılır. */
  tckn: z
    .string()
    .transform(digitsOnly)
    .pipe(z.string().refine((v) => v === "" || isValidTckn(v), "tcknInvalid"))
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});

export const corporateInvoiceSchema = z.object({
  type: z.literal("corporate"),
  companyTitle: requiredText(2, 200, { required: "companyTitleRequired", short: "companyTitleRequired" }),
  /** VKN (10 hane) ya da şahıs işletmesinde TCKN (11 hane). */
  taxId: z
    .string("taxIdRequired")
    .transform(digitsOnly)
    .pipe(z.string().min(1, "taxIdRequired").refine(isValidTaxId, "taxIdInvalid")),
  taxOffice: requiredText(2, 80, { required: "taxOfficeRequired", short: "taxOfficeRequired" }),
  address: addressSchema,
  authorizedPerson: requiredText(2, 120, { required: "authorizedPersonRequired", short: "authorizedPersonRequired" }),
  mersis: z
    .string()
    .transform(digitsOnly)
    .pipe(z.string().refine((v) => v === "" || /^\d{16}$/.test(v), "mersisInvalid"))
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  kep: z
    .string()
    .max(200, "tooLong")
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().refine((v) => v === "" || z.email().safeParse(v).success, "kepInvalid"))
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  poNumber: optionalText(40),
  eInvoiceUser: z.boolean().default(false),
});

export const invoiceSchema = z.discriminatedUnion("type", [individualInvoiceSchema, corporateInvoiceSchema], {
  error: "invoiceTypeRequired",
});

/* ── Onaylar ──────────────────────────────────────────────────────────────── */

/**
 * Kutular arayüzde AYRI ve işaretsiz gelir. `kvkkRead` rıza değil, aydınlatma
 * metninin okunduğu beyanıdır. `marketing` isteğe bağlıdır; satışın şartı
 * yapılamaz. `corporateAuthority` yalnız kurumsal faturada zorunludur.
 */
export const consentsSchema = z.object({
  preInfo: z.literal(true, "preInfoRequired"),
  contract: z.literal(true, "contractRequired"),
  kvkkRead: z.literal(true, "kvkkRequired"),
  marketing: z.boolean().default(false),
  certificatePublication: z.boolean().default(false),
  corporateAuthority: z.boolean().default(false),
});

/* ── Sipariş gövdesi ──────────────────────────────────────────────────────── */

const orderFields = z.object({
  /** Saha kimliği — sunucu yayında ve katılıma açık olduğunu ayrıca doğrular. */
  landId: z.uuid("landInvalid"),
  // Geçerli en az / en çok adet satış ayarlarındadır; önizleme ve sipariş uçları ayrıca denetler.
  quantity: z
    .number("quantityInvalid")
    .int("quantityInvalid")
    .min(QTY_HARD_LIMITS.min, "quantityMin")
    .max(QTY_HARD_LIMITS.max, "quantityMax"),
  /** Boşsa sertifikaya alıcının adı soyadı yazılır (sunucuda doldurulur). */
  certificateName: certificateNameSchema,
  buyer: buyerSchema,
  invoice: invoiceSchema,
  consents: consentsSchema,
  locale: z.enum(LOCALES).default("tr"),
  /** Müşteriye gösterilen hukuki metinlerin şablon sürümü; sunucu güncel sürümle karşılaştırır. */
  documentsVersion: z.string().min(1, "documentsStale").max(40, "documentsStale"),
  /** Idempotency: sihirbaz açılışında üretilir; ağ tekrarı tek sipariş oluşturur. */
  clientToken: z.uuid("generic"),
  /** Honeypot ve doldurma süresi — talep formlarıyla aynı bot sinyalleri. */
  website: z.string().max(200).optional(),
  elapsedMs: z.number().int().nonnegative().max(86_400_000).optional(),
  sourcePath: z.string().max(300).optional(),
});

export const orderPayloadSchema = orderFields.superRefine((v, ctx) => {
  if (v.consents.certificatePublication && !isOwnCertificateName(resolveCertificateName(v), v.buyer)) {
    ctx.addIssue({ code: "custom", path: ["consents", "certificatePublication"], message: "certificatePublicationSelfOnly" });
  }
  if (v.invoice.type === "corporate" && !v.consents.corporateAuthority) {
    ctx.addIssue({ code: "custom", path: ["consents", "corporateAuthority"], message: "corporateAuthorityRequired" });
  }
});

/** 4. adımın önizlemesi: onay kutuları ve idempotency alanları henüz yoktur. */
export const orderPreviewSchema = orderFields.pick({
  landId: true,
  quantity: true,
  certificateName: true,
  buyer: true,
  invoice: true,
  locale: true,
});

export type OrderPayloadInput = z.input<typeof orderPayloadSchema>;
export type OrderPayload = z.output<typeof orderPayloadSchema>;
export type OrderPreviewPayload = z.output<typeof orderPreviewSchema>;

/**
 * Sertifikada görünecek ad: verilen ad ya da alıcının adı soyadı. Yedek ad da
 * sertifika karakter kümesine ve 60 karakter sınırına indirgenir (alıcı adında
 * bu küme dışı bir işaret varsa atılır).
 */
export function resolveCertificateName(payload: Pick<OrderPayload, "certificateName" | "buyer">): string {
  if (payload.certificateName) return payload.certificateName;
  const fallback = [...`${payload.buyer.firstName} ${payload.buyer.lastName}`]
    .filter((ch) => /[\p{L}\p{M}\p{N} .,'’&()/+-]/u.test(ch))
    .join("");
  return cleanText(fallback).slice(0, 60).trim();
}

/* ── Cayma bildirimi (/cayma) ─────────────────────────────────────────────── */

/**
 * Sipariş numarası + siparişte kullanılan e-posta birlikte istenir; ikisi
 * eşleşmezse sunucu "bulunamadı" der (hangisinin yanlış olduğunu söylemez).
 */
export const withdrawalRequestSchema = z.object({
  orderNo: z
    .string("orderNoRequired")
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().min(1, "orderNoRequired").regex(ORDER_NO_RE, "orderNoInvalid")),
  email: z
    .string("emailRequired")
    .max(200, "tooLong")
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().min(1, "emailRequired").pipe(z.email("emailInvalid"))),
  /** İsteğe bağlı açıklama — cayma için gerekçe GEREKMEZ. */
  note: optionalText(500),
  locale: z.enum(LOCALES).default("tr"),
  website: z.string().max(200).optional(),
  elapsedMs: z.number().int().nonnegative().max(86_400_000).optional(),
});

export type WithdrawalRequestInput = z.input<typeof withdrawalRequestSchema>;
