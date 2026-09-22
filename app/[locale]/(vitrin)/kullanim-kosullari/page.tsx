import { setRequestLocale } from "next-intl/server";
import LegalLayout from "@/components/vitrin/LegalLayout";
import LegalBlocks from "@/components/vitrin/LegalBlocks";
import { siteTermsBlocks } from "@/lib/legal/templates/site-policies";
import { LEGAL_EFFECTIVE_LABEL } from "@/lib/legal/version";
import { buildPageMetadata } from "@/lib/seo";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildPageMetadata({ title: "Kullanım Koşulları", description: "Skytech Green kullanım koşulları ve başvuru yolları.", path: "/kullanim-kosullari" }, locale);
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  return <LegalLayout title="Kullanım Koşulları" path="/kullanim-kosullari" effectiveDate={LEGAL_EFFECTIVE_LABEL}><LegalBlocks blocks={siteTermsBlocks()} /></LegalLayout>;
}
