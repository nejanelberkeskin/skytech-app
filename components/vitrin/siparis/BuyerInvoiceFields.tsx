"use client";
import { useTranslations } from "next-intl";
import {
  Field,
  SectionCard,
  inputCls,
} from "@/components/vitrin/talep/FormPrimitives";
import { TR_ILLER_ALFABETIK } from "@/lib/tr-iller";
import type { Buyer, InvoiceValues } from "./types";

type Props = {
  buyer: Buyer;
  invoice: InvoiceValues;
  onBuyer: (patch: Partial<Buyer>) => void;
  onInvoice: (patch: Partial<InvoiceValues>) => void;
  errorFor: (path: string) => string | null;
  disabled: boolean;
};
export default function BuyerInvoiceFields({
  buyer,
  invoice,
  onBuyer,
  onInvoice,
  errorFor,
  disabled,
}: Props) {
  const t = useTranslations("orderWizard");
  const invoiceField = (
    key: Exclude<keyof InvoiceValues, "type" | "eInvoiceUser">,
    required = false,
    numeric = false,
    maxLength = 200,
  ) => {
    const address = ["province", "district", "line", "postalCode"].includes(
      key,
    );
    const path = `invoice.${address ? "address." : ""}${key}`;
    return (
      <Field
        key={key}
        label={t(`invoice.${key}`)}
        required={required}
        optional={!required}
        error={errorFor(path)}
        hint={
          errorFor(path)
            ? undefined
            : key === "tckn"
              ? t("invoice.tcknHint")
              : key === "taxId"
                ? t("invoice.taxIdHint")
                : undefined
        }
      >
        {(a) => (
          <input
            id={a.id}
            name={path}
            value={invoice[key]}
            onChange={(e) => onInvoice({ [key]: e.target.value })}
            disabled={disabled}
            required={required}
            maxLength={maxLength}
            inputMode={numeric ? "numeric" : key === "kep" ? "email" : "text"}
            autoComplete={
              numeric
                ? "off"
                : key === "companyTitle"
                  ? "organization"
                  : key === "postalCode"
                    ? "postal-code"
                    : "off"
            }
            aria-invalid={a.invalid}
            aria-describedby={a.describedBy}
            className={inputCls(a.invalid ? "x" : null)}
          />
        )}
      </Field>
    );
  };
  return (
    <div className="space-y-6">
      <SectionCard step={3} title={t("buyer.title")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["firstName", "lastName", "email", "phone"] as const).map((key) => (
            <Field
              key={key}
              label={t(`buyer.${key}`)}
              required
              error={errorFor(`buyer.${key}`)}
            >
              {(a) => (
                <input
                  id={a.id}
                  name={`buyer.${key}`}
                  type={
                    key === "email" ? "email" : key === "phone" ? "tel" : "text"
                  }
                  autoComplete={
                    {
                      firstName: "given-name",
                      lastName: "family-name",
                      email: "email",
                      phone: "tel",
                    }[key]
                  }
                  maxLength={key === "email" ? 200 : key === "phone" ? 40 : 60}
                  value={buyer[key]}
                  onChange={(e) => onBuyer({ [key]: e.target.value })}
                  required
                  disabled={disabled}
                  aria-invalid={a.invalid}
                  aria-describedby={a.describedBy}
                  className={inputCls(a.invalid ? "x" : null)}
                />
              )}
            </Field>
          ))}
        </div>
      </SectionCard>
      <section
        className="vitrin-card p-6 lg:p-8"
        aria-labelledby="invoice-heading"
      >
        <h3
          id="invoice-heading"
          className="mb-5 text-lg font-bold text-[#0e2519]"
        >
          {t("invoice.title")}
        </h3>
        <fieldset
          role="radiogroup"
          aria-required="true"
          aria-invalid={!!errorFor("invoice.type") || !!errorFor("invoice")}
          aria-describedby={
            errorFor("invoice.type") || errorFor("invoice")
              ? "invoice-type-error"
              : undefined
          }
        >
          <legend className="sr-only">{t("invoice.type")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["individual", "corporate"] as const).map((type) => (
              <label
                key={type}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm font-semibold ${invoice.type === type ? "border-[#1B6B3A] bg-[#edf4e9]" : "border-black/10"}`}
              >
                <input
                  type="radio"
                  required
                  name="invoice.type"
                  value={type}
                  checked={invoice.type === type}
                  onChange={() => onInvoice({ type })}
                  disabled={disabled}
                  aria-describedby={
                    errorFor("invoice.type") || errorFor("invoice")
                      ? "invoice-type-error"
                      : undefined
                  }
                  className="h-4 w-4 accent-[#1B6B3A]"
                />
                {t(`invoice.${type}`)}
              </label>
            ))}
          </div>
          {(errorFor("invoice.type") || errorFor("invoice")) && (
            <p
              id="invoice-type-error"
              role="alert"
              className="mt-2 text-sm text-red-700"
            >
              {errorFor("invoice.type") || errorFor("invoice")}
            </p>
          )}
        </fieldset>
        {invoice.type && (
          <div className="mt-6 space-y-5">
            {invoice.type === "corporate" && (
              <div className="grid gap-4 sm:grid-cols-2">
                {invoiceField("companyTitle", true)}
                {invoiceField("taxId", true, true, 11)}
                {invoiceField("taxOffice", true, false, 80)}
                {invoiceField("authorizedPerson", true, false, 120)}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("invoice.province")}
                required
                error={errorFor("invoice.address.province")}
              >
                {(a) => (
                  <select
                    id={a.id}
                    name="invoice.address.province"
                    value={invoice.province}
                    onChange={(e) => onInvoice({ province: e.target.value })}
                    disabled={disabled}
                    required
                    aria-invalid={a.invalid}
                    aria-describedby={a.describedBy}
                    className={inputCls(a.invalid ? "x" : null)}
                  >
                    <option value="">{t("invoice.selectProvince")}</option>
                    {TR_ILLER_ALFABETIK.map((p) => (
                      <option key={p.kod} value={p.kod}>
                        {p.ad}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {invoiceField("district", true, false, 80)}
            </div>
            <Field
              label={t("invoice.line")}
              required
              error={errorFor("invoice.address.line")}
            >
              {(a) => (
                <textarea
                  id={a.id}
                  name="invoice.address.line"
                  rows={3}
                  autoComplete="street-address"
                  maxLength={300}
                  required
                  value={invoice.line}
                  onChange={(e) => onInvoice({ line: e.target.value })}
                  disabled={disabled}
                  aria-invalid={a.invalid}
                  aria-describedby={a.describedBy}
                  className={inputCls(a.invalid ? "x" : null)}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {invoiceField("postalCode", false, true, 5)}
              {invoice.type === "individual" &&
                invoiceField("tckn", false, true, 11)}
            </div>
            {invoice.type === "corporate" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {invoiceField("mersis", false, true, 16)}
                  {invoiceField("kep")}
                  {invoiceField("poNumber", false, false, 40)}
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="invoice.eInvoiceUser"
                    checked={invoice.eInvoiceUser}
                    onChange={(e) =>
                      onInvoice({ eInvoiceUser: e.target.checked })
                    }
                    disabled={disabled}
                    className="h-4 w-4 accent-[#1B6B3A]"
                  />
                  {t("invoice.eInvoiceUser")}
                </label>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
