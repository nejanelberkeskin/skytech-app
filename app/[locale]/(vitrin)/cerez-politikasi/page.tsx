import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import CookiePreferencesLink from "@/components/vitrin/CookiePreferencesLink";
import LegalLayout, { LegalList, LegalP, LegalSection } from "@/components/vitrin/LegalLayout";
import { buildPageMetadata } from "@/lib/seo";

/* Çerez Politikası — sitenin GERÇEKTE kullandığı çerez ve benzeri teknolojilerin dökümü.
   Bu sayfa kodla uyumlu tutulmalıdır; aşağıdakilerden biri değişirse metin de güncellenir:
     • Google Analytics yalnız izinle yüklenir, reklam sinyalleri kapalıdır
       (components/analytics/GoogleAnalytics.tsx, lib/analytics.ts)
     • Oturum çerezleri: @supabase/ssr (lib/supabase/*) — yalnız üye girişi yapıldığında
     • Tarayıcı deposu: skytech_cookie_consent (lib/analytics.ts), skytech_pending_claim (lib/requests/client.ts)
     • Sipariş erişim çerezi sgo_<no>: lib/orders/access.ts (orderCookieOptions — HttpOnly, 30 gün)
     • Gömülü üçüncü taraf içerik yalnız tıklanınca yüklenir (components/vitrin/shared/ClickToLoadFrame.tsx,
       saha videoları: components/vitrin/shared/YouTubeLite.tsx — youtube-nocookie.com)
     • Ödeme iyzico'nun barındırdığı sayfada alınır (lib/payments/iyzico.ts) — sitemize gömülü değildir
   Dil tercihi çerezle değil adresle tutulur (i18n/routing.ts → localeDetection: false). */

const LINK = "text-[#1B6B3A] font-semibold underline underline-offset-2";

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
        "skytechgreen.com çerez politikası: hangi çerezlerin ve benzeri teknolojilerin ne amaçla kullanıldığı, Google Analytics izni ve tercihlerinizi nasıl yöneteceğiniz.",
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
    <LegalLayout title="Çerez Politikası" path="/cerez-politikasi" effectiveDate="22 Eylül 2026">
      <LegalSection no="1" title="Çerez nedir, bu sayfa neyi anlatır?">
        <LegalP>
          Çerezler, bir internet sitesini ziyaret ettiğinizde tarayıcınıza kaydedilen küçük metin dosyalarıdır.
          Tarayıcının yerel deposu gibi benzer teknolojiler de aynı işi görebilir. Bu sayfada skytechgreen.com’un
          hangilerini, ne amaçla ve ne kadar süreyle kullandığını; hangilerinin izninize bağlı olduğunu ve
          tercihinizi nasıl değiştirebileceğinizi bulursunuz.
        </LegalP>
        <LegalP>
          Kısaca: siteyi yalnızca gezdiğinizde ve izin vermediğinizde cihazınıza <strong>hiçbir çerez yazılmaz</strong> ve
          Google’a hiçbir veri gönderilmez.
        </LegalP>
      </LegalSection>

      <LegalSection no="2" title="Zorunlu çerezler ve depolama (izin gerekmez)">
        <LegalP>
          Bunlar, sizin istediğiniz bir işlevin çalışması için gereklidir; reklam ya da izleme amacıyla kullanılmaz.
        </LegalP>
        <LegalList
          items={[
            <>
              <strong>Oturum çerezleri</strong> (<code>sb-…-auth-token</code>, giriş sırasında geçici olarak{" "}
              <code>sb-…-auth-token-code-verifier</code>): yalnızca <strong>üye girişi yaptığınızda</strong> yazılır;
              oturumunuzu açık tutar ve hesabınıza sizden başkasının erişmesini önler. Oturumu kapattığınızda
              silinir; kapatmazsanız en çok 400 gün saklanır. Sağlayıcı: üyelik altyapımız Supabase.
            </>,
            <>
              <strong>Sipariş erişim çerezi</strong> (<code>sgo_</code> ile başlayan, sipariş numaranızı içeren ad):
              sipariş teyidi e-postanızdaki bağlantıyla sipariş sayfanızı açtığınızda yazılır; sayfayı yenilediğinizde ya
              da dil değiştirdiğinizde siparişinizi yeniden görebilmenizi sağlar. Yalnızca sunucumuz okuyabilir, başka
              sitelere gönderilmez; 30 gün sonra kendiliğinden silinir.
            </>,
            <>
              <strong>Çerez tercihiniz</strong> (tarayıcı deposu: <code>skytech_cookie_consent</code>): analitiğe izin
              verip vermediğinizi hatırlar; böylece her sayfada yeniden sorulmaz. Siz silene kadar durur.
            </>,
            <>
              <strong>Bekleyen talep kaydı</strong> (tarayıcı deposu: <code>skytech_pending_claim</code>): misafir
              olarak bir talep bıraktıktan sonra hesap açarsanız, talebin hesabınıza bağlanabilmesi için geçici
              olarak tutulur; bağlandığında silinir.
            </>,
          ]}
        />
        <LegalP>
          Dil tercihiniz çerezle değil, sayfa adresiyle (<code>/en</code>, <code>/ru</code>) belirlenir.
        </LegalP>
      </LegalSection>

      <LegalSection no="3" title="Analitik çerezler (yalnızca izninizle)">
        <LegalP>
          Ziyaretleri ölçmek ve siteyi geliştirmek için <strong>Google Analytics 4</strong> kullanıyoruz. Google
          Analytics <strong>yalnızca siz “Analitiğe İzin Ver” dediğinizde yüklenir</strong>. İzin vermediğinizde
          Google’ın ölçüm betiği indirilmez, çerez yazılmaz ve Google’a hiçbir veri gönderilmez.
        </LegalP>
        <LegalList
          items={[
            <>
              <code>_ga</code> — ziyaretçileri birbirinden ayırt etmek için rastgele bir kimlik tutar. Süre: 2 yıl.
            </>,
            <>
              <code>_ga_E938FSNCWT</code> — oturum durumunu (ziyaretin başlangıcı, sayfa sayısı) tutar. Süre: 2 yıl.
            </>,
          ]}
        />
        <LegalP>
          Bu çerezler aracılığıyla ziyaret ettiğiniz sayfalar, yaklaşık konumunuz (ülke/şehir düzeyinde), cihaz ve
          tarayıcı bilgileriniz ile siteye nereden geldiğiniz Google tarafından işlenir. Sağlayıcı Google LLC’dir
          (Amerika Birleşik Devletleri); izin vermeniz hâlinde verileriniz bu amaçla yurt dışına aktarılır.
          İzninizi geri aldığınızda bu çerezler cihazınızdan silinir ve Google Analytics sonraki sayfalarda
          yüklenmez.
        </LegalP>
        <LegalP>
          <strong>Reklam ve pazarlama çerezi kullanmıyoruz.</strong> Google Analytics’in reklam amaçlı özellikleri
          (reklam kişiselleştirme, Google sinyalleri, yeniden pazarlama) kapalıdır.
        </LegalP>
      </LegalSection>

      <LegalSection no="4" title="Çerez kullanmayan ölçüm">
        <LegalP>
          Sitenin hızını ve toplam ziyaret sayısını izlemek için barındırma sağlayıcımız Vercel’in{" "}
          <strong>Web Analytics</strong> ve <strong>Speed Insights</strong> hizmetlerini kullanıyoruz. Bu hizmetler
          cihazınıza çerez yazmaz, sizi siteler arasında izlemez ve ziyaretçi bazında profil oluşturmaz; ölçümler
          toplu hâlde tutulur. Çerez kullanılmadığı için izin bandında yer almaz.
        </LegalP>
      </LegalSection>

      <LegalSection no="5" title="Üçüncü taraf içerikler">
        <LegalP>
          Başka bir sağlayıcıdan gelen içerikler <strong>yalnızca siz istediğinizde</strong> yüklenir:
        </LegalP>
        <LegalList
          items={[
            <>
              <strong>Harita:</strong> İletişim sayfasındaki harita, “Haritayı göster” düğmesine bastığınızda
              OpenStreetMap’ten yüklenir.
            </>,
            <>
              <strong>Çalışma videoları:</strong> Proje Uygulama Sahası sayfalarındaki videolar, “Videoyu oynat”
              düğmesine bastığınızda YouTube’un gizlilik geliştirilmiş kipinden (youtube-nocookie.com) yüklenir.
              Oynatmaya başladığınızda YouTube kendi çerezlerini ve tarayıcı deposunu kullanabilir.
            </>,
          ]}
        />
        <LegalP>
          Düğmeye basmadığınız sürece bu sağlayıcılara hiçbir istek gitmez. Yüklendikten sonra içerik, kendi
          sağlayıcısının gizlilik ve çerez koşullarına tabidir.
        </LegalP>
        <LegalP>
          Sipariş verdiğinizde ödeme, ödeme kuruluşu <strong>iyzico</strong>’nun güvenli ödeme sayfasında alınır. Bu
          sayfa sitemize gömülü değildir; ödeme sırasında iyzico’nun kendi çerez ve gizlilik koşulları geçerlidir.
        </LegalP>
        <LegalP>
          Sitedeki sosyal medya simgeleri yalnızca bağlantıdır; tıklamadığınız sürece o platformlara veri
          göndermez.
        </LegalP>
      </LegalSection>

      <LegalSection no="6" title="Tercihinizi nasıl yönetirsiniz?">
        <LegalP>
          Siteye ilk girişinizde çıkan bantta “Yalnız Zorunlu” ya da “Analitiğe İzin Ver” seçeneklerinden birini
          seçersiniz; iki seçenek de aynı görünürlüktedir ve seçiminiz sitenin kullanımını etkilemez. Tercihinizi
          dilediğiniz an değiştirebilirsiniz:{" "}
          <CookiePreferencesLink label="Çerez tercihlerini aç" className={LINK} /> (aynı bağlantı her sayfanın
          altında da bulunur).
        </LegalP>
        <LegalP>
          Ayrıca tarayıcınızın ayarlarından çerezleri silebilir ya da engelleyebilirsiniz. Zorunlu çerezleri
          engellerseniz üye girişi çalışmaz; sitenin geri kalanı etkilenmez.
        </LegalP>
      </LegalSection>

      <LegalSection no="7" title="Kişisel verilerinizle ilişkisi">
        <LegalP>
          Çerezler aracılığıyla işlenen veriler kişisel veri niteliği taşıyabilir. Zorunlu çerezler ve çerez
          kullanmayan ölçüm, sitenin güvenli ve düzgün çalışmasına ilişkin meşru menfaatimize; analitik çerezler
          ise yalnızca <strong>açık rızanıza</strong> dayanır. Haklarınız ve başvuru yolları için{" "}
          <Link href="/kvkk" className={LINK}>
            KVKK Aydınlatma Metni
          </Link>
          ’ni, genel ilkelerimiz için{" "}
          <Link href="/gizlilik-politikasi" className={LINK}>
            Gizlilik Politikası
          </Link>
          ’nı inceleyebilirsiniz.
        </LegalP>
      </LegalSection>

      <LegalSection no="8" title="Değişiklikler ve iletişim">
        <LegalP>
          Kullandığımız çerezler değiştiğinde bu sayfa güncellenir; yeni bir izin gerektiren bir değişiklikte bant
          size yeniden gösterilir. Sorularınız için: <strong>info@skytechgreen.com</strong>
        </LegalP>
      </LegalSection>
    </LegalLayout>
  );
}
