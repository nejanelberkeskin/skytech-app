import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Skytech Green — Tohum Toplarıyla Geleceği Ekin",
  description:
    "Dron teknolojisi ve tohum topu ile karbon nötr ağaçlandırma. Bireysel ve kurumsal çözümler, ölçülebilir etki, şeffaf tedarik zinciri.",
};

export default function VitrinHomePage() {
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
