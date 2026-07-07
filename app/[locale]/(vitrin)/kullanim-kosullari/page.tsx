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
      title: "Kullanım Koşulları",
      description:
        "skytechgreen.com kullanım koşulları: hizmet kapsamı, kullanıcı yükümlülükleri, fikri mülkiyet ve sorumluluk sınırları.",
      path: "/kullanim-kosullari",
    },
    locale
  );
}

export default async function KullanimKosullariPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LegalLayout title="Kullanım Koşulları" path="/kullanim-kosullari" effectiveDate="6 Temmuz 2026">
      <LegalSection no="1" title="Taraflar ve Kapsam">
        <LegalP>
          Bu Kullanım Koşulları; Skytech Havacılık A.Ş. (&quot;Skytech&quot;) tarafından işletilen
          skytechgreen.com web sitesi ile bu site üzerinden sunulan içerik ve hizmetlerin
          (&quot;Platform&quot;) kullanımını düzenler. Platformu ziyaret eden veya kullanan herkes
          (&quot;Kullanıcı&quot;) bu koşulları kabul etmiş sayılır.
        </LegalP>
      </LegalSection>

      <LegalSection no="2" title="Hizmetin Niteliği">
        <LegalP>
          Skytech; dron destekli tohum topu ekimi, ağaçlandırma, karbon nötrleme ve
          kurumsal sürdürülebilirlik alanlarında hizmet sunar. Platformda yer alan
          çimlenme oranı, karbon emilimi ve benzeri değerler bilimsel literatüre ve saha
          verilerine dayanan tahminî değerlerdir; doğa koşullarına bağlı olarak
          değişkenlik gösterebilir ve taahhüt niteliği taşımaz.
        </LegalP>
        <LegalP>
          Sipariş, üyelik ve ödeme akışları dönemsel olarak askıya alınabilir veya
          değiştirilebilir; güncel durum Platformda ilan edilir.
        </LegalP>
      </LegalSection>

      <LegalSection no="3" title="Kullanıcı Yükümlülükleri">
        <LegalList
          items={[
            "Platformu hukuka, dürüstlük kurallarına ve işbu koşullara uygun kullanmak",
            "Formlarda doğru, güncel ve kendisine ait bilgileri iletmek",
            "Platformun işleyişini bozacak müdahalelerde (zararlı yazılım, aşırı yük, yetkisiz erişim denemesi vb.) bulunmamak",
            "Üçüncü kişilerin kişisel verilerini izinsiz paylaşmamak",
          ]}
        />
      </LegalSection>

      <LegalSection no="4" title="Fikri Mülkiyet">
        <LegalP>
          Platformdaki tüm içerik; metinler, görseller, videolar, logo ve markalar,
          yazılım ve tasarım dâhil olmak üzere Skytech Havacılık A.Ş.’ye veya lisans
          verenlerine aittir. Yazılı izin olmaksızın kopyalanamaz, çoğaltılamaz,
          dağıtılamaz veya ticari amaçla kullanılamaz.
        </LegalP>
      </LegalSection>

      <LegalSection no="5" title="Sorumluluğun Sınırlandırılması">
        <LegalP>
          Platform &quot;olduğu gibi&quot; sunulur. Skytech; kesintisiz veya hatasız çalışmayı
          garanti etmez ve Platformun kullanımından doğan dolaylı zararlardan, mevzuatın
          izin verdiği azami ölçüde, sorumlu tutulamaz. Üçüncü taraf sitelere verilen
          bağlantıların içeriğinden ilgili site sahipleri sorumludur.
        </LegalP>
      </LegalSection>

      <LegalSection no="6" title="Değişiklikler">
        <LegalP>
          Skytech bu koşulları dilediği zaman güncelleyebilir. Güncel sürüm bu sayfada
          yayımlandığı anda yürürlüğe girer; Platformu kullanmaya devam etmeniz güncel
          koşulları kabul ettiğiniz anlamına gelir.
        </LegalP>
      </LegalSection>

      <LegalSection no="7" title="Uygulanacak Hukuk ve Yetki">
        <LegalP>
          Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda Ankara
          Mahkemeleri ve İcra Daireleri yetkilidir.
        </LegalP>
        <LegalP>
          İletişim: Skytech Havacılık A.Ş. — Saray Mah. 60 Cad. No:22, Kahramankazan /
          Ankara · info@skytechgreen.com
        </LegalP>
      </LegalSection>
    </LegalLayout>
  );
}
