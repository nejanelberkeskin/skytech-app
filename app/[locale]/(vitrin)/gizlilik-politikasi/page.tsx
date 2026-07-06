import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import LegalLayout, { LegalList, LegalP, LegalSection } from "@/components/vitrin/LegalLayout";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata(
    {
      title: "Gizlilik Politikası",
      description:
        "Skytech Havacılık A.Ş. gizlilik politikası: hangi kişisel verileri, hangi amaçlarla işlediğimiz, kimlerle paylaştığımız ve haklarınız.",
      path: "/gizlilik-politikasi",
    },
    locale
  );
}

export default async function GizlilikPolitikasiPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LegalLayout title="Gizlilik Politikası" path="/gizlilik-politikasi" effectiveDate="6 Temmuz 2026">
      <LegalSection no="1" title="Giriş">
        <LegalP>
          Bu Gizlilik Politikası; Skytech Havacılık A.Ş. (&quot;Skytech&quot;, &quot;Şirket&quot;, &quot;biz&quot;)
          tarafından işletilen skytechgreen.com alan adlı web sitesi ve bağlı hizmetler
          (&quot;Platform&quot;) üzerinden toplanan kişisel verilerin nasıl işlendiğini,
          saklandığını ve korunduğunu açıklar. Platformu kullanarak bu politikada
          açıklanan uygulamaları kabul etmiş sayılırsınız.
        </LegalP>
        <LegalP>
          Kişisel verilerin işlenmesine ilişkin ayrıntılı yasal aydınlatma için ayrıca{" "}
          <a href="/kvkk" className="text-[#1B6B3A] font-semibold underline underline-offset-2">
            KVKK Aydınlatma Metni
          </a>
          ’ni inceleyebilirsiniz.
        </LegalP>
      </LegalSection>

      <LegalSection no="2" title="Topladığımız Veriler">
        <LegalList
          items={[
            <>
              <strong>Kimlik ve iletişim bilgileri:</strong> ad-soyad, e-posta adresi,
              telefon numarası; bilgi talep formları ve kurumsal başvurular aracılığıyla.
            </>,
            <>
              <strong>Kurumsal bilgiler:</strong> şirket adı, unvan, çalışan sayısı gibi
              teklif süreçlerinde ilettiğiniz bilgiler.
            </>,
            <>
              <strong>İşlem bilgileri:</strong> sipariş, sertifika ve rezervasyon
              kayıtları (ilgili akışlar aktif olduğunda).
            </>,
            <>
              <strong>Teknik veriler:</strong> IP adresi, tarayıcı/işletim sistemi
              bilgisi, ziyaret edilen sayfalar ve çerezler aracılığıyla toplanan
              kullanım verileri.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection no="3" title="Verileri İşleme Amaçlarımız">
        <LegalList
          items={[
            "Bilgi ve teklif taleplerinizi yanıtlamak, sizinle iletişim kurmak",
            "Sipariş, sertifika ve raporlama süreçlerini yürütmek",
            "Platformun güvenliğini sağlamak, hata ve kötüye kullanımı önlemek",
            "Hizmet kalitesini ölçmek ve Platform deneyimini iyileştirmek",
            "Yasal yükümlülüklerimizi yerine getirmek",
          ]}
        />
      </LegalSection>

      <LegalSection no="4" title="Verilerin Paylaşımı">
        <LegalP>
          Kişisel verilerinizi ticari amaçla üçüncü kişilere satmayız. Veriler yalnızca;
          hizmetin sunulması için zorunlu tedarikçilerle (ör. barındırma, e-posta
          gönderimi, ödeme altyapısı), yasal zorunluluk hâlinde yetkili kurumlarla ve
          açık rızanızın bulunduğu durumlarla sınırlı olarak paylaşılır. Tedarikçilerimiz
          ile veri işleme sözleşmeleri yapılır.
        </LegalP>
      </LegalSection>

      <LegalSection no="5" title="Saklama Süresi ve Güvenlik">
        <LegalP>
          Veriler, işleme amaçları için gerekli olan süre ve ilgili mevzuatta öngörülen
          zamanaşımı süreleri boyunca saklanır; süre sonunda silinir, yok edilir veya
          anonim hâle getirilir. Verileriniz şifreli bağlantı (HTTPS), erişim kontrolü
          ve yetkilendirme dâhil uygun teknik ve idari tedbirlerle korunur.
        </LegalP>
      </LegalSection>

      <LegalSection no="6" title="Haklarınız">
        <LegalP>
          Kişisel verilerinize ilişkin erişim, düzeltme, silme ve itiraz haklarınızı{" "}
          <a href="/kvkk" className="text-[#1B6B3A] font-semibold underline underline-offset-2">
            KVKK Aydınlatma Metni
          </a>
          ’nde açıklanan yöntemlerle kullanabilirsiniz.
        </LegalP>
      </LegalSection>

      <LegalSection no="7" title="İletişim">
        <LegalP>
          Skytech Havacılık A.Ş. — Saray Mah. 60 Cad. No:32, Kahramankazan / Ankara,
          Türkiye · info@skytechgreen.com
        </LegalP>
        <LegalP>
          Bu politika gerektiğinde güncellenebilir; güncel sürüm her zaman bu sayfada
          yayımlanır.
        </LegalP>
      </LegalSection>
    </LegalLayout>
  );
}
