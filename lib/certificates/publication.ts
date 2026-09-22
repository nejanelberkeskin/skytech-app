/** Yayın izni yalnız ilgili kişinin kendi adına ve kaydedilen ada bağlıdır. */
import type { OrderConsents } from "@/lib/orders/types";
export const HIDDEN_CERTIFICATE_NAME = "Ad paylaşılmıyor";
const normalized = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
export function isOwnCertificateName(name: string, buyer: { firstName: string; lastName: string }): boolean {
  return normalized(name) === normalized(`${buyer.firstName} ${buyer.lastName}`);
}
export function publicCertificateName(order: {
  certificate_name: string; buyer_first_name: string; buyer_last_name: string; consents: OrderConsents;
}): string {
  const consent = order.consents?.certificatePublication;
  return consent?.granted === true && !consent.revokedAt && consent.subjectName === order.certificate_name &&
    isOwnCertificateName(order.certificate_name, { firstName: order.buyer_first_name, lastName: order.buyer_last_name })
    ? order.certificate_name : HIDDEN_CERTIFICATE_NAME;
}
