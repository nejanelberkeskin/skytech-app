import { getLocale } from "next-intl/server";
import JsonLd from "./JsonLd";
import { ORG_AREA_SERVED, SITE_NAME, SITE_URL, absoluteUrl, localeUrl } from "@/lib/seo";

interface Props {
  /** Hizmet adı — "Tohum Topu Tedariki", "Dron ile Ağaçlandırma" gibi. */
  name: string;
  /** Hizmet açıklaması — 2-3 cümle, kullanıcı dilinde. */
  description: string;
  /** Hizmet tipi — "Drone seed release", "Reforestation" gibi. */
  serviceType: string;
  /** Sayfa path'i — canonical için. */
  path: string;
  /** Görsel — bir tane (1:1 veya 16:9, absolute path). */
  image?: string;
}

/**
 * Service schema — bir hizmet sayfasındaki anahtar bilgilerin
 * arama motorları için yapılandırılmış hâli. Hizmet sayfaları için.
 */
export default async function ServiceSchema({
  name,
  description,
  serviceType,
  path,
  image,
}: Props) {
  const url = localeUrl(path, await getLocale());
  return (
    <JsonLd
      id={`service-${path.replace(/\//g, "-")}`}
      data={{
        "@context": "https://schema.org",
        "@type": "Service",
        name,
        description,
        serviceType,
        url,
        provider: {
          "@id": `${SITE_URL}#organization`,
          "@type": "Organization",
          name: SITE_NAME,
        },
        areaServed: {
          "@type": "Country",
          name: ORG_AREA_SERVED,
        },
        ...(image && { image: absoluteUrl(image) }),
      }}
    />
  );
}
