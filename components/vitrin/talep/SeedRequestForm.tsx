"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { TR_ILLER_ALFABETIK, ilAdi } from "@/lib/tr-iller";
import { SEED_PURPOSES, SEED_QTY } from "@/lib/requests/schema";
import { PURPOSE_LABELS, type LabelLocale } from "@/lib/requests/labels";
import type { SeedOption } from "@/lib/requests/options";
import { ChipGroup, Field, QuantityInput, SectionCard, inputCls } from "./FormPrimitives";
import ContactFields from "./ContactFields";
import RequestFormShell from "./RequestFormShell";
import SuccessCard from "./SuccessCard";
import { EMPTY_CONTACT, useAuthPrefill, useRequestForm, type ContactState } from "./useRequestForm";

const QUICK = [100, 250, 500, 1000, 5000];
const DEFAULT_QTY = 100;

export default function SeedRequestForm({ species }: { species: SeedOption[] }) {
  const t = useTranslations("requestForms.seed");
  const tc = useTranslations("requestForms.common");
  const locale = useLocale() as LabelLocale;
  const form = useRequestForm();

  // Seçili türler (sıra korunur — hata yolu details.seedItems.<index>)
  const [selected, setSelected] = useState<string[]>([]);
  const [qty, setQty] = useState<Record<string, number | null>>({});
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [purpose, setPurpose] = useState<(typeof SEED_PURPOSES)[number] | null>(null);
  const [contact, setContact] = useState<ContactState>(EMPTY_CONTACT);
  const [honeypot, setHoneypot] = useState("");

  // Giriş yapmışsa iletişim alanlarını profilden doldur (boş alanlar için)
  const { prefill, isLoggedIn } = useAuthPrefill((p) =>
    setContact((c) => ({ ...c, contactName: c.contactName || p.name, email: c.email || p.email, phone: c.phone || p.phone }))
  );

  const toggleSpecies = (slug: string) => {
    form.clearError("details.seedItems");
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
    setQty((prev) => (slug in prev ? prev : { ...prev, [slug]: DEFAULT_QTY }));
  };

  const total = useMemo(
    () => selected.reduce((s, slug) => s + (qty[slug] ?? 0), 0),
    [selected, qty]
  );

  const purposeOptions = SEED_PURPOSES.map((p) => ({ value: p, label: PURPOSE_LABELS[locale][p] }));

  const summary = [
    ...(selected.length
      ? [{
          label: t("summary.species"),
          value: (
            <span className="block space-y-0.5">
              {selected.map((slug) => (
                <span key={slug} className="block">
                  {species.find((s) => s.slug === slug)?.name ?? slug}: {(qty[slug] ?? 0).toLocaleString("tr-TR")}
                </span>
              ))}
            </span>
          ),
        }]
      : []),
    ...(total > 0 ? [{ label: t("summary.total"), value: total.toLocaleString("tr-TR") }] : []),
    ...(province ? [{ label: t("summary.province"), value: ilAdi(province) ?? province }] : []),
  ];

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void form.submit(
      contact,
      {
        type: "seed_purchase",
        seedItems: selected.map((slug) => ({ slug, quantity: qty[slug] ?? NaN })),
        deliveryProvince: province,
        deliveryDistrict: district || undefined,
        purpose: purpose ?? undefined,
      },
      honeypot
    );
  };

  if (form.success) {
    return <SuccessCard result={form.success} email={contact.email.trim().toLowerCase()} isLoggedIn={isLoggedIn} />;
  }

  const listError = form.errorFor("details.seedItems");

  return (
    <RequestFormShell onSubmit={onSubmit} submitting={form.submitting} formError={form.formError} summary={summary}>
      {/* 1 · Türler */}
      <SectionCard step={1} title={t("species.heading")} sub={t("species.sub")} id="turler">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="group" aria-label={t("species.heading")}>
          {species.map((s) => {
            const active = selected.includes(s.slug);
            const idx = selected.indexOf(s.slug);
            const qtyError = idx >= 0 ? form.errorFor(`details.seedItems.${idx}.quantity`) : null;
            return (
              <div
                key={s.slug}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  active ? "border-[#1B6B3A] shadow-lg shadow-[#1B6B3A]/10" : listError ? "border-[#dc2626]/40" : "border-black/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSpecies(s.slug)}
                  aria-pressed={active}
                  className="w-full text-left flex gap-4 p-4 hover:bg-[#f8faf5] transition-colors"
                >
                  <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-[#1B6B3A]/8">
                    {s.image ? (
                      <Image src={s.image} alt={s.name} fill sizes="80px" className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-2xl">🌱</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#0e2519] leading-tight">{s.name}</p>
                        {s.latinName && <p className="text-xs italic text-[#6b8f6b]">{s.latinName}</p>}
                      </div>
                      <span
                        className={`shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          active ? "bg-[#1B6B3A] border-[#1B6B3A] text-white" : "border-black/15 text-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                    {s.description && <p className="text-xs text-[#3d5a3d] mt-1.5 leading-relaxed line-clamp-2">{s.description}</p>}
                  </div>
                </button>
                {active && (
                  <div className="px-4 pb-4 pt-1 border-t border-black/5 bg-[#f8faf5]">
                    <Field label={`${s.name} · ${t("species.quantity")}`} required error={qtyError}>
                      {(a) => (
                        <QuantityInput
                          id={a.id}
                          value={qty[s.slug] ?? null}
                          onChange={(v) => {
                            form.clearError(`details.seedItems.${idx}.quantity`);
                            setQty((prev) => ({ ...prev, [s.slug]: v }));
                          }}
                          min={SEED_QTY.min}
                          max={SEED_QTY.max}
                          quick={QUICK}
                          invalid={a.invalid}
                          describedBy={a.describedBy}
                          disabled={form.submitting}
                          ariaLabel={`${s.name} ${t("species.quantity")}`}
                        />
                      )}
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {listError && <p role="alert" className="text-xs font-medium text-[#dc2626]">{listError}</p>}
      </SectionCard>

      {/* 2 · Teslimat */}
      <SectionCard step={2} title={t("delivery.heading")} sub={t("delivery.sub")} id="teslimat">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("delivery.province")} required error={form.errorFor("details.deliveryProvince")}>
            {(a) => (
              <select
                id={a.id}
                value={province}
                disabled={form.submitting}
                onChange={(e) => {
                  form.clearError("details.deliveryProvince");
                  setProvince(e.target.value);
                }}
                aria-invalid={a.invalid}
                aria-describedby={a.describedBy}
                className={inputCls(a.invalid ? "x" : null)}
              >
                <option value="">{t("delivery.provincePlaceholder")}</option>
                {TR_ILLER_ALFABETIK.map((il) => (
                  <option key={il.kod} value={il.kod}>
                    {il.ad}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("delivery.district")} optional error={form.errorFor("details.deliveryDistrict")}>
            {(a) => (
              <input
                id={a.id}
                type="text"
                maxLength={80}
                value={district}
                disabled={form.submitting}
                onChange={(e) => setDistrict(e.target.value)}
                aria-invalid={a.invalid}
                aria-describedby={a.describedBy}
                placeholder={t("delivery.districtPlaceholder")}
                className={inputCls(a.invalid ? "x" : null)}
              />
            )}
          </Field>
        </div>
      </SectionCard>

      {/* 3 · Amaç */}
      <SectionCard step={3} title={t("purpose.heading")} sub={t("purpose.sub")} id="amac">
        <ChipGroup
          label={t("purpose.heading")}
          options={purposeOptions}
          value={purpose}
          onChange={(v) => setPurpose(v as typeof purpose)}
          disabled={form.submitting}
        />
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
      <span className="sr-only">{tc("required")}</span>
    </RequestFormShell>
  );
}
