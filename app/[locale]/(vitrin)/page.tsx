import HeroSection from "@/components/vitrin/homepage/HeroSection";
import MarqueeStrip from "@/components/vitrin/homepage/MarqueeStrip";
import ValueCards from "@/components/vitrin/homepage/ValueCards";
import HowItWorks from "@/components/vitrin/homepage/HowItWorks";
import SeedJourney from "@/components/vitrin/homepage/SeedJourney";
import CarbonCalculator from "@/components/vitrin/homepage/CarbonCalculator";
import ImpactTabs from "@/components/vitrin/homepage/ImpactTabs";
import MagicLens from "@/components/vitrin/homepage/MagicLens";
import AdvantagesGrid from "@/components/vitrin/homepage/AdvantagesGrid";
import ComparisonTable from "@/components/vitrin/homepage/ComparisonTable";
import BeforeAfter from "@/components/vitrin/homepage/BeforeAfter";
import ServicePackages from "@/components/vitrin/homepage/ServicePackages";
import FAQSection from "@/components/vitrin/homepage/FAQSection";
import FinalCTA from "@/components/vitrin/homepage/FinalCTA";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "homeMeta" });
  return buildPageMetadata(
    { title: t("title"), description: t("description"), path: "/" },
    locale
  );
}

export default async function VitrinHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <HeroSection />
      <MarqueeStrip />
      <ValueCards />
      <HowItWorks />
      <SeedJourney />
      <CarbonCalculator />
      <ImpactTabs />
      <MagicLens />
      <AdvantagesGrid />
      <ComparisonTable />
      <BeforeAfter />
      <ServicePackages />
      <FAQSection />
      <FinalCTA />
    </>
  );
}
