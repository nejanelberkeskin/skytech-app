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

/* ═══════════════════════════════════════════════════════════════════════
   Karbon ve Raporlama
   ═══════════════════════════════════════════════════════════════════════
   Bu sayfa bilinçli olarak karbon miktarı, katsayı, hesaplayıcı ya da
   "karbon nötr / denkleştirme" iddiası İÇERMEZ. Sahalardaki karbon tutumu
   bağımsız bir kuruluşça doğrulanmış değildir; sunabildiğimiz belge bir
   Faaliyet Raporu'dur. Doğrulanmış bir hesap olmadan buraya rakam eklemeyin
   (Reklam Kurulu — çevreye ilişkin beyanlar; 7552 sayılı İklim Kanunu).
   ═══════════════════════════════════════════════════════════════════════ */

const REPORT_ITEMS = ["site", "area", "species", "date", "coordinates", "footage"] as const;
const FAQ_ITEMS = ["credit", "sustainability", "individual", "future"] as const;

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

export default async function KarbonVeRaporlamaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("carbonProgramPage");

  const canItems = t.raw("usage.can.items") as string[];
  const cannotItems = t.raw("usage.cannot.items") as string[];
  const whyPoints = t.raw("why.points") as string[];

  return (
    <>
      <BreadcrumbSchema items={[{ name: t("breadcrumb.label"), path: "/karbon-programi" }]} />
      <ServiceSchema
        name={t("schema.name")}
        description={t("schema.description")}
        serviceType="Reforestation activity reporting and monitoring"
        path="/karbon-programi"
      />
      <BreadCrumb title={t("hero.title")} subtitle={t("hero.subtitle")} items={[{ label: t("breadcrumb.label") }]} />

      {/* Faaliyet Raporu'nda neler var */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge={t("report.badge")}
          title={<>{t("report.title.pre")} <span className="text-gradient-forest">{t("report.title.highlight")}</span></>}
          subtitle={t("report.subtitle")}
        />
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto stagger-children">
          {REPORT_ITEMS.map((key, i) => (
            <li key={key} className="vitrin-card p-6 lg:p-7">
              <p className="text-xs font-bold tabular-nums tracking-[0.18em] text-[#22894a] mb-3">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="text-lg font-bold text-[#1a2e1a] mb-2">{t(`report.items.${key}.title`)}</h3>
              <p className="text-sm text-[#3d5a3d] leading-relaxed">{t(`report.items.${key}.desc`)}</p>
            </li>
          ))}
        </ol>
      </SectionWrapper>

      {/* Ne işe yarar / ne değildir */}
      <SectionWrapper variant="tinted">
        <SectionHeading
          badge={t("usage.badge")}
          title={<>{t("usage.title.pre")} <span className="text-gradient-forest">{t("usage.title.highlight")}</span></>}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <div className="rounded-3xl p-7 lg:p-9 bg-gradient-to-br from-[#1B6B3A] to-[#22894a] text-white shadow-2xl shadow-[#1B6B3A]/20">
            <h3 className="text-xl font-bold mb-5">{t("usage.can.heading")}</h3>
            <ul className="space-y-3 text-sm text-white/90">
              {canItems.map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckIcon className="w-5 h-5 shrink-0 text-[#a3e635] mt-0.5" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="vitrin-card p-7 lg:p-9">
            <h3 className="text-xl font-bold text-[#1a2e1a] mb-5">{t("usage.cannot.heading")}</h3>
            <ul className="space-y-3 text-sm text-[#3d5a3d]">
              {cannotItems.map((item) => (
                <li key={item} className="flex gap-3">
                  <MinusIcon className="w-5 h-5 shrink-0 text-[#9a3412] mt-0.5" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionWrapper>

      {/* Karbon konusunda neden temkinliyiz */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge={t("why.badge")}
          title={<>{t("why.title.pre")} <span className="text-gradient-forest">{t("why.title.highlight")}</span></>}
        />
        <div className="max-w-3xl mx-auto">
          <p className="text-base lg:text-lg text-[#3d5a3d] leading-relaxed mb-8">{t("why.body")}</p>
          <ul className="space-y-4">
            {whyPoints.map((point, i) => (
              <li key={point} className="vitrin-card p-5 flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] font-bold flex items-center justify-center text-sm tabular-nums">
                  {i + 1}
                </span>
                <p className="text-sm text-[#3d5a3d] leading-relaxed">{point}</p>
              </li>
            ))}
          </ul>
        </div>
      </SectionWrapper>

      {/* SSS */}
      <SectionWrapper variant="tinted">
        <SectionHeading
          badge={t("faq.badge")}
          title={<>{t("faq.title.pre")} <span className="text-gradient-forest">{t("faq.title.highlight")}</span></>}
        />
        <div className="max-w-3xl mx-auto space-y-3">
          {FAQ_ITEMS.map((key) => (
            <details key={key} className="group bg-white border border-black/8 rounded-2xl overflow-hidden">
              <summary className="flex items-center justify-between p-5 cursor-pointer text-base font-semibold text-[#1a2e1a] hover:text-[#1B6B3A] transition-colors list-none">
                <span className="pr-4">{t(`faq.items.${key}.question`)}</span>
                <span className="shrink-0 w-7 h-7 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] flex items-center justify-center group-open:bg-[#1B6B3A] group-open:text-white group-open:rotate-45 transition-all">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
                    <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-5 text-sm text-[#3d5a3d] leading-relaxed">{t(`faq.items.${key}.answer`)}</div>
            </details>
          ))}
        </div>
      </SectionWrapper>

      {/* CTA */}
      <SectionWrapper variant="light">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            {t("cta.title.pre")} <span className="text-gradient-forest">{t("cta.title.highlight")}</span>
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">{t("cta.subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link href={orderCtaHref("hub")} className="vitrin-cta-primary">
              {CTA_MODE === "order" ? t("cta.order") : CTA_MODE === "request" ? t("cta.request") : t("cta.soon")}
            </Link>
            <Link href="/bilgi-al" className="vitrin-cta-secondary">
              {t("cta.corporate")}
            </Link>
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" strokeLinecap="round" />
    </svg>
  );
}
