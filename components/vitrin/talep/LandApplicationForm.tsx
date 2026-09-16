"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TR_ILLER_ALFABETIK, ilAdi } from "@/lib/tr-iller";
import { AREA, AREA_UNITS, LAND_CONDITIONS, OWNERSHIP_TYPES, TIMING_OPTIONS } from "@/lib/requests/schema";
import {
  AREA_UNIT_LABELS,
  LAND_CONDITION_LABELS,
  OWNERSHIP_LABELS,
  TIMING_LABELS,
  type LabelLocale,
} from "@/lib/requests/labels";
import { ChipGroup, Field, SectionCard, inputCls } from "./FormPrimitives";
import ContactFields from "./ContactFields";
import RequestFormShell from "./RequestFormShell";
import SuccessCard from "./SuccessCard";
import { EMPTY_CONTACT, useAuthPrefill, useRequestForm, type ContactState } from "./useRequestForm";

type Condition = (typeof LAND_CONDITIONS)[number];
type Ownership = (typeof OWNERSHIP_TYPES)[number];
type Timing = (typeof TIMING_OPTIONS)[number];
type Unit = (typeof AREA_UNITS)[number];

export default function LandApplicationForm() {
  const t = useTranslations("requestForms.land");
  const locale = useLocale() as LabelLocale;
  const form = useRequestForm();

  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [areaValue, setAreaValue] = useState("");
  const [areaUnit, setAreaUnit] = useState<Unit>("dekar");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [ownership, setOwnership] = useState<Ownership | null>(null);
  const [timing, setTiming] = useState<Timing | null>(null);
  const [accessNotes, setAccessNotes] = useState("");
  const [contact, setContact] = useState<ContactState>(EMPTY_CONTACT);
  const [honeypot, setHoneypot] = useState("");

  // Giriş yapmışsa iletişim alanlarını profilden doldur (boş alanlar için)
  const { prefill, isLoggedIn } = useAuthPrefill((p) =>
    setContact((c) => ({ ...c, contactName: c.contactName || p.name, email: c.email || p.email, phone: c.phone || p.phone }))
  );

  const L = {
    cond: LAND_CONDITIONS.map((c) => ({ value: c, label: LAND_CONDITION_LABELS[locale][c] })),
    own: OWNERSHIP_TYPES.map((o) => ({ value: o, label: OWNERSHIP_LABELS[locale][o] })),
    timing: TIMING_OPTIONS.map((x) => ({ value: x, label: TIMING_LABELS[locale][x] })),
    unit: AREA_UNITS.map((u) => ({ value: u, label: AREA_UNIT_LABELS[locale][u] })),
  };

  const areaNumber = areaValue.trim() === "" ? NaN : Number(areaValue.replace(",", "."));

  const summary = [
    ...(province
      ? [{ label: t("summary.location"), value: [ilAdi(province), district.trim() || null].filter(Boolean).join(" / ") }]
      : []),
    ...(Number.isFinite(areaNumber) && areaNumber > 0
      ? [{ label: t("summary.area"), value: `${areaNumber.toLocaleString(locale === "tr" ? "tr-TR" : "en-GB")} ${AREA_UNIT_LABELS[locale][areaUnit]}` }]
      : []),
    ...(conditions.length
      ? [{ label: t("summary.condition"), value: conditions.map((c) => LAND_CONDITION_LABELS[locale][c]).join(", ") }]
      : []),
    ...(timing ? [{ label: t("summary.timing"), value: TIMING_LABELS[locale][timing] }] : []),
  ];

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void form.submit(
      contact,
      {
        type: "land_application",
        province,
        district: district || undefined,
        areaValue: areaNumber,
        areaUnit,
        conditions,
        ownership: ownership as Ownership,
        timing: timing as Timing,
        mapLink: mapLink || undefined,
        accessNotes: accessNotes || undefined,
      },
      honeypot
    );
  };

  if (form.success) {
    return <SuccessCard result={form.success} email={contact.email.trim().toLowerCase()} isLoggedIn={isLoggedIn} />;
  }

  return (
    <RequestFormShell onSubmit={onSubmit} submitting={form.submitting} formError={form.formError} summary={summary}>
      {/* 1 · Konum */}
      <SectionCard step={1} title={t("location.heading")} id="konum">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("location.province")} required error={form.errorFor("details.province")}>
            {(a) => (
              <select
                id={a.id}
                value={province}
                disabled={form.submitting}
                onChange={(e) => {
                  form.clearError("details.province");
                  setProvince(e.target.value);
                }}
                aria-invalid={a.invalid}
                aria-describedby={a.describedBy}
                className={inputCls(a.invalid ? "x" : null)}
              >
                <option value="">{t("location.provincePlaceholder")}</option>
                {TR_ILLER_ALFABETIK.map((il) => (
                  <option key={il.kod} value={il.kod}>
                    {il.ad}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("location.district")} optional error={form.errorFor("details.district")}>
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
                placeholder={t("location.districtPlaceholder")}
                className={inputCls(a.invalid ? "x" : null)}
              />
            )}
          </Field>
        </div>
        <Field label={t("location.mapLink")} optional error={form.errorFor("details.mapLink")}>
          {(a) => (
            <input
              id={a.id}
              type="url"
              inputMode="url"
              maxLength={500}
              value={mapLink}
              disabled={form.submitting}
              onChange={(e) => {
                form.clearError("details.mapLink");
                setMapLink(e.target.value);
              }}
              aria-invalid={a.invalid}
              aria-describedby={a.describedBy}
              placeholder={t("location.mapLinkPlaceholder")}
              className={inputCls(a.invalid ? "x" : null)}
            />
          )}
        </Field>
      </SectionCard>

      {/* 2 · Alan */}
      <SectionCard step={2} title={t("area.heading")} sub={t("area.hint")} id="alan">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <Field label={t("area.value")} required error={form.errorFor("details.areaValue")}>
            {(a) => (
              <input
                id={a.id}
                type="number"
                inputMode="decimal"
                min={AREA.min}
                max={AREA.max}
                step="0.1"
                value={areaValue}
                disabled={form.submitting}
                onChange={(e) => {
                  form.clearError("details.areaValue");
                  setAreaValue(e.target.value);
                }}
                aria-invalid={a.invalid}
                aria-describedby={a.describedBy}
                className={inputCls(a.invalid ? "x" : null)}
              />
            )}
          </Field>
          <div>
            <span className="block text-xs font-semibold text-[#1a2e1a] mb-1.5 uppercase tracking-wider">{t("area.unit")}</span>
            <ChipGroup
              label={t("area.unit")}
              options={L.unit}
              value={areaUnit}
              onChange={(v) => setAreaUnit((v as Unit) ?? "dekar")}
              disabled={form.submitting}
              error={form.errorFor("details.areaUnit")}
            />
          </div>
        </div>
      </SectionCard>

      {/* 3 · Durum */}
      <SectionCard step={3} title={t("condition.heading")} sub={t("condition.sub")} id="durum">
        <ChipGroup
          label={t("condition.heading")}
          options={L.cond}
          value={conditions}
          multiple
          onChange={(v) => {
            form.clearError("details.conditions");
            setConditions((v as Condition[]) ?? []);
          }}
          disabled={form.submitting}
          error={form.errorFor("details.conditions")}
        />
        {form.errorFor("details.conditions") && (
          <p role="alert" className="text-xs font-medium text-[#dc2626]">{form.errorFor("details.conditions")}</p>
        )}
      </SectionCard>

      {/* 4 · Mülkiyet + Zamanlama */}
      <SectionCard step={4} title={t("ownership.heading")} id="mulkiyet">
        <ChipGroup
          label={t("ownership.heading")}
          options={L.own}
          value={ownership}
          onChange={(v) => {
            form.clearError("details.ownership");
            setOwnership(v as Ownership | null);
          }}
          disabled={form.submitting}
          error={form.errorFor("details.ownership")}
        />
        {form.errorFor("details.ownership") && (
          <p role="alert" className="text-xs font-medium text-[#dc2626]">{form.errorFor("details.ownership")}</p>
        )}
        <div className="pt-2">
          <p className="text-sm font-bold text-[#0e2519] mb-3">{t("timing.heading")}</p>
          <ChipGroup
            label={t("timing.heading")}
            options={L.timing}
            value={timing}
            onChange={(v) => {
              form.clearError("details.timing");
              setTiming(v as Timing | null);
            }}
            disabled={form.submitting}
            error={form.errorFor("details.timing")}
          />
          {form.errorFor("details.timing") && (
            <p role="alert" className="mt-2 text-xs font-medium text-[#dc2626]">{form.errorFor("details.timing")}</p>
          )}
        </div>
      </SectionCard>

      {/* 5 · Notlar */}
      <SectionCard step={5} title={t("notes.heading")} id="notlar">
        <Field label={t("notes.heading")} optional error={form.errorFor("details.accessNotes")}>
          {(a) => (
            <textarea
              id={a.id}
              rows={4}
              maxLength={1500}
              value={accessNotes}
              disabled={form.submitting}
              onChange={(e) => setAccessNotes(e.target.value)}
              aria-invalid={a.invalid}
              aria-describedby={a.describedBy}
              placeholder={t("notes.placeholder")}
              className={inputCls(a.invalid ? "x" : null, "resize-none")}
            />
          )}
        </Field>
      </SectionCard>

      {/* 6 · İletişim */}
      <ContactFields
        step={6}
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
