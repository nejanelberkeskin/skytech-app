import type { LegalBlock } from "@/lib/legal/types";

/**
 * Hukuki belge bloklarını (lib/legal) vitrin tipografisiyle basar. Sözleşme ve
 * ön bilgilendirme sayfaları, siparişte kullanılan AYNI şablonun çıktısını bu
 * bileşenle gösterir.
 */
export default function LegalBlocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <h2 key={i} className="text-xl lg:text-2xl font-bold text-[#0e2519] !mt-10 first:!mt-0">
                {block.text}
              </h2>
            );
          case "subheading":
            return (
              <h3 key={i} className="text-base lg:text-lg font-semibold text-[#0e2519] !mt-7">
                {block.text}
              </h3>
            );
          case "paragraph":
            return (
              <p key={i} className="text-base text-[#3d5a3d] leading-relaxed">
                {block.text}
              </p>
            );
          case "note":
            return (
              <p key={i} className="rounded-2xl border border-[#1B6B3A]/15 bg-[#f4f8f2] px-5 py-4 text-base text-[#3d5a3d] leading-relaxed">
                {block.text}
              </p>
            );
          case "list":
            return (
              <ul key={i} className="space-y-2.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-base text-[#3d5a3d] leading-relaxed">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#22894a] mt-2.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div key={i} className="overflow-hidden rounded-2xl border border-black/8">
                <table className="w-full text-base">
                  <tbody>
                    {block.rows.map(([label, value], j) => (
                      <tr key={j} className="border-b border-black/5 last:border-0 align-top">
                        <th scope="row" className="w-[36%] bg-[#f4f8f2] px-4 py-3 text-left font-semibold text-[#1a2e1a]">
                          {label}
                        </th>
                        <td className="px-4 py-3 text-[#3d5a3d] break-words">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "fields":
            return (
              <div key={i} className="space-y-5 pt-2">
                {block.labels.map((label, j) => (
                  <p key={j} className="flex items-end gap-3 text-base text-[#3d5a3d]">
                    <span className="whitespace-nowrap">{label}:</span>
                    <span className="flex-1 border-b border-[#6b8f6b]/60 h-5" aria-hidden="true" />
                  </p>
                ))}
              </div>
            );
        }
      })}
    </div>
  );
}
