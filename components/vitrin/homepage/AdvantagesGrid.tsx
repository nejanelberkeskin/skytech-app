"use client";

import { motion, type Variants, useMotionValue, useSpring } from "framer-motion";
import { useRef } from "react";
import SectionWrapper from "../SectionWrapper";
import SectionHeading from "../SectionHeading";

type Advantage = {
  title: string;
  description: string;
  Icon: (p: { className?: string }) => React.JSX.Element;
};

const ADVANTAGES: Advantage[] = [
  { title: "Hızlı Ekim", description: "Bir drone uçuşunda 200+ tohum. Geleneksel yöntemlere kıyasla 10 kat hız.", Icon: BoltIcon },
  { title: "Sıfır Saha Tahribatı", description: "Havadan ekim, ekosistemi koruyor. İnsan ayağının değmediği bölgelere bile ulaşıyor.", Icon: LeafIcon },
  { title: "Tam Şeffaflık", description: "Her tohumun ağaçtan toplanma tarihi, orijin bilgisi ve türü blok zinciriyle doğrulanır. Tedarik zinciri uçtan uca şeffaf.", Icon: EyeIcon },
  { title: "Yıllık İzleme", description: "Periyodik uçuş verileri, büyüme metrikleri ve karbon nötrleme sonuçlarınız kurumsal panomuzda anlık olarak güncellenir.", Icon: SatelliteIcon },
  { title: "Kurumsal Entegrasyon", description: "API entegrasyonu ile e-ticaret sepetinden ESG raporuna kadar tam uyum.", Icon: BuildingIcon },
  { title: "Yasal Uyumluluk", description: "Orman Bölge Müdürlükleri koordinasyonunda, %100 yasal izin ve mevzuat uyumluluğu çerçevesinde projeler.", Icon: ShieldIcon },
];

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

export default function AdvantagesGrid() {
  return (
    <SectionWrapper variant="tinted" className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 mesh-gradient opacity-50 pointer-events-none" />
      <div className="relative">
        <SectionHeading
          badge="Avantajlar"
          title={
            <>
              Skytech Green Farkı
              <br />
              <span className="text-gradient-aurora">Altı Temel Üstünlük</span>
            </>
          }
          subtitle="Geleneksel ağaçlandırmadan dronlu ekime, her noktada ölçülebilir avantaj sağlıyoruz."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6"
        >
          {ADVANTAGES.map((adv) => (
            <motion.div key={adv.title} variants={itemVariants} className="h-full">
              <AdvantageCard adv={adv} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

function AdvantageCard({ adv }: { adv: Advantage }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { damping: 22, stiffness: 220 });
  const rotateY = useSpring(ry, { damping: 22, stiffness: 220 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    rx.set(((y - rect.height / 2) / (rect.height / 2)) * -4);
    ry.set(((x - rect.width / 2) / (rect.width / 2)) * 4);
    ref.current?.style.setProperty("--spotlight-x", `${x}px`);
    ref.current?.style.setProperty("--spotlight-y", `${y}px`);
  };
  const handleLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000, transformStyle: "preserve-3d" }}
      className="spotlight-card relative vitrin-card p-7 flex items-start gap-5 group h-full"
    >
      <motion.div
        whileHover={{ scale: 1.1, rotate: -3 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
        className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1B6B3A] to-[#22894a] flex items-center justify-center shadow-md shadow-[#1B6B3A]/20"
      >
        <adv.Icon className="w-5 h-5 text-white" />
      </motion.div>
      <div style={{ transform: "translateZ(20px)" }}>
        <h3 className="text-base font-bold text-[#0e2519] mb-2 leading-tight tracking-tight">{adv.title}</h3>
        <p className="text-sm text-[#3d5a3d] leading-relaxed">{adv.description}</p>
      </div>
    </motion.div>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor">
      <path d="M27 5C27 5 22 4 16 6C10 8 6 13 6 19C6 22 8 25 11 26C8 24 7 21 7 19C7 14 11 9 17 8C12 11 9 16 9 20C9 24 11 27 14 27C20 27 26 22 27 5Z" />
    </svg>
  );
}
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function SatelliteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 13a4 4 0 0 1 6-4M5 17a8 8 0 0 1 10-7" strokeLinecap="round" />
      <circle cx="5" cy="19" r="2" />
      <path d="M14 4l6 6-3 3-6-6 3-3z" strokeLinejoin="round" />
    </svg>
  );
}
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <line x1="9" y1="9" x2="9" y2="9" strokeLinecap="round" />
      <line x1="15" y1="9" x2="15" y2="9" strokeLinecap="round" />
      <path d="M10 21v-4h4v4" />
    </svg>
  );
}
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9 12 11 14 15 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
