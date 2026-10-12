import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import LegalLayout, { LegalList, LegalP, LegalSection } from "@/components/vitrin/LegalLayout";
import { COMPANY } from "@/lib/company";
import { buildPageMetadata } from "@/lib/seo";
import { TEXT } from "@/lib/legal/templates/shared";
import { LEGAL_EFFECTIVE_LABEL, isDraftLegalVersion } from "@/lib/legal/version";
import { legalPagesVisible } from "@/lib/legal/visibility";

/* İşlem Rehberi — 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun
   m.3 uyarınca sipariş öncesinde sunulması gereken bilgiler. */

const PATH = "/islem-rehberi";
const TITLE = "İşlem Rehberi";
const link = "font-semibold text-[#1B6B3A] underline underline-offset-4";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata(
    {
      title: TITLE,
      description:
        "Skytech Green'de sipariş nasıl verilir: sözleşmenin kurulması için izlenen adımlar, bilgilerin düzeltilmesi, sözleşme metnine erişim, gizlilik ve uyuşmazlık çözümü.",
      path: PATH,
      noindex: isDraftLegalVersion(),
    },
    locale
  );
}

export default async function IslemRehberiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!legalPagesVisible()) notFound();

  return (
    <LegalLayout title={TITLE} path={PATH} effectiveDate={LEGAL_EFFECTIVE_LABEL}>
      <p className="text-base leading-relaxed text-[#3d5a3d]">
        Satış kapalıyken ekranda yalnız bilgi veya talep oluşturma seçenekleri bulunabilir. Talep bırakılması sipariş
        oluşturmaz, bedel tahsil edilmez ve ücretli hizmet sözleşmesi kurulmaz. Aşağıdaki satın alma akışı yalnız satışın
        açık olduğu sahalarda uygulanır.
      </p>
      <LegalSection no="1" title="Sözleşmenin kurulması için izlenen adımlar">
        <LegalList
          items={[
            <>Proje Uygulama Sahaları arasından bir saha seçersiniz.</>,
            <>Bıraktırmak istediğiniz tohum topu adedini belirlersiniz; toplam bedel anında gösterilir.</>,
            <>Katılım Sertifikası&apos;nda kendi adınızın, kurumsal faturada kurum unvanının yer almasını ya da adsız sertifikayı seçersiniz.</>,
            <>Alıcı bilgilerinizi ve fatura türünü (bireysel ya da kurumsal) girersiniz.</>,
            <>
              Özet ekranında siparişinizi, toplam bedeli, hizmetin ifa edileceği son tarihi ve cayma hakkınızı görürsünüz.
              Siparişinize özel Ön Bilgilendirme Formu&apos;nu ve Mesafeli Hizmet Sözleşmesi&apos;ni okuyup ayrı ayrı onaylarsınız.
            </>,
            <>
              &quot;Siparişi Onayla ve Öde&quot; düğmesine bastığınızda ödeme yükümlülüğü altına girersiniz ve güvenli ödeme
              sayfasına yönlendirilirsiniz. Ödeme, 3D Secure doğrulamasıyla alınır.
            </>,
            <>
              Ödemeniz onaylandığında sözleşme kurulur; sipariş teyidi, Ön Bilgilendirme Formu, sözleşme ve Cayma Formu
              e-posta adresinize gönderilir.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection no="2" title="Bilgilerin düzeltilmesi">
        <LegalP>
          Onaydan önce her adımda &quot;Geri&quot; düğmesiyle önceki adımlara dönüp bilgilerinizi değiştirebilirsiniz; özet
          ekranı girdiğiniz bütün bilgileri bir arada gösterir. Onaydan sonra fark ettiğiniz bir hata için{" "}
          {COMPANY.email} adresine sipariş numaranızla yazmanız yeterlidir.
        </LegalP>
      </LegalSection>

      <LegalSection no="3" title="Sözleşme metninin saklanması ve erişim">
        <LegalP>
          Siparişinize özel sözleşme metni Skytech Green tarafından elektronik ortamda, içeriği değiştirilemeyecek biçimde
          saklanır. Metin size e-posta ile gönderilir; üyeyseniz hesabınızdan da erişebilirsiniz. Örnek metinler:{" "}
          <Link href="/on-bilgilendirme" className={link}>Ön Bilgilendirme Formu</Link>,{" "}
          <Link href="/mesafeli-satis-sozlesmesi" className={link}>Mesafeli Hizmet Sözleşmesi</Link>.
        </LegalP>
      </LegalSection>

      <LegalSection no="4" title="Ödeme güvenliği">
        <LegalP>
          Kart numaranızın tamamı, son kullanma tarihi ve güvenlik kodu ödeme kuruluşunun güvenli sayfasında girilir; Skytech Green bunları görmez ve saklamaz. Gerekli işlem sonucu, ödeme referansı ve maskeli kart bilgisi işlenebilir.
        </LegalP>
      </LegalSection>

      <LegalSection no="5" title="Gizlilik">
        <LegalP>
          Kişisel verilerinizin hangi amaçlarla işlendiği <Link href="/kvkk" className={link}>KVKK Aydınlatma Metni</Link> ve{" "}
          <Link href="/gizlilik-politikasi" className={link}>Gizlilik Politikası</Link>&apos;nda açıklanır. Ticari elektronik
          ileti izni siparişin şartı değildir; ayrıca ve isteğe bağlı olarak alınır.
        </LegalP>
      </LegalSection>

      <LegalSection no="6" title="Cayma, iade ve ifa">
        <LegalP>
          Ayrıntılar: <Link href="/cayma-ve-iade" className={link}>Cayma ve İade Koşulları</Link>,{" "}
          <Link href="/ifa-kosullari" className={link}>İfa ve Teslimat Koşulları</Link>.
        </LegalP>
      </LegalSection>

      <LegalSection no="7" title="Uyuşmazlıkların çözümü">
        <LegalP>{TEXT.disputesConsumer}</LegalP>
        {COMPANY.chamber && <LegalP>Mensubu olunan meslek odası: {COMPANY.chamber}.</LegalP>}
      </LegalSection>
    </LegalLayout>
  );
}
