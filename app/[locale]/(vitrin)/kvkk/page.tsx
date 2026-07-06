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
    <LegalLayout title="KVKK Aydınlatma Metni" path="/kvkk" effectiveDate="6 Temmuz 2026">
      <LegalSection no="1" title="Veri Sorumlusu">
        <LegalP>
          6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca kişisel
          verileriniz; veri sorumlusu sıfatıyla <strong>Skytech Havacılık A.Ş.</strong>{" "}
          (Saray Mah. 60 Cad. No:32, Kahramankazan / Ankara) tarafından aşağıda açıklanan
          kapsamda işlenmektedir.
        </LegalP>
      </LegalSection>

      <LegalSection no="2" title="İşlenen Kişisel Veriler">
        <LegalList
          items={[
            <><strong>Kimlik:</strong> ad, soyad</>,
            <><strong>İletişim:</strong> e-posta, telefon, adres (fatura/teslimat süreçlerinde)</>,
            <><strong>Müşteri işlem:</strong> talep, sipariş, sertifika ve rezervasyon kayıtları</>,
            <><strong>İşlem güvenliği:</strong> IP adresi, log kayıtları, çerez verileri</>,
            <><strong>Kurumsal temsilci bilgileri:</strong> çalışılan şirket, unvan</>,
          ]}
        />
      </LegalSection>

      <LegalSection no="3" title="İşleme Amaçları ve Hukuki Sebepler">
        <LegalP>Kişisel verileriniz KVKK m.5’te yer alan hukuki sebeplere dayalı olarak;</LegalP>
        <LegalList
          items={[
            <>Talep ve başvuruların yanıtlanması — <em>ilgili kişinin talebine bağlı işleme (m.5/2-c)</em></>,
            <>Sözleşmenin kurulması ve ifası (sipariş, sertifika, raporlama) — <em>m.5/2-c</em></>,
            <>Hukuki yükümlülüklerin yerine getirilmesi (fatura, kayıt saklama) — <em>m.5/2-ç</em></>,
            <>Platform güvenliğinin sağlanması — <em>meşru menfaat (m.5/2-f)</em></>,
            <>Açık rızanızın bulunduğu hâllerde ticari elektronik ileti gönderimi — <em>m.5/1</em></>,
          ]}
        />
      </LegalSection>

      <LegalSection no="4" title="Verilerin Aktarılması">
        <LegalP>
          Kişisel verileriniz; hizmetin sunulması için zorunlu olduğu ölçüde barındırma,
          e-posta ve ödeme hizmeti sağlayıcılarına, hukuki yükümlülük kapsamında yetkili
          kamu kurum ve kuruluşlarına KVKK m.8 ve m.9’a uygun olarak aktarılabilir.
          Yurt dışına aktarım söz konusu olduğunda Kanunun öngördüğü güvencelere uyulur.
        </LegalP>
      </LegalSection>

      <LegalSection no="5" title="Toplama Yöntemi">
        <LegalP>
          Verileriniz; Platform üzerindeki formlar, e-posta ve telefon iletişimi ile
          çerezler aracılığıyla otomatik ya da kısmen otomatik yollarla toplanır.
        </LegalP>
      </LegalSection>

      <LegalSection no="6" title="Saklama Süresi">
        <LegalP>
          Veriler, işleme amaçlarının gerektirdiği süre ve mevzuattaki zamanaşımı/saklama
          süreleri boyunca muhafaza edilir; sürelerin sonunda silinir, yok edilir veya
          anonim hâle getirilir.
        </LegalP>
      </LegalSection>

      <LegalSection no="7" title="KVKK m.11 Kapsamındaki Haklarınız">
        <LegalList
          items={[
            "Kişisel verilerinizin işlenip işlenmediğini öğrenme ve buna ilişkin bilgi talep etme",
            "İşleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme",
            "Yurt içinde / yurt dışında aktarıldığı üçüncü kişileri bilme",
            "Eksik veya yanlış işlenmişse düzeltilmesini isteme",
            "KVKK m.7 çerçevesinde silinmesini veya yok edilmesini isteme",
            "Düzeltme/silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme",
            "Münhasıran otomatik sistemlerle analiz sonucu aleyhe bir sonuca itiraz etme",
            "Kanuna aykırı işleme nedeniyle zarara uğranması hâlinde zararın giderilmesini talep etme",
          ]}
        />
        <LegalP>
          Başvurularınızı; kimliğinizi tevsik eden belgelerle birlikte yazılı olarak
          şirket adresimize veya <strong>info@skytechgreen.com</strong> adresine
          iletebilirsiniz. Başvurular, Veri Sorumlusuna Başvuru Usul ve Esasları
          Hakkında Tebliğ’e uygun olarak en geç 30 gün içinde ücretsiz sonuçlandırılır.
        </LegalP>
      </LegalSection>
    </LegalLayout>
  );
}
