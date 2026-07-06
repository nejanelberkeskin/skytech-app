import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import Timeline from "@/components/vitrin/hakkimizda/Timeline";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import { buildPageMetadata } from "@/lib/seo";
import { TRANSACTIONS_ENABLED } from "@/lib/site-config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  return buildPageMetadata(
    {
      title: t("meta.title"),
      description: t("meta.description"),
      path: "/hakkimizda",
      image: {
        url: "/images/hakkimizda/saha.webp",
        alt: t("hero.imageAlt"),
      },
    },
    locale
  );
}

export default async function HakkimizdaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("aboutPage");

  const VALUES = [
    { title: t("values.science.title"), desc: t("values.science.desc"), Icon: ScienceIcon },
    { title: t("values.technology.title"), desc: t("values.technology.desc"), Icon: TechIcon },
    { title: t("values.transparency.title"), desc: t("values.transparency.desc"), Icon: EyeIcon },
    { title: t("values.sustainability.title"), desc: t("values.sustainability.desc"), Icon: LeafIcon },
  ];

  const TEAM = [
    { name: t("team.foresters.name"), desc: t("team.foresters.desc"), count: 8 },
    { name: t("team.pilots.name"), desc: t("team.pilots.desc"), count: 12 },
    { name: t("team.coordinators.name"), desc: t("team.coordinators.desc"), count: 6 },
    { name: t("team.software.name"), desc: t("team.software.desc"), count: 10 },
  ];

  const STATS = [
    { value: "3", label: t("stats.regions.label") },
    { value: "36+", label: t("stats.members.label") },
    { value: "%100", label: t("stats.compliance.label") },
  ];

  return (
    <>
      <BreadcrumbSchema items={[{ name: t("breadcrumb.label"), path: "/hakkimizda" }]} />
      <BreadCrumb
        title={t("hero.title")}
        subtitle={t("hero.subtitle")}
        items={[{ label: t("breadcrumb.label") }]}
      />

      {/* Hikaye */}
      <SectionWrapper variant="light">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center max-w-6xl mx-auto">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] mb-5 text-xs font-semibold uppercase tracking-wider">
              {t("story.badge")}
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
              {t("story.titleLead")} <span className="text-gradient-forest">{t("story.titleAccent")}</span>
            </h2>
            <p className="text-base text-[#3d5a3d] leading-relaxed mb-5">
              {t("story.paragraph1")}
            </p>
            <p className="text-base text-[#3d5a3d] leading-relaxed">
              {t.rich("story.paragraph2", {
                brand: (chunks) => <strong className="text-[#1B6B3A]">{chunks}</strong>,
              })}
            </p>
          </div>

          <div className="relative aspect-square rounded-3xl overflow-hidden bg-[#0a1f12]">
            <Image
              src="/images/hakkimizda/saha.webp"
              alt={t("hero.imageAlt")}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute bottom-6 left-6 right-6 liquid-glass-dark rounded-2xl p-4 text-center">
              <p className="text-xs text-[#a7d4a7] uppercase tracking-wider font-semibold">{t("story.imageCaption")}</p>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Timeline — Yolculuğumuz */}
      <Timeline />

      {/* Değerler */}
      <SectionWrapper variant="tinted">
        <SectionHeading
          badge={t("values.badge")}
          title={t.rich("values.title", {
            accent: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
          })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto stagger-children">
          {VALUES.map((v) => (
            <div key={v.title} className="vitrin-card p-7 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#1B6B3A] to-[#22894a] flex items-center justify-center shadow-md shadow-[#1B6B3A]/15 mb-5">
                <v.Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base font-bold text-[#1a2e1a] mb-2">{v.title}</h3>
              <p className="text-sm text-[#3d5a3d] leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Ekip */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge={t("team.badge")}
          title={t.rich("team.title", {
            accent: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
          })}
          subtitle={t("team.subtitle")}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto stagger-children">
          {TEAM.map((t) => (
            <div key={t.name} className="vitrin-card p-7 flex items-start gap-5">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1B6B3A] to-[#22894a] flex items-center justify-center shadow-md shadow-[#1B6B3A]/15">
                <span className="text-xl font-bold text-white tabular-nums">{t.count}</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1a2e1a] mb-1.5">{t.name}</h3>
                <p className="text-sm text-[#3d5a3d] leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* İstatistikler */}
      <SectionWrapper variant="tinted">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
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
              accent: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
            })}
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">
            {t("cta.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link href={TRANSACTIONS_ENABLED ? "/bireysel/satin-al" : "/yakinda"} className="vitrin-cta-primary">
              {TRANSACTIONS_ENABLED ? t("cta.primaryEnabled") : t("cta.primaryDisabled")}
            </Link>
            <Link href="/iletisim" className="vitrin-cta-secondary">{t("cta.secondary")}</Link>
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}

function ScienceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 3h6M10 3v7L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 10V3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TechIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <line x1="6" y1="10" x2="6" y2="14" strokeLinecap="round" />
      <line x1="10" y1="10" x2="10" y2="14" strokeLinecap="round" />
      <line x1="14" y1="10" x2="18" y2="10" strokeLinecap="round" />
      <line x1="14" y1="14" x2="18" y2="14" strokeLinecap="round" />
    </svg>
  );
}
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor">
      <path d="M27 5C27 5 22 4 16 6C10 8 6 13 6 19C6 22 8 25 11 26C8 24 7 21 7 19C7 14 11 9 17 8C12 11 9 16 9 20C9 24 11 27 14 27C20 27 26 22 27 5Z" />
    </svg>
  );
}
