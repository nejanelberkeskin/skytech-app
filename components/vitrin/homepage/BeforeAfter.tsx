"use client";

import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useRef, useState } from "react";
import SectionHeading from "../SectionHeading";

/**
 * BeforeAfter — scroll-linked clip-path geçişi.
 *
 * Tutup-çekmeli klasik slider yerine, sayfa scroll progress'ine göre
 * yeşil orman görseli soldan sağa doğru yanmış arazinin üzerine sıvı bir
 * dalga gibi açılır.
 */
export default function BeforeAfter() {
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 75%", "end 25%"],
  });

  const smooth = useSpring(scrollYProgress, {
    damping: 28,
    stiffness: 120,
    mass: 0.4,
  });

  // Reveal width 0% → 100%
  const revealPct = useTransform(smooth, [0, 1], [0, 100]);
  const clipPath = useTransform(revealPct, (v) => `inset(0 ${100 - v}% 0 0)`);

  // Vertical seam x position
  const seamLeft = useTransform(revealPct, (v) => `${v}%`);
  const seamOpacity = useTransform(smooth, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);

  // Progress label position
  const labelLeft = useTransform(revealPct, (v) => `${v}%`);

  return (
    <section ref={ref} className="relative bg-[#f8faf5] vitrin-section">
      <div className="vitrin-container">
        <SectionHeading
          badge="Önce / Sonra"
          title={
            <>
              Aşağı Kaydırın —
              <br />
              <span className="text-gradient-aurora">Doğanın Geri Dönüşü</span>
            </>
          }
          subtitle="Yangın sonrası çorak araziyi, yıllar içinde yeniden hayata kavuşturduk. Scroll edin — değişimi izleyin."
        />

        <div className="relative aspect-[16/9] max-w-6xl mx-auto rounded-3xl overflow-hidden shadow-2xl">
          {/* Background — burnt land */}
          <BarrenLayer />

          {/* Foreground — green forest, clip-path animated */}
          <motion.div
            style={{ clipPath, WebkitClipPath: clipPath as unknown as string }}
            className="absolute inset-0"
          >
            <ForestLayer />
          </motion.div>

          {/* Vertical seam line */}
          <motion.div
            style={{ left: seamLeft, opacity: seamOpacity }}
            className="absolute top-0 bottom-0 w-px pointer-events-none -translate-x-1/2"
          >
            <div className="relative h-full w-px bg-gradient-to-b from-[#a3e635] via-[#34d399] to-[#22894a] shadow-[0_0_24px_rgba(52,211,153,0.7)]" />
            {/* Seam handle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full premium-glass-dark flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.5)]">
              <svg
                className="w-5 h-5 text-[#a3e635]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <polyline points="9 6 15 12 9 18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </motion.div>

          {/* Top labels */}
          <div className="absolute top-6 left-6 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-[0.2em] text-[#fda4af] z-10">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fda4af]" />
              Önce — 2021
            </span>
          </div>
          <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3e635] z-10">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635] animate-pulse" />
              Sonra — 2026
            </span>
          </div>

          {/* Progress label that follows the seam */}
          <motion.div
            style={{ left: labelLeft, opacity: seamOpacity }}
            className="absolute bottom-6 -translate-x-1/2 px-3 py-1.5 rounded-full premium-glass-dark text-[10px] font-bold uppercase tracking-[0.2em] text-white pointer-events-none whitespace-nowrap"
          >
            Yenilenme:{" "}
            <ProgressLabel value={revealPct} />
          </motion.div>
        </div>

        <p className="mt-6 text-center text-xs text-[#6b8f6b] uppercase tracking-[0.2em] font-bold">
          Manavgat · 50 hektar · 12.000 tohum
        </p>
      </div>
    </section>
  );
}

function ProgressLabel({ value }: { value: MotionValue<number> }) {
  const [pct, setPct] = useState(0);
  useMotionValueEvent(value, "change", (v) => setPct(Math.round(v as number)));
  return <span className="tabular-nums">%{pct}</span>;
}

/* GORSEL: yanmış arazi fotoğrafı (16:9) buraya */
function BarrenLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #382518 0%, #2a1810 50%, #1a0e08 100%)",
        }}
      />
      {/* Charred patches */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 80%, rgba(0,0,0,0.6), transparent 35%), radial-gradient(circle at 60% 60%, rgba(0,0,0,0.5), transparent 40%), radial-gradient(circle at 80% 30%, rgba(80,40,20,0.6), transparent 50%)",
        }}
      />
      {/* Dead trees */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full h-2/3 opacity-60"
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
      >
        {[80, 180, 290, 400, 500, 610, 720, 840, 940].map((cx, i) => (
          <g key={cx} stroke="#1a0e06" strokeWidth="3" fill="none">
            <line x1={cx} y1={290} x2={cx + (i % 2 === 0 ? -3 : 4)} y2={120 - (i % 4) * 14} strokeLinecap="round" />
            <line x1={cx} y1={200} x2={cx - 18 + i * 2} y2={170 - (i % 2) * 10} strokeLinecap="round" />
            <line x1={cx} y1={210} x2={cx + 22 - i} y2={180} strokeLinecap="round" />
            <line x1={cx} y1={170} x2={cx - 14} y2={140} strokeLinecap="round" />
          </g>
        ))}
      </svg>
      {/* Smoke */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-screen"
        style={{
          background:
            "linear-gradient(180deg, transparent 30%, rgba(140,90,60,0.4) 100%)",
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

/* GORSEL: yenilenmiş yeşil arazi fotoğrafı (16:9) buraya */
function ForestLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #1f6b3a 0%, #2e8b4a 60%, #0a3a1a 100%)",
        }}
      />
      {/* Distant tree row */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full h-3/4"
        viewBox="0 0 1000 400"
        preserveAspectRatio="none"
      >
        {Array.from({ length: 20 }).map((_, i) => {
          const cx = (i + 0.5) * (1000 / 20);
          const r = 22 + ((i * 13) % 12);
          return (
            <ellipse
              key={`bg-${i}`}
              cx={cx}
              cy={250}
              rx={r}
              ry={r * 0.85}
              fill="#0e3d20"
              opacity={0.7}
            />
          );
        })}
        {Array.from({ length: 14 }).map((_, i) => {
          const cx = 30 + i * 70 + (i % 2) * 18;
          return (
            <g key={`mid-${i}`} fill="#1f6b3a">
              <ellipse cx={cx} cy={310} rx={36} ry={28} />
              <ellipse cx={cx + 14} cy={300} rx={26} ry={22} fill="#2d8a4d" />
              <ellipse cx={cx - 10} cy={305} rx={24} ry={20} fill="#2a7d44" />
            </g>
          );
        })}
        {[120, 320, 540, 760, 920].map((cx, i) => (
          <g key={`fg-${i}`}>
            <rect x={cx - 3} y={355} width={6} height={45} fill="#3a2410" />
            <ellipse cx={cx} cy={350} rx={50} ry={42} fill="#2e8b4a" />
            <ellipse cx={cx + 12} cy={335} rx={38} ry={34} fill="#3da55a" />
            <ellipse cx={cx - 14} cy={340} rx={32} ry={28} fill="#34944f" />
            <ellipse cx={cx + 4} cy={325} rx={22} ry={20} fill="#5cc26d" />
          </g>
        ))}
      </svg>
      {/* Sun rays */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-screen"
        style={{
          background:
            "radial-gradient(ellipse at 70% 0%, rgba(163, 230, 53, 0.6), transparent 60%)",
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
