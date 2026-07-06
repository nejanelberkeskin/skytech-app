import JsonLd from "./JsonLd";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

/**
 * WebSite schema — Google "SiteLinks Search Box" rich result için gerekli
 * + AI bot'ların site adı/URL'i kavramasına yardımcı.
 */
export default function WebSiteSchema() {
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
        inLanguage: "tr-TR",
        description: SITE_DESCRIPTION,
        publisher: {
          "@id": `${SITE_URL}#organization`,
        },
      }}
    />
  );
}
