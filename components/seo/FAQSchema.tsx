import JsonLd from "./JsonLd";

interface FAQItem {
  question: string;
  answer: string;
}

interface Props {
  items: FAQItem[];
}

/**
 * FAQPage schema — Google FAQ rich result + AI bot'ların soruları kolayca
 * eşleştirebilmesi için. FAQ bloğu olan sayfalarda bu component'i render et.
 *
 * NOT: Schema'daki sorular ve cevaplar sayfada gerçekten görünür olmalı —
 * aksi halde Google "spam structured data" sayar (rehber, bölüm 7).
 */
export default function FAQSchema({ items }: Props) {
  return (
    <JsonLd
      id="faq"
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }}
    />
  );
}
