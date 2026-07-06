import Link from "next/link";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import ProjectsGrid from "@/components/vitrin/projeler/ProjectsGrid";
import TurkeyMap from "@/components/vitrin/TurkeyMap";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import { PROJECTS } from "@/lib/projects-data";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Projeler & Harita — Sahadan Kanıt",
  description:
    "Çanakkale, İzmir ve Bursa'da sürdürdüğümüz pilot drone ağaçlandırma çalışmalarımız. İnteraktif Türkiye haritası ve il bazlı pilot saha detayları.",
  path: "/projeler",
  keywords: [
    "ağaçlandırma projeleri Türkiye",
    "pilot ağaçlandırma",
    "drone ekim projeleri",
    "Çanakkale İzmir Bursa ağaçlandırma",
    "Orman Genel Müdürlüğü ağaçlandırma",
  ],
});

const STATS = [
  { value: "3", label: "Pilot Bölge" },
  { value: "3", label: "İl" },
  { value: "%100", label: "Yasal Uyum" },
];

export default function ProjelerPage() {
  return (
    <>
      <BreadcrumbSchema items={[{ name: "Projeler", path: "/projeler" }]} />
      <BreadCrumb
        title="Sahadan Kanıt"
        subtitle="Çanakkale, İzmir ve Bursa'da pilot sahalarımızda çalışmalarımız sürüyor — gerçek dronelar, gerçek tohumlar."
        items={[{ label: "Projeler" }]}
      />

      {/* Stats */}
      <SectionWrapper variant="light" className="!py-12">
        <div className="grid grid-cols-3 gap-5 max-w-3xl mx-auto">
          {STATS.map((s) => (
            <div key={s.label} className="vitrin-card p-6 text-center">
              <p className="text-3xl lg:text-4xl font-bold bg-gradient-to-br from-[#1B6B3A] to-[#22894a] bg-clip-text text-transparent mb-1 tabular-nums">
                {s.value}
              </p>
              <p className="text-xs uppercase tracking-wider text-[#6b8f6b] font-semibold">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* İnteraktif Türkiye Haritası */}
      <SectionWrapper variant="tinted">
        <SectionHeading
          badge="İnteraktif Harita"
          title={
            <>
              Türkiye{" "}
              <span className="text-gradient-aurora">Pilot Saha Haritası</span>
            </>
          }
          subtitle="Pilot sahalarımızı harita üzerinden keşfedin. İllerin üzerine gelin, detayları görün."
        />
        <TurkeyMap
          projects={PROJECTS.map((p) => ({
            id: p.id,
            province: p.city,
            region: p.region,
            status: p.status,
            trees: p.trees,
            year: p.year,
          }))}
        />
      </SectionWrapper>

      {/* Pilot saha listesi */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge="Pilot Sahalar"
          title={<>Sahada <span className="text-gradient-aurora">Aktif Olduğumuz Bölgeler</span></>}
          subtitle="Şu anda Çanakkale, İzmir ve Bursa'da pilot çalışmalarımız sürüyor. Alan çoğaldıkça yeni sahalar burada listelenecek."
        />
        <ProjectsGrid />
      </SectionWrapper>

      {/* CTA */}
      <SectionWrapper variant="tinted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            Kendi <span className="text-gradient-forest">Projenizi</span> Başlatın
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">
            Şirketiniz, belediyeniz veya STK'nız için özel bir proje tasarlayabiliriz.
          </p>
          <Link href="/bilgi-al" className="vitrin-cta-primary">Teklif Al</Link>
        </div>
      </SectionWrapper>
    </>
  );
}
