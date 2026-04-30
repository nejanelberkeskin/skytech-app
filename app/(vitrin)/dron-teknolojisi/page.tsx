import type { Metadata } from "next";
import Link from "next/link";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";

export const metadata: Metadata = {
  title: "Dron Teknolojisi — Hassas Ekim, Sıfır Ayak İzi | Skytech Green",
  description:
    "GPS hassasiyetli drone filomuz, ulaşılması zor bölgelerde insan ayağının değmediği alanlara tohum topu ekiyor.",
};

const FEATURES = [
  { title: "GPS Hassasiyeti", desc: "Santimetre seviyesinde RTK GPS — her tohumun düştüğü nokta kayıtlı.", Icon: GpsIcon },
  { title: "200+ Tohum / Uçuş", desc: "Gelişmiş kapasite ile büyük alanları tek seferde tarayabiliyoruz.", Icon: BoxIcon },
  { title: "10x Hız", desc: "Geleneksel ekime göre on kat daha hızlı, ekim süresini günlerden saatlere indiriyor.", Icon: BoltIcon },
  { title: "Otonom Görev", desc: "Önceden planlanan rota; drone otonom uçar, görevi tamamlar, baz istasyonuna döner.", Icon: AutoIcon },
  { title: "Saha Kayıtsız Erişim", desc: "İnsan ayağının ulaşamadığı eğimli, yangın bölgesi, erozyon alanlarına erişim.", Icon: PathIcon },
  { title: "Yıllık Takip", desc: "Aynı drone, periyodik uçuşlarla büyüme verisi toplar — şeffaf izleme.", Icon: ChartIcon },
];

const PROCESS = [
  { num: "01", title: "Bölge Taraması", desc: "Drone uydu ve LiDAR ile alan haritalanır, eğim ve toprak nem analizi yapılır." },
  { num: "02", title: "Ekim Planı", desc: "GPS koordinatlı ekim haritası oluşturulur. Yasal izinler İl Orman Müd. ile koordine edilir." },
  { num: "03", title: "Otonom Ekim", desc: "Drone planlanmış rotada otonom uçar, hesaplanmış noktalara tohum topu bırakır." },
  { num: "04", title: "Raporlama", desc: "Uçuş kaydı, fotoğraflar ve GPS verileri kurumsal panonuza yansır." },
];

export default function DronTeknolojisiPage() {
  return (
    <>
      <BreadCrumb
        title="Hassas Ekim, Sıfır Ayak İzi"
        subtitle="GPS hassasiyetli dronlarla, insan adımının ulaşamadığı bölgelere tohum topu ekiyoruz."
        items={[{ label: "Dron Teknolojisi" }]}
      />

      {/* Hero card */}
      <SectionWrapper variant="light">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center max-w-6xl mx-auto">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] mb-5 text-xs font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B3A]" />
              Drone Sistemi
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
              <span className="text-gradient-forest">Otonom Drone Filomuz</span> Sahada
            </h2>
            <p className="text-base text-[#3d5a3d] leading-relaxed mb-5">
              Skytech Green drone filosu; 200+ tohum kapasiteli yük modülü, RTK GPS, LiDAR ve termal kamera ile donatılmıştır.
              Önceden planlanmış GPS koordinatlarına otonom uçar, tohum topu bırakır.
            </p>
            <p className="text-base text-[#3d5a3d] leading-relaxed">
              Tüm uçuş kayıtları gerçek zamanlı olarak kurumsal panonuza işlenir — şeffaflık ve doğrulanabilirlik için.
            </p>
          </div>

          {/* GORSEL: Drone havada tohum atışı yapıyor — eylem fotoğrafı veya 3D render. 1:1 */}
          <div className="relative aspect-square rounded-3xl bg-gradient-to-br from-[#0a1f12] via-[#1B6B3A] to-[#22894a] overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-40 h-40 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}>
                <circle cx="6" cy="6" r="2.5" />
                <circle cx="18" cy="6" r="2.5" />
                <circle cx="6" cy="18" r="2.5" />
                <circle cx="18" cy="18" r="2.5" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
                <path d="M8 8l-2-2M16 8l2-2M8 16l-2 2M16 16l2 2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="absolute bottom-6 left-6 right-6 liquid-glass-dark rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs text-[#a7d4a7]">
                <span>RTK GPS</span><span>•</span>
                <span>LiDAR</span><span>•</span>
                <span>Termal Kamera</span>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Özellikler */}
      <SectionWrapper variant="tinted">
        <SectionHeading
          badge="Teknik Özellikler"
          title={<>Endüstri Lideri <span className="text-gradient-forest">Drone Donanımı</span></>}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto stagger-children">
          {FEATURES.map((f) => (
            <div key={f.title} className="vitrin-card p-7 flex items-start gap-5">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1B6B3A] to-[#22894a] flex items-center justify-center shadow-md shadow-[#1B6B3A]/15">
                <f.Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1a2e1a] mb-2">{f.title}</h3>
                <p className="text-sm text-[#3d5a3d] leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Operasyon Süreci */}
      <SectionWrapper variant="light">
        <SectionHeading
          badge="Operasyon"
          title={<>Dört Aşamada <span className="text-gradient-forest">Drone Ekimi</span></>}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto stagger-children">
          {PROCESS.map((p) => (
            <div key={p.num} className="vitrin-card p-6">
              <div className="text-3xl font-bold text-[#1B6B3A]/15 mb-3 tracking-tighter">{p.num}</div>
              <h3 className="text-base font-bold text-[#1a2e1a] mb-2">{p.title}</h3>
              <p className="text-sm text-[#3d5a3d] leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* CTA */}
      <SectionWrapper variant="tinted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            Projeniz İçin <span className="text-gradient-forest">Drone Ekimi</span> Planlayalım
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8 max-w-xl mx-auto">
            Bölge analizi, yasal izin koordinasyonu ve operasyon planlaması — tek noktadan.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link href="/bilgi-al" className="vitrin-cta-primary">Teklif Al</Link>
            <Link href="/projeler" className="vitrin-cta-secondary">Aktif Projeler</Link>
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}

function GpsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="1" x2="12" y2="4" strokeLinecap="round" />
      <line x1="12" y1="20" x2="12" y2="23" strokeLinecap="round" />
      <line x1="1" y1="12" x2="4" y2="12" strokeLinecap="round" />
      <line x1="20" y1="12" x2="23" y2="12" strokeLinecap="round" />
    </svg>
  );
}
function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinejoin="round" />
      <polyline points="3 8 12 13 21 8" strokeLinejoin="round" />
      <line x1="12" y1="13" x2="12" y2="22" strokeLinecap="round" />
    </svg>
  );
}
function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
function AutoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 12a9 9 0 0 1 9-9c4 0 7 2 8 5M21 12a9 9 0 0 1-9 9c-4 0-7-2-8-5" strokeLinecap="round" />
      <polyline points="20 4 20 9 15 9" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="4 20 4 15 9 15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PathIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 21l4-9 4 4 6-12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 14l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
