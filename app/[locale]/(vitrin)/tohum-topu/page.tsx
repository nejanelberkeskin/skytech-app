import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import ServiceSchema from "@/components/seo/ServiceSchema";
import { buildPageMetadata } from "@/lib/seo";
import { CTA_MODE, orderCtaHref } from "@/lib/site-config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seedBallPage" });
  return buildPageMetadata(
    {
      title: t("meta.title"),
      description: t("meta.description"),
      path: "/tohum-topu",
      image: {
        url: "/images/tohum-topu/hero.webp",
        alt: t("meta.imageAlt"),
      },
    },
    locale
  );
}

export default async function TohumTopuPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("seedBallPage");

  const COMPONENTS = [
    { label: t("components.native.label"), desc: t("components.native.desc") },
    { label: t("components.clay.label"), desc: t("components.clay.desc") },
    { label: t("components.fertilizer.label"), desc: t("components.fertilizer.desc") },
  ];

  const STEPS = [
    { num: "01", title: t("steps.selection.title"), desc: t("steps.selection.desc") },
    { num: "02", title: t("steps.mixing.title"), desc: t("steps.mixing.desc") },
    { num: "03", title: t("steps.drying.title"), desc: t("steps.drying.desc") },
  ];

  const STATS = [
    { value: t("stats.season.value"), label: t("stats.season.label") },
  ];

  return (
    <>
      <BreadcrumbSchema items={[{ name: t("breadcrumb.label"), path: "/tohum-topu" }]} />
      <ServiceSchema
        name={t("schema.name")}
        description={t("schema.description")}
        serviceType="Seed ball production for reforestation"
        path="/tohum-topu"
        image="/images/tohum-topu/hero.webp"
      />
      <BreadCrumb
        title={t("hero.title")}
        subtitle={t("hero.subtitle")}
        items={[{ label: t("breadcrumb.label") }]}
      />

      {/* Bilim — Ne ve Neden */}
      <SectionWrapper variant="light">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center max-w-6xl mx-auto">
          <div>
            <p className="mb-5 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1B6B3A]">
              <span aria-hidden className="h-px w-8 bg-current" />
              {t("what.badge")}
            </p>
            <h2 className="display-headline text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14261a] mb-5">
              {t.rich("what.heading", {
                grad: (chunks) => <span className="text-[#1B6B3A]">{chunks}</span>,
              })}
            </h2>
            <p className="text-base text-[#3d5a3d] leading-relaxed mb-5">
              {t.rich("what.p1", {
                strong: (chunks) => <strong className="text-[#1B6B3A]"> {chunks} </strong>,
              })}
            </p>
            <p className="text-base text-[#3d5a3d] leading-relaxed">
              {t("what.p2")}
            </p>
          </div>

          <div className="relative aspect-square rounded-xl overflow-hidden bg-[#dfe3d6]">
            <Image
              src="/images/tohum-topu/hero.webp"
              alt={t("what.imageAlt")}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-[#14261a]/10 bg-white px-4 py-3 text-center">
              <p className="text-xs text-[#1B6B3A] uppercase tracking-wider font-semibold mb-1">{t("what.caption.eyebrow")}</p>
              <p className="text-sm text-[#14261a]">{t("what.caption.text")}</p>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Akademik literatür + laboratuvar analiziyle bilimsel tasarım */}
      <SectionWrapper variant="tinted" className="!py-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="mb-5 flex items-center justify-center gap-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1B6B3A]">
            <span aria-hidden className="h-px w-8 bg-current" />
            {t("science.badge")}
          </p>
          <h2 className="display-headline text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14261a] mb-5">
            {t.rich("science.heading", {
              grad: (chunks) => <span className="text-[#1B6B3A]">{chunks}</span>,
            })}
          </h2>
          <p className="text-base text-[#3d5a3d] leading-relaxed">
            {t("science.body")}
          </p>
        </div>
      </SectionWrapper>

      {/* Bileşenler */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge={t("formulation.badge")}
          title={t.rich("formulation.title", {
            grad: (chunks) => <span className="text-[#1B6B3A]">{chunks}</span>,
          })}
          subtitle={t("formulation.subtitle")}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 max-w-5xl mx-auto stagger-children">
          {COMPONENTS.map((c) => (
            <div key={c.label} className="vitrin-card p-7 text-center">
              <h3 className="text-lg font-bold text-[#14261a] mb-2">{c.label}</h3>
              <p className="text-sm text-[#3d5a3d] leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Üretim Süreci */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge={t("production.badge")}
          title={t.rich("production.title", {
            grad: (chunks) => <span className="text-[#1B6B3A]">{chunks}</span>,
          })}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto stagger-children">
          {STEPS.map((s) => (
            <div key={s.num} className="vitrin-card p-7">
              <div className="text-xs font-bold tabular-nums tracking-[0.18em] text-[#1B6B3A] mb-3">{s.num}</div>
              <h3 className="text-lg font-bold text-[#14261a] mb-2.5">{s.title}</h3>
              <p className="text-sm text-[#3d5a3d] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* İstatistikler */}
      <SectionWrapper variant="tinted">
        <div className="grid gap-5 max-w-xl mx-auto">
          {STATS.map((s) => (
            <div key={s.label} className="vitrin-card p-6 lg:p-7 text-center">
              <p className="text-3xl lg:text-4xl font-bold text-[#1B6B3A] mb-2 tabular-nums">
                {s.value}
              </p>
              <p className="text-xs uppercase tracking-wider text-[#6b8f6b] font-semibold">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* CTA */}
      <SectionWrapper variant="light">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="display-headline text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14261a] mb-5">
            {t.rich(CTA_MODE === "request" ? "cta.titleRequest" : "cta.title", {
              grad: (chunks) => <span className="text-[#1B6B3A]">{chunks}</span>,
            })}
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">
            {t("cta.subtitle")}
          </p>
          <Link href={orderCtaHref("hub")} className="vitrin-cta-primary">
            {CTA_MODE === "order" ? t("cta.buttonOrder") : CTA_MODE === "request" ? t("cta.buttonRequest") : t("cta.buttonSoon")}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </SectionWrapper>
    </>
  );
}
