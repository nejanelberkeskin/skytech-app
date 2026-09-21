import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import OpenLandRequestForm, { type SiteOption } from "@/components/vitrin/talep/OpenLandRequestForm";
import { buildPageMetadata } from "@/lib/seo";
import { REQUEST_ROUTES } from "@/lib/site-config";
import { getProjectSites } from "@/lib/sites/data";
import { formatHectares, formatSiteLocation } from "@/lib/sites/format";
import type { SiteLocale } from "@/lib/sites/types";

/* ═══════════════════════════════════════════════════════════════════════
   Proje Uygulama Sahasına tohum topu bıraktırma
   ═══════════════════════════════════════════════════════════════════════
   Sitedeki bütün "Talep Oluştur / Satın Al" çağrıları buraya gelir: ziyaretçi
   önce sahaları görür; kendi arazisi için başvurmak isteyen, üstteki küçük
   bağlantıyla diğer forma geçer. (Adres tarihsel nedenle /talep/acik-arazi.)
   ═══════════════════════════════════════════════════════════════════════ */

// Saha listesi yönetim panelinden değişebilir; 5 dk ISR.
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

export default async function SahayaTohumTopuPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const siteLocale = (["tr", "en", "ru"].includes(locale) ? locale : "tr") as SiteLocale;

  const [t, tSeeds, allSites] = await Promise.all([
    getTranslations("requestForms.openLand"),
    getTranslations("ourSeeds"),
    getProjectSites(siteLocale),
  ]);

  // Yalnız katılıma açık sahalar ve yalnız gösterilecek alanlar istemciye gider.
  const sites: SiteOption[] = allSites
    .filter((s) => s.acceptsOrders)
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      location: formatSiteLocation(s),
      area:
        s.areaHectares !== null
          ? t("site.hectares", { value: formatHectares(s.areaHectares, siteLocale), count: s.areaHectares })
          : null,
      fire: s.isFireAffected
        ? s.fireYear
          ? t("site.fireWithYear", { year: String(s.fireYear) })
          : t("site.fire")
        : null,
      workType: t(`site.workTypes.${s.workType}`),
      species: s.species.map((sp) => {
        const key = `seeds.${sp.slug}.name`;
        return tSeeds.has(key) ? tSeeds(key) : sp.name;
      }),
      coverImage: s.coverImage,
    }));

  return (
    <>
      <BreadcrumbSchema items={[{ name: t("breadcrumb.label"), path: REQUEST_ROUTES.openLand }]} />
      <BreadCrumb
        title={t("breadcrumb.title")}
        subtitle={t("breadcrumb.subtitle")}
        items={[{ label: t("breadcrumb.label") }]}
      />
      <SectionWrapper variant="light">
        <OpenLandRequestForm sites={sites} />
      </SectionWrapper>
    </>
  );
}
