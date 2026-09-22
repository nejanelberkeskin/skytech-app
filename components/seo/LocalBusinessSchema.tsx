import { getTranslations } from "next-intl/server";
import JsonLd from "./JsonLd";
import {
  ORG_ADDRESS,
  ORG_GEO,
  ORG_CONTACT,
  ORG_LEGAL_NAME,
  ORG_SAMEAS,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "@/lib/seo";

/**
 * LocalBusiness schema — yerel SEO için. İletişim sayfasında render edilir.
 * Google Maps'te bulunabilirlik ve local pack görünürlüğü için kritik.
 * Açıklama aktif locale'e göre gelir (Yandex/Google çok dilli entity).
 */
export default async function LocalBusinessSchema() {
  const t = await getTranslations("homeMeta");
  return (
    <JsonLd
      id="localbusiness"
      data={{
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "@id": `${SITE_URL}#localbusiness`,
        name: SITE_NAME,
        legalName: ORG_LEGAL_NAME,
        url: SITE_URL,
        logo: absoluteUrl("/images/brand/logo.png"),
        image: absoluteUrl("/og.jpg"),
        description: t("description"),
        address: {
          "@type": "PostalAddress",
          streetAddress: ORG_ADDRESS.street,
          // schema.org: addressLocality = ilçe/şehir, addressRegion = il
          addressLocality: ORG_ADDRESS.district,
          addressRegion: ORG_ADDRESS.city,
          addressCountry: ORG_ADDRESS.countryCode,
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: ORG_GEO.latitude,
          longitude: ORG_GEO.longitude,
        },
        telephone: ORG_CONTACT.phone,
        email: ORG_CONTACT.email,
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            opens: "09:00",
            closes: "18:00",
          },
        ],
        priceRange: "₺₺",
        areaServed: {
          "@type": "Country",
          name: "Türkiye",
        },
        ...(ORG_SAMEAS.length > 0 && { sameAs: ORG_SAMEAS }),
      }}
    />
  );
}
