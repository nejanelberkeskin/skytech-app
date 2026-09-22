import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import LegalLayout, { LegalList, LegalP, LegalSection } from "@/components/vitrin/LegalLayout";
import { buildPageMetadata } from "@/lib/seo";
import { TEXT } from "@/lib/legal/templates/shared";
import { LEGAL_EFFECTIVE_LABEL, isDraftLegalVersion } from "@/lib/legal/version";
import { legalPagesVisible } from "@/lib/legal/visibility";

/* Hizmetin ifası (teslimat) koşulları — hukuki cümleler sözleşmeyle AYNI
   kaynaktan (lib/legal/templates/shared.ts → TEXT) gelir. */

const PATH = "/ifa-kosullari";
const TITLE = "İfa ve Teslimat Koşulları";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata(
    {
      title: TITLE,
      description:
        "Skytech Green tohum topu bıraktırma hizmetinin nasıl ve ne zaman ifa edildiği: bırakma sezonu, kesin son tarih, bildirimler, Katılım Sertifikası ve çalışma görüntüleri.",
      path: PATH,
      noindex: isDraftLegalVersion(),
    },
    locale
  );
}

export default async function IfaKosullariPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!legalPagesVisible()) notFound();

  return (
    <LegalLayout title={TITLE} path={PATH} effectiveDate={LEGAL_EFFECTIVE_LABEL}>
      <LegalSection no="1" title="Hizmetin konusu">
        <LegalP>
          Skytech Green&apos;den satın alınan hizmet; seçtiğiniz Proje Uygulama Sahasına, sipariş ettiğiniz adette tohum
          topunun insansız hava aracı (dron) ile bırakılması, bırakma tamamlandığında adınıza bir Katılım Sertifikası
          düzenlenmesi ve izleme döneminde çalışmaya ilişkin görüntülerin sizinle paylaşılmasıdır.
        </LegalP>
        <LegalP>
          Bu hizmette kargoyla gönderilen bir ürün yoktur; nakliye, teslimat veya benzeri adlarla ek bir bedel alınmaz.
          &quot;Teslimat&quot;, hizmetin sahada ifa edilmesi ve size bildirilmesidir.
        </LegalP>
      </LegalSection>

      <LegalSection no="2" title="Takvim">
        <LegalP>{TEXT.calendar}</LegalP>
        <LegalList
          items={[
            <>
              <strong>Kesin son tarih:</strong> Her siparişte tohum topu bırakmanın son tarihi, siparişi onaylamadan önce
              ekranda gösterilir; Ön Bilgilendirme Formu&apos;na ve sözleşmeye tarih olarak yazılır. Bu tarih, siparişin
              yazıldığı bırakma sezonunun son günüdür (31 Mart). Sertifika ve izleme içeriği için ayrı son tarihler kararlaştırılır; bırakma tarihi bu edimlerin son tarihi sayılmaz.
            </>,
            <>
              <strong>Sezona yetişmeyen siparişler:</strong> Sipariş tarihi ile sezon sonu arasında cayma süresi ve hazırlık
              için yeterli zaman kalmıyorsa sipariş izleyen bırakma sezonuna yazılır; bu durum onaydan önce açıkça
              belirtilir.
            </>,
            <>
              <strong>Bırakma günü:</strong> Hava koşulları, uçuş izinleri ve saha koşulları gözetilerek Skytech Green
              tarafından, kesin son tarihi aşmamak üzere belirlenir.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection no="3" title="Bildirimler, sertifika ve görüntüler">
        <LegalP>{TEXT.completionNotice}</LegalP>
        <LegalP>
          Görüntüler, aynı sahada ve aynı dönemde yapılan bırakma çalışmasının tamamına ilişkindir; tek bir siparişe özgü
          ayrı bir çekim yapılmaz.
        </LegalP>
      </LegalSection>

      <LegalSection no="4" title="Tür seçimi ve hizmetin sınırları">
        <LegalP>{TEXT.speciesBySeller}</LegalP>
        <LegalP>{TEXT.noResultGuarantee}</LegalP>
        <LegalP>{TEXT.notADonation}</LegalP>
      </LegalSection>

      <LegalSection no="5" title="Hizmetin süresinde ifa edilememesi">
        <LegalP>{TEXT.lateOrImpossible}</LegalP>
      </LegalSection>

      <LegalSection no="6" title="Fatura">
        <LegalP>{TEXT.invoice}</LegalP>
      </LegalSection>
    </LegalLayout>
  );
}
