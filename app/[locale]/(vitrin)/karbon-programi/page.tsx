import Link from "next/link";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import CarbonCalculator from "@/components/vitrin/homepage/CarbonCalculator";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import ServiceSchema from "@/components/seo/ServiceSchema";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Karbon Programı — Ölçülebilir, Şeffaf, Sertifikalı",
  description:
    "Karbon nötrleme programımız: dron ekimleriyle dengelenen CO₂, şeffaf metrikler, GRI/CDP uyumlu ESG raporlama. Kurumsal karbon sertifikası.",
  path: "/karbon-programi",
  keywords: [
    "karbon nötrleme",
    "karbon ayak izi",
    "ESG raporlama",
    "karbon sertifikası",
    "GRI CDP karbon",
    "kurumsal sürdürülebilirlik",
    "carbon offset Türkiye",
  ],
});

const METRICS = [
  { value: "10–25 kg", label: "CO₂ / Ağaç / Yıl", desc: "Bir ağacın ortalama yıllık karbondioksit emilimi; tür, yaş ve iklime göre değişir.", ref: 1 },
  { value: "4,5–40,7 t", label: "CO₂ / ha / Yıl", desc: "Genç ağaçlandırma alanlarının ilk 20 yıldaki hektar başına karbon giderim aralığı.", ref: 2 },
  { value: "~550 g", label: "CO₂ / m² / Yıl", desc: "Akdeniz çam ormanlarında ölçülen organik karbon tutum hızı (2/3 toprak, 1/3 biyokütle).", ref: 3 },
  { value: "GRI/CDP", label: "Uyumlu", desc: "Veri formatlarımız uluslararası raporlama standartlarına uygundur." },
];

const REFERENCES = [
  {
    id: 1,
    text: "Ortalama ağaç başına yıllık CO₂ emilim aralığı — bağımsız karbon hesaplama derlemeleri ve orman yönetimi karbon muhasebesi kaynakları.",
    source: "Penn State Extension — Carbon Accounting in Forest Management",
    url: "https://extension.psu.edu/carbon-accounting-in-forest-management",
  },
  {
    id: 2,
    text: "Ağaçlandırma ve fidanlıkların ilk 20 yıldaki hektar başına karbon giderim hızı (4,5–40,7 t CO₂ ha⁻¹ yıl⁻¹).",
    source: "Bernal et al., Carbon Balance and Management (2018) — Global carbon dioxide removal rates from forest landscape restoration",
    url: "https://cbmjournal.biomedcentral.com/articles/10.1186/s13021-018-0110-8",
  },
  {
    id: 3,
    text: "Akdeniz çam ormanında organik karbon tutum hızı (~550 g CO₂ m⁻² yıl⁻¹).",
    source: "Disentangling the soil and atmospheric stress on carbon sequestration in a Mediterranean pine forest, arXiv (2025)",
    url: "https://arxiv.org/pdf/2511.22720",
  },
  {
    id: 4,
    text: "Tohum topu kompozisyonu, atış yüksekliği ve çimlenme başarısı üzerine İHA tabanlı hassas ekim araştırması.",
    source: "UAV-Based Precision Seed Dropping for Automated Reforestation, Authorea (2025)",
    url: "https://www.authorea.com/doi/full/10.22541/au.175622436.63027828/v1",
  },
];

const COMPARISON = [
  { method: "Karbon Kredisi Satın Alma", icon: "📄", pros: "Hızlı, kolay", cons: "Soyut, ölçülemez, çoğu zaman çift sayım", verdict: false },
  { method: "Skytech Drone Ağaçlandırma", icon: "🌱", pros: "Fiziksel ağaç + GPS koordinatlı kayıt", cons: "—", verdict: true },
];

const FAQ = [
  { q: "Karbon sertifikalarınız ne için geçerli?", a: "Sertifikalarımız ESG raporlarında, GRI ve CDP gönderimlerinde, kurumsal sürdürülebilirlik beyanlarında kullanılabilir. Kurumumuz bünyesinde gerçekleştirilen tüm ormanlaştırma ve karbon yutak alanı projeleri Orman Genel Müdürlüğü (OGM) Bölge Müdürlükleri koordinasyonunda, yasal ve bilimsel altyapıya uygun olarak yürütülmektedir." },
  { q: "Karbon hesaplaması nasıl yapılıyor?", a: "Tohum sayısı × çimlenme oranı = ağaç sayısı; ağaç sayısı × ağaç başına yıllık CO₂ emilimi × izleme süresi = toplam karbon dengelemesi. Ağaç başına emilim aralığı (10–25 kg/yıl) ve hektar bazlı giderim hızları (4,5–40,7 t CO₂/ha/yıl) sayfanın altında listelenen akademik kaynaklara dayanır; tür, yaş ve iklime göre saha bazında güncellenir." },
  { q: "Bireysel olarak da katılabilir miyim?", a: "Evet — tohum sipariş eden her kullanıcı, kendi karbon ayak izini dengelemiş olur. Dijital sertifikanızda kaç kg CO₂ dengelediğiniz net olarak gösterilir." },
  { q: "ESG entegrasyonu nasıl çalışıyor?", a: "Kurumsal panelinizde ESG yazılımınız arasında API entegrasyonu sağlayarak veri akışını otomatik hale getiriyoruz. Sistemimiz şirketinizin karbon ayak izini hesaplar ve bu doğrultuda markanıza özel, drone teknolojisiyle desteklenen bir orman oluşturur." },
];

export default function KarbonProgramiPage() {
  return (
    <>
      <BreadcrumbSchema items={[{ name: "Karbon Programı", path: "/karbon-programi" }]} />
      <ServiceSchema
        name="Karbon Nötrleme Programı"
        description="GRI/CDP/SASB uyumlu, IPCC standartlarında karbon ayak izi hesaplama ve dron ağaçlandırmayla nötrleme. Kurumsal ESG raporlarına entegre."
        serviceType="Carbon offset and ESG reporting"
        path="/karbon-programi"
      />
      <BreadCrumb
        title="Holding ve Şirketler için Uçtan Uca Karbon Nötrleme"
        subtitle="Yıllık sera gazı emisyonlarınızı uluslararası standartlarda hesaplıyor, drone teknolojisiyle yüksek karbon yutak alanları (biyo-karbon ekosistemleri) inşa ediyor ve tüm süreci şeffaf biçimde ESG raporlarınıza entegre ediyoruz."
        items={[{ label: "Karbon Programı" }]}
      />

      {/* Metrikler */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge="Metrikler"
          title={<>Ölçülebilir <span className="text-gradient-forest">Karbon Etkisi</span></>}
          subtitle="Her sayı IPCC standartlarına dayanır. Şeffaf, doğrulanabilir, denetlenebilir."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto stagger-children">
          {METRICS.map((m) => (
            <div key={m.label} className="vitrin-card p-6 lg:p-7">
              <p className="text-3xl lg:text-4xl font-bold bg-gradient-to-br from-[#1B6B3A] to-[#22894a] bg-clip-text text-transparent mb-2 tabular-nums">
                {m.value}
              </p>
              <p className="text-xs uppercase tracking-wider text-[#1B6B3A] font-semibold mb-2">
                {m.label}
              </p>
              <p className="text-xs text-[#3d5a3d] leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Karbon Hesaplayıcı (homepage'dan reuse) */}
      <CarbonCalculator />

      {/* Karşılaştırma */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge="Karbon Kredisi vs. Gerçek Ağaçlandırma"
          title={<>Hangisi <span className="text-gradient-forest">Gerçekten Etkili?</span></>}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {COMPARISON.map((c) => (
            <div
              key={c.method}
              className={`relative rounded-3xl p-7 lg:p-9 ${
                c.verdict
                  ? "bg-gradient-to-br from-[#1B6B3A] to-[#22894a] text-white shadow-2xl shadow-[#1B6B3A]/20"
                  : "vitrin-card"
              }`}
            >
              <div className="text-5xl mb-5">{c.icon}</div>
              <h3 className={`text-xl font-bold mb-4 ${c.verdict ? "text-white" : "text-[#1a2e1a]"}`}>
                {c.method}
              </h3>
              <div className="space-y-3 text-sm">
                <p className={c.verdict ? "text-white/85" : "text-[#3d5a3d]"}>
                  <strong className={c.verdict ? "text-[#a3e635]" : "text-[#1B6B3A]"}>Artılar:</strong> {c.pros}
                </p>
                {c.cons !== "—" && (
                  <p className={c.verdict ? "text-white/85" : "text-[#3d5a3d]"}>
                    <strong className="text-[#dc2626]">Eksiler:</strong> {c.cons}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* FAQ */}
      <SectionWrapper variant="tinted">
        <SectionHeading
          badge="SSS"
          title={<>Karbon Programı <span className="text-gradient-forest">Hakkında</span></>}
        />
        <div className="max-w-3xl mx-auto space-y-3">
          {FAQ.map((item, i) => (
            <details key={i} className="group bg-white border border-black/8 rounded-2xl overflow-hidden">
              <summary className="flex items-center justify-between p-5 cursor-pointer text-base font-semibold text-[#1a2e1a] hover:text-[#1B6B3A] transition-colors list-none">
                <span className="pr-4">{item.q}</span>
                <span className="shrink-0 w-7 h-7 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] flex items-center justify-center group-open:bg-[#1B6B3A] group-open:text-white group-open:rotate-45 transition-all">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
                    <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-5 text-sm text-[#3d5a3d] leading-relaxed">{item.a}</div>
            </details>
          ))}
        </div>
      </SectionWrapper>

      {/* Akademik Kaynaklar */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge="Bilimsel Kaynaklar"
          title={<>Verilerimizin <span className="text-gradient-forest">Dayanakları</span></>}
          subtitle="Karbon hesaplama parametrelerimiz, hakemli akademik yayınlara ve bağımsız kurum kaynaklarına dayanır."
        />
        <ol className="max-w-3xl mx-auto space-y-4">
          {REFERENCES.map((ref) => (
            <li key={ref.id} className="vitrin-card p-5 flex gap-4">
              <span className="shrink-0 w-8 h-8 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] font-bold flex items-center justify-center text-sm">
                {ref.id}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-[#3d5a3d] leading-relaxed mb-1.5">{ref.text}</p>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B6B3A] hover:text-[#22894a] transition-colors break-words"
                >
                  {ref.source}
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </li>
          ))}
        </ol>
        <p className="max-w-3xl mx-auto text-xs text-[#6b8f6b] mt-6 text-center leading-relaxed">
          Not: Karbon giderim değerleri tür, yaş, iklim ve saha koşullarına göre değişir. Sunulan aralıklar
          bilimsel literatürdeki ortalamalardır; kurumsal projelerde saha bazlı ölçümlerle güncellenir.
        </p>
      </SectionWrapper>

      {/* CTA */}
      <SectionWrapper variant="tinted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            Karbon Nötrleme <span className="text-gradient-forest">Programına Katılın</span>
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">
            Bireysel ya da kurumsal — ölçülebilir karbon dengeleme yolculuğu burada başlıyor.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link href="/kurumsal/teklif-al" className="vitrin-cta-primary">Kurumsal Teklif Al</Link>
            <Link href="/bireysel/satin-al" className="vitrin-cta-secondary">Bireysel Tohum Sipariş Et</Link>
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}
