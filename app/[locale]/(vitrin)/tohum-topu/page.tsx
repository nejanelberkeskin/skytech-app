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
import { TRANSACTIONS_ENABLED } from "@/lib/site-config";

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
    { label: t("components.native.label"), desc: t("components.native.desc"), pct: "30%" },
    { label: t("components.clay.label"), desc: t("components.clay.desc"), pct: "50%" },
    { label: t("components.fertilizer.label"), desc: t("components.fertilizer.desc"), pct: "20%" },
  ];

  const STEPS = [
    { num: "01", title: t("steps.selection.title"), desc: t("steps.selection.desc") },
    { num: "02", title: t("steps.mixing.title"), desc: t("steps.mixing.desc") },
    { num: "03", title: t("steps.drying.title"), desc: t("steps.drying.desc") },
  ];

  const STATS = [
    { value: "%65+", label: t("stats.germination.label") },
    { value: "200+", label: t("stats.perFlight.label") },
    { value: "5kg", label: t("stats.co2.label") },
    { value: t("stats.lifespan.value"), label: t("stats.lifespan.label") },
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
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] mb-5 text-xs font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B3A]" />
              {t("what.badge")}
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
              {t.rich("what.heading", {
                grad: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
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

          <div className="relative aspect-square rounded-3xl overflow-hidden bg-[#0a1f12]">
            <Image
              src="/images/tohum-topu/hero.webp"
              alt={t("what.imageAlt")}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute bottom-6 left-6 right-6 liquid-glass-dark rounded-2xl p-5 text-center">
              <p className="text-xs text-[#a7d4a7] uppercase tracking-wider font-semibold mb-1">{t("what.caption.eyebrow")}</p>
              <p className="text-sm text-white">{t("what.caption.text")}</p>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Akademik literatür + laboratuvar analiziyle bilimsel tasarım */}
      <SectionWrapper variant="tinted" className="!py-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] mb-5 text-xs font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B3A]" />
            {t("science.badge")}
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            {t.rich("science.heading", {
              grad: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
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
            grad: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
          })}
          subtitle={t("formulation.subtitle")}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 max-w-5xl mx-auto stagger-children">
          {COMPONENTS.map((c) => (
            <div key={c.label} className="vitrin-card p-7 text-center">
              <div className="text-4xl font-bold bg-gradient-to-br from-[#1B6B3A] to-[#22894a] bg-clip-text text-transparent mb-2">
                {c.pct}
              </div>
              <h3 className="text-lg font-bold text-[#1a2e1a] mb-2">{c.label}</h3>
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
            grad: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
          })}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto stagger-children">
          {STEPS.map((s) => (
            <div key={s.num} className="vitrin-card p-7">
              <div className="text-2xl font-bold text-[#1B6B3A]/20 mb-3 tracking-tighter">{s.num}</div>
              <h3 className="text-lg font-bold text-[#1a2e1a] mb-2.5">{s.title}</h3>
              <p className="text-sm text-[#3d5a3d] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* İstatistikler */}
      <SectionWrapper variant="tinted">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {STATS.map((s) => (
            <div key={s.label} className="vitrin-card p-6 lg:p-7 text-center">
              <p className="text-3xl lg:text-4xl font-bold bg-gradient-to-br from-[#1B6B3A] to-[#22894a] bg-clip-text text-transparent mb-2 tabular-nums">
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
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            {t.rich("cta.title", {
              grad: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
            })}
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">
            {t("cta.subtitle")}
          </p>
          <Link href={TRANSACTIONS_ENABLED ? "/bireysel/satin-al" : "/yakinda"} className="vitrin-cta-primary">
            {TRANSACTIONS_ENABLED ? t("cta.buttonOrder") : t("cta.buttonSoon")}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </SectionWrapper>
    </>
  );
}
