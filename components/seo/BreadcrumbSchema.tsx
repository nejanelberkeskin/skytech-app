import JsonLd from "./JsonLd";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";

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
export default function BreadcrumbSchema({ items }: Props) {
  const all: Required<BreadcrumbItem>[] = [
    { name: "Ana Sayfa", path: "/" },
    ...items.map((it, i) => ({
      name: it.name,
      path: it.path ?? `/breadcrumb-${i}`,
    })),
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
          item: absoluteUrl(item.path),
        })),
      }}
    />
  );
}
