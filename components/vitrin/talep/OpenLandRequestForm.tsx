"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { REQUEST_ROUTES } from "@/lib/site-config";
import { CERTIFICATE_NAME, RELEASE_QTY } from "@/lib/requests/schema";
import {
  DEFAULT_QUANTITY,
  PRICING_VISIBLE,
  QUANTITY_PRESETS,
  UNIT_PRICE_KURUS,
  formatCount,
  formatTry,
  totalKurus,
  type PriceLocale,
} from "@/lib/pricing";
import { Field, QuantityInput, SectionCard, inputCls } from "./FormPrimitives";
import ContactFields from "./ContactFields";
import RequestFormShell from "./RequestFormShell";
import SuccessCard from "./SuccessCard";
import { EMPTY_CONTACT, useAuthPrefill, useRequestForm, type ContactState } from "./useRequestForm";

/* ═══════════════════════════════════════════════════════════════════════
   Proje Uygulama Sahasına tohum topu bıraktırma — talep formu
   ═══════════════════════════════════════════════════════════════════════
   Sipariş sihirbazı (ödeme, sözleşme, fatura) yayına girene kadar aynı
   seçimleri ödeme almadan toplar: saha → adet → sertifikadaki ad → iletişim.
   • Sahada hektar gösterilir; bırakılacak adet/kapasite GÖSTERİLMEZ.
   • Tür müşteri tarafından seçilmez; sahaya göre belirlenir, bilgi olarak yazılır.
   • Adet sınırları ve birim bedel lib/pricing.ts'ten gelir; tutar bilgi amaçlıdır,
     sunucu kendi hesabını yapar.
   ═══════════════════════════════════════════════════════════════════════ */

/** Sunucu sayfasının hazırladığı, yalnız gösterilecek alanları taşıyan saha özeti. */
export interface SiteOption {
  id: string;
  slug: string;
  name: string;
  /** "İlçe, İl" */
  location: string | null;
  /** "42,5 hektar" — bilinmiyorsa null (satır gizlenir) */
  area: string | null;
  /** "Yangın Sahası · 2021" — yangın sahası değilse null */
  fire: string | null;
  workType: string;
  /** Sahaya bırakılan tür adları (istenen dilde) */
  species: string[];
  coverImage: string | null;
}

/** Saha sayfasından gelindiyse (?saha=slug) o saha seçili açılır — hydration'a zarar vermeden. */
const noopSubscribe = () => () => {};
const readSiteParam = () => new URLSearchParams(window.location.search).get("saha") ?? "";
const readSiteParamOnServer = () => "";

export default function OpenLandRequestForm({ sites }: { sites: SiteOption[] }) {
  const t = useTranslations("requestForms.openLand");
  const locale = useLocale() as PriceLocale;
  const form = useRequestForm();
  const groupId = useId();

  const preselectedSlug = useSyncExternalStore(noopSubscribe, readSiteParam, readSiteParamOnServer);
  const [choice, setChoice] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number | null>(DEFAULT_QUANTITY);
  const [certificateName, setCertificateName] = useState("");
  const [contact, setContact] = useState<ContactState>(EMPTY_CONTACT);
  const [honeypot, setHoneypot] = useState("");

  // Giriş yapmışsa iletişim alanlarını profilden doldur (boş alanlar için)
  const { prefill, isLoggedIn } = useAuthPrefill((p) =>
    setContact((c) => ({ ...c, contactName: c.contactName || p.name, email: c.email || p.email, phone: c.phone || p.phone }))
  );

  const landId =
    choice ?? sites.find((s) => s.slug === preselectedSlug)?.id ?? (sites.length === 1 ? sites[0].id : "");
  const site = sites.find((s) => s.id === landId) ?? null;
  const total = totalKurus(quantity);
  const certName = certificateName.trim();

  const summary = [
    ...(site ? [{ label: t("summary.site"), value: site.name }] : []),
    ...(site && site.species.length ? [{ label: t("summary.species"), value: site.species.join(", ") }] : []),
    ...(quantity ? [{ label: t("summary.quantity"), value: formatCount(quantity, locale) }] : []),
    ...(PRICING_VISIBLE && total !== null
      ? [
          { label: t("summary.unitPrice"), value: formatTry(UNIT_PRICE_KURUS, locale) },
          { label: t("summary.total"), value: formatTry(total, locale) },
        ]
      : []),
    ...(certName ? [{ label: t("summary.certificateName"), value: certName }] : []),
  ];

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void form.submit(
      contact,
      {
        type: "open_land_seeding",
        landId,
        quantity: quantity ?? NaN,
        certificateName: certName || undefined,
      },
      honeypot
    );
  };

  if (form.success) {
    return <SuccessCard result={form.success} email={contact.email.trim().toLowerCase()} isLoggedIn={isLoggedIn} />;
  }

  const ownLandLink = (
    <Link
      href={REQUEST_ROUTES.land}
      className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#1B6B3A]/25 bg-white text-sm font-semibold text-[#1B6B3A] hover:border-[#1B6B3A]/50 hover:bg-[#1B6B3A]/5 transition-colors"
    >
      {t("top.ownLand")}
      <ArrowIcon className="w-4 h-4" />
    </Link>
  );

  /* Katılıma açık saha yoksa form yerine bilgi kartı */
  if (sites.length === 0) {
    return (
      <div className="vitrin-card p-7 lg:p-10 max-w-3xl mx-auto text-center">
        <h2 className="text-xl lg:text-2xl font-bold text-[#0e2519] mb-3">{t("empty.title")}</h2>
        <p className="text-sm lg:text-base text-[#3d5a3d] leading-relaxed mb-7">{t("empty.desc")}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {ownLandLink}
          <Link
            href="/bilgi-al"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-[#1B6B3A] hover:text-[#22894a] transition-colors"
          >
            {t("empty.contact")}
          </Link>
        </div>
      </div>
    );
  }

  const siteError = form.errorFor("details.landId");
  const siteErrId = `${groupId}-err`;

  const top = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#1B6B3A]/10 bg-[#f8faf5] px-5 py-4">
      <p className="text-sm text-[#3d5a3d] leading-relaxed">{t("top.text")}</p>
      {ownLandLink}
    </div>
  );

  return (
    <RequestFormShell onSubmit={onSubmit} submitting={form.submitting} formError={form.formError} summary={summary} top={top}>
      {/* 1 · Saha */}
      <SectionCard step={1} title={t("site.heading")} sub={t("site.sub")} id="saha">
        <div
          role="radiogroup"
          aria-labelledby="saha-title"
          aria-invalid={!!siteError}
          aria-describedby={siteError ? siteErrId : undefined}
          className="grid grid-cols-1 gap-3"
        >
          {sites.map((s) => {
            const active = s.id === landId;
            return (
              <label
                key={s.id}
                className={`relative flex gap-4 rounded-2xl border p-4 sm:p-5 cursor-pointer transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#1B6B3A]/30 has-[:disabled]:opacity-60 has-[:disabled]:cursor-default ${
                  active
                    ? "border-[#1B6B3A] bg-[#1B6B3A]/5 shadow-lg shadow-[#1B6B3A]/10"
                    : siteError
                      ? "border-[#dc2626]/40 hover:border-[#dc2626]/60"
                      : "border-black/10 hover:border-[#1B6B3A]/40"
                }`}
              >
                <input
                  type="radio"
                  name={`${groupId}-saha`}
                  value={s.id}
                  checked={active}
                  disabled={form.submitting}
                  onChange={() => {
                    form.clearError("details.landId");
                    setChoice(s.id);
                  }}
                  className="sr-only"
                />
                {s.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.coverImage}
                    alt=""
                    loading="lazy"
                    className="hidden sm:block shrink-0 w-24 h-24 rounded-xl object-cover"
                  />
                )}
                <span className="block flex-1 min-w-0">
                  {s.fire && (
                    <span className="inline-flex items-center gap-1 mb-2 px-2.5 py-1 rounded-full border border-[#fed7aa] bg-[#fff7ed] text-[10px] font-bold uppercase tracking-[0.1em] text-[#9a3412]">
                      <FlameIcon className="w-3 h-3" />
                      {s.fire}
                    </span>
                  )}
                  <span className="block font-bold text-[#0e2519] leading-snug">{s.name}</span>
                  {s.location && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-[#6b8f6b]">
                      <PinIcon className="w-3.5 h-3.5 shrink-0" />
                      {s.location}
                    </span>
                  )}
                  <span className="mt-3 flex flex-col sm:flex-row sm:flex-wrap gap-x-8 gap-y-2">
                    {s.area && <Fact label={t("site.area")} value={s.area} />}
                    <Fact label={t("site.workType")} value={s.workType} />
                    {s.species.length > 0 && <Fact label={t("site.species")} value={s.species.join(", ")} />}
                  </span>
                </span>
                <span
                  className={`shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    active ? "bg-[#1B6B3A] border-[#1B6B3A]" : "border-black/15"
                  }`}
                  aria-hidden="true"
                >
                  {active && <span className="w-2 h-2 rounded-full bg-white" />}
                </span>
              </label>
            );
          })}
        </div>
        {siteError && (
          <p id={siteErrId} role="alert" className="text-xs font-medium text-[#dc2626]">
            {siteError}
          </p>
        )}
        <p className="text-xs text-[#6b8f6b] leading-relaxed">{t("site.speciesNote")}</p>
      </SectionCard>

      {/* 2 · Adet */}
      <SectionCard
        step={2}
        title={t("quantity.heading")}
        sub={t("quantity.sub", { min: formatCount(RELEASE_QTY.min, locale) })}
        id="adet"
      >
        <Field label={t("quantity.label")} required error={form.errorFor("details.quantity")}>
          {(a) => (
            <QuantityInput
              id={a.id}
              value={quantity}
              onChange={(v) => {
                form.clearError("details.quantity");
                setQuantity(v);
              }}
              min={RELEASE_QTY.min}
              max={RELEASE_QTY.max}
              quick={[...QUANTITY_PRESETS]}
              invalid={a.invalid}
              describedBy={a.describedBy}
              disabled={form.submitting}
              ariaLabel={t("quantity.label")}
            />
          )}
        </Field>

        {PRICING_VISIBLE && (
          <div className="rounded-2xl bg-[#f8faf5] border border-[#1B6B3A]/10 p-4 sm:p-5">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#6b8f6b]">{t("price.unit")}</dt>
                <dd className="mt-1 text-lg font-bold text-[#0e2519]">
                  {formatTry(UNIT_PRICE_KURUS, locale)}
                  <span className="ml-1.5 text-xs font-medium text-[#6b8f6b]">{t("price.vat")}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#6b8f6b]">{t("price.total")}</dt>
                <dd className="mt-1 text-lg font-bold text-[#1B6B3A]" aria-live="polite">
                  {total !== null ? formatTry(total, locale) : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-[#3d5a3d] leading-relaxed">{t("price.note")}</p>
          </div>
        )}
      </SectionCard>

      {/* 3 · Sertifikadaki ad */}
      <SectionCard step={3} title={t("certificate.heading")} sub={t("certificate.sub")} id="sertifika">
        <Field
          label={t("certificate.label")}
          optional
          error={form.errorFor("details.certificateName")}
          hint={t("certificate.hint", { max: CERTIFICATE_NAME.max })}
        >
          {(a) => (
            <div className="relative">
              <input
                id={a.id}
                type="text"
                maxLength={CERTIFICATE_NAME.max}
                value={certificateName}
                disabled={form.submitting}
                autoComplete="off"
                onChange={(e) => {
                  form.clearError("details.certificateName");
                  setCertificateName(e.target.value);
                }}
                aria-invalid={a.invalid}
                aria-describedby={a.describedBy}
                placeholder={t("certificate.placeholder")}
                className={inputCls(a.invalid ? "x" : null, "pr-16")}
              />
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-medium tabular-nums text-[#94b494] pointer-events-none"
                aria-hidden="true"
              >
                {certificateName.length}/{CERTIFICATE_NAME.max}
              </span>
            </div>
          )}
        </Field>
      </SectionCard>

      {/* 4 · İletişim */}
      <ContactFields
        step={4}
        values={contact}
        onChange={(patch) => {
          Object.keys(patch).forEach((k) => form.clearError(`contact.${k}`));
          setContact((c) => ({ ...c, ...patch }));
        }}
        errorFor={form.errorFor}
        disabled={form.submitting}
        prefilled={prefill !== null}
        honeypot={honeypot}
        onHoneypot={setHoneypot}
      />
    </RequestFormShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="block min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#6b8f6b]">{label}</span>
      <span className="block text-sm font-semibold text-[#1a2e1a] leading-snug">{value}</span>
    </span>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
