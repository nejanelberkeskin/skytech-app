import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "comingSoonPage" });
  return buildPageMetadata(
    {
      title: t("meta.title"),
      description: t("meta.description"),
      path: "/yakinda",
    },
    locale
  );
}

export default async function YakindaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("comingSoonPage");

  return (
    <SectionWrapper variant="light" className="!py-24 lg:!py-32">
      <div className="max-w-2xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] mb-8 text-xs font-bold uppercase tracking-[0.18em]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#22894a] opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1B6B3A]" />
          </span>
          {t("badge")}
        </div>

        {/* Görsel ikon */}
        <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-[#1B6B3A] to-[#22894a] flex items-center justify-center shadow-xl shadow-[#1B6B3A]/20">
          <SproutIcon className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-4xl lg:text-5xl font-bold text-[#0e2519] leading-tight mb-5 tracking-tight">
          {t("title.lead")} <span className="text-gradient-forest">{t("title.highlight")}</span>
        </h1>

        <p className="text-lg text-[#3d5a3d] leading-relaxed mb-4">
          {t("body.primary")}
        </p>
        <p className="text-base text-[#6b8f6b] leading-relaxed mb-10">
          {t("body.secondary")}
        </p>

        {/* CTA'lar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          <Link href="/" className="vitrin-cta-secondary">
            {t("cta.home")}
          </Link>
          <Link href="/bilgi-al" className="vitrin-cta-primary">
            {t("cta.info")}
          </Link>
        </div>

        {/* Hızlı linkler */}
        <div className="mt-14 pt-10 border-t border-black/5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b8f6b] mb-5">
            {t("discover.heading")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/tohum-topu" className="text-[#1B6B3A] hover:text-[#22894a] font-semibold transition-colors">{t("discover.seedBall")}</Link>
            <Link href="/dron-teknolojisi" className="text-[#1B6B3A] hover:text-[#22894a] font-semibold transition-colors">{t("discover.drone")}</Link>
            <Link href="/projeler" className="text-[#1B6B3A] hover:text-[#22894a] font-semibold transition-colors">{t("discover.projects")}</Link>
            <Link href="/kurumsal-cozumler" className="text-[#1B6B3A] hover:text-[#22894a] font-semibold transition-colors">{t("discover.corporate")}</Link>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

function SproutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
  );
}
