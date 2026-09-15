"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Field, SectionCard, inputCls } from "./FormPrimitives";
import type { ContactState } from "./useRequestForm";

/**
 * İletişim bloğu — üç formda ortak. Honeypot alanı da burada: gerçek
 * kullanıcı görmez (ekran dışı, tab sırasında yok, autocomplete kapalı).
 */
export default function ContactFields({
  step,
  values,
  onChange,
  errorFor,
  disabled,
  prefilled,
  honeypot,
  onHoneypot,
}: {
  step: number;
  values: ContactState;
  onChange: (patch: Partial<ContactState>) => void;
  errorFor: (path: string) => string | null;
  disabled: boolean;
  prefilled: boolean;
  honeypot: string;
  onHoneypot: (v: string) => void;
}) {
  const t = useTranslations("requestForms.common");

  return (
    <SectionCard step={step} title={t("contact.heading")} sub={t("contact.sub")} id="iletisim">
      {prefilled && (
        <p className="text-xs text-[#1B6B3A] bg-[#1B6B3A]/8 rounded-xl px-4 py-2.5 font-medium">{t("prefilled")}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t("contact.name")} required error={errorFor("contact.contactName")}>
          {(a) => (
            <input
              id={a.id}
              name="name"
              type="text"
              autoComplete="name"
              maxLength={120}
              required
              disabled={disabled}
              value={values.contactName}
              onChange={(e) => onChange({ contactName: e.target.value })}
              aria-invalid={a.invalid}
              aria-describedby={a.describedBy}
              placeholder={t("contact.namePlaceholder")}
              className={inputCls(a.invalid ? "x" : null)}
            />
          )}
        </Field>
        <Field label={t("contact.company")} optional error={errorFor("contact.company")}>
          {(a) => (
            <input
              id={a.id}
              name="organization"
              type="text"
              autoComplete="organization"
              maxLength={160}
              disabled={disabled}
              value={values.company}
              onChange={(e) => onChange({ company: e.target.value })}
              aria-invalid={a.invalid}
              aria-describedby={a.describedBy}
              placeholder={t("contact.companyPlaceholder")}
              className={inputCls(a.invalid ? "x" : null)}
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t("contact.phone")} error={errorFor("contact.phone")}>
          {(a) => (
            <input
              id={a.id}
              name="tel"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={40}
              disabled={disabled}
              value={values.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              aria-invalid={a.invalid}
              aria-describedby={a.describedBy}
              placeholder={t("contact.phonePlaceholder")}
              className={inputCls(a.invalid ? "x" : null)}
            />
          )}
        </Field>
        <Field label={t("contact.email")} error={errorFor("contact.email")}>
          {(a) => (
            <input
              id={a.id}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={200}
              disabled={disabled}
              value={values.email}
              onChange={(e) => onChange({ email: e.target.value })}
              aria-invalid={a.invalid}
              aria-describedby={a.describedBy}
              placeholder={t("contact.emailPlaceholder")}
              className={inputCls(a.invalid ? "x" : null)}
            />
          )}
        </Field>
      </div>

      <Field label={t("contact.message")} optional error={errorFor("contact.message")}>
        {(a) => (
          <textarea
            id={a.id}
            name="message"
            rows={4}
            maxLength={2000}
            disabled={disabled}
            value={values.message}
            onChange={(e) => onChange({ message: e.target.value })}
            aria-invalid={a.invalid}
            aria-describedby={a.describedBy}
            placeholder={t("contact.messagePlaceholder")}
            className={inputCls(a.invalid ? "x" : null, "resize-none")}
          />
        )}
      </Field>

      {/* Honeypot — gerçek kullanıcılar görmez/doldurmaz */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => onHoneypot(e.target.value)}
          />
        </label>
      </div>

      {/* KVKK onayı */}
      <label className={`flex items-start gap-3 text-xs leading-relaxed pt-1 cursor-pointer ${errorFor("contact.consent") ? "text-[#dc2626]" : "text-[#3d5a3d]"}`}>
        <input
          type="checkbox"
          name="consent"
          required
          disabled={disabled}
          checked={values.consent}
          onChange={(e) => onChange({ consent: e.target.checked })}
          aria-invalid={!!errorFor("contact.consent")}
          className="mt-0.5 w-4 h-4 shrink-0 accent-[#1B6B3A]"
        />
        <span>
          {t.rich("consent", {
            kvkk: (chunks) => (
              <Link href="/kvkk" target="_blank" className="font-semibold text-[#1B6B3A] underline underline-offset-2">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>
      {errorFor("contact.consent") && (
        <p role="alert" className="-mt-3 text-xs font-medium text-[#dc2626]">{errorFor("contact.consent")}</p>
      )}
    </SectionCard>
  );
}
