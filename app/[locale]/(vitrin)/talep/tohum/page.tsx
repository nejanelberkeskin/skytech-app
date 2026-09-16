import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import SeedRequestForm from "@/components/vitrin/talep/SeedRequestForm";
import { buildPageMetadata } from "@/lib/seo";
import { REQUEST_ROUTES } from "@/lib/site-config";
import { getActiveSeeds } from "@/lib/requests/options";

// Katalog seyrek değişir; 5 dk ISR. Gönderimde API zaten canlı doğrular.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "requestForms.seed" });
  return buildPageMetadata(
    { title: t("meta.title"), description: t("meta.description"), path: REQUEST_ROUTES.seed },
    locale
  );
}

export default async function TohumTalebiPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tHub, tSeeds, seeds] = await Promise.all([
    getTranslations("requestForms.seed"),
    getTranslations("requestsHub"),
    getTranslations("ourSeeds"),
    getActiveSeeds(),
  ]);

  // Bilinen türlerde sitenin kendi dilindeki ad/açıklama; diğerlerinde katalog metni.
  const species = seeds.map((s) => {
    const key = `seeds.${s.slug}`;
    const has = tSeeds.has(`${key}.name`);
    return {
      ...s,
      name: has ? tSeeds(`${key}.name`) : s.name,
      latinName: has ? tSeeds(`${key}.latin`) : s.latinName,
      description: has ? tSeeds(`${key}.description`) : s.description,
    };
  });

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: tHub("breadcrumb.label"), path: REQUEST_ROUTES.hub },
          { name: t("breadcrumb.label"), path: REQUEST_ROUTES.seed },
        ]}
      />
      <BreadCrumb
        title={t("breadcrumb.title")}
        subtitle={t("breadcrumb.subtitle")}
        items={[{ label: tHub("breadcrumb.label"), href: REQUEST_ROUTES.hub }, { label: t("breadcrumb.label") }]}
      />
      <SectionWrapper variant="light">
        <SeedRequestForm species={species} />
      </SectionWrapper>
    </>
  );
}
