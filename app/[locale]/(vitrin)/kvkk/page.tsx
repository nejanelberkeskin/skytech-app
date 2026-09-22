import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import LegalBlocks from "@/components/vitrin/LegalBlocks";
import LegalLayout, { LegalList, LegalP, LegalSection } from "@/components/vitrin/LegalLayout";
import { buildPageMetadata } from "@/lib/seo";
import { KVKK_NOTICE_TITLE, kvkkNoticeBlocks } from "@/lib/legal/templates/kvkk-notice";
import { LEGAL_DOCUMENTS_VERSION, LEGAL_EFFECTIVE_LABEL } from "@/lib/legal/version";
import { legalPagesVisible, samplePdfHref } from "@/lib/legal/visibility";

/* KVKK Aydınlatma Metni.
   YENİ metin (satış modeli v2: sipariş, ödeme, fatura, sertifika, ticari ileti, aktarımlar, saklama
   süreleri) lib/legal/templates/kvkk-notice.ts'ten gelir — her siparişle birlikte saklanan kopyayla
   AYNI kaynak. Hukuk incelemesi bitene kadar canlıda ESKİ metin kalır: yeni metin yalnız geliştirmede,
   Vercel önizlemesinde ve NEXT_PUBLIC_LEGAL_PAGES_ENABLED=true iken görünür (diğer hukuk sayfalarıyla
   aynı kural — lib/legal/visibility.ts). Bayrak açıldığında aşağıdaki eski metin bloğu silinebilir. */

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

  if (legalPagesVisible()) {
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

  return (
    <LegalLayout title="KVKK Aydınlatma Metni" path="/kvkk" effectiveDate="6 Temmuz 2026">
      <LegalSection no="1" title="Veri Sorumlusu">
        <LegalP>
          6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca kişisel
          verileriniz; veri sorumlusu sıfatıyla <strong>Skytech Havacılık ve Teknoloji Sanayi Ticaret A.Ş.</strong>{" "}
          (Macun Mah. Batı Bulvarı ATB İş Merkezi I Blok No: 244, Yenimahalle / Ankara) tarafından aşağıda açıklanan
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
