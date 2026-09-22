import { setRequestLocale } from "next-intl/server";
import LegalLayout from "@/components/vitrin/LegalLayout";
import LegalBlocks from "@/components/vitrin/LegalBlocks";
import CookiePreferencesLink from "@/components/vitrin/CookiePreferencesLink";
import { cookiePolicyBlocks } from "@/lib/legal/templates/site-policies";
import { LEGAL_EFFECTIVE_LABEL } from "@/lib/legal/version";
import { buildPageMetadata } from "@/lib/seo";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildPageMetadata({ title: "Çerez Politikası", description: "Skytech Green çerezleri, isteğe bağlı ölçüm ve tercih yönetimi.", path: "/cerez-politikasi" }, locale);
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  return <LegalLayout title="Çerez Politikası" path="/cerez-politikasi" effectiveDate={LEGAL_EFFECTIVE_LABEL}>
    <LegalBlocks blocks={cookiePolicyBlocks()} />
    <CookiePreferencesLink label="Çerez tercihlerini aç" className="mt-6 inline-block min-h-11 py-3 font-semibold underline" />
  </LegalLayout>;
}
