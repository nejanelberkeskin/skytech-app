/**
 * Siparişe özel hukuki belgelerin üretimi — YALNIZ SUNUCU.
 *
 *   buildLegalContext()  sipariş verisi → şablonların kullandığı düz bağlam
 *   buildOrderDocuments() bağlam → [Ön Bilgilendirme, Sözleşme, Cayma Formu]
 *                         her biri: HTML kopya + SHA-256 özeti (+ istenirse PDF)
 *
 * Önizleme (4. adım) ile sipariş anındaki kopya AYNI işlevden çıkar; tek fark
 * sipariş numarasıdır. Müşterinin onayladığı metin ile saklanan metin bu yüzden
 * madde madde aynıdır.
 */
import { createHash } from "node:crypto";
import { ilAdi } from "@/lib/tr-iller";
import { formatHectares, formatSiteLocation } from "@/lib/sites/format";
import type { OrderSchedule } from "@/lib/orders/schedule";
import { resolveCertificateName, type OrderPreviewPayload } from "@/lib/orders/schema";
import type { DocumentKind, SiteSnapshot } from "@/lib/orders/types";
import { renderLegalHtml } from "./render-html";
import { contractDocument } from "./templates/contract";
import { preInfoDocument } from "./templates/pre-info";
import { withdrawalFormDocument } from "./templates/withdrawal-form";
import type { LegalBuyer, LegalContext, LegalDocument, LegalSite } from "./types";
import { LEGAL_DOCUMENTS_VERSION } from "./version";

const WORK_TYPE_TR: Record<SiteSnapshot["workType"], string> = {
  ormanlastirma: "Ormanlaştırma",
  genclestirme: "Gençleştirme",
  ormanlastirma_genclestirme: "Ormanlaştırma – Gençleştirme",
};

export function legalSiteFrom(site: SiteSnapshot): LegalSite {
  return {
    name: site.name,
    location: formatSiteLocation(site),
    area: site.areaHectares !== null ? `${formatHectares(site.areaHectares, "tr")} hektar` : null,
    fire: site.isFireAffected ? (site.fireYear ? `Yangın Sahası (${site.fireYear})` : "Yangın Sahası") : null,
    workType: WORK_TYPE_TR[site.workType],
    species: site.species.map((s) => (s.latinName ? `${s.name} (${s.latinName})` : s.name)),
  };
}

export function legalBuyerFrom(input: Pick<OrderPreviewPayload, "buyer" | "invoice">): LegalBuyer {
  const { buyer, invoice } = input;
  const a = invoice.address;
  const address = [a.line, `${a.district} / ${ilAdi(a.province) ?? ""}`, a.postalCode].filter(Boolean).join(", ");
  const person = `${buyer.firstName} ${buyer.lastName}`;
  return invoice.type === "corporate"
    ? {
        type: "corporate",
        name: invoice.companyTitle,
        authorizedPerson: invoice.authorizedPerson,
        taxLine: `${invoice.taxOffice} / ${invoice.taxId}`,
        address,
        email: buyer.email,
        phone: buyer.phone,
      }
    : // Bireyselde T.C. kimlik no belgeye yazılmaz (veri asgarileştirme); yalnız faturada kullanılır.
      { type: "individual", name: person, authorizedPerson: null, taxLine: null, address, email: buyer.email, phone: buyer.phone };
}

export interface LegalContextInput {
  input: OrderPreviewPayload;
  site: SiteSnapshot;
  totals: { unitPriceKurus: number; totalKurus: number; vatRate: number; vatKurus: number };
  schedule: OrderSchedule;
  /** Sipariş tarihi — YYYY-MM-DD (İstanbul) */
  orderDate: string;
  orderNo?: string | null;
}

export function buildLegalContext(p: LegalContextInput): LegalContext {
  return {
    version: LEGAL_DOCUMENTS_VERSION,
    orderNo: p.orderNo ?? null,
    orderDate: p.orderDate,
    buyer: legalBuyerFrom(p.input),
    site: legalSiteFrom(p.site),
    quantity: p.input.quantity,
    unitPriceKurus: p.totals.unitPriceKurus,
    totalKurus: p.totals.totalKurus,
    vatRate: p.totals.vatRate,
    vatKurus: p.totals.vatKurus,
    certificateName: resolveCertificateName(p.input),
    schedule: p.schedule,
  };
}

export interface BuiltDocument {
  kind: DocumentKind;
  title: string;
  version: string;
  document: LegalDocument;
  html: string;
  /** HTML kopyanın SHA-256 özeti (onaltılık, 64 karakter). */
  sha256: string;
}

export const sha256Hex = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

export function buildOrderDocuments(ctx: LegalContext): BuiltDocument[] {
  return [preInfoDocument(ctx), contractDocument(ctx), withdrawalFormDocument(ctx)].map((document) => {
    const html = renderLegalHtml(document);
    return { kind: document.kind, title: document.title, version: document.version, document, html, sha256: sha256Hex(html) };
  });
}
