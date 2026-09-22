import { notFound } from "next/navigation";
import LegalBlocks from "@/components/vitrin/LegalBlocks";
import LegalLayout from "@/components/vitrin/LegalLayout";
import { SAMPLE_NOTICE, sampleLegalContext } from "@/lib/legal/sample";
import { getPublicSalesSettings } from "@/lib/orders/public-pricing";
import { contractDocument } from "@/lib/legal/templates/contract";
import { preInfoDocument } from "@/lib/legal/templates/pre-info";
import { LEGAL_DOCUMENTS_VERSION, LEGAL_EFFECTIVE_LABEL } from "@/lib/legal/version";
import { legalPagesVisible, samplePdfHref } from "@/lib/legal/visibility";

const BUILDERS = { pre_info: preInfoDocument, contract: contractDocument } as const;
const PDF_SLUG = { pre_info: "on-bilgilendirme", contract: "mesafeli-hizmet-sozlesmesi" } as const;

/**
 * "Ön Bilgilendirme Formu" ve "Mesafeli Satış Sözleşmesi" sayfalarının gövdesi:
 * siparişte kullanılan şablonun yer tutuculu örneği + PDF bağlantıları.
 */
export default async function SampleLegalDocument({
  kind,
  title,
  path,
}: {
  kind: keyof typeof BUILDERS;
  title: string;
  path: string;
}) {
  if (!legalPagesVisible()) notFound();
  const document = BUILDERS[kind](sampleLegalContext(new Date(), await getPublicSalesSettings()));

  return (
    <LegalLayout title={title} path={path} effectiveDate={LEGAL_EFFECTIVE_LABEL}>
      <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] px-5 py-4 text-sm leading-relaxed text-[#7c2d12]">
        {SAMPLE_NOTICE}
      </div>

      <LegalBlocks blocks={document.blocks} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-black/8 pt-6 text-sm">
        <a
          href={samplePdfHref(PDF_SLUG[kind])}
          target="_blank"
          rel="noopener"
          className="font-semibold text-[#1B6B3A] underline decoration-[#1B6B3A]/30 underline-offset-4 hover:decoration-[#1B6B3A]"
        >
          Örnek metni PDF olarak indir
        </a>
        <a
          href={samplePdfHref("cayma-formu")}
          target="_blank"
          rel="noopener"
          className="font-semibold text-[#1B6B3A] underline decoration-[#1B6B3A]/30 underline-offset-4 hover:decoration-[#1B6B3A]"
        >
          Cayma Formu (PDF)
        </a>
        <span className="text-xs text-[#6b8f6b]">Belge sürümü: {LEGAL_DOCUMENTS_VERSION}</span>
      </div>
    </LegalLayout>
  );
}
