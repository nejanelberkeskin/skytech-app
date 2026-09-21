import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import SampleLegalDocument from "@/components/vitrin/SampleLegalDocument";
import { buildPageMetadata } from "@/lib/seo";
import { isDraftLegalVersion } from "@/lib/legal/version";

const PATH = "/on-bilgilendirme";
const TITLE = "Ön Bilgilendirme Formu";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata(
    {
      title: TITLE,
      description: "Skytech Green tohum topu bıraktırma hizmeti için sipariş öncesi ön bilgilendirme formunun örnek metni: hizmetin nitelikleri, toplam bedel, ifa ve cayma hakkı.",
      path: PATH,
      // Taslak metin arama motorlarına verilmez.
      noindex: isDraftLegalVersion(),
    },
    locale
  );
}

export default async function OnBilgilendirmePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SampleLegalDocument kind="pre_info" title={TITLE} path={PATH} />;
}
