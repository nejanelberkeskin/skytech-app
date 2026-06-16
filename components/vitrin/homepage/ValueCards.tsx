"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import SectionWrapper from "../SectionWrapper";

const VALUE_CARDS = [
  {
    title: "Sıfır Saha İzi",
    description:
      "Dronlar havadan tohum bırakır, saha tahribatı oluşmaz. Ulaşılması zor bölgelerde ekosistem el değmemiş kalır.",
    accent: "from-[#1B6B3A] to-[#22894a]",
    Icon: DroneIcon,
    image: "/images/values/sifir-saha-izi.webp",
    stat: "%100",
    statLabel: "Doğa Korumalı",
  },
  {
    title: "Şeffaf Tedarik Zinciri",
    description:
      "Tüm tohumlar İl Orman Müdürlüğü üretim tesislerinden tedarik edilir. Parti numarası, üretim tarihi ve tür bilgisi blokchain seviyesinde kayıtlıdır.",
    accent: "from-[#22894a] to-[#34d399]",
    Icon: ShieldIcon,
    image: "/images/values/seffaf-tedarik.webp",
    stat: "%100",
    statLabel: "İzlenebilirlik",
  },
  {
    title: "Yıllık Drone Raporlama",
    description:
      "Periyodik izleme uçuşları, büyüme verisi ve karbon nötrleme metrikleri kurumsal panonuzda anlık. ESG raporlarına entegre edilebilir.",
    accent: "from-[#34d399] to-[#a3e635]",
    Icon: ChartIcon,
    image: "/images/values/yillik-raporlama.webp",
    stat: "12 ay",
    statLabel: "İzleme",
  },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const headingVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export default function ValueCards() {
  return (
    <SectionWrapper variant="light" className="!pt-24 !pb-20 relative overflow-hidden">
      {/* Subtle aurora behind heading */}
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] opacity-50 pointer-events-none mesh-gradient blur-3xl"
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="relative max-w-3xl mx-auto text-center mb-16 lg:mb-20"
      >
        <motion.div variants={headingVariants}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B6B3A]/8 border border-[#1B6B3A]/15 mb-6 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1B6B3A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B3A]" />
            Neden Skytech Green?
          </div>
        </motion.div>

        <motion.h2
          variants={headingVariants}
          className="display-headline text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-[#0e2519] mb-6"
        >
          Geleneksel Ağaçlandırmanın
          <br />
          <span className="text-gradient-aurora">Sınırlarını Aşıyoruz</span>
        </motion.h2>

        <motion.p
          variants={headingVariants}
          className="text-base lg:text-lg text-[#3d5a3d] max-w-2xl mx-auto leading-relaxed"
        >
          Üç temel prensip üzerine inşa edilmiş, ölçülebilir ve sürdürülebilir bir ağaçlandırma sistemi.
        </motion.p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="relative grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7"
      >
        {VALUE_CARDS.map((card) => (
          <motion.div key={card.title} variants={cardVariants}>
            <ValueCard card={card} />
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  );
}

function ValueCard({ card }: { card: (typeof VALUE_CARDS)[number] }) {
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D tilt on hover
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const springConfig = { damping: 20, stiffness: 220, mass: 0.6 };
  const rotateX = useSpring(rx, springConfig);
  const rotateY = useSpring(ry, springConfig);

  // Glow scale based on hover
  const glowOpacity = useMotionValue(0);
  const glow = useSpring(glowOpacity, { damping: 30, stiffness: 200 });
  const glowScale = useTransform(glow, [0, 1], [0.85, 1]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    // -8° to 8° tilt range
    rx.set(((y - cy) / cy) * -7);
    ry.set(((x - cx) / cx) * 7);
    // Spotlight tracking
    cardRef.current?.style.setProperty("--spotlight-x", `${x}px`);
    cardRef.current?.style.setProperty("--spotlight-y", `${y}px`);
  };
  const handleEnter = () => {
    glowOpacity.set(1);
  };
  const handleLeave = () => {
    rx.set(0);
    ry.set(0);
    glowOpacity.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1200,
        transformStyle: "preserve-3d",
      }}
      className="group relative spotlight-card premium-glass rounded-3xl h-full overflow-hidden flex flex-col"
    >
      {/* Animated radial glow that follows cursor */}
      <motion.div
        aria-hidden
        style={{ opacity: glow, scale: glowScale }}
        className="absolute inset-0 pointer-events-none z-0"
      >
        <div
          className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${card.accent} opacity-[0.06] blur-2xl`}
        />
      </motion.div>

      {/* Hero image */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={card.image}
          alt={card.title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent pointer-events-none" />
        {/* Icon overlay top-left */}
        <motion.div
          whileHover={{ scale: 1.08, rotate: -3 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className={`absolute top-4 left-4 inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br ${card.accent} items-center justify-center shadow-lg shadow-[#1B6B3A]/30 ring-2 ring-white/40`}
        >
          <card.Icon className="w-6 h-6 text-white" />
        </motion.div>
      </div>

      <div style={{ transform: "translateZ(40px)" }} className="relative p-7 lg:p-8 flex-1 flex flex-col">
        {/* Title */}
        <h3 className="text-xl lg:text-2xl font-bold text-[#0e2519] mb-3 leading-tight tracking-tight">
          {card.title}
        </h3>

        {/* Description */}
        <p className="text-sm lg:text-[15px] text-[#3d5a3d] leading-relaxed mb-7 flex-1">
          {card.description}
        </p>

        {/* Stat */}
        <div className="flex items-baseline gap-2 pt-5 border-t border-[#1B6B3A]/8">
          <span
            className={`text-3xl font-bold bg-gradient-to-br ${card.accent} bg-clip-text text-transparent tabular-nums`}
          >
            {card.stat}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b8f6b]">
            {card.statLabel}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function DroneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M9 12h6M12 9v6" strokeLinecap="round" />
      <rect x="9" y="10" width="6" height="4" rx="1" />
    </svg>
  );
}
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="9 12 11 14 15 10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 14l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="14" r="1.2" fill="currentColor" />
      <circle cx="11" cy="10" r="1.2" fill="currentColor" />
      <circle cx="15" cy="14" r="1.2" fill="currentColor" />
      <circle cx="21" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}
