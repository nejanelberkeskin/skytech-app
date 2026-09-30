/**
 * Bilgi formu (/bilgi-al) kuralları — istemci ve sunucu AYNI modülü kullanır (app/api/public/bilgi-al/route.ts).
 * Değerler kırpılarak denetlenir; yalnız boşluktan oluşan ad ya da mesaj boş sayılır.
 */
export const CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CONTACT_LIMITS = { name: 200, email: 254, phone: 40, company: 200, subject: 200, message: 5000 } as const;

export type ContactField = "name" | "email" | "phone" | "company" | "subject" | "message" | "noticeRead";
/** Sunucu yanıtındaki `reason` ile aynı adlar. */
export type ContactProblem = "required" | "invalid_email" | "too_long" | "notice_required";
/** Ekrandaki sıra: odak ilk hatalı alana gider. */
export const CONTACT_FIELD_ORDER: readonly ContactField[] = ["name", "email", "phone", "company", "subject", "message", "noticeRead"];

export interface ContactInput {
  name: unknown; email: unknown; phone?: unknown; company?: unknown; subject: unknown; message: unknown; noticeRead: unknown;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Alan → sorun. Boş sonuç: gönderilebilir. */
export function validateContact(input: ContactInput): Partial<Record<ContactField, ContactProblem>> {
  const problems: Partial<Record<ContactField, ContactProblem>> = {};
  const values = {
    name: text(input.name), email: text(input.email), phone: text(input.phone), company: text(input.company),
    subject: text(input.subject), message: text(input.message),
  };
  for (const field of ["name", "email", "subject", "message"] as const) if (!values[field]) problems[field] = "required";
  if (!problems.email && !CONTACT_EMAIL_RE.test(values.email)) problems.email = "invalid_email";
  for (const [field, max] of Object.entries(CONTACT_LIMITS) as [keyof typeof CONTACT_LIMITS, number][]) {
    if (!problems[field] && values[field].length > max) problems[field] = "too_long";
  }
  if (input.noticeRead !== true) problems.noticeRead = "notice_required";
  return problems;
}

/** Sunucunun 400 yanıtındaki alanlar (`{ fields, reason }`); tanınmayan değerler yok sayılır. */
export function problemsFromResponse(body: unknown): Partial<Record<ContactField, ContactProblem>> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const { fields, reason } = body as { fields?: unknown; reason?: unknown };
  if (!Array.isArray(fields)) return {};
  const kind: ContactProblem = reason === "invalid_email" || reason === "too_long" || reason === "notice_required" ? reason : "required";
  const problems: Partial<Record<ContactField, ContactProblem>> = {};
  for (const field of fields) if ((CONTACT_FIELD_ORDER as readonly unknown[]).includes(field)) problems[field as ContactField] = kind;
  return problems;
}
