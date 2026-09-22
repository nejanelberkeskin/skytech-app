import type { ReactNode } from "react";
import type { OrderPayloadInput } from "@/lib/orders/schema";
import type { OrderSchedule } from "@/lib/orders/schedule";
import type { PriceLocale, PublicPricing } from "@/lib/pricing";

export interface WizardSite {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  hectares: string | null;
  fire: string | null;
  workType: string;
  species: string[];
  cover: string | null;
}
export interface WizardProps {
  site: WizardSite;
  locale: PriceLocale;
  mode: "order" | "request";
  schedule: OrderSchedule;
  dateLabels: Record<string, string>;
  timeline: ReactNode;
  /** Satış ayarlarından: birim bedel, en az / en çok adet, hazır seçenekler. */
  pricing: PublicPricing;
}
export type Buyer = OrderPayloadInput["buyer"];
export interface InvoiceValues {
  type: "" | "individual" | "corporate";
  province: string;
  district: string;
  line: string;
  postalCode: string;
  tckn: string;
  companyTitle: string;
  taxId: string;
  taxOffice: string;
  authorizedPerson: string;
  mersis: string;
  kep: string;
  poNumber: string;
  eInvoiceUser: boolean;
}
export const EMPTY_INVOICE: InvoiceValues = {
  type: "",
  province: "",
  district: "",
  line: "",
  postalCode: "",
  tckn: "",
  companyTitle: "",
  taxId: "",
  taxOffice: "",
  authorizedPerson: "",
  mersis: "",
  kep: "",
  poNumber: "",
  eInvoiceUser: false,
};
export const EMPTY_CONSENTS = {
  preInfo: false,
  contract: false,
  kvkkRead: false,
  corporateAuthority: false,
  marketing: false,
  certificatePublication: false,
};
export type Consents = typeof EMPTY_CONSENTS;
export function invoiceInput(value: InvoiceValues) {
  const address = {
    province: value.province,
    district: value.district,
    line: value.line,
    postalCode: value.postalCode,
  };
  return value.type === "corporate"
    ? {
        type: "corporate" as const,
        address,
        companyTitle: value.companyTitle,
        taxId: value.taxId,
        taxOffice: value.taxOffice,
        authorizedPerson: value.authorizedPerson,
        mersis: value.mersis,
        kep: value.kep,
        poNumber: value.poNumber,
        eInvoiceUser: value.eInvoiceUser,
      }
    : { type: value.type, address, tckn: value.tckn };
}
export function errorStep(fields: Record<string, string>): number {
  const paths = Object.keys(fields);
  if (
    paths.some(
      (p) =>
        p === "quantity" ||
        p === "landId" ||
        p.startsWith("details.quantity") ||
        p === "details.landId",
    )
  )
    return 1;
  if (
    paths.some(
      (p) => p === "certificateName" || p === "details.certificateName",
    )
  )
    return 2;
  if (
    paths.some(
      (p) =>
        p.startsWith("buyer") ||
        p.startsWith("invoice") ||
        p.startsWith("contact"),
    )
  )
    return 3;
  return 4;
}
