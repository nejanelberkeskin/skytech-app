import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import LegalLayout, { LegalList, LegalP, LegalSection } from "@/components/vitrin/LegalLayout";
import { COMPANY, companyAddressLine } from "@/lib/company";
import { buildPageMetadata } from "@/lib/seo";
import { TEXT } from "@/lib/legal/templates/shared";
import { LEGAL_EFFECTIVE_LABEL, isDraftLegalVersion } from "@/lib/legal/version";
import { legalPagesVisible, samplePdfHref } from "@/lib/legal/visibility";

/* Cayma ve iade koşulları — hukuki cümleler sözleşmeyle AYNI kaynaktan
   (lib/legal/templates/shared.ts → TEXT) gelir; burada yalnız açıklama eklenir. */

const PATH = "/cayma-ve-iade";
const TITLE = "Cayma ve İade Koşulları";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata(
    {
      title: TITLE,
      description:
        "Skytech Green tohum topu bıraktırma siparişlerinde 14 günlük cayma hakkı, cayma bildiriminin nasıl yapılacağı ve bedelin iade koşulları.",
      path: PATH,
      noindex: isDraftLegalVersion(),
    },
    locale
  );
}

export default async function CaymaVeIadePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!legalPagesVisible()) notFound();

  return (
    <LegalLayout title={TITLE} path={PATH} effectiveDate={LEGAL_EFFECTIVE_LABEL}>
      <LegalSection no="1" title="Cayma hakkı">
        <LegalP>{TEXT.withdrawalRightGeneral}</LegalP>
        <LegalP>
          Süre, ödemenizin onaylandığı gün başlar. Siparişinize özel son gün; Ön Bilgilendirme Formu&apos;nda,
          sözleşmenizde ve sipariş teyidi e-postanızda tarih olarak yazılıdır.
        </LegalP>
      </LegalSection>

      <LegalSection no="2" title="Cayma bildirimi nasıl yapılır?">
        <LegalP>{TEXT.withdrawalHow()}</LegalP>
        <LegalList
          items={[
            <>Yazılı bildirim adresi: {COMPANY.legalName}, {companyAddressLine()}</>,
            <>E-posta: {COMPANY.email}</>,
            <>
              <a href={samplePdfHref("cayma-formu")} target="_blank" rel="noopener" className="font-semibold text-[#1B6B3A] underline underline-offset-4">
                Cayma Formu örneği (PDF)
              </a>{" "}
              — siparişinize özel form, sipariş teyidi e-postanızın ekindedir.
            </>,
          ]}
        />
        <LegalP>Bildiriminizde sipariş numaranızı belirtmeniz işlemi hızlandırır.</LegalP>
      </LegalSection>

      <LegalSection no="3" title="Bedelin iadesi">
        <LegalP>{TEXT.withdrawalRefund}</LegalP>
        <LegalP>
          İadenin hesabınıza yansıma süresi bankanıza göre değişebilir; bu süre Skytech Green&apos;in kontrolünde değildir.
        </LegalP>
      </LegalSection>

      <LegalSection no="4" title="Cayma süresi ve hizmetin ifası">
        <LegalP>{TEXT.noEarlyPerformance}</LegalP>
      </LegalSection>

      <LegalSection no="5" title="Hizmetin süresinde ifa edilememesi">
        <LegalP>{TEXT.lateOrImpossible}</LegalP>
      </LegalSection>

      <LegalSection no="6" title="Tüketici sıfatı taşımayan alıcılar">
        <LegalP>{TEXT.corporateWithdrawal}</LegalP>
      </LegalSection>

      <LegalSection no="7" title="Uyuşmazlıkların çözümü">
        <LegalP>{TEXT.disputesConsumer}</LegalP>
      </LegalSection>
    </LegalLayout>
  );
}
