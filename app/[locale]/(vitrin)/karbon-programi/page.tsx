import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import CarbonCalculator from "@/components/vitrin/homepage/CarbonCalculator";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import ServiceSchema from "@/components/seo/ServiceSchema";
import { buildPageMetadata } from "@/lib/seo";
import { TRANSACTIONS_ENABLED } from "@/lib/site-config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "carbonProgramPage" });
  return buildPageMetadata(
    {
      title: t("meta.title"),
      description: t("meta.description"),
      path: "/karbon-programi",
    },
    locale
  );
}

export default async function KarbonProgramiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("carbonProgramPage");

  const METRICS = [
    { value: "10–25 kg", label: t("metrics.perTree.label"), desc: t("metrics.perTree.desc"), ref: 1 },
    { value: "4,5–40,7 t", label: t("metrics.perHectare.label"), desc: t("metrics.perHectare.desc"), ref: 2 },
    { value: "~550 g", label: t("metrics.perSquareMeter.label"), desc: t("metrics.perSquareMeter.desc"), ref: 3 },
    { value: "GRI/CDP", label: t("metrics.compliant.label"), desc: t("metrics.compliant.desc") },
  ];

  const REFERENCES = [
    {
      id: 1,
      text: t("references.ref1.text"),
      source: "Penn State Extension — Carbon Accounting in Forest Management",
      url: "https://extension.psu.edu/carbon-accounting-in-forest-management",
    },
    {
      id: 2,
      text: t("references.ref2.text"),
      source: "Bernal et al., Carbon Balance and Management (2018) — Global carbon dioxide removal rates from forest landscape restoration",
      url: "https://cbmjournal.biomedcentral.com/articles/10.1186/s13021-018-0110-8",
    },
    {
      id: 3,
      text: t("references.ref3.text"),
      source: "Disentangling the soil and atmospheric stress on carbon sequestration in a Mediterranean pine forest, arXiv (2025)",
      url: "https://arxiv.org/pdf/2511.22720",
    },
    {
      id: 4,
      text: t("references.ref4.text"),
      source: "UAV-Based Precision Seed Dropping for Automated Reforestation, Authorea (2025)",
      url: "https://www.authorea.com/doi/full/10.22541/au.175622436.63027828/v1",
    },
  ];

  const COMPARISON = [
    { method: t("comparison.credit.method"), icon: "📄", pros: t("comparison.credit.pros"), cons: t("comparison.credit.cons"), verdict: false },
    { method: t("comparison.forest.method"), icon: "🌱", pros: t("comparison.forest.pros"), cons: "—", verdict: true },
  ];

  const FAQ = [
    { q: t("faq.validity.question"), a: t("faq.validity.answer") },
    { q: t("faq.calculation.question"), a: t("faq.calculation.answer") },
    { q: t("faq.individual.question"), a: t("faq.individual.answer") },
    { q: t("faq.esg.question"), a: t("faq.esg.answer") },
  ];

  return (
    <>
      <BreadcrumbSchema items={[{ name: t("breadcrumb.label"), path: "/karbon-programi" }]} />
      <ServiceSchema
        name={t("schema.name")}
        description={t("schema.description")}
        serviceType="Carbon offset and ESG reporting"
        path="/karbon-programi"
      />
      <BreadCrumb
        title={t("hero.title")}
        subtitle={t("hero.subtitle")}
        items={[{ label: t("breadcrumb.label") }]}
      />

      {/* Metrikler */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge={t("metrics.badge")}
          title={<>{t("metrics.title.pre")} <span className="text-gradient-forest">{t("metrics.title.highlight")}</span></>}
          subtitle={t("metrics.subtitle")}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto stagger-children">
          {METRICS.map((m) => (
            <div key={m.label} className="vitrin-card p-6 lg:p-7">
              <p className="text-3xl lg:text-4xl font-bold bg-gradient-to-br from-[#1B6B3A] to-[#22894a] bg-clip-text text-transparent mb-2 tabular-nums">
                {m.value}
              </p>
              <p className="text-xs uppercase tracking-wider text-[#1B6B3A] font-semibold mb-2">
                {m.label}
              </p>
              <p className="text-xs text-[#3d5a3d] leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Karbon Hesaplayıcı (homepage'dan reuse) */}
      <CarbonCalculator />

      {/* Karşılaştırma */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge={t("comparison.badge")}
          title={<>{t("comparison.title.pre")} <span className="text-gradient-forest">{t("comparison.title.highlight")}</span></>}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {COMPARISON.map((c) => (
            <div
              key={c.method}
              className={`relative rounded-3xl p-7 lg:p-9 ${
                c.verdict
                  ? "bg-gradient-to-br from-[#1B6B3A] to-[#22894a] text-white shadow-2xl shadow-[#1B6B3A]/20"
                  : "vitrin-card"
              }`}
            >
              <div className="text-5xl mb-5">{c.icon}</div>
              <h3 className={`text-xl font-bold mb-4 ${c.verdict ? "text-white" : "text-[#1a2e1a]"}`}>
                {c.method}
              </h3>
              <div className="space-y-3 text-sm">
                <p className={c.verdict ? "text-white/85" : "text-[#3d5a3d]"}>
                  <strong className={c.verdict ? "text-[#a3e635]" : "text-[#1B6B3A]"}>{t("comparison.prosLabel")}</strong> {c.pros}
                </p>
                {c.cons !== "—" && (
                  <p className={c.verdict ? "text-white/85" : "text-[#3d5a3d]"}>
                    <strong className="text-[#dc2626]">{t("comparison.consLabel")}</strong> {c.cons}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* FAQ */}
      <SectionWrapper variant="tinted">
        <SectionHeading
          badge={t("faq.badge")}
          title={<>{t("faq.title.pre")} <span className="text-gradient-forest">{t("faq.title.highlight")}</span></>}
        />
        <div className="max-w-3xl mx-auto space-y-3">
          {FAQ.map((item, i) => (
            <details key={i} className="group bg-white border border-black/8 rounded-2xl overflow-hidden">
              <summary className="flex items-center justify-between p-5 cursor-pointer text-base font-semibold text-[#1a2e1a] hover:text-[#1B6B3A] transition-colors list-none">
                <span className="pr-4">{item.q}</span>
                <span className="shrink-0 w-7 h-7 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] flex items-center justify-center group-open:bg-[#1B6B3A] group-open:text-white group-open:rotate-45 transition-all">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
                    <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-5 text-sm text-[#3d5a3d] leading-relaxed">{item.a}</div>
            </details>
          ))}
        </div>
      </SectionWrapper>

      {/* Akademik Kaynaklar */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge={t("references.badge")}
          title={<>{t("references.title.pre")} <span className="text-gradient-forest">{t("references.title.highlight")}</span></>}
          subtitle={t("references.subtitle")}
        />
        <ol className="max-w-3xl mx-auto space-y-4">
          {REFERENCES.map((ref) => (
            <li key={ref.id} className="vitrin-card p-5 flex gap-4">
              <span className="shrink-0 w-8 h-8 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] font-bold flex items-center justify-center text-sm">
                {ref.id}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-[#3d5a3d] leading-relaxed mb-1.5">{ref.text}</p>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B6B3A] hover:text-[#22894a] transition-colors break-words"
                >
                  {ref.source}
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </li>
          ))}
        </ol>
        <p className="max-w-3xl mx-auto text-xs text-[#6b8f6b] mt-6 text-center leading-relaxed">
          {t("references.note")}
        </p>
      </SectionWrapper>

      {/* CTA */}
      <SectionWrapper variant="tinted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            {t("cta.title.pre")} <span className="text-gradient-forest">{t("cta.title.highlight")}</span>
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">
            {t("cta.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link href={TRANSACTIONS_ENABLED ? "/kurumsal/teklif-al" : "/bilgi-al"} className="vitrin-cta-primary">
              {TRANSACTIONS_ENABLED ? t("cta.primaryEnabled") : t("cta.primaryDisabled")}
            </Link>
            <Link href={TRANSACTIONS_ENABLED ? "/bireysel/satin-al" : "/yakinda"} className="vitrin-cta-secondary">
              {TRANSACTIONS_ENABLED ? t("cta.secondaryEnabled") : t("cta.secondaryDisabled")}
            </Link>
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}
