import { orderCtaHref } from "@/lib/site-config";
import Image from "next/image";
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
  const nav = await getTranslations("nav");
  return (
    <>
      <BreadcrumbSchema items={[{ name: t("title"), path: PATH }]} />
      <ServiceSchema name={t("serviceName")} description={t("serviceDescription")} serviceType="Drone seed release" path={PATH} />
      <BreadCrumb title={t("title")} subtitle={t("intro")} items={[{ label: t("title") }]} />
      <SectionWrapper>
        <figure className="mx-auto mb-14 max-w-5xl">
          <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#e9ebe2]">
              <Image src="/images/kaplamali-tohum/tohumlar.webp" alt={t("images.seeds")} fill priority sizes="(min-width: 640px) 60vw, 100vw" className="object-cover" />
            </div>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-1 sm:grid-rows-2">
              <div className="relative col-span-2 aspect-[4/3] overflow-hidden rounded-xl bg-[#e9ebe2] sm:col-span-1 sm:aspect-auto">
                <Image src="/images/kaplamali-tohum/dron-saha.webp" alt={t("images.drone")} fill sizes="(min-width: 640px) 35vw, 66vw" className="object-cover" />
              </div>
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[#e9ebe2] sm:aspect-auto">
                <Image src="/images/kaplamali-tohum/filiz.webp" alt={t("images.sprout")} fill sizes="(min-width: 640px) 35vw, 33vw" className="object-cover" />
              </div>
            </div>
          </div>
          <figcaption className="mt-3 text-xs text-[#6b8f6b]">{t("images.note")}</figcaption>
        </figure>
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
            <Link href={orderCtaHref("hub")} className="vitrin-cta-primary">{nav("orderSeeds")}</Link>
            <Link href="/sahalar" className="vitrin-cta-secondary">{t("sitesLink")}</Link>
            <Link href="/tohumlarimiz" className="vitrin-cta-secondary">{t("speciesLink")}</Link>
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}
