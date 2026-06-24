"use client";

import { motion, type Variants, useMotionValue, useSpring } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import SectionWrapper from "../SectionWrapper";
import SectionHeading from "../SectionHeading";

type Step = {
  num: string;
  title: string;
  description: string;
  Icon: (p: { className?: string }) => React.JSX.Element;
  image: string;
};

const STEPS: Step[] = [
  {
    num: "01",
    title: "Tohum Topu Ar-Ge",
    description:
      "Orman mühendislerimiz hedef bölgenin iklim ve toprak yapısına uygun tohum türlerini seçer, ormancılık bilimiyle tohum topu formüle ederiz.",
    Icon: FlaskIcon,
    image: "/images/steps/01-arge.webp",
  },
  {
    num: "02",
    title: "Hedef Alan Analizi",
    description:
      "Uydu ve drone görüntüleriyle bölge taranır. Eğim, toprak nemi, ekosistem analizi yapılır. Orman Bölge Müdürlüğü ile koordineli yasal izinler alınır.",
    Icon: MapIcon,
    image: "/images/steps/02-analiz.webp",
  },
  {
    num: "03",
    title: "Dronla Dağıtım",
    description:
      "GPS hassasiyetli drone filomuz, hesaplanmış noktalara tohum topları bırakır. Bir uçuşta 200+ tohum, sıfır saha tahribatıyla.",
    Icon: DroneIcon,
    image: "/images/steps/03-dagitim.webp",
  },
  {
    num: "04",
    title: "Uzaktan İzleme",
    description:
      "Yıllık drone uçuşlarıyla büyüme takip edilir. Karbon nötrleme metrikleri kurumsal panoda anlık görünür. ESG raporlarına entegre.",
    Icon: SatelliteIcon,
    image: "/images/steps/04-izleme.webp",
  },
];

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
};

export default function HowItWorks() {
  return (
    <SectionWrapper variant="tinted" id="nasil-calisir" className="relative overflow-hidden">
      {/* Soft mesh wash */}
      <div
        aria-hidden
        className="absolute inset-0 mesh-gradient opacity-50 pointer-events-none"
      />

      <div className="relative">
        <SectionHeading
          badge="Süreç"
          title={
            <>
              Dört Adımda
              <br />
              <span className="text-gradient-aurora">Yeni Bir Orman</span>
            </>
          }
          subtitle="Her adımda şeffaflık, ölçülebilirlik ve bilim. İşte tohumdan ormana giden yol."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-5"
        >
          {STEPS.map((step, idx) => (
            <StepCard key={step.num} step={step} isLast={idx === STEPS.length - 1} />
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

function StepCard({ step, isLast }: { step: Step; isLast: boolean }) {
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
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    rx.set(((y - cy) / cy) * -5);
    ry.set(((x - cx) / cx) * 5);
    ref.current?.style.setProperty("--spotlight-x", `${x}px`);
    ref.current?.style.setProperty("--spotlight-y", `${y}px`);
  };
  const handleLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div variants={{
      hidden: { opacity: 0, y: 40 },
      show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
    } as Variants} className="relative group">
      {/* Connecting line — only desktop, not last */}
      {!isLast && (
        <motion.div
          aria-hidden
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "left" }}
          className="hidden lg:block absolute top-[60px] left-[calc(50%+50px)] right-[-30%] h-px pointer-events-none z-0"
        >
          <div className="h-full bg-gradient-to-r from-[#22894a]/40 via-[#22894a]/20 to-transparent" />
          <svg
            className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#22894a]/60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <polyline points="9 6 15 12 9 18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      )}

      <motion.div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{
          rotateX,
          rotateY,
          transformPerspective: 1000,
          transformStyle: "preserve-3d",
        }}
        className="spotlight-card relative vitrin-card h-full z-10 overflow-hidden flex flex-col"
      >
        {/* Step image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <Image
            src={step.image}
            alt={step.title}
            fill
            sizes="(max-width: 768px) 100vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent pointer-events-none" />
          <motion.div
            whileHover={{ scale: 1.08, rotate: -3 }}
            transition={{ type: "spring", stiffness: 280, damping: 18 }}
            className="absolute top-3 left-3 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1B6B3A] to-[#22894a] flex items-center justify-center shadow-lg shadow-[#1B6B3A]/30 ring-2 ring-white/40"
          >
            <step.Icon className="w-5 h-5 text-white" />
          </motion.div>
          <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-white/85 backdrop-blur text-xs font-bold tracking-tighter tabular-nums text-[#1B6B3A]">
            {step.num}
          </span>
        </div>

        <div style={{ transform: "translateZ(30px)" }} className="relative p-7 flex-1">
          <h3 className="text-lg font-bold text-[#0e2519] mb-3 leading-tight tracking-tight">
            {step.title}
          </h3>
          <p className="text-sm text-[#3d5a3d] leading-relaxed">{step.description}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FlaskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9 3h6M10 3v7L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 10V3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 14h10" strokeLinecap="round" />
    </svg>
  );
}
function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9 3l-6 3v15l6-3 6 3 6-3V3l-6 3-6-3z" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="9" y1="3" x2="9" y2="18" strokeLinecap="round" />
      <line x1="15" y1="6" x2="15" y2="21" strokeLinecap="round" />
    </svg>
  );
}
function DroneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M8 8l-2-2M16 8l2-2M8 16l-2 2M16 16l2 2" strokeLinecap="round" />
    </svg>
  );
}
function SatelliteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M5 13a4 4 0 0 1 6-4M5 17a8 8 0 0 1 10-7" strokeLinecap="round" />
      <circle cx="5" cy="19" r="2" />
      <path d="M14 4l6 6-3 3-6-6 3-3z" strokeLinejoin="round" />
      <path d="M11 7l3 3M17 13l3 3" strokeLinecap="round" />
    </svg>
  );
}
