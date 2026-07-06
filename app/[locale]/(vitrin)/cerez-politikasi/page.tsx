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
      title: "Çerez Politikası",
      description:
        "skytechgreen.com çerez politikası: kullandığımız çerez türleri, kullanım amaçları ve çerez tercihlerinizi nasıl yönetebileceğiniz.",
      path: "/cerez-politikasi",
    },
    locale
  );
}

export default async function CerezPolitikasiPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LegalLayout title="Çerez Politikası" path="/cerez-politikasi" effectiveDate="6 Temmuz 2026">
      <LegalSection no="1" title="Çerez Nedir?">
        <LegalP>
          Çerezler (cookies); bir web sitesini ziyaret ettiğinizde tarayıcınız
          aracılığıyla cihazınıza kaydedilen küçük metin dosyalarıdır. Skytech Havacılık
          A.Ş. olarak skytechgreen.com’da çerezleri, Platformun düzgün çalışması ve
          deneyiminizin iyileştirilmesi amacıyla kullanırız.
        </LegalP>
      </LegalSection>

      <LegalSection no="2" title="Kullandığımız Çerez Türleri">
        <LegalList
          items={[
            <>
              <strong>Zorunlu çerezler:</strong> oturum yönetimi, dil tercihi ve güvenlik
              (ör. oturum doğrulama) için gereklidir; Platformun çalışması bu çerezler
              olmadan mümkün değildir.
            </>,
            <>
              <strong>Performans / analitik çerezleri:</strong> sayfa performansını ve
              kullanım istatistiklerini anonim biçimde ölçmek için kullanılır
              (ör. Vercel Analytics / Speed Insights).
            </>,
            <>
              <strong>İşlevsel çerezler:</strong> tercihinizi hatırlayarak (ör. seçilen
              dil) deneyimi kişiselleştirir.
            </>,
          ]}
        />
        <LegalP>
          Platformda üçüncü taraf reklam veya pazarlama çerezi kullanılmamaktadır.
          Haritalar gibi gömülü üçüncü taraf içerikler (ör. OpenStreetMap) kendi çerez
          politikalarına tabi olabilir.
        </LegalP>
      </LegalSection>

      <LegalSection no="3" title="Çerezleri Nasıl Yönetirsiniz?">
        <LegalP>
          Tarayıcı ayarlarınızdan çerezleri silebilir, engelleyebilir veya çerez
          kaydedilmeden önce uyarı almayı seçebilirsiniz. Zorunlu çerezlerin
          engellenmesi hâlinde Platformun bazı bölümleri beklendiği gibi çalışmayabilir.
          Popüler tarayıcıların çerez ayarlarına, tarayıcınızın &quot;Ayarlar → Gizlilik&quot;
          menüsünden ulaşabilirsiniz.
        </LegalP>
      </LegalSection>

      <LegalSection no="4" title="Kişisel Verilerle İlişkisi">
        <LegalP>
          Çerezler aracılığıyla işlenen veriler hakkında ayrıntılı bilgi için{" "}
          <a href="/gizlilik-politikasi" className="text-[#1B6B3A] font-semibold underline underline-offset-2">
            Gizlilik Politikası
          </a>{" "}
          ve{" "}
          <a href="/kvkk" className="text-[#1B6B3A] font-semibold underline underline-offset-2">
            KVKK Aydınlatma Metni
          </a>
          ’ni inceleyebilirsiniz.
        </LegalP>
      </LegalSection>

      <LegalSection no="5" title="İletişim">
        <LegalP>
          Sorularınız için: Skytech Havacılık A.Ş. — Saray Mah. 60 Cad. No:32,
          Kahramankazan / Ankara · info@skytechgreen.com
        </LegalP>
      </LegalSection>
    </LegalLayout>
  );
}
