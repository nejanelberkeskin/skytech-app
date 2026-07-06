import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import ProjectsGrid from "@/components/vitrin/projeler/ProjectsGrid";
import TurkeyMap from "@/components/vitrin/TurkeyMap";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import { PROJECTS } from "@/lib/projects-data";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projectsPage" });
  return buildPageMetadata(
    {
      title: t("meta.title"),
      description: t("meta.description"),
      path: "/projeler",
    },
    locale
  );
}

export default async function ProjelerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projectsPage");

  const STATS = [
    { value: "3", label: t("stats.pilotRegions") },
    { value: "3", label: t("stats.provinces") },
    { value: "%100", label: t("stats.legalCompliance") },
  ];

  return (
    <>
      <BreadcrumbSchema items={[{ name: t("breadcrumbSchemaName"), path: "/projeler" }]} />
      <BreadCrumb
        title={t("breadcrumbTitle")}
        subtitle={t("breadcrumbSubtitle")}
        items={[{ label: t("breadcrumbSchemaName") }]}
      />

      {/* Stats */}
      <SectionWrapper variant="light" className="!py-12">
        <div className="grid grid-cols-3 gap-5 max-w-3xl mx-auto">
          {STATS.map((s) => (
            <div key={s.label} className="vitrin-card p-6 text-center">
              <p className="text-3xl lg:text-4xl font-bold bg-gradient-to-br from-[#1B6B3A] to-[#22894a] bg-clip-text text-transparent mb-1 tabular-nums">
                {s.value}
              </p>
              <p className="text-xs uppercase tracking-wider text-[#6b8f6b] font-semibold">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* İnteraktif Türkiye Haritası */}
      <SectionWrapper variant="tinted">
        <SectionHeading
          badge={t("map.badge")}
          title={
            <>
              {t("map.titleLine")}{" "}
              <span className="text-gradient-aurora">{t("map.titleAccent")}</span>
            </>
          }
          subtitle={t("map.subtitle")}
        />
        <TurkeyMap
          projects={PROJECTS.map((p) => ({
            id: p.id,
            province: p.city,
            region: t(`items.${p.id}.region`),
            status: p.status,
            trees: p.trees,
            year: p.year,
          }))}
        />
      </SectionWrapper>

      {/* Pilot saha listesi */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge={t("list.badge")}
          title={<>{t("list.titleLine")} <span className="text-gradient-aurora">{t("list.titleAccent")}</span></>}
          subtitle={t("list.subtitle")}
        />
        <ProjectsGrid />
      </SectionWrapper>

      {/* CTA */}
      <SectionWrapper variant="tinted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            {t("cta.titleLine")} <span className="text-gradient-forest">{t("cta.titleAccent")}</span> {t("cta.titleTail")}
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">
            {t("cta.subtitle")}
          </p>
          <Link href="/bilgi-al" className="vitrin-cta-primary">{t("cta.button")}</Link>
        </div>
      </SectionWrapper>
    </>
  );
}
