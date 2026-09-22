import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import LegalBlocks from "@/components/vitrin/LegalBlocks";
import LegalLayout from "@/components/vitrin/LegalLayout";
import { buildPageMetadata } from "@/lib/seo";
import { KVKK_NOTICE_TITLE, kvkkNoticeBlocks } from "@/lib/legal/templates/kvkk-notice";
import { LEGAL_DOCUMENTS_VERSION, LEGAL_EFFECTIVE_LABEL } from "@/lib/legal/version";
import { samplePdfHref } from "@/lib/legal/visibility";

/* Sayfa ve sipariş nüshası aynı metin kaynağını kullanır. */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata(
    {
      title: "KVKK Aydınlatma Metni",
      description:
        "6698 sayılı KVKK kapsamında Skytech Havacılık A.Ş. kişisel verilerin işlenmesine ilişkin aydınlatma metni ve ilgili kişi hakları.",
      path: "/kvkk",
    },
    locale
  );
}

export default async function KvkkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
      <LegalLayout title={KVKK_NOTICE_TITLE} path="/kvkk" effectiveDate={LEGAL_EFFECTIVE_LABEL}>
        <LegalBlocks blocks={kvkkNoticeBlocks()} />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-black/8 pt-6 text-sm">
          <a
            href={samplePdfHref("kvkk-aydinlatma-metni")}
            target="_blank"
            rel="noopener"
            className="font-semibold text-[#1B6B3A] underline decoration-[#1B6B3A]/30 underline-offset-4 hover:decoration-[#1B6B3A]"
          >
            Metni PDF olarak indir
          </a>
          <span className="text-xs text-[#6b8f6b]">Belge sürümü: {LEGAL_DOCUMENTS_VERSION}</span>
        </div>
      </LegalLayout>
    );
}
