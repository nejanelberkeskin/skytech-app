"use client";

import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import Image from "next/image";
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

function BarrenLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Image
        src="/images/before-after/manavgat-2021.webp"
        alt="Manavgat 2021 yangın sonrası"
        fill
        sizes="(max-width: 1024px) 100vw, 80vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0 opacity-25 mix-blend-multiply pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.4) 100%)",
        }}
      />
    </div>
  );
}

function ForestLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Image
        src="/images/before-after/manavgat-2026.webp"
        alt="Manavgat 2026 yeşil yeniden ormanlaştırma"
        fill
        sizes="(max-width: 1024px) 100vw, 80vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0 opacity-15 mix-blend-screen pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 70% 0%, rgba(163, 230, 53, 0.5), transparent 60%)",
        }}
      />
    </div>
  );
}
