import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import OpenLandRequestForm from "@/components/vitrin/talep/OpenLandRequestForm";
import { buildPageMetadata } from "@/lib/seo";
import { REQUEST_ROUTES } from "@/lib/site-config";
import { getOpenPublicLands } from "@/lib/requests/options";

// Açık saha listesi admin panelinden değişebilir; 5 dk ISR.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "requestForms.openLand" });
  return buildPageMetadata(
    { title: t("meta.title"), description: t("meta.description"), path: REQUEST_ROUTES.openLand },
    locale
  );
}

export default async function AcikAraziPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tHub, lands] = await Promise.all([
    getTranslations("requestForms.openLand"),
    getTranslations("requestsHub"),
    getOpenPublicLands(),
  ]);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: tHub("breadcrumb.label"), path: REQUEST_ROUTES.hub },
          { name: t("breadcrumb.label"), path: REQUEST_ROUTES.openLand },
        ]}
      />
      <BreadCrumb
        title={t("breadcrumb.title")}
        subtitle={t("breadcrumb.subtitle")}
        items={[{ label: tHub("breadcrumb.label"), href: REQUEST_ROUTES.hub }, { label: t("breadcrumb.label") }]}
      />
      <SectionWrapper variant="light">
        <OpenLandRequestForm lands={lands} />
      </SectionWrapper>
    </>
  );
}
