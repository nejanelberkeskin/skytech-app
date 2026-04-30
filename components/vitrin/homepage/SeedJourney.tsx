"use client";

import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useRef } from "react";

/**
 * SeedJourney — Tohumun yolculuğu scrollytelling.
 *
 * Sticky merkez tohum topu sayfa scroll edildikçe 3 sahne arasında geçiş yapar:
 *  1. Laboratuvar (küçük, analiz)
 *  2. Drone haznesi (yukarıdan aşağı süzülür)
 *  3. Toprağa çarpma (scale + glow patlama)
 */
export default function SeedJourney() {
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Smooth scroll-linked progress
  const progress = useSpring(scrollYProgress, {
    damping: 26,
    stiffness: 110,
    mass: 0.4,
  });

  // Seed scale: 0.45 (lab) → 1 (drone) → 1.6 (impact)
  const seedScale = useTransform(progress, [0, 0.45, 0.65, 1], [0.45, 1, 1.1, 1.6]);
  // Seed Y: top (lab) → mid (drone descend) → bottom (impact)
  const seedY = useTransform(progress, [0, 0.4, 0.7, 1], ["-20%", "0%", "30%", "55%"]);
  // Seed rotate
  const seedRotate = useTransform(progress, [0, 1], [0, 360]);
  // Seed glow intensity
  const seedGlow = useTransform(
    progress,
    [0, 0.4, 0.7, 0.85, 1],
    [0.3, 0.5, 0.7, 1, 0.4]
  );

  // Scene visibility
  const lab = useTransform(progress, [0, 0.25, 0.4], [1, 1, 0]);
  const drone = useTransform(progress, [0.25, 0.4, 0.6, 0.75], [0, 1, 1, 0]);
  const impact = useTransform(progress, [0.6, 0.8, 1], [0, 1, 1]);

  // Impact shockwave
  const shockwaveScale = useTransform(progress, [0.7, 1], [0, 4]);
  const shockwaveOpacity = useTransform(progress, [0.7, 0.85, 1], [0, 0.7, 0]);

  // Caption text — pick based on progress
  const captionStep = useMotionValue(0);
  progress.on("change", (v) => {
    captionStep.set(v < 0.4 ? 0 : v < 0.7 ? 1 : 2);
  });

  return (
    <section
      ref={ref}
      className="relative bg-white"
      style={{ height: "300vh" }}
      aria-label="Tohumun yolculuğu"
    >
      {/* Sticky stage */}
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Mesh-dark base */}
        <div className="absolute inset-0 mesh-dark grain-overlay" />
        <div className="aurora-bg">
          <div className="aurora-blob aurora-blob-1" />
          <div className="aurora-blob aurora-blob-2" />
        </div>

        {/* Scene 1 — Laboratuvar */}
        <motion.div style={{ opacity: lab }} className="absolute inset-0 pointer-events-none">
          <LabScene />
        </motion.div>

        {/* Scene 2 — Drone hazne */}
        <motion.div style={{ opacity: drone }} className="absolute inset-0 pointer-events-none">
          <DroneScene />
        </motion.div>

        {/* Scene 3 — Toprağa çarpma */}
        <motion.div style={{ opacity: impact }} className="absolute inset-0 pointer-events-none">
          <ImpactScene shockwaveScale={shockwaveScale} shockwaveOpacity={shockwaveOpacity} />
        </motion.div>

        {/* Centered seed ball */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            style={{
              scale: seedScale,
              y: seedY,
              rotate: seedRotate,
            }}
            className="relative"
          >
            <motion.div
              style={{
                boxShadow: useTransform(
                  seedGlow,
                  (v) =>
                    `0 0 ${Math.round(v * 80)}px ${Math.round(v * 30)}px rgba(34, 197, 94, ${v * 0.6})`
                ),
              }}
              className="relative w-40 h-40 rounded-full"
            >
              {/* Seed ball — clay sphere with gradient */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, #c2986b 0%, #8a5a30 35%, #4a2f18 80%, #2a190a 100%)",
                  boxShadow:
                    "inset -10px -14px 30px rgba(0,0,0,0.6), inset 8px 6px 20px rgba(255,255,255,0.18)",
                }}
              />
              {/* Seed cracks */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-40">
                <path
                  d="M30 25 L45 40 M55 60 L70 75 M40 75 L25 60 M65 30 L75 45"
                  stroke="#1a0e06"
                  strokeWidth="1"
                  fill="none"
                />
              </svg>
              {/* Tiny green sprout peeking */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                <path
                  d="M50 40 Q55 25 60 30 M50 40 Q45 25 40 30"
                  stroke="#a3e635"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <circle cx="50" cy="40" r="2" fill="#34d399" />
              </svg>
            </motion.div>

            {/* GORSEL: gerçek tohum topu görseli (PNG, transparan, 256x256) buraya yerleştirilebilir */}
          </motion.div>
        </div>

        {/* Captions */}
        <SceneCaption progress={progress} />

        {/* Progress bar */}
        <ProgressBar progress={progress} />
      </div>
    </section>
  );
}

function LabScene() {
  return (
    <div className="absolute inset-0">
      {/* Lab grid + microscopes */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-40">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <pattern id="lab-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#22894a" strokeOpacity="0.4" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="200" height="200" fill="url(#lab-grid)" />
          {/* Concentric circles */}
          {[60, 80, 100].map((r) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#34d399" strokeWidth="0.4" strokeDasharray="2 3" opacity="0.5" />
          ))}
          {/* Cross-hairs */}
          <line x1="100" y1="0" x2="100" y2="200" stroke="#34d399" strokeWidth="0.3" opacity="0.4" />
          <line x1="0" y1="100" x2="200" y2="100" stroke="#34d399" strokeWidth="0.3" opacity="0.4" />
        </svg>
      </div>
      {/* HUD elements */}
      <div className="absolute top-12 left-12 text-[10px] uppercase tracking-[0.2em] text-[#34d399]/70 font-bold">
        ⊹ Lab Analiz · KIL/GÜBRE/TOHUM
      </div>
      <div className="absolute bottom-32 right-12 text-[10px] uppercase tracking-[0.2em] text-[#34d399]/70 font-bold tabular-nums text-right">
        pH 6.8 · NPK Optimal
      </div>
    </div>
  );
}

function DroneScene() {
  return (
    <div className="absolute inset-0">
      {/* Drone silhouette top */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2">
        <svg width="280" height="120" viewBox="0 0 280 120" className="opacity-80">
          <g fill="#0e2519" stroke="#34d399" strokeOpacity="0.3" strokeWidth="1">
            {/* Rotors */}
            <circle cx="40" cy="40" r="32" fill="none" strokeOpacity="0.2" strokeDasharray="2 4" />
            <circle cx="240" cy="40" r="32" fill="none" strokeOpacity="0.2" strokeDasharray="2 4" />
            <circle cx="40" cy="100" r="22" fill="none" strokeOpacity="0.15" strokeDasharray="2 4" />
            <circle cx="240" cy="100" r="22" fill="none" strokeOpacity="0.15" strokeDasharray="2 4" />
            {/* Body */}
            <rect x="100" y="30" width="80" height="40" rx="8" fill="#0a1f12" />
            <rect x="120" y="40" width="40" height="20" rx="3" fill="#22894a" opacity="0.4" />
            {/* Arms */}
            <line x1="60" y1="40" x2="100" y2="50" />
            <line x1="220" y1="40" x2="180" y2="50" />
            <line x1="60" y1="100" x2="100" y2="65" />
            <line x1="220" y1="100" x2="180" y2="65" />
            {/* Drop chute */}
            <path d="M130 70 L130 95 L150 95 L150 70 Z" fill="#1f3d2a" stroke="#34d399" strokeOpacity="0.5" />
          </g>
        </svg>
      </div>
      {/* GPS rays */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[360px] h-80">
        <svg viewBox="0 0 360 320" className="w-full h-full">
          <defs>
            <linearGradient id="gps-ray" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M180 0 L100 320 L260 320 Z" fill="url(#gps-ray)" />
        </svg>
      </div>
      <div className="absolute top-48 right-12 text-[10px] uppercase tracking-[0.2em] text-[#34d399]/70 font-bold tabular-nums text-right">
        RTK · 36.78°N · 31.43°E
      </div>
      <div className="absolute bottom-32 left-12 text-[10px] uppercase tracking-[0.2em] text-[#34d399]/70 font-bold">
        ⊹ Hassas Hedef · 200+ tohum
      </div>
    </div>
  );
}

function ImpactScene({
  shockwaveScale,
  shockwaveOpacity,
}: {
  shockwaveScale: ReturnType<typeof useTransform>;
  shockwaveOpacity: ReturnType<typeof useTransform>;
}) {
  return (
    <div className="absolute inset-0">
      {/* Ground */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(20, 60, 30, 0.7) 50%, rgba(10, 40, 20, 1) 100%)",
        }}
      />
      {/* Shockwave rings */}
      <div className="absolute inset-0 flex items-end justify-center pb-[18%] pointer-events-none">
        <motion.div
          style={{ scale: shockwaveScale, opacity: shockwaveOpacity }}
          className="w-32 h-32 rounded-full border-2 border-[#a3e635]"
        />
      </div>
      {/* Sprouting silhouettes */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full"
        viewBox="0 0 1000 200"
        preserveAspectRatio="none"
        style={{ height: "30vh" }}
      >
        {[100, 250, 380, 520, 660, 800, 920].map((cx, i) => (
          <motion.g
            key={cx}
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ delay: i * 0.15, duration: 0.8 }}
          >
            <ellipse cx={cx} cy={140} rx={36} ry={30} fill="#22894a" opacity={0.85} />
            <ellipse cx={cx + 8} cy={130} rx={26} ry={22} fill="#34d399" opacity={0.85} />
            <rect x={cx - 2} y={140} width={4} height={50} fill="#3a2410" />
          </motion.g>
        ))}
      </svg>
      <div className="absolute bottom-44 left-12 text-[10px] uppercase tracking-[0.2em] text-[#a3e635] font-bold">
        ⊹ Toprağa İndi · Çimlenme: %65+
      </div>
    </div>
  );
}

function SceneCaption({ progress }: { progress: ReturnType<typeof useSpring> }) {
  // Use opacity transforms to switch between captions
  const opacity1 = useTransform(progress, [0, 0.25, 0.4], [1, 1, 0]);
  const opacity2 = useTransform(progress, [0.3, 0.45, 0.65, 0.75], [0, 1, 1, 0]);
  const opacity3 = useTransform(progress, [0.65, 0.8, 1], [0, 1, 1]);

  return (
    <div className="absolute top-1/2 left-12 max-w-md -translate-y-1/2 lg:left-20 hidden md:block">
      <motion.div style={{ opacity: opacity1 }} className="absolute">
        <Caption
          step="01"
          title="Laboratuvar"
          desc="Ziraat mühendisleri kil + organik gübre + yerli tohum oranlarını analiz eder, tohum topunu formüle eder."
        />
      </motion.div>
      <motion.div style={{ opacity: opacity2 }} className="absolute">
        <Caption
          step="02"
          title="Dronla Yolculuk"
          desc="GPS hassasiyetli drone tohum topunu hedef koordinata otonom uçar — bir uçuşta 200+ tohum."
        />
      </motion.div>
      <motion.div style={{ opacity: opacity3 }} className="absolute">
        <Caption
          step="03"
          title="Toprağa Buluşma"
          desc="Yağmurla birlikte kil çözülür, tohum filizlenir. Çimlenme oranı %65+ — geleneksel yöntemin 3 katı."
        />
      </motion.div>
    </div>
  );
}

function Caption({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="premium-glass-dark rounded-2xl p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3e635] mb-2">
        Adım {step}
      </p>
      <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3 tracking-tight">{title}</h3>
      <p className="text-sm text-[#a7d4a7] leading-relaxed">{desc}</p>
    </div>
  );
}

function ProgressBar({ progress }: { progress: ReturnType<typeof useSpring> }) {
  const width = useTransform(progress, (v) => `${v * 100}%`);
  return (
    <div className="absolute bottom-12 left-12 right-12 lg:left-20 lg:right-20">
      <div className="flex items-baseline justify-between mb-2 text-[10px] uppercase tracking-[0.2em] font-bold">
        <span className="text-[#a7d4a7]">Tohumun Yolculuğu</span>
        <span className="text-[#34d399] hidden md:block">Lab → Drone → Toprak</span>
      </div>
      <div className="h-px bg-white/10 rounded-full overflow-hidden">
        <motion.div
          style={{ width }}
          className="h-full bg-gradient-to-r from-[#1B6B3A] via-[#22894a] to-[#34d399]"
        />
      </div>
    </div>
  );
}
