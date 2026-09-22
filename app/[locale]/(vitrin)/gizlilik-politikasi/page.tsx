import { setRequestLocale } from "next-intl/server";
import LegalLayout from "@/components/vitrin/LegalLayout";
import LegalBlocks from "@/components/vitrin/LegalBlocks";
import { privacyPolicyBlocks } from "@/lib/legal/templates/site-policies";
import { LEGAL_EFFECTIVE_LABEL } from "@/lib/legal/version";
import { buildPageMetadata } from "@/lib/seo";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildPageMetadata({ title: "Gizlilik Politikası", description: "Skytech Green gizlilik politikası ve başvuru yolları.", path: "/gizlilik-politikasi" }, locale);
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  return <LegalLayout title="Gizlilik Politikası" path="/gizlilik-politikasi" effectiveDate={LEGAL_EFFECTIVE_LABEL}><LegalBlocks blocks={privacyPolicyBlocks()} /></LegalLayout>;
}
