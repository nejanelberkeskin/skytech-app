import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import { TreesIcon, SproutIcon, ClockIcon, GlobeIcon } from "@/components/ui/Icons";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Tohumlarımız — Yerli Türler ve Özellikleri",
  description:
    "Skytech Green tohum topu projelerinde kullandığımız yerli türler: Kızılçam, Karaçam, Sedir, Ardıç. Her türün iklim adaptasyonu, kök yapısı, çimlenme süresi ve ekolojik rolü.",
  path: "/tohumlarimiz",
  keywords: [
    "yerli ağaç türleri",
    "kızılçam tohumu",
    "karaçam tohumu",
    "sedir tohumu",
    "ardıç tohumu",
    "Türkiye ormancılık",
    "endemik türler",
  ],
});

type Seed = {
  id: string;
  name: string;
  latin: string;
  family: string;
  region: string;
  climate: string;
  rootDepth: string;
  germination: string;
  lifespan: string;
  ecologicalRole: string;
  description: string;
  accent: string;
};

const SEEDS: Seed[] = [
  {
    id: "kizilcam",
    name: "Kızılçam",
    latin: "Pinus brutia",
    family: "Pinaceae (Çamgiller)",
    region: "Akdeniz, Ege, Marmara",
    climate: "Akdeniz iklimi, sıcak-kurak yazlara dayanıklı",
    rootDepth: "Derin ve geniş yayılan",
    germination: "20–30 gün",
    lifespan: "150–200 yıl",
    ecologicalRole: "Yangın sonrası ilk kolonileyici tür. Toprağı stabilize eder, kuşlar ve böcekler için habitat sağlar.",
    description:
      "Türkiye orman alanının yaklaşık %25'ini kaplayan en yaygın iğne yapraklı türümüz. Akdeniz iklimine mükemmel uyum sağlar, hızlı büyür ve yangından sonra otomatik rejenerasyon kabiliyetiyle bilinir.",
    accent: "from-[#1B6B3A] to-[#22894a]",
  },
  {
    id: "karacam",
    name: "Karaçam",
    latin: "Pinus nigra",
    family: "Pinaceae (Çamgiller)",
    region: "İç Anadolu, Batı Karadeniz, Toroslar",
    climate: "Karasal iklim; kuraklığa ve soğuğa toleranslı",
    rootDepth: "Derin kazık kök sistemi",
    germination: "20–40 gün",
    lifespan: "300–500 yıl",
    ecologicalRole: "Yüksek rakım ormanlaştırmasının öncü türü. Erozyon kontrolünde ve bozkır-orman geçiş kuşağında kritik rol oynar.",
    description:
      "Anadolu'nun yüksek kesimlerine dayanıklı yerli çam türü. Kuraklığa ve dona toleransı sayesinde zorlu iklimlerde güvenle kullanılır; uzun ömürlü ve dayanıklı odunuyla bilinir.",
    accent: "from-[#22894a] to-[#34d399]",
  },
  {
    id: "sedir",
    name: "Sedir (Toros Sediri)",
    latin: "Cedrus libani",
    family: "Pinaceae (Çamgiller)",
    region: "Toroslar, Antalya, Konya",
    climate: "Dağ iklimi, 1.000–2.000 m yükseltiler",
    rootDepth: "Derin ve dayanıklı",
    germination: "25–40 gün",
    lifespan: "1.000+ yıl",
    ecologicalRole: "Yüksek rakım ekosistemlerinin yapı taşı. Kuş ve memeli türler için habitat sağlar.",
    description:
      "Anadolu'nun simgesi, asırlık ömrüyle bir miras türü. Yüksek dağlarda saf orman oluşturur; reçinesi ve özel kokusuyla kuraklığa yüksek dayanım sağlar.",
    accent: "from-[#34d399] to-[#a3e635]",
  },
  {
    id: "ardic",
    name: "Ardıç",
    latin: "Juniperus",
    family: "Cupressaceae (Servigiller)",
    region: "Anadolu geneli, özellikle iç bölgeler",
    climate: "Kurak ve yarı-kurak iklim, taşlı topraklar",
    rootDepth: "Derin, kayalık zeminlere uyumlu",
    germination: "60–120 gün (kalın kabuk)",
    lifespan: "300–600 yıl",
    ecologicalRole: "Sarp ve kurak yamaçlarda öncü tür. Meyveleri kuş ve yaban hayatına besin sağlar; erozyon kontrolünde kritik.",
    description:
      "Anadolu'nun sarp yamaçlarına uyum sağlayan dayanıklı yerli tür. Eteklerden zirvelere kadar yaşar; meyveleri ekosistem için besin değeri taşır, erozyon ve çölleşmeyle mücadelede vazgeçilmezdir.",
    accent: "from-[#1B6B3A] to-[#34d399]",
  },
];

export default function TohumlarimizPage() {
  return (
    <>
      <BreadcrumbSchema items={[{ name: "Tohumlarımız", path: "/tohumlarimiz" }]} />
      <BreadCrumb
        title="Yerli Tohumlarımız"
        subtitle="Her tohum, bölgenin iklimine ve ekosistemine uygun olarak seçilir. Skytech Green tohum topu projelerinde kullanılan dört yerli türün özellikleri."
        items={[{ label: "Tohumlarımız" }]}
      />

      <SectionWrapper variant="light">
        <SectionHeading
          badge="Türler"
          title={<>Dört Yerli <span className="text-gradient-forest">Türümüz</span></>}
          subtitle="Her tür, ekildiği bölgenin iklim ve toprak yapısına göre seçilir. Tohumlarımız Orman Bölge Müdürlükleri tedariklidir."
        />

        <div className="space-y-12 max-w-5xl mx-auto">
          {SEEDS.map((seed, i) => (
            <article
              key={seed.id}
              className="vitrin-card overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-0"
            >
              {/* Sol — Tür kartı (renkli) */}
              <div className={`md:col-span-4 bg-gradient-to-br ${seed.accent} text-white p-8 flex flex-col justify-between`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/70">
                    Tür {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-3xl font-bold mt-2 leading-tight">{seed.name}</h3>
                  <p className="text-sm italic text-white/80 mt-1">{seed.latin}</p>
                </div>
                <div className="mt-8 flex items-center gap-3 text-sm text-white/90">
                  <TreesIcon className="w-10 h-10 shrink-0" strokeWidth={1.4} />
                  <span className="text-xs leading-relaxed">{seed.family}</span>
                </div>
              </div>

              {/* Sağ — Detay */}
              <div className="md:col-span-8 p-8 lg:p-10 space-y-6">
                <p className="text-base text-[#3d5a3d] leading-relaxed">{seed.description}</p>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <Detail icon={<GlobeIcon className="w-4 h-4" />} label="Bölge" value={seed.region} />
                  <Detail icon={<SproutIcon className="w-4 h-4" />} label="İklim" value={seed.climate} />
                  <Detail icon={<TreesIcon className="w-4 h-4" />} label="Kök Yapısı" value={seed.rootDepth} />
                  <Detail icon={<ClockIcon className="w-4 h-4" />} label="Çimlenme" value={seed.germination} />
                  <Detail icon={<ClockIcon className="w-4 h-4" />} label="Ortalama Ömrü" value={seed.lifespan} />
                  <Detail icon={<SproutIcon className="w-4 h-4" />} label="Ekolojik Rolü" value={seed.ecologicalRole} />
                </dl>
              </div>
            </article>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper variant="tinted" className="text-center">
        <p className="text-base text-[#3d5a3d] leading-relaxed max-w-2xl mx-auto">
          Yöreye uygun tohumlarımız ilgili Orman Bölge Müdürlüklerinden tedarik edilmekte;
          tohumların tür bilgisi, ağaçlardan toplanma tarihleri ve orijin bilgileri blok zinciri
          teknolojisiyle güvenle doğrulanmaktadır.
        </p>
      </SectionWrapper>
    </>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-7 h-7 rounded-lg bg-[#1B6B3A]/8 flex items-center justify-center text-[#1B6B3A] shrink-0">
        {icon}
      </span>
      <div>
        <dt className="text-[11px] font-bold uppercase tracking-widest text-[#1B6B3A]">{label}</dt>
        <dd className="text-sm text-[#3d5a3d] mt-0.5 leading-snug">{value}</dd>
      </div>
    </div>
  );
}
