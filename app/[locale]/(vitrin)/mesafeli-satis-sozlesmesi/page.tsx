import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import SampleLegalDocument from "@/components/vitrin/SampleLegalDocument";
import { buildPageMetadata } from "@/lib/seo";
import { isDraftLegalVersion } from "@/lib/legal/version";

const PATH = "/mesafeli-satis-sozlesmesi";
const TITLE = "Mesafeli Satış Sözleşmesi";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata(
    {
      title: TITLE,
      description: "Skytech Green tohum topu bıraktırma hizmetine ilişkin Mesafeli Hizmet Sözleşmesi'nin örnek metni: taraflar, bedel, ifa takvimi, 14 günlük cayma hakkı ve iade koşulları.",
      path: PATH,
      // Taslak metin arama motorlarına verilmez.
      noindex: isDraftLegalVersion(),
    },
    locale
  );
}

export default async function MesafeliSatisSozlesmesiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SampleLegalDocument kind="contract" title={TITLE} path={PATH} />;
}
