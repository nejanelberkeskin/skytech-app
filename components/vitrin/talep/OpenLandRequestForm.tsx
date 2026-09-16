"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SEED_QTY } from "@/lib/requests/schema";
import type { LandOption } from "@/lib/requests/options";
import { Field, QuantityInput, SectionCard, inputCls } from "./FormPrimitives";
import ContactFields from "./ContactFields";
import RequestFormShell from "./RequestFormShell";
import SuccessCard from "./SuccessCard";
import { EMPTY_CONTACT, useAuthPrefill, useRequestForm, type ContactState } from "./useRequestForm";

const QUICK = [100, 250, 500, 1000, 5000];

export default function OpenLandRequestForm({ lands }: { lands: LandOption[] }) {
  const t = useTranslations("requestForms.openLand");
  const form = useRequestForm();

  const [landId, setLandId] = useState<string>(lands.length === 1 ? lands[0].id : "");
  const [quantity, setQuantity] = useState<number | null>(100);
  const [dedication, setDedication] = useState("");
  const [contact, setContact] = useState<ContactState>(EMPTY_CONTACT);
  const [honeypot, setHoneypot] = useState("");

  // Giriş yapmışsa iletişim alanlarını profilden doldur (boş alanlar için)
  const { prefill, isLoggedIn } = useAuthPrefill((p) =>
    setContact((c) => ({ ...c, contactName: c.contactName || p.name, email: c.email || p.email, phone: c.phone || p.phone }))
  );

  const land = lands.find((l) => l.id === landId) ?? null;

  const summary = [
    ...(land ? [{ label: t("summary.land"), value: land.region ? `${land.name} · ${land.region}` : land.name }] : []),
    ...(quantity ? [{ label: t("summary.quantity"), value: quantity.toLocaleString("tr-TR") }] : []),
    ...(dedication.trim() ? [{ label: t("summary.dedication"), value: dedication.trim() }] : []),
  ];

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void form.submit(
      contact,
      {
        type: "open_land_seeding",
        landId,
        quantity: quantity ?? NaN,
        dedication: dedication || undefined,
      },
      honeypot
    );
  };

  if (form.success) {
    return <SuccessCard result={form.success} email={contact.email.trim().toLowerCase()} isLoggedIn={isLoggedIn} />;
  }

  const landError = form.errorFor("details.landId");

  return (
    <RequestFormShell onSubmit={onSubmit} submitting={form.submitting} formError={form.formError} summary={summary}>
      {/* 1 · Saha */}
      <SectionCard step={1} title={t("land.heading")} sub={t("land.sub")} id="saha">
        {lands.length === 0 ? (
          <p className="text-sm text-[#3d5a3d] bg-[#f8faf5] border border-black/5 rounded-xl px-4 py-3">{t("land.empty")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label={t("land.heading")} aria-invalid={!!landError}>
            {lands.map((l) => {
              const active = l.id === landId;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={form.submitting}
                  onClick={() => {
                    form.clearError("details.landId");
                    setLandId(l.id);
                  }}
                  className={`text-left rounded-2xl border p-4 transition-all ${
                    active
                      ? "border-[#1B6B3A] bg-[#1B6B3A]/5 shadow-lg shadow-[#1B6B3A]/10"
                      : landError
                        ? "border-[#dc2626]/40 hover:border-[#dc2626]/60"
                        : "border-black/10 hover:border-[#1B6B3A]/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1B6B3A]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B3A]" />
                      {t("land.open")}
                    </span>
                    <span
                      className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        active ? "bg-[#1B6B3A] border-[#1B6B3A]" : "border-black/15"
                      }`}
                      aria-hidden="true"
                    >
                      {active && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="font-bold text-[#0e2519] leading-tight">{l.name}</p>
                  {l.region && (
                    <p className="text-xs text-[#6b8f6b] mt-1 inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {t("land.region")}: {l.region}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {landError && <p role="alert" className="text-xs font-medium text-[#dc2626]">{landError}</p>}
      </SectionCard>

      {/* 2 · Adet */}
      <SectionCard step={2} title={t("quantity.heading")} sub={t("quantity.sub")} id="adet">
        <Field label={t("quantity.heading")} required error={form.errorFor("details.quantity")}>
          {(a) => (
            <QuantityInput
              id={a.id}
              value={quantity}
              onChange={(v) => {
                form.clearError("details.quantity");
                setQuantity(v);
              }}
              min={SEED_QTY.min}
              max={SEED_QTY.max}
              quick={QUICK}
              invalid={a.invalid}
              describedBy={a.describedBy}
              disabled={form.submitting}
              ariaLabel={t("quantity.heading")}
            />
          )}
        </Field>
      </SectionCard>

      {/* 3 · Adına */}
      <SectionCard step={3} title={t("dedication.heading")} sub={t("dedication.sub")} id="adina">
        <Field label={t("dedication.heading")} optional error={form.errorFor("details.dedication")}>
          {(a) => (
            <input
              id={a.id}
              type="text"
              maxLength={120}
              value={dedication}
              disabled={form.submitting}
              onChange={(e) => setDedication(e.target.value)}
              aria-invalid={a.invalid}
              aria-describedby={a.describedBy}
              placeholder={t("dedication.placeholder")}
              className={inputCls(a.invalid ? "x" : null)}
            />
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
