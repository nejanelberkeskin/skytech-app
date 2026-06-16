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
  { value: "5kg", label: "CO₂ / Ağaç / Yıl", desc: "Olgun bir ağaç yıllık ortalama 5kg karbondioksit emer." },
  { value: "0,025t", label: "CO₂ / Tohum", desc: "Bir tohum topu 25 yılda 0,025 ton CO₂ tutar." },
  { value: "%65+", label: "Çimlenme", desc: "Ağaca dönüşen tohum oranı, geleneksel ekimin 3 katı." },
  { value: "GRI/CDP", label: "Uyumlu", desc: "Veri formatlarımız uluslararası raporlama standartlarına uygun." },
];

const COMPARISON = [
  { method: "Karbon Kredisi Satın Alma", icon: "📄", pros: "Hızlı, kolay", cons: "Soyut, ölçülemez, çoğu zaman çift sayım", verdict: false },
  { method: "Skytech Drone Ağaçlandırma", icon: "🌱", pros: "Fiziksel ağaç + GPS koordinatlı kayıt", cons: "—", verdict: true },
];

const FAQ = [
  { q: "Karbon sertifikalarınız ne için geçerli?", a: "ESG raporlamalarında, GRI ve CDP gönderimlerinde, kurumsal sürdürülebilirlik beyanlarında kullanılabilir. İl Orman Müdürlüğü koordineli yasal projelerimiz uçtan uca doğrulanabilir." },
  { q: "Karbon hesaplaması nasıl yapılıyor?", a: "Tohum sayısı × çimlenme oranı (%65) = ağaç sayısı. Ağaç sayısı × yıllık 5kg CO₂ × izleme süresi = toplam karbon dengelemesi. Tüm parametreler uluslararası kabul gören IPCC kılavuzlarından alınmıştır." },
  { q: "Bireysel olarak da katılabilir miyim?", a: "Evet — tohum sipariş eden her kullanıcı, kendi karbon ayak izini dengelemiş olur. Dijital sertifikanızda kaç kg CO₂ dengelediğiniz net olarak gösterilir." },
  { q: "ESG entegrasyonu nasıl çalışıyor?", a: "Kurumsal panelimizden API ile ESG yazılımınıza veri akışı kurulabilir. Şirket karbon ayak izinizi hesaplıyor, ona göre dronlu hatıra ormanı kuruyoruz." },
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
        title="Her Ağaç Bir Karbon Filtresi. Biz Onu Ölçüyoruz."
        subtitle="Soyut karbon kredilerine güvenmek yerine, gerçek ağaçlarla, GPS koordinatlı kayıtlarla, ölçülebilir karbon nötrleme."
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

      {/* CTA */}
      <SectionWrapper variant="light">
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
