import { getLocale } from "next-intl/server";
import JsonLd from "./JsonLd";
import { SITE_NAME, localeUrl } from "@/lib/seo";

interface BreadcrumbItem {
  /** Görünür isim — "Projeler", "Tohum Topu" gibi. */
  name: string;
  /** Path — "/projeler", "/tohum-topu" gibi (son madde için href: yok). */
  path?: string;
}

interface Props {
  items: BreadcrumbItem[];
}

/**
 * BreadcrumbList schema — Google'da sayfa yolu rich-result olarak görünür
 * + AI bot'ların hiyerarşiyi kavramasına yardımcı.
 *
 * "Ana Sayfa" otomatik olarak ilk madde olarak eklenir.
 */
export default async function BreadcrumbSchema({ items }: Props) {
  const locale = await getLocale();
  const all: BreadcrumbItem[] = [
    { name: "Ana Sayfa", path: "/" },
    ...items,
  ];

  return (
    <JsonLd
      id="breadcrumb"
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: all.map((item, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          name: idx === 0 ? SITE_NAME : item.name,
          ...(item.path && { item: localeUrl(item.path, locale) }),
        })),
      }}
    />
  );
}
