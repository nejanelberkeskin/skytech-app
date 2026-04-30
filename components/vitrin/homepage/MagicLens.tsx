"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { useRef, useState } from "react";
import SectionHeading from "../SectionHeading";

/**
 * MagicLens — fareyi takip eden "Önce / Sonra" maskesi.
 *
 * Arka planda yanmış / çorak alan sahnesi.
 * Farenin altında 320px çapında daire içinde yemyeşil orman görünür.
 * CSS mask-image: radial-gradient + Framer Motion useMotionTemplate
 */
export default function MagicLens() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  // 50% / 50% default position
  const x = useMotionValue(50);
  const y = useMotionValue(50);
  const sx = useSpring(x, { damping: 24, stiffness: 280, mass: 0.4 });
  const sy = useSpring(y, { damping: 24, stiffness: 280, mass: 0.4 });

  // mask-image string with live coordinates (percentage based)
  const maskImage = useMotionTemplate`radial-gradient(circle 200px at ${sx}% ${sy}%, black 0%, black 60%, transparent 100%)`;

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(((e.clientX - rect.left) / rect.width) * 100);
    y.set(((e.clientY - rect.top) / rect.height) * 100);
  };

  return (
    <section className="relative overflow-hidden vitrin-section bg-white">
      <div className="vitrin-container">
        <SectionHeading
          badge="Sihirli Lens"
          title={
            <>
              Çorak Bir Arazi.
              <br />
              <span className="text-gradient-aurora">Yeşil Bir Gelecek.</span>
            </>
          }
          subtitle="Fareyi gezdirin — yanmış toprağın altında nasıl bir orman büyüdüğünü kendi gözlerinizle görün."
        />

        <div
          ref={containerRef}
          onPointerMove={handleMove}
          onPointerEnter={() => setActive(true)}
          onPointerLeave={() => setActive(false)}
          className="relative aspect-[16/9] max-w-6xl mx-auto rounded-3xl overflow-hidden cursor-none shadow-2xl"
          data-cursor="magnetic"
        >
          {/* Background layer — burnt / barren scene */}
          <BarrenScene />

          {/* Foreground layer — green forest, masked by lens */}
          <motion.div
            className="absolute inset-0"
            style={{
              maskImage,
              WebkitMaskImage: maskImage,
            }}
          >
            <ForestScene />
          </motion.div>

          {/* Lens ring */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              left: useMotionTemplate`calc(${sx}% - 200px)`,
              top: useMotionTemplate`calc(${sy}% - 200px)`,
              width: 400,
              height: 400,
              opacity: active ? 1 : 0,
            }}
            animate={{ opacity: active ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Inner glow ring */}
            <div className="absolute inset-[60px] rounded-full ring-2 ring-white/40 ring-offset-0 shadow-[0_0_60px_rgba(34,197,94,0.4)]" />
            {/* Outer subtle ring */}
            <div className="absolute inset-[40px] rounded-full ring-1 ring-white/15" />
          </motion.div>

          {/* Hint label */}
          <motion.div
            className="absolute top-6 left-6 px-3.5 py-1.5 rounded-full premium-glass-dark text-[10px] font-bold uppercase tracking-[0.2em] text-[#a7d4a7] pointer-events-none"
            animate={{ opacity: active ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
              Fareyi gezdirin
            </span>
          </motion.div>

          {/* Labels */}
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-xs font-bold uppercase tracking-[0.2em] pointer-events-none">
            <span className="px-3 py-1.5 rounded-full premium-glass-dark text-[#fda4af]">
              Önce — Yangın Sonrası
            </span>
            <span className="px-3 py-1.5 rounded-full premium-glass-dark text-[#a3e635]">
              Sonra — Skytech Green
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* GORSEL: yanmış / çorak arazi fotoğrafı buraya gelecek (16:9). Şimdilik gradient + dokular. */
function BarrenScene() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #2a1a10 0%, #3d2a18 35%, #1c1208 100%)",
        }}
      />
      {/* Charred ground texture */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 80%, rgba(0,0,0,0.5), transparent 40%), radial-gradient(circle at 70% 60%, rgba(0,0,0,0.4), transparent 40%), radial-gradient(circle at 40% 30%, rgba(80,40,20,0.5), transparent 50%)",
        }}
      />
      {/* Dead tree silhouettes */}
      <DeadTrees />
      {/* Smoke / haze */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-screen"
        style={{
          background:
            "linear-gradient(180deg, transparent 40%, rgba(120,80,50,0.4) 100%)",
        }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

/* GORSEL: yemyeşil orman fotoğrafı (aynı bölge, 16:9). Şimdilik gradient + dokular. */
function ForestScene() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #1a4a2a 0%, #22894a 50%, #0a3a1a 100%)",
        }}
      />
      {/* Tree silhouettes — green canopy */}
      <LiveTrees />
      {/* Sunlight rays */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-screen"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(163, 230, 53, 0.5), transparent 60%)",
        }}
      />
      {/* Misty highlights */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(circle at 20% 70%, rgba(255,255,255,0.4), transparent 30%), radial-gradient(circle at 75% 65%, rgba(255,255,255,0.3), transparent 30%)",
        }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 opacity-20 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

function DeadTrees() {
  return (
    <svg
      className="absolute bottom-0 left-0 right-0 w-full h-1/2 opacity-60"
      viewBox="0 0 1000 300"
      preserveAspectRatio="none"
    >
      {[120, 240, 410, 560, 700, 820].map((cx, i) => (
        <g key={cx} stroke="#1a0e06" strokeWidth="2.5" fill="none">
          <line x1={cx} y1={290} x2={cx + (i % 2 === 0 ? -3 : 4)} y2={130 - (i % 3) * 20} strokeLinecap="round" />
          <line x1={cx} y1={200} x2={cx - 18 + i * 2} y2={170 - (i % 2) * 8} strokeLinecap="round" />
          <line x1={cx} y1={210} x2={cx + 22 - i} y2={180} strokeLinecap="round" />
          <line x1={cx} y1={170} x2={cx - 12} y2={140} strokeLinecap="round" />
          <line x1={cx} y1={170} x2={cx + 14} y2={150} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

function LiveTrees() {
  return (
    <svg
      className="absolute bottom-0 left-0 right-0 w-full h-3/4"
      viewBox="0 0 1000 400"
      preserveAspectRatio="none"
    >
      {/* Distant tree row */}
      {Array.from({ length: 18 }).map((_, i) => {
        const cx = (i + 0.5) * (1000 / 18);
        const r = 20 + ((i * 13) % 12);
        return (
          <ellipse
            key={`bg-${i}`}
            cx={cx}
            cy={260}
            rx={r}
            ry={r * 0.8}
            fill="#0e3d20"
            opacity={0.6}
          />
        );
      })}
      {/* Mid layer */}
      {Array.from({ length: 12 }).map((_, i) => {
        const cx = 40 + i * 80 + ((i % 2) * 24);
        return (
          <g key={`mid-${i}`} fill="#1f6b3a">
            <ellipse cx={cx} cy={300} rx={36} ry={26} />
            <ellipse cx={cx + 14} cy={290} rx={26} ry={22} fill="#2d8a4d" />
            <ellipse cx={cx - 10} cy={295} rx={24} ry={20} fill="#2a7d44" />
          </g>
        );
      })}
      {/* Foreground hero trees */}
      {[180, 470, 760].map((cx, i) => (
        <g key={`fg-${i}`}>
          <rect x={cx - 3} y={350} width={6} height={50} fill="#3a2410" />
          <ellipse cx={cx} cy={345} rx={56} ry={48} fill="#2e8b4a" />
          <ellipse cx={cx + 12} cy={330} rx={40} ry={36} fill="#3da55a" />
          <ellipse cx={cx - 16} cy={336} rx={36} ry={32} fill="#34944f" />
          <ellipse cx={cx + 4} cy={320} rx={26} ry={24} fill="#5cc26d" />
        </g>
      ))}
    </svg>
  );
}
