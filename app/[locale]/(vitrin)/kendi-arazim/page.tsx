import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import LandApplicationForm from "@/components/vitrin/talep/LandApplicationForm";
import SeasonTimeline from "@/components/vitrin/shared/SeasonTimeline";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import ApplicationLink from "@/components/vitrin/kendi-arazim/ApplicationLink";
import { REQUESTS_ENABLED } from "@/lib/site-config";
import { SITES_HREF } from "@/lib/sites/links";
import { COMPANY } from "@/lib/company";
import { buildPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ownLandPage" });
  return buildPageMetadata({ title: t("title"), description: t("description"), path: "/kendi-arazim" }, locale);
}

export default async function OwnLandPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!REQUESTS_ENABLED) redirect({ href: "/yakinda", locale });
  const t = await getTranslations({ locale, namespace: "ownLandPage" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const heading = "display-headline text-2xl font-semibold sm:text-3xl";
  const applicants = ["individuals", "companies", "cooperatives", "municipalities", "institutions"] as const;
  const steps = ["application", "review", "planning", "offer", "release"] as const;
  const questions = ["location", "area", "condition", "ownership", "timing", "contact"] as const;
  return (
    <div className="vitrin-container space-y-14 pb-20 pt-28 text-[#0e2519] sm:space-y-20 sm:pt-36 motion-reduce:[&_*]:!transition-none motion-reduce:[&_*]:!animate-none">
      <BreadcrumbSchema items={[{ name: t("breadcrumb"), path: `${locale === "tr" ? "" : `/${locale}`}/kendi-arazim` }]} />
      <header>
        <nav aria-label={t("breadcrumbLabel")} className="mb-7 flex flex-wrap gap-2 text-sm text-[#526352]">
          <Link href="/" className="underline-offset-4 hover:underline">{nav("home")}</Link>
          <span aria-hidden="true">/</span><span aria-current="page">{t("breadcrumb")}</span>
        </nav>
        <div className="grid overflow-hidden rounded-3xl border border-[#1B6B3A]/15 bg-[#f8faf5] lg:grid-cols-[1.15fr_1fr]">
          <div className="p-6 sm:p-10 lg:p-12">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#1B6B3A]">{t("eyebrow")}</p>
            <h1 className="display-headline text-3xl font-semibold leading-tight sm:text-4xl xl:text-5xl">{t("title")}</h1>
            <p className="mt-6 max-w-2xl leading-relaxed text-[#3d5a3d]">{t("description")}</p>
            <div className="mt-8 flex flex-col items-start gap-5">
              <ApplicationLink>{t("apply")}</ApplicationLink>
              <Link href={SITES_HREF} className="max-w-full py-2 text-sm font-semibold text-[#1B6B3A] underline decoration-[#1B6B3A]/30 underline-offset-4">{t("sites")}</Link>
            </div>
          </div>
          <div className="relative min-h-64 lg:min-h-full">
            <Image src="/images/projeler/canakkale-gelibolu.webp" alt="" loading="eager" fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          </div>
        </div>
      </header>
      <section aria-labelledby="eligible-title" className="grid gap-7 lg:grid-cols-[1fr_1.6fr]">
        <div><h2 id="eligible-title" className={heading}>{t("eligible.title")}</h2><p className="mt-4 leading-relaxed text-[#526352]">{t("eligible.note")}</p></div>
        <ul className="grid gap-3 sm:grid-cols-2">{applicants.map((key) => <li key={key} className="rounded-2xl border border-[#1B6B3A]/15 px-5 py-4 font-medium">{t(`eligible.${key}`)}</li>)}</ul>
      </section>
      <section aria-labelledby="process-title">
        <h2 id="process-title" className={heading}>{t("process.title")}</h2>
        <ol className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{steps.map((key, index) => <li key={key} className="rounded-2xl bg-[#f8faf5] p-6">
          <span aria-hidden="true" className="mb-5 flex h-9 w-9 items-center justify-center rounded-full border border-[#1B6B3A]/25 font-mono text-sm text-[#1B6B3A]">{index + 1}</span>
          <h3 className="font-semibold">{t(`process.${key}.title`)}</h3><p className="mt-3 text-sm leading-relaxed text-[#526352]">{t(`process.${key}.body`)}</p>
        </li>)}</ol>
      </section>
      <section aria-labelledby="information-title" className="grid gap-7 rounded-3xl border border-[#1B6B3A]/15 p-6 sm:p-9 lg:grid-cols-2">
        <div><h2 id="information-title" className={heading}>{t("information.title")}</h2><p className="mt-5 font-medium leading-relaxed text-[#1B6B3A]">{t("free")}</p></div>
        <ul className="space-y-3">{questions.map((key) => <li key={key} className="flex gap-3 text-[#526352]"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1B6B3A]" />{t(`information.${key}`)}</li>)}</ul>
      </section>
      <SeasonTimeline locale={locale} currentMonth={new Date().getUTCMonth()} />
      <section id="basvuru" tabIndex={-1} aria-labelledby="application-title" className="scroll-mt-28 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[#1B6B3A]">
        <h2 id="application-title" className={`${heading} mb-4`}>{t("formTitle")}</h2><p className="mb-8 text-[#526352]">{t("free")}</p>
        <LandApplicationForm />
      </section>
      <section aria-labelledby="faq-title" className="max-w-4xl">
        <h2 id="faq-title" className={`${heading} mb-7`}>{t("faq.title")}</h2>
        <div className="divide-y divide-[#1B6B3A]/15 border-y border-[#1B6B3A]/15">{["fee", "species", "season"].map((key) => <details key={key} className="group py-5">
          <summary className="cursor-pointer rounded-md pr-3 font-semibold marker:text-[#1B6B3A] focus-visible:outline-2 focus-visible:outline-offset-4">{t(`faq.${key}.question`)}</summary>
          <p className="mt-4 pl-5 leading-relaxed text-[#526352]">{t(`faq.${key}.answer`)}</p>
        </details>)}</div>
      </section>
      <footer className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#1B6B3A]/15 pt-7 text-sm">
        <p>{t("contact")}</p><a className="break-all font-semibold text-[#1B6B3A] underline underline-offset-4" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        {COMPANY.phone && <a className="font-semibold text-[#1B6B3A] underline underline-offset-4" href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}>{COMPANY.phone}</a>}
      </footer>
    </div>
  );
}
