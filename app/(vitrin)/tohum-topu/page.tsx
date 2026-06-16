import Image from "next/image";
import Link from "next/link";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import ServiceSchema from "@/components/seo/ServiceSchema";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Tohum Topu — Bir Kürede Koca Bir Orman",
  description:
    "Kil, organik gübre ve seçilmiş tohumlardan üretilen tohum topu nedir, nasıl yapılır? %65+ çimlenme oranı, üretim süreci ve bilimsel formülasyon.",
  path: "/tohum-topu",
  image: {
    url: "/images/tohum-topu/hero.webp",
    alt: "Tohum topu yakın çekim — kil küre, çatlak ve filiz",
  },
  keywords: [
    "tohum topu",
    "tohum topu nedir",
    "kil tohum topu",
    "ağaçlandırma tohum topu",
    "tohum topu üretimi",
    "yerli tohum",
  ],
});

const COMPONENTS = [
  { label: "Yerli Tohum", desc: "İl Orman Müdürlüğü tedarikli, parti numarası kayıtlı.", pct: "30%" },
  { label: "Killi Toprak", desc: "Koruyucu kabuk, hayvan yemesini engeller.", pct: "50%" },
  { label: "Organik Gübre", desc: "Çimlenme için besin desteği.", pct: "20%" },
];

const STEPS = [
  { num: "01", title: "Tohum Seçimi", desc: "Hedef bölgenin iklim ve toprağına uygun yerli tür belirlenir." },
  { num: "02", title: "Karışım & Şekillendirme", desc: "Kil, gübre, tohum oranlanır; küre haline getirilir." },
  { num: "03", title: "Kurutma & Paketleme", desc: "48 saat doğal kurutma; nemden korunmuş paketlenir." },
];

const STATS = [
  { value: "%65+", label: "Çimlenme Oranı" },
  { value: "200+", label: "Tohum / Drone Uçuşu" },
  { value: "5kg", label: "CO₂ / Ağaç / Yıl" },
  { value: "25 yıl", label: "Ortalama Yaşam" },
];

export default function TohumTopuPage() {
  return (
    <>
      <BreadcrumbSchema items={[{ name: "Tohum Topu", path: "/tohum-topu" }]} />
      <ServiceSchema
        name="Tohum Topu Üretimi ve Tedariki"
        description="İl Orman Müdürlüğü koordineli yerli tohumlardan, kil ve organik gübreyle formüle edilmiş, %65+ çimlenme oranına sahip tohum topu üretimi."
        serviceType="Seed ball production for reforestation"
        path="/tohum-topu"
        image="/images/tohum-topu/hero.webp"
      />
      <BreadCrumb
        title="Bir Kürede Koca Bir Orman"
        subtitle="Tohum topu — kil, organik gübre ve seçilmiş tohumların ileri tarım bilimiyle birleştiği küçük bir mucize."
        items={[{ label: "Tohum Topu" }]}
      />

      {/* Bilim — Ne ve Neden */}
      <SectionWrapper variant="light">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center max-w-6xl mx-auto">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] mb-5 text-xs font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B3A]" />
              Tohum Topu Nedir?
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
              Doğanın <span className="text-gradient-forest">Akıllı Kapsülü</span>
            </h2>
            <p className="text-base text-[#3d5a3d] leading-relaxed mb-5">
              Tohum topu; kil, organik gübre ve seçilmiş yerli tohumların belirli oranlarda karıştırılıp küçük küre haline getirilmiş halidir.
              Toprağa düştüğünde dış kabuk koruyucu görev görür, yağmurla birlikte tohum çimlenir.
            </p>
            <p className="text-base text-[#3d5a3d] leading-relaxed">
              Hayvan ve kuş yemesini engeller, kuraklığa dayanıklılığı artırır ve çimlenme oranını
              <strong className="text-[#1B6B3A]"> %65+ </strong>seviyesine çıkarır — geleneksel serpme yöntemine kıyasla 3 kat daha verimli.
            </p>
          </div>

          <div className="relative aspect-square rounded-3xl overflow-hidden bg-[#0a1f12]">
            <Image
              src="/images/tohum-topu/hero.webp"
              alt="Tohum topu yakın çekim — kil küre, çatlak ve filiz"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute bottom-6 left-6 right-6 liquid-glass-dark rounded-2xl p-5 text-center">
              <p className="text-xs text-[#a7d4a7] uppercase tracking-wider font-semibold mb-1">Yakın Çekim</p>
              <p className="text-sm text-white">Kil + Gübre + Yerli Tohum</p>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Bileşenler */}
      <SectionWrapper variant="tinted">
        <SectionHeading
          badge="Formülasyon"
          title={<>Üç Bileşen, <span className="text-gradient-forest">Mükemmel Denge</span></>}
          subtitle="Her tohum topu, ileri tarım bilimi prensiplerinde formüle edilir."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 max-w-5xl mx-auto stagger-children">
          {COMPONENTS.map((c) => (
            <div key={c.label} className="vitrin-card p-7 text-center">
              <div className="text-4xl font-bold bg-gradient-to-br from-[#1B6B3A] to-[#22894a] bg-clip-text text-transparent mb-2">
                {c.pct}
              </div>
              <h3 className="text-lg font-bold text-[#1a2e1a] mb-2">{c.label}</h3>
              <p className="text-sm text-[#3d5a3d] leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Üretim Süreci */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge="Üretim Süreci"
          title={<>Üç Adımda <span className="text-gradient-forest">Tohum Topu</span></>}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto stagger-children">
          {STEPS.map((s) => (
            <div key={s.num} className="vitrin-card p-7">
              <div className="text-2xl font-bold text-[#1B6B3A]/20 mb-3 tracking-tighter">{s.num}</div>
              <h3 className="text-lg font-bold text-[#1a2e1a] mb-2.5">{s.title}</h3>
              <p className="text-sm text-[#3d5a3d] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* İstatistikler */}
      <SectionWrapper variant="tinted">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {STATS.map((s) => (
            <div key={s.label} className="vitrin-card p-6 lg:p-7 text-center">
              <p className="text-3xl lg:text-4xl font-bold bg-gradient-to-br from-[#1B6B3A] to-[#22894a] bg-clip-text text-transparent mb-2 tabular-nums">
                {s.value}
              </p>
              <p className="text-xs uppercase tracking-wider text-[#6b8f6b] font-semibold">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* CTA */}
      <SectionWrapper variant="light">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            Kendi <span className="text-gradient-forest">Tohum Topunuzu</span> Sipariş Edin
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">
            Adresinize teslim, kendi bahçenizde veya seçilen Skytech alanlarında profesyonel ekim ile.
          </p>
          <Link href="/bireysel/satin-al" className="vitrin-cta-primary">
            Sipariş Ver
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </SectionWrapper>
    </>
  );
}
