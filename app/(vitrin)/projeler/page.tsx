import type { Metadata } from "next";
import Link from "next/link";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import ProjectsGrid from "@/components/vitrin/projeler/ProjectsGrid";
import TurkeyMap from "@/components/vitrin/TurkeyMap";
import { PROJECTS } from "@/lib/projects-data";

export const metadata: Metadata = {
  title: "Projeler & Harita — Sahadan Kanıt | Skytech Green",
  description:
    "Türkiye genelinde aktif, pilot ve tamamlanmış drone ağaçlandırma projelerimiz. İnteraktif harita ve proje detayları.",
};

const STATS = [
  { value: "42K+", label: "Toplam Tohum Atıldı" },
  { value: "6", label: "Aktif Bölge" },
  { value: "4", label: "İl" },
  { value: "%100", label: "Yasal Uyum" },
];

export default function ProjelerPage() {
  return (
    <>
      <BreadCrumb
        title="Sahadan Kanıt"
        subtitle="Türkiye'nin dört bir yanında, gerçek dronelar — gerçek tohumlar — gerçek ormanlar."
        items={[{ label: "Projeler" }]}
      />

      {/* Stats */}
      <SectionWrapper variant="light" className="!py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
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
              <span className="text-gradient-aurora">Proje Haritası</span>
            </>
          }
          subtitle="Aktif, pilot ve tamamlanmış projelerimizi harita üzerinden keşfedin. İllerin üzerine gelin, detayları görün."
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

      {/* Proje listesi */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge="Tüm Projeler"
          title={<>Sahada <span className="text-gradient-aurora">Aktif Olduğumuz Bölgeler</span></>}
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
