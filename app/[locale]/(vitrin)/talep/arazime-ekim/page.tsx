import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import LandApplicationForm from "@/components/vitrin/talep/LandApplicationForm";
import { buildPageMetadata } from "@/lib/seo";
import { REQUEST_ROUTES } from "@/lib/site-config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "requestForms.land" });
  return buildPageMetadata(
    { title: t("meta.title"), description: t("meta.description"), path: REQUEST_ROUTES.land },
    locale
  );
}

export default async function ArazimeEkimPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tHub] = await Promise.all([
    getTranslations("requestForms.land"),
    getTranslations("requestsHub"),
  ]);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: tHub("breadcrumb.label"), path: REQUEST_ROUTES.hub },
          { name: t("breadcrumb.label"), path: REQUEST_ROUTES.land },
        ]}
      />
      <BreadCrumb
        title={t("breadcrumb.title")}
        subtitle={t("breadcrumb.subtitle")}
        items={[{ label: tHub("breadcrumb.label"), href: REQUEST_ROUTES.hub }, { label: t("breadcrumb.label") }]}
      />
      <SectionWrapper variant="light">
        <LandApplicationForm />
      </SectionWrapper>
    </>
  );
}
