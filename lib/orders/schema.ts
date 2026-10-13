/**
 * Sipariş sihirbazı — istemci ve sunucunun ORTAK doğrulama şeması.
 *
 * Hata iletileri i18n anahtarıdır ("orderWizard.errors.<anahtar>"); kalıp talep
 * formlarıyla aynıdır (lib/requests/schema.ts). TUTAR bu şemada YOKTUR: istemci
 * tutar göndermez, gönderse de okunmaz — sunucu lib/pricing.ts ile hesaplar.
 */
import { z } from "zod";
import { ANONYMOUS_CERTIFICATE_NAME, isCompanyCertificateName, isOwnCertificateName } from "@/lib/certificates/publication";
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

/**
 * Ödemede dur kaydı (PAYMENT_SOON): ödeme yokken alıcıya e-posta ya da telefondan biriyle ulaşılır; en az biri zorunlu.
 * Gerçek siparişte `buyerSchema` geçerlidir (e-posta zorunlu: teyit, sözleşme, fatura ve sertifika e-postayla gider).
 */
export const preorderBuyerSchema = z
  .object({
    firstName: buyerSchema.shape.firstName,
    lastName: buyerSchema.shape.lastName,
    email: z
      .string()
      .max(200, "tooLong")
      .transform((v) => v.trim().toLowerCase())
      .pipe(z.string().refine((v) => v === "" || z.email().safeParse(v).success, "emailInvalid")),
    phone: z
      .string()
      .max(40, "tooLong")
      .transform((v) => v.trim())
      .refine((v) => v === "" || normalizePhone(v) !== null, "phoneInvalid")
      .transform((v) => (v ? (normalizePhone(v) as string) : "")),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) ctx.addIssue({ code: "custom", path: ["email"], message: "contactRequired" });
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
 * Kutular arayüzde AYRI ve işaretsiz gelir. KVKK aydınlatması kutu değildir (bildirim olarak gösterilir);
 * eski istemcilerin gönderdiği `kvkkRead` kabul edilir ama kaydedilmez ve şart değildir. `marketing`
 * isteğe bağlıdır, satışın şartı yapılamaz. `corporateAuthority` yalnız kurumsal faturada zorunludur.
 */
export const consentsSchema = z.object({
  preInfo: z.literal(true, "preInfoRequired"),
  contract: z.literal(true, "contractRequired"),
  kvkkRead: z.boolean().optional(),
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
  /**
   * Sertifikadaki ad: alıcının kendi adı (varsayılan), kurumsal faturada kurum unvanı ya da adsız. Başka bir
   * kişinin adı ALINMAZ: KVKK aydınlatma metni 2026-10.5 — satın alanın "izin aldım" beyanı üçüncü kişi için işleme
   * şartı değildir; uygulanabilir şart yoksa sertifika adsız hazırlanır, çocuk adı toplanmaz.
   */
  certificateMode: z.enum(["own", "company", "anonymous"]).default("own"),
  /** Eski istemciler: boşsa kipe göre doldurulur; doluysa yalnız alıcının kendi adı ya da kurum unvanı olabilir. */
  certificateName: certificateNameSchema,
  buyer: buyerSchema,
  invoice: invoiceSchema,
  consents: consentsSchema,
  locale: z.enum(LOCALES).default("tr"),
  /** Müşteriye gösterilen hukuki metinlerin şablon sürümü; sunucu güncel sürümle karşılaştırır. */
  documentsVersion: z.string().min(1, "documentsStale").max(80, "documentsStale"),
  /** Idempotency: sihirbaz açılışında üretilir; ağ tekrarı tek sipariş oluşturur. */
  clientToken: z.uuid("generic"),
  /** Honeypot ve doldurma süresi — talep formlarıyla aynı bot sinyalleri. */
  website: z.string().max(200).optional(),
  elapsedMs: z.number().int().nonnegative().max(86_400_000).optional(),
  sourcePath: z.string().max(300).optional(),
});

/** Üçüncü kişi adı yok: ad ya alıcının kendisi, ya kurumsal alıcının unvanı ya da adsız. */
function certificateNameRule(v: Pick<OrderPayload, "certificateMode" | "certificateName" | "buyer" | "invoice">, ctx: z.RefinementCtx) {
  if (v.certificateMode === "company" && v.invoice.type !== "corporate") {
    ctx.addIssue({ code: "custom", path: ["certificateMode"], message: "certificateCompanyRequiresCorporate" });
  }
  const name = v.certificateName;
  if (name && v.certificateMode === "own" && !isOwnCertificateName(name, v.buyer)
      && !(v.invoice.type === "corporate" && isCompanyCertificateName(name, v.invoice.companyTitle))) {
    ctx.addIssue({ code: "custom", path: ["certificateName"], message: "certificateNameThirdParty" });
  }
}

export const orderPayloadSchema = orderFields.superRefine((v, ctx) => {
  certificateNameRule(v, ctx);
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
  certificateMode: true,
  certificateName: true,
  buyer: true,
  invoice: true,
  locale: true,
}).superRefine(certificateNameRule);

export type OrderPayloadInput = z.input<typeof orderPayloadSchema>;
export type OrderPayload = z.output<typeof orderPayloadSchema>;
export type OrderPreviewPayload = z.output<typeof orderPreviewSchema>;

/**
 * Sertifikada görünecek ad: verilen ad ya da alıcının adı soyadı. Yedek ad da
 * sertifika karakter kümesine ve 60 karakter sınırına indirgenir (alıcı adında
 * bu küme dışı bir işaret varsa atılır).
 */
export function resolveCertificateName(
  payload: Pick<OrderPayload, "certificateName" | "buyer"> & Partial<Pick<OrderPayload, "certificateMode" | "invoice">>,
): string {
  if (payload.certificateMode === "anonymous") return ANONYMOUS_CERTIFICATE_NAME;
  if (payload.certificateMode === "company" && payload.invoice?.type === "corporate") return cleanText(payload.invoice.companyTitle).slice(0, 60).trim();
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
