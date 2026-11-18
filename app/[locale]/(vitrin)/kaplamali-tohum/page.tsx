import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import ServiceSchema from "@/components/seo/ServiceSchema";
import { buildPageMetadata } from "@/lib/seo";

const PATH = "/kaplamali-tohum";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "coatedSeedPage" });
  return buildPageMetadata({ title: t("title"), description: t("intro"), path: PATH }, locale);
}
export default async function CoatedSeedPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coatedSeedPage");
  const seo = await getTranslations("seoContent");
  return (
    <>
      <BreadcrumbSchema items={[{ name: t("title"), path: PATH }]} />
      <ServiceSchema name={t("serviceName")} description={t("serviceDescription")} serviceType="Drone seed release" path={PATH} />
      <BreadCrumb title={t("title")} subtitle={t("intro")} items={[{ label: t("title") }]} />
      <SectionWrapper>
        <div className="mx-auto max-w-3xl space-y-12">
          {(["definition", "difference", "selection", "service", "outcomes", "records"] as const).map((key) => (
            <section key={key} aria-labelledby={`coated-${key}`}>
              <h2 id={`coated-${key}`} className="mb-4 text-2xl font-semibold text-[#14261a]">{t(`${key}.title`)}</h2>
              <p className="leading-relaxed text-[#3d5a3d]">{t(`${key}.body`)}</p>
              {key === "difference" && <Link href="/tohum-topu" className="mt-4 inline-block font-semibold text-[#1B6B3A] underline underline-offset-4">{seo("seedBallLink")}</Link>}
              {key === "records" && <Link href="/karbon-programi" className="mt-4 inline-block font-semibold text-[#1B6B3A] underline underline-offset-4">{seo("reportsLink")}</Link>}
            </section>
          ))}
          <div className="flex flex-wrap gap-4 border-t border-[#14261a]/15 pt-8">
            <Link href="/sahalar" className="vitrin-cta-primary">{t("sitesLink")}</Link>
            <Link href="/tohumlarimiz" className="vitrin-cta-secondary">{t("speciesLink")}</Link>
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}
