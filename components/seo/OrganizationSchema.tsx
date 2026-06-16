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
 * Organization schema — şirket varlık bilgisi.
 * Root layout'a koyulmalı; her sayfada otomatik render olur ve Google'ın
 * "Knowledge Graph" entity'sini güçlendirir.
 */
export default function OrganizationSchema() {
  return (
    <JsonLd
      id="organization"
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${SITE_URL}#organization`,
        name: SITE_NAME,
        legalName: ORG_LEGAL_NAME,
        url: SITE_URL,
        logo: absoluteUrl("/images/brand/logo.png"),
        image: absoluteUrl("/images/brand/logo.png"),
        description:
          "Dron teknolojisi ve tohum topu ile karbon nötr ağaçlandırma platformu. " +
          "Bireysel ve kurumsal çözümler, şeffaf tedarik zinciri, yıllık drone raporlama.",
        foundingDate: "2021",
        areaServed: {
          "@type": "Country",
          name: "Türkiye",
        },
        address: {
          "@type": "PostalAddress",
          addressLocality: ORG_ADDRESS.city,
          addressCountry: ORG_ADDRESS.countryCode,
        },
        contactPoint: [
          {
            "@type": "ContactPoint",
            telephone: ORG_CONTACT.phone,
            email: ORG_CONTACT.email,
            contactType: "customer service",
            areaServed: "TR",
            availableLanguage: ["Turkish", "English"],
          },
        ],
        ...(ORG_SAMEAS.length > 0 && { sameAs: ORG_SAMEAS }),
      }}
    />
  );
}
