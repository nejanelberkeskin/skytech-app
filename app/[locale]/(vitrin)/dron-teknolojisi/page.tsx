import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import ServiceSchema from "@/components/seo/ServiceSchema";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "droneTechPage" });
  return buildPageMetadata(
    {
      title: t("meta.title"),
      description: t("meta.description"),
      path: "/dron-teknolojisi",
      image: {
        url: "/images/dron-teknolojisi/hero.webp",
        alt: t("meta.imageAlt"),
      },
      keywords: [
        "drone ağaçlandırma",
        "dronla tohum ekim",
        "RTK GPS tarım drone",
        "tarımsal drone Türkiye",
        "otonom drone ekim",
        "drone reforestation",
      ],
    },
    locale
  );
}

export default async function DronTeknolojisiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("droneTechPage");

  const FEATURES = [
    { title: t("features.gps.title"), desc: t("features.gps.desc"), Icon: GpsIcon },
    { title: t("features.capacity.title"), desc: t("features.capacity.desc"), Icon: BoxIcon },
    { title: t("features.speed.title"), desc: t("features.speed.desc"), Icon: BoltIcon },
    { title: t("features.autonomous.title"), desc: t("features.autonomous.desc"), Icon: AutoIcon },
    { title: t("features.access.title"), desc: t("features.access.desc"), Icon: PathIcon },
    { title: t("features.tracking.title"), desc: t("features.tracking.desc"), Icon: ChartIcon },
  ];

  const PROCESS = [
    { num: "01", title: t("process.survey.title"), desc: t("process.survey.desc") },
    { num: "02", title: t("process.plan.title"), desc: t("process.plan.desc") },
    { num: "03", title: t("process.seeding.title"), desc: t("process.seeding.desc") },
    { num: "04", title: t("process.reporting.title"), desc: t("process.reporting.desc") },
  ];

  return (
    <>
      <BreadcrumbSchema items={[{ name: t("breadcrumb.label"), path: "/dron-teknolojisi" }]} />
      <ServiceSchema
        name={t("schema.name")}
        description={t("schema.description")}
        serviceType="Drone-based aerial seeding for reforestation"
        path="/dron-teknolojisi"
        image="/images/dron-teknolojisi/hero.webp"
      />
      <BreadCrumb
        title={t("hero.title")}
        subtitle={t("hero.subtitle")}
        items={[{ label: t("breadcrumb.label") }]}
      />

      {/* Hero card */}
      <SectionWrapper variant="light">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center max-w-6xl mx-auto">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] mb-5 text-xs font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B3A]" />
              {t("system.badge")}
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
              {t.rich("system.heading", {
                grad: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
              })}
            </h2>
            <p className="text-base text-[#3d5a3d] leading-relaxed mb-5">
              {t("system.p1")}
            </p>
            <p className="text-base text-[#3d5a3d] leading-relaxed">
              {t.rich("system.p2", {
                strong: (chunks) => <strong className="text-[#1B6B3A]">{chunks}</strong>,
              })}
            </p>
          </div>

          <div className="relative aspect-square rounded-3xl overflow-hidden bg-[#0a1f12]">
            <Image
              src="/images/dron-teknolojisi/hero.webp"
              alt={t("system.imageAlt")}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute bottom-6 left-6 right-6 liquid-glass-dark rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs text-[#a7d4a7]">
                <span>RTK GPS</span><span>•</span>
                <span>LiDAR</span><span>•</span>
                <span>{t("system.thermalCamera")}</span>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Özellikler */}
      <SectionWrapper variant="tinted">
        <SectionHeading
          badge={t("featuresSection.badge")}
          title={t.rich("featuresSection.title", {
            grad: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
          })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto stagger-children">
          {FEATURES.map((f) => (
            <div key={f.title} className="vitrin-card p-7 flex items-start gap-5">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1B6B3A] to-[#22894a] flex items-center justify-center shadow-md shadow-[#1B6B3A]/15">
                <f.Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1a2e1a] mb-2">{f.title}</h3>
                <p className="text-sm text-[#3d5a3d] leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Operasyon Süreci */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge={t("processSection.badge")}
          title={t.rich("processSection.title", {
            grad: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
          })}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto stagger-children">
          {PROCESS.map((p) => (
            <div key={p.num} className="vitrin-card p-6">
              <div className="text-3xl font-bold text-[#1B6B3A]/15 mb-3 tracking-tighter">{p.num}</div>
              <h3 className="text-base font-bold text-[#1a2e1a] mb-2">{p.title}</h3>
              <p className="text-sm text-[#3d5a3d] leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* CTA */}
      <SectionWrapper variant="tinted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            {t.rich("cta.title", {
              grad: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
            })}
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">
            {t("cta.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link href="/bilgi-al" className="vitrin-cta-primary">{t("cta.buttonPrimary")}</Link>
            <Link href="/projeler" className="vitrin-cta-secondary">{t("cta.buttonSecondary")}</Link>
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}

function GpsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="1" x2="12" y2="4" strokeLinecap="round" />
      <line x1="12" y1="20" x2="12" y2="23" strokeLinecap="round" />
      <line x1="1" y1="12" x2="4" y2="12" strokeLinecap="round" />
      <line x1="20" y1="12" x2="23" y2="12" strokeLinecap="round" />
    </svg>
  );
}
function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinejoin="round" />
      <polyline points="3 8 12 13 21 8" strokeLinejoin="round" />
      <line x1="12" y1="13" x2="12" y2="22" strokeLinecap="round" />
    </svg>
  );
}
function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
function AutoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 12a9 9 0 0 1 9-9c4 0 7 2 8 5M21 12a9 9 0 0 1-9 9c-4 0-7-2-8-5" strokeLinecap="round" />
      <polyline points="20 4 20 9 15 9" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="4 20 4 15 9 15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PathIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 21l4-9 4 4 6-12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 14l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
