"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatCount, formatTry, initialQuantity, quantityRangeError, type PriceLocale, type PublicPricing } from "@/lib/pricing";

export interface QuickBuySite {
  slug: string;
  name: string;
  location: string;
  hectares: string | null;
  fire: string | null;
  cover: string | null;
  product: string;
  unit: string;
  orderHref: string;
  pricing: PublicPricing;
}

/** Saha + adet seçimi; "Devam et" sahanın sihirbazını seçilen adetle açar (`?adet=`). */
export default function QuickBuy({ sites, locale, sitesHref }: { sites: QuickBuySite[]; locale: PriceLocale; sitesHref: string }) {
  const t = useTranslations("quickBuy");
  const [slug, setSlug] = useState(sites[0].slug);
  const site = sites.find((s) => s.slug === slug) ?? sites[0];
  const [text, setText] = useState(() => String(initialQuantity(sites[0].pricing)));
  const quantity = /^\d{1,7}$/.test(text.trim()) ? Number(text.trim()) : null;
  const range = quantity === null ? "invalid" : quantityRangeError(quantity, site.pricing);
  const total = quantity !== null && !range ? quantity * site.pricing.unitPriceKurus : null;
  const href = useMemo(() => (total === null ? null : `${site.orderHref}?adet=${quantity}`), [site.orderHref, quantity, total]);
  const error =
    range === "quantityMin" ? t("errors.min", { min: formatCount(site.pricing.minQuantity, locale) })
    : range === "quantityMax" ? t("errors.max", { max: formatCount(site.pricing.maxQuantity, locale) })
    : range === "invalid" ? t("errors.invalid")
    : null;
  const step = (delta: number) => {
    const base = quantity ?? site.pricing.minQuantity;
    setText(String(Math.min(site.pricing.maxQuantity, Math.max(site.pricing.minQuantity, base + delta))));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="space-y-6">
        <section aria-labelledby="qb-site" className="rounded-xl border border-[#14261a]/12 bg-white p-5 sm:p-6">
          <h2 id="qb-site" className="flex items-center gap-3 text-lg font-semibold text-[#14261a]">
            <StepNo n={1} />
            {t("siteTitle")}
          </h2>
          <div role="radiogroup" aria-labelledby="qb-site" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sites.map((s) => {
              const selected = s.slug === site.slug;
              return (
                <button
                  key={s.slug}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSlug(s.slug)}
                  className={`flex min-w-0 flex-row overflow-hidden rounded-lg border-2 sm:flex-col text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B6B3A] ${
                    selected ? "border-[#1B6B3A] bg-[#1B6B3A]/5" : "border-[#14261a]/12 bg-white hover:border-[#1B6B3A]/50"
                  }`}
                >
                  <span className="relative block w-28 shrink-0 self-stretch bg-[#e9ebe2] sm:aspect-[16/9] sm:w-full">
                    {s.cover && <Image src={s.cover} alt="" fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 40vw, 112px" className="object-cover" />}
                  </span>
                  <span className="flex flex-1 flex-col gap-1 p-3.5">
                    <span className="font-semibold leading-snug text-[#14261a]">{s.name}</span>
                    {s.location && <span className="text-sm text-[#3d5a3d]">{s.location}</span>}
                    <span className="mt-1 text-xs text-[#6b8f6b]">{[s.fire, s.hectares].filter(Boolean).join(" · ")}</span>
                    <span className="mt-2 text-sm font-semibold text-[#1B6B3A]">
                      {t("unitPrice", { price: formatTry(s.pricing.unitPriceKurus, locale), unit: s.unit })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-[#3d5a3d]">
            {t("product")}: <span className="font-semibold text-[#14261a]">{site.product}</span>
            <span className="mx-2 text-[#14261a]/25">|</span>
            <Link href={sitesHref} className="font-semibold text-[#1B6B3A] underline underline-offset-4">{t("inspectSites")}</Link>
          </p>
        </section>

        <section aria-labelledby="qb-qty" className="rounded-xl border border-[#14261a]/12 bg-white p-5 sm:p-6">
          <h2 id="qb-qty" className="flex items-center gap-3 text-lg font-semibold text-[#14261a]">
            <StepNo n={2} />
            {t("quantityTitle")}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {site.pricing.quantityPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setText(String(preset))}
                aria-pressed={quantity === preset}
                className={`min-h-11 rounded-lg border px-4 text-sm font-semibold tabular-nums transition-colors ${
                  quantity === preset ? "border-[#1B6B3A] bg-[#1B6B3A] text-white" : "border-[#14261a]/20 text-[#14261a] hover:border-[#1B6B3A]"
                }`}
              >
                {formatCount(preset, locale)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex max-w-xs items-center gap-2">
            <button type="button" onClick={() => step(-10)} aria-label={t("decrease")} className="h-12 w-12 shrink-0 rounded-lg border border-[#14261a]/20 text-xl font-semibold text-[#14261a] hover:border-[#1B6B3A]">−</button>
            <label className="sr-only" htmlFor="qb-qty-input">{t("quantityLabel")}</label>
            <input
              id="qb-qty-input"
              inputMode="numeric"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
              aria-invalid={Boolean(error)}
              aria-describedby="qb-qty-help"
              className="h-12 w-full min-w-0 rounded-lg border border-[#14261a]/20 bg-white text-center text-lg font-semibold tabular-nums text-[#14261a] focus:border-[#1B6B3A] focus:outline-none focus:ring-2 focus:ring-[#1B6B3A]/20"
            />
            <button type="button" onClick={() => step(10)} aria-label={t("increase")} className="h-12 w-12 shrink-0 rounded-lg border border-[#14261a]/20 text-xl font-semibold text-[#14261a] hover:border-[#1B6B3A]">+</button>
          </div>
          <p id="qb-qty-help" role={error ? "alert" : undefined} className={`mt-3 text-sm ${error ? "text-red-700" : "text-[#3d5a3d]"}`}>
            {error ?? t("quantityHelp", { min: formatCount(site.pricing.minQuantity, locale), unit: site.unit })}
          </p>
        </section>
      </div>

      <aside className="rounded-xl border border-[#14261a]/12 bg-white p-5 sm:p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold text-[#14261a]">{t("summaryTitle")}</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label={t("summarySite")} value={site.name} />
          <Row label={t("product")} value={site.product} />
          <Row label={t("quantityLabel")} value={quantity === null ? "—" : formatCount(quantity, locale)} />
          <Row label={t("summaryUnit")} value={formatTry(site.pricing.unitPriceKurus, locale)} />
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t border-[#14261a]/10 pt-4">
          <span className="text-sm text-[#3d5a3d]">{t("total")}</span>
          <span className="text-2xl font-bold tabular-nums text-[#14261a]">{total === null ? "—" : formatTry(total, locale)}</span>
        </div>
        <p className="mt-1 text-xs text-[#6b8f6b]">{t("vatIncluded")}</p>
        {href ? (
          <Link href={href} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#1B6B3A] px-6 font-semibold text-white transition-colors hover:bg-[#14552d]">
            {t("continue")}
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : (
          <span aria-disabled className="mt-5 flex min-h-12 w-full items-center justify-center rounded-[10px] bg-[#14261a]/10 px-6 font-semibold text-[#14261a]/50">{t("continue")}</span>
        )}
        <ul className="mt-5 space-y-2 border-t border-[#14261a]/10 pt-4 text-sm text-[#3d5a3d]">
          {(["withdrawal", "secure", "certificate"] as const).map((key) => (
            <li key={key} className="flex gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#1B6B3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t(`trust.${key}`)}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function StepNo({ n }: { n: number }) {
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B6B3A] text-sm font-semibold text-white">{n}</span>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#3d5a3d]">{label}</dt>
      <dd className="text-right font-semibold text-[#14261a]">{value}</dd>
    </div>
  );
}
