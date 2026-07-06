import { getLocale, getTranslations } from "next-intl/server";
import JsonLd from "./JsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const LOCALE_TO_BCP47: Record<string, string> = {
  tr: "tr-TR",
  en: "en-US",
  ru: "ru-RU",
};

/**
 * WebSite schema — Google "SiteLinks Search Box" rich result için gerekli
 * + AI bot'ların site adı/URL'i kavramasına yardımcı. Dil aktif locale'e göre.
 */
export default async function WebSiteSchema() {
  const t = await getTranslations("homeMeta");
  const locale = await getLocale();
  return (
    <JsonLd
      id="website"
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        name: SITE_NAME,
        alternateName: "Skytech Green Eco-Tech",
        url: SITE_URL,
        inLanguage: LOCALE_TO_BCP47[locale] ?? "tr-TR",
        description: t("description"),
        publisher: {
          "@id": `${SITE_URL}#organization`,
        },
      }}
    />
  );
}
