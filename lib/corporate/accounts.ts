/**
 * Kurumsal hesap başvurusu ve yönetici onayı (043). Kurum başvurur → yönetim (corporate.review) onaylar ya da reddeder →
 * yalnız onaylı hesap kurumsal panelde teklif ekleyebilir (veritabanı politikası da aynı kuralı uygular).
 */
import { z } from "zod";
import { isValidTaxId } from "@/lib/orders/tax-ids";
import { normalizePhone } from "@/lib/requests/schema";

export const CORPORATE_STATUSES = ["pending", "approved", "rejected"] as const;
export type CorporateStatus = (typeof CORPORATE_STATUSES)[number];

const text = (min: number, max: number, key: string) =>
  z.string(key).trim().min(min, key).max(max, "tooLong");

/** Başvuru gövdesi. Şifre yalnız oturum yoksa (yeni hesap) zorunludur; bunu uç denetler. */
export const corporateApplicationSchema = z.object({
  companyTitle: text(2, 200, "companyTitleRequired"),
  taxId: z
    .string("taxIdRequired")
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(1, "taxIdRequired").refine(isValidTaxId, "taxIdInvalid")),
  taxOffice: text(2, 80, "taxOfficeRequired"),
  address: text(10, 400, "addressShort"),
  authorizedPerson: text(2, 120, "authorizedPersonRequired"),
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
  password: z.string().max(200, "tooLong").optional(),
  /** Kurum adına başvurmaya yetkili olduğunu onaylar. */
  authority: z.literal(true, "authorityRequired"),
  website: z.string().max(200).optional(),
});
export type CorporateApplication = z.output<typeof corporateApplicationSchema>;

export const PASSWORD_MIN = 8;

/** Yönetim kararı. */
export const corporateDecisionSchema = z
  .object({
    userId: z.uuid(),
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

export interface CorporateAccountItem {
  userId: string;
  companyTitle: string;
  taxId: string;
  taxOffice: string;
  address: string;
  authorizedPerson: string;
  email: string;
  phone: string;
  status: CorporateStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const CORPORATE_ACCOUNT_COLUMNS =
  "user_id, company_title, tax_id, tax_office, address, authorized_person, contact_email, phone, status, review_note, reviewed_at, created_at";

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");

export function corporateAccountOf(row: Row): CorporateAccountItem {
  return {
    userId: s(row.user_id),
    companyTitle: s(row.company_title),
    taxId: s(row.tax_id),
    taxOffice: s(row.tax_office),
    address: s(row.address),
    authorizedPerson: s(row.authorized_person),
    email: s(row.contact_email),
    phone: s(row.phone),
    status: (CORPORATE_STATUSES as readonly string[]).includes(s(row.status)) ? (row.status as CorporateStatus) : "pending",
    reviewNote: typeof row.review_note === "string" ? row.review_note : null,
    reviewedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    createdAt: s(row.created_at),
  };
}
