/**
 * Generic JSON-LD render helper. Tüm Schema.org componentlerimiz bu
 * primitive'i kullanır — script tag'i ile tip-güvenli JSON serialize.
 *
 * Notlar:
 * - `dangerouslySetInnerHTML` JSON-LD için Google'ın önerdiği yöntem.
 * - JSON.stringify özel karakter (< > &) escape eder, ek temizlik gerekmez.
 */

interface JsonLdProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  /** Birden fazla schema aynı sayfada varsa id ile ayır (debug için). */
  id?: string;
}

export default function JsonLd({ data, id }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      {...(id && { id: `jsonld-${id}` })}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
