import JsonLd from "./JsonLd";
import {
  ORG_ADDRESS,
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
 *
 * NOT: Custom domain bağlanınca, geoCoordinates ve openingHours
 * gerçek değerlerle güncellenmeli. Şu an placeholder.
 */
export default function LocalBusinessSchema() {
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
        description:
          "Dron teknolojisi ve tohum topu ile karbon nötr ağaçlandırma platformu. " +
          "Ankara merkezli, Türkiye geneli operasyon.",
        address: {
          "@type": "PostalAddress",
          streetAddress: ORG_ADDRESS.street,
          addressLocality: ORG_ADDRESS.city,
          addressRegion: ORG_ADDRESS.district,
          addressCountry: ORG_ADDRESS.countryCode,
        },
        // Ankara genel koordinatı — gerçek ofis adresi belirlenince güncellenmeli
        geo: {
          "@type": "GeoCoordinates",
          latitude: 39.9334,
          longitude: 32.8597,
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
