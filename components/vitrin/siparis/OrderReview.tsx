"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatCount, formatTry, type PriceLocale } from "@/lib/pricing";
import { TR_ILLER_ALFABETIK } from "@/lib/tr-iller";
import type { OrderPreview, OrderDocumentPreview } from "@/lib/orders/client";
import { downloadDocument } from "./DocumentDialog";
import type { Buyer, Consents, InvoiceValues, WizardSite } from "./types";

export function ReviewRows({
  rows,
}: {
  rows: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="divide-y divide-[#1B6B3A]/10">
      {rows.map(({ label, value }) => (
        <div
          key={label}
          className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-5"
        >
          <dt className="text-sm text-[#3d5a3d]">{label}</dt>
          <dd className="break-words text-sm font-semibold text-[#0e2519] sm:text-right">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
type Props = {
  preview: OrderPreview;
  site: WizardSite;
  locale: PriceLocale;
  buyer: Buyer;
  invoice: InvoiceValues;
  certificateName: string;
  consents: Consents;
  onConsent: (key: keyof Consents, value: boolean) => void;
  errorFor: (path: string) => string | null;
  onDocument: (doc: OrderDocumentPreview) => void;
  dateLabels: Record<string, string>;
  timeline: ReactNode;
  disabled: boolean;
};
export default function OrderReview({
  preview,
  site,
  locale,
  buyer,
  invoice,
  certificateName,
  consents,
  onConsent,
  errorFor,
  onDocument,
  dateLabels,
  timeline,
  disabled,
}: Props) {
  const t = useTranslations("orderWizard");
  const totals = preview.totals;
  const mask = (id: string) =>
    id.trim() ? `••••••${id.replace(/[\s.-]/g, "").slice(-4)}` : null;
  const taxId =
    invoice.type === "corporate" ? mask(invoice.taxId) : mask(invoice.tckn);
  const rows = [
    { label: t("review.site"), value: site.name },
    ...(site.species.length ? [{ label: t("review.species"), value: site.species.join(" · ") }] : []),
    { label: t("quantity.label"), value: formatCount(totals.quantity, locale) },
    {
      label: t("quantity.unit"),
      value: formatTry(totals.unitPriceKurus, locale),
    },
    { label: t("review.total"), value: formatTry(totals.totalKurus, locale) },
    {
      label: t("review.vat", { rate: formatCount(totals.vatRate, locale) }),
      value: formatTry(totals.vatKurus, locale),
    },
    { label: t("certificate.label"), value: certificateName },
    { label: t("buyer.title"), value: `${buyer.firstName} ${buyer.lastName}` },
    { label: t("buyer.email"), value: buyer.email },
    { label: t("buyer.phone"), value: buyer.phone },
    {
      label: t("invoice.type"),
      value: t(`invoice.${invoice.type || "individual"}`),
    },
    ...(invoice.type === "corporate"
      ? [
          { label: t("invoice.companyTitle"), value: invoice.companyTitle },
          { label: t("invoice.taxOffice"), value: invoice.taxOffice },
          {
            label: t("invoice.authorizedPerson"),
            value: invoice.authorizedPerson,
          },
          ...(invoice.mersis
            ? [{ label: t("invoice.mersis"), value: mask(invoice.mersis) }]
            : []),
          ...(invoice.kep
            ? [{ label: t("invoice.kep"), value: invoice.kep }]
            : []),
          ...(invoice.poNumber
            ? [{ label: t("invoice.poNumber"), value: invoice.poNumber }]
            : []),
          {
            label: t("invoice.eInvoiceUser"),
            value: t(invoice.eInvoiceUser ? "yes" : "no"),
          },
        ]
      : []),
    {
      label: t("invoice.address"),
      value: [
        invoice.line,
        invoice.district,
        TR_ILLER_ALFABETIK.find((p) => p.kod === invoice.province)?.ad,
        invoice.postalCode,
      ]
        .filter(Boolean)
        .join(", "),
    },
    ...(taxId
      ? [
          {
            label: t(
              invoice.type === "corporate" ? "invoice.taxId" : "invoice.tckn",
            ),
            value: taxId,
          },
        ]
      : []),
  ];
  const requiredKeys: (keyof Consents)[] = [
    "preInfo",
    "contract",
    "kvkkRead",
    ...(invoice.type === "corporate" ? ["corporateAuthority" as const] : []),
  ];
  function checkbox(key: keyof Consents) {
    const error = errorFor(`consents.${key}`);
    return (
      <div key={key}>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            required={key !== "marketing"}
            name={`consents.${key}`}
            checked={consents[key]}
            disabled={disabled}
            onChange={(e) => onConsent(key, e.target.checked)}
            aria-invalid={!!error}
            aria-describedby={error ? `consent-${key}-error` : undefined}
            className="mt-1 h-4 w-4 shrink-0 accent-[#1B6B3A]"
          />
          <span>
            {key === "kvkkRead"
              ? t.rich("consents.kvkkRead", {
                  kvkk: (chunks) => (
                    <Link
                      href="/kvkk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#1B6B3A] underline underline-offset-4"
                    >
                      {chunks}
                    </Link>
                  ),
                })
              : t(`consents.${key}`)}
          </span>
        </label>
        {error && (
          <p
            id={`consent-${key}-error`}
            role="alert"
            className="ml-7 text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <section className="vitrin-card p-6 lg:p-8">
        <h3 className="mb-3 text-lg font-bold">{t("review.title")}</h3>
        <ReviewRows rows={rows} />
      </section>
      <section className="vitrin-card space-y-4 p-6 lg:p-8">
        <h3 className="text-lg font-bold">{t("review.schedule")}</h3>
        <p className="text-sm text-[#3d5a3d]">
          {dateLabels[preview.schedule.season.startsOn] ??
            preview.schedule.season.startsOn}{" "}
          —{" "}
          {dateLabels[preview.schedule.season.endsOn] ??
            preview.schedule.season.endsOn}
        </p>
        <p className="font-semibold text-[#0e2519]">
          {t("review.deadline", {
            date:
              dateLabels[preview.schedule.performanceDeadline] ??
              preview.schedule.performanceDeadline,
          })}
        </p>
        {preview.schedule.rolledToNextSeason && (
          <p
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
          >
            {t("review.rolled", { season: preview.schedule.season.label })}
          </p>
        )}
        {timeline}
        <h4 className="font-semibold">{t("review.withdrawalTitle")}</h4>
        <p className="text-sm leading-relaxed text-[#3d5a3d]">
          {t("review.withdrawal")}
        </p>
      </section>
      <section className="vitrin-card p-6 lg:p-8">
        <h3 className="mb-5 text-lg font-bold">{t("documents.title")}</h3>
        {locale !== "tr" && (
          <p className="-mt-2 mb-4 text-sm text-[#526352]">{t("documents.languageNote")}</p>
        )}
        <ul className="divide-y divide-[#1B6B3A]/10">
          {preview.documents.map((doc) => (
            <li
              key={doc.kind}
              className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
            >
              <span className="text-sm font-semibold">{doc.title}</span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => onDocument(doc)}
                  className="min-h-11 rounded-xl border border-[#1B6B3A]/25 px-4 text-sm font-semibold text-[#1B6B3A]"
                  aria-label={t("documents.readNamed", { title: doc.title })}
                >
                  {t("documents.read")}
                </button>
                <button
                  type="button"
                  onClick={() => downloadDocument(doc)}
                  className="min-h-11 rounded-xl border border-[#1B6B3A]/25 px-4 text-sm font-semibold text-[#1B6B3A]"
                  aria-label={t("documents.downloadNamed", {
                    title: doc.title,
                  })}
                >
                  {t("documents.download")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="vitrin-card p-6 lg:p-8">
        <h3 className="mb-3 text-lg font-bold">{t("consents.title")}</h3>
        {requiredKeys.map(checkbox)}
        <div className="mt-5 rounded-2xl border border-[#1B6B3A]/10 bg-[#f8faf5] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#3d5a3d]">
            {t("optional")}
          </p>
          {checkbox("marketing")}
        </div>
      </section>
    </div>
  );
}
