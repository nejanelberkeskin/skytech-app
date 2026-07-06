import Image from "next/image";
import Link from "next/link";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import DashboardParallax from "@/components/vitrin/kurumsal/DashboardParallax";
import DeveloperApi from "@/components/vitrin/kurumsal/DeveloperApi";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import ServiceSchema from "@/components/seo/ServiceSchema";
import { buildPageMetadata } from "@/lib/seo";
import { TRANSACTIONS_ENABLED } from "@/lib/site-config";

export const metadata = buildPageMetadata({
  title: "Kurumsal Çözümler — ESG Ortaklığı",
  description:
    "Şirketinize özel kurumsal ormanlaştırma, çalışan başına otomatik PDF sertifika, GRI/CDP/SASB uyumlu ESG raporlama ve e-ticaret API entegrasyonu.",
  path: "/kurumsal-cozumler",
  keywords: [
    "kurumsal ağaçlandırma",
    "kurumsal ormanlaştırma",
    "ESG çözümleri",
    "çalışan karbon sertifikası",
    "kurumsal sürdürülebilirlik partneri",
    "B2B karbon nötrleme",
    "API tohum entegrasyonu",
  ],
});

const COMPARISON = [
  { item: "Logo Baskılı Ürün", impact: "Kısa ömürlü, çoğu çöpe gider", esg: "Yok", icon: "🎁", verdict: false, image: "/images/kurumsal/promosyon-urunu.webp" },
  { item: "Markanıza Özel Orman", impact: "25+ yıl yaşar, ekosistem yaratır", esg: "Tam ESG entegrasyon", icon: "🌳", verdict: true, image: "/images/kurumsal/hatira-ormani.webp" },
];

const FEATURES = [
  { title: "Çalışan Bazlı Sertifika", desc: "Her çalışana özel PDF sertifika otomatik üretilir, e-posta ile iletilir.", Icon: PeopleIcon },
  { title: "Kurumsal Ormanlaştırma", desc: "Kuruma özel kurumsal alan, drone çekim videoları, koordinatlı haritalama.", Icon: TreesIcon },
  { title: "ESG Yazılım API Entegrasyonu", desc: "Kurumsal panelimiz ile ESG yazılımınız arasında API entegrasyonu kurarak veri akışını otomatik hale getiriyoruz. GRI, CDP, SASB uyumlu.", Icon: ApiIcon },
  { title: "E-ticaret Entegrasyonu", desc: "\"Sepete 1 tohum ekle\" widget'ı — müşterilerinize ekoloji deneyimi sunun.", Icon: CartIcon },
  { title: "Karbon Ayak İzi → Markanıza Özel Orman", desc: "Sistemimiz şirketinizin karbon ayak izini hesaplar ve bu doğrultuda markanıza özel, drone teknolojisiyle desteklenen bir orman oluşturur.", Icon: CalcIcon },
  { title: "Özel Hesap Yöneticisi", desc: "Süreç boyunca özel temas noktanız.", Icon: BadgeIcon },
];

export default function KurumsalCozumlerPage() {
  return (
    <>
      <BreadcrumbSchema items={[{ name: "Kurumsal Çözümler", path: "/kurumsal-cozumler" }]} />
      <ServiceSchema
        name="Kurumsal Ormanlaştırma ve ESG Çözümleri"
        description="Şirketler için kurumsal orman kurulumu, çalışan başına PDF sertifika otomasyonu, GRI/CDP uyumlu karbon raporlama, REST API + e-ticaret eklenti entegrasyonu."
        serviceType="Corporate ESG and reforestation partnership"
        path="/kurumsal-cozumler"
      />
      <BreadCrumb
        title="Promosyon Ürünleri Çöpe Gider. Kurumsal Ormanınız Sonsuza Kadar Yaşar."
        subtitle="ESG hedeflerinize ölçülebilir katkı, çalışan deneyimine somut anlam — tek bir kurumsal partner."
        items={[{ label: "Kurumsal Çözümler" }]}
      />

      {/* Karşılaştırma */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge="Klasik vs. Skytech"
          title={<>Hangisi Daha <span className="text-gradient-forest">Kalıcı Etki?</span></>}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {COMPARISON.map((c) => (
            <div
              key={c.item}
              className={`relative rounded-3xl overflow-hidden flex flex-col ${
                c.verdict
                  ? "bg-gradient-to-br from-[#1B6B3A] to-[#22894a] text-white shadow-2xl shadow-[#1B6B3A]/20"
                  : "vitrin-card"
              }`}
            >
              <div className="relative aspect-square overflow-hidden">
                <Image
                  src={c.image}
                  alt={c.item}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${
                  c.verdict ? "from-[#1B6B3A]/95 via-[#1B6B3A]/30" : "from-white via-white/15"
                } to-transparent pointer-events-none`} />
                <div className="absolute top-4 left-4 text-4xl">{c.icon}</div>
              </div>
              <div className="p-7 lg:p-8 flex-1 flex flex-col">
              <h3 className={`text-xl font-bold mb-4 ${c.verdict ? "text-white" : "text-[#1a2e1a]"}`}>
                {c.item}
              </h3>
              <ul className="space-y-3 text-sm">
                <li className={c.verdict ? "text-white/85" : "text-[#3d5a3d]"}>
                  <strong className={c.verdict ? "text-[#a3e635]" : "text-[#1B6B3A]"}>Etki:</strong> {c.impact}
                </li>
                <li className={c.verdict ? "text-white/85" : "text-[#3d5a3d]"}>
                  <strong className={c.verdict ? "text-[#a3e635]" : "text-[#1B6B3A]"}>ESG:</strong> {c.esg}
                </li>
              </ul>
              </div>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Özellikler */}
      <SectionWrapper variant="tinted">
        <SectionHeading
          badge="Modüller"
          title={<>Kurumsal Ormanlaştırma <span className="text-gradient-forest">Sistem Modülleri</span></>}
          subtitle="Her büyüklükteki şirket için altı temel kurumsal çözüm."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto stagger-children">
          {FEATURES.map((f) => (
            <div key={f.title} className="vitrin-card p-7">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1B6B3A] to-[#22894a] flex items-center justify-center shadow-md shadow-[#1B6B3A]/15 mb-5">
                <f.Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-[#1a2e1a] mb-2">{f.title}</h3>
              <p className="text-sm text-[#3d5a3d] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Dashboard teaser — Scroll-parallax 3D mockup */}
      <DashboardParallax />

      {/* Developer API */}
      <DeveloperApi />

      {/* Lead form CTA */}
      <SectionWrapper variant="tinted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            Kurumsal Projenizi <span className="text-gradient-forest">Tasarlayalım</span>
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">
            Çalışan sayınız, karbon hedefiniz, ESG ihtiyaçlarınız — birlikte planlayalım. 24 saat içinde dönüş.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link href={TRANSACTIONS_ENABLED ? "/kurumsal/teklif-al" : "/bilgi-al"} className="vitrin-cta-primary">
              {TRANSACTIONS_ENABLED ? "Teklif Talep Et" : "Bilgi Al"}
            </Link>
            <Link href="/iletisim" className="vitrin-cta-secondary">Bize Ulaşın</Link>
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21c0-4 3-6 7-6s7 2 7 6" strokeLinecap="round" />
      <circle cx="17" cy="7" r="3" />
      <path d="M22 19c0-2-2-4-5-4" strokeLinecap="round" />
    </svg>
  );
}
function TreesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M8 21l-2-7H4l4-9 4 9h-2l-2 7zM16 21l-1-5h-1l3-7 3 7h-1l-1 5z" strokeLinejoin="round" />
    </svg>
  );
}
function ApiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6M14 4l-4 16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.5 14h13l3-9H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CalcIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" strokeLinecap="round" />
      <circle cx="8" cy="12" r="0.8" fill="currentColor" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
      <circle cx="16" cy="12" r="0.8" fill="currentColor" />
      <circle cx="8" cy="16" r="0.8" fill="currentColor" />
      <circle cx="12" cy="16" r="0.8" fill="currentColor" />
    </svg>
  );
}
function BadgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14l-2 7 5-3 5 3-2-7" strokeLinejoin="round" />
    </svg>
  );
}
