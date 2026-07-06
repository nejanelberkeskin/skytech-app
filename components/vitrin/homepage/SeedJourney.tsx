"use client";

import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useRef } from "react";
import { useTranslations } from "next-intl";

/**
 * SeedJourney — Tohumun yolculuğu scrollytelling (tamamen kod animasyonu).
 *
 * Sticky sahnede scroll ilerlemesiyle üç perde:
 *  1. Laboratuvar  — tohum topu analiz altında: tarama halkası, HUD
 *  2. Drone        — hazneden bırakılış: hızlanan dönüş, hareket izi, hız çizgileri
 *  3. Toprak       — çarpma: squash + toz patlaması + çift şok dalgası,
 *                    ardından çatlaktan büyüyen filiz (pathLength scrub)
 *
 * Tüm ana hareketler scroll'a bağlıdır (useTransform); yalnızca ortam
 * animasyonları (tarama halkası dönüşü, süzülen sporlar) süreklidir.
 */
export default function SeedJourney() {
  const t = useTranslations("seedJourney");
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const progress = useSpring(scrollYProgress, {
    damping: 26,
    stiffness: 110,
    mass: 0.4,
  });

  /* ── Tohum topu yörüngesi ─────────────────────────────────────────────
     lab (küçük, yukarıda) → drone haznesi → serbest düşüş → çarpma (aşağıda) */
  const ballScale = useTransform(
    progress,
    [0, 0.32, 0.5, 0.78, 0.84, 1],
    [0.55, 0.9, 0.95, 1.15, 1.05, 1.1]
  );
  const ballY = useTransform(
    progress,
    [0, 0.32, 0.5, 0.78, 1],
    ["-24%", "-14%", "-18%", "52%", "52%"]
  );
  // Çarpma anında squash (basılma) — X genişler, Y kısalır
  const ballScaleY = useTransform(progress, [0.76, 0.8, 0.86], [1, 0.78, 1]);
  const ballScaleX = useTransform(progress, [0.76, 0.8, 0.86], [1, 1.18, 1]);
  // Düşüşte hızlanan dönüş
  const ballRotate = useTransform(progress, [0, 0.5, 0.8, 1], [0, 120, 480, 480]);
  // Glow: lab'da soğuk/zayıf, düşüşte artar, çarpmada patlar, filizde yumuşar
  const glow = useTransform(progress, [0, 0.5, 0.78, 0.84, 1], [0.25, 0.45, 0.9, 1, 0.5]);
  const glowShadow = useTransform(
    glow,
    (v) => `0 0 ${Math.round(v * 70)}px ${Math.round(v * 26)}px rgba(34, 197, 94, ${v * 0.55})`
  );

  /* ── Düşüş efektleri ── */
  const trailOpacity = useTransform(progress, [0.5, 0.58, 0.76, 0.8], [0, 1, 1, 0]);
  const speedLines = useTransform(progress, [0.52, 0.6, 0.74, 0.8], [0, 0.7, 0.7, 0]);

  /* ── Çarpma efektleri ── */
  const shock1Scale = useTransform(progress, [0.78, 0.95], [0.2, 4]);
  const shock1Opacity = useTransform(progress, [0.78, 0.84, 0.96], [0, 0.8, 0]);
  const shock2Scale = useTransform(progress, [0.81, 1], [0.2, 5.5]);
  const shock2Opacity = useTransform(progress, [0.81, 0.87, 1], [0, 0.5, 0]);
  const dustProgress = useTransform(progress, [0.78, 0.96], [0, 1]);

  /* ── Filiz büyümesi (çarpma sonrası) ── */
  const sproutGrow = useTransform(progress, [0.84, 0.97], [0, 1]);
  const leafGrow = useTransform(progress, [0.9, 1], [0, 1]);
  const crackOpen = useTransform(progress, [0.8, 0.92], [0, 1]);

  /* ── Sahne görünürlükleri ── */
  const lab = useTransform(progress, [0, 0.25, 0.4], [1, 1, 0]);
  const drone = useTransform(progress, [0.25, 0.4, 0.6, 0.75], [0, 1, 1, 0]);
  const impact = useTransform(progress, [0.6, 0.8, 1], [0, 1, 1]);
  const scanOpacity = useTransform(progress, [0, 0.28, 0.38], [1, 1, 0]);

  return (
    <section
      ref={ref}
      className="relative bg-white"
      style={{ height: "300vh" }}
      aria-label={t("ariaLabel")}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="absolute inset-0 mesh-dark grain-overlay" />
        <div className="aurora-bg">
          <div className="aurora-blob aurora-blob-1" />
          <div className="aurora-blob aurora-blob-2" />
        </div>

        {/* Ortam: süzülen spor tanecikleri */}
        <AmbientSpores />

        {/* Sahne arka planları */}
        <motion.div style={{ opacity: lab }} className="absolute inset-0 pointer-events-none">
          <LabScene />
        </motion.div>
        <motion.div style={{ opacity: drone }} className="absolute inset-0 pointer-events-none">
          <DroneScene />
        </motion.div>
        <motion.div style={{ opacity: impact }} className="absolute inset-0 pointer-events-none">
          <ImpactScene />
        </motion.div>

        {/* ── Merkez: tohum topu + efektler ── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            {/* Şok dalgaları — çarpma noktasında */}
            <motion.div
              style={{ scale: shock1Scale, opacity: shock1Opacity, y: "52%" }}
              className="absolute left-1/2 top-1/2 -ml-20 -mt-20 w-40 h-40 rounded-full border-2 border-[#a3e635]"
            />
            <motion.div
              style={{ scale: shock2Scale, opacity: shock2Opacity, y: "52%" }}
              className="absolute left-1/2 top-1/2 -ml-20 -mt-20 w-40 h-40 rounded-full border border-[#34d399]"
            />

            {/* Toz patlaması — 8 parçacık */}
            {DUST.map((d, i) => (
              <DustParticle key={i} progress={dustProgress} dx={d.dx} dy={d.dy} size={d.size} />
            ))}

            {/* Hareket izi (düşüş) — 3 hayalet kopya */}
            {[0.5, 0.32, 0.18].map((op, i) => (
              <GhostTrail
                key={i}
                ballY={ballY}
                trailOpacity={trailOpacity}
                offset={(i + 1) * 9}
                relOpacity={op}
              />
            ))}

            {/* Hız çizgileri */}
            <motion.div
              style={{ opacity: speedLines, y: ballY }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-56"
            >
              {[14, 38, 62, 86].map((x, i) => (
                <span
                  key={x}
                  className="absolute w-px bg-gradient-to-b from-transparent via-[#a7d4a7]/60 to-transparent"
                  style={{ left: `${x}%`, top: i % 2 ? "-30%" : "-45%", height: "60%" }}
                />
              ))}
            </motion.div>

            {/* Tarama halkası — yalnız lab perdesinde */}
            <motion.div
              style={{ opacity: scanOpacity, y: ballY }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
                className="w-56 h-56 rounded-full border border-dashed border-[#34d399]/40"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                className="absolute inset-4 rounded-full border border-dotted border-[#a3e635]/30"
              />
              {/* Tarama noktaları */}
              {[0, 90, 180, 270].map((deg) => (
                <span
                  key={deg}
                  className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-[#34d399]"
                  style={{ transform: `rotate(${deg}deg) translateY(-112px)` }}
                />
              ))}
            </motion.div>

            {/* Tohum topu */}
            <motion.div
              style={{ scale: ballScale, y: ballY }}
              className="relative"
            >
              <motion.div
                style={{ scaleX: ballScaleX, scaleY: ballScaleY, boxShadow: glowShadow }}
                className="relative w-40 h-40 rounded-full"
              >
                <motion.div style={{ rotate: ballRotate }} className="absolute inset-0">
                  <SeedBallSVG crackOpen={crackOpen} />
                </motion.div>
              </motion.div>

              {/* Filiz — topun tepesinden büyür (dönüşten bağımsız) */}
              <Sprout grow={sproutGrow} leaves={leafGrow} />
            </motion.div>
          </div>
        </div>

        <SceneCaption progress={progress} />
        <ProgressBar progress={progress} />
      </div>
    </section>
  );
}

/* ── Tohum topu SVG — katmanlı kil dokusu + açılan çatlaklar ─────────── */
function SeedBallSVG({ crackOpen }: { crackOpen: MotionValue<number> }) {
  const crackWidth = useTransform(crackOpen, [0, 1], [0.8, 2.6]);
  const crackGlow = useTransform(crackOpen, [0, 1], [0, 0.9]);
  return (
    <svg viewBox="0 0 160 160" className="w-full h-full">
      <defs>
        <radialGradient id="sj-clay" cx="32%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#c9a06f" />
          <stop offset="38%" stopColor="#8a5a30" />
          <stop offset="78%" stopColor="#4a2f18" />
          <stop offset="100%" stopColor="#241407" />
        </radialGradient>
        <radialGradient id="sj-sheen" cx="30%" cy="24%" r="36%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="76" fill="url(#sj-clay)" />
      <circle cx="80" cy="80" r="76" fill="url(#sj-sheen)" />
      {/* Kil dokusu benekleri */}
      {[
        [46, 58, 3], [104, 44, 2.4], [120, 92, 3.4], [62, 112, 2.6],
        [90, 70, 2], [38, 88, 2.2], [104, 124, 2.8], [72, 38, 2.2],
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#2e1b0c" opacity={0.5} />
      ))}
      {/* Çarpmayla açılan çatlaklar — içinden yeşil ışık sızar */}
      <motion.g style={{ strokeWidth: crackWidth }} stroke="#180d05" fill="none" strokeLinecap="round">
        <path d="M52 34 Q62 52 56 70 M92 26 Q98 46 112 56 M118 96 Q102 104 98 122 M44 100 Q56 108 54 128" />
      </motion.g>
      <motion.g style={{ opacity: crackGlow, strokeWidth: 1.2 }} stroke="#a3e635" fill="none" strokeLinecap="round">
        <path d="M52 34 Q62 52 56 70 M92 26 Q98 46 112 56 M118 96 Q102 104 98 122 M44 100 Q56 108 54 128" />
      </motion.g>
    </svg>
  );
}

/* ── Filiz: gövde pathLength ile büyür, yapraklar açılır ─────────────── */
function Sprout({ grow, leaves }: { grow: MotionValue<number>; leaves: MotionValue<number> }) {
  const stemOpacity = useTransform(grow, [0, 0.05], [0, 1]);
  const leafScale = useTransform(leaves, [0, 1], [0, 1]);
  const leafRotL = useTransform(leaves, [0, 1], [30, 0]);
  const leafRotR = useTransform(leaves, [0, 1], [-30, 0]);
  return (
    <motion.svg
      viewBox="0 0 120 140"
      style={{ opacity: stemOpacity }}
      className="absolute left-1/2 -translate-x-1/2 -top-[74px] w-[120px] h-[140px] overflow-visible"
    >
      {/* Gövde */}
      <motion.path
        d="M60 138 C60 108 56 88 60 62"
        fill="none"
        stroke="#4ade80"
        strokeWidth={5}
        strokeLinecap="round"
        style={{ pathLength: grow }}
      />
      {/* Sol yaprak */}
      <motion.g style={{ scale: leafScale, rotate: leafRotL, originX: "60px", originY: "70px" }}>
        <path
          d="M60 70 C40 66 28 50 30 34 C48 36 60 50 60 70Z"
          fill="#34d399"
          opacity={0.95}
        />
        <path d="M60 70 C48 58 40 48 34 38" stroke="#166534" strokeWidth={1.4} fill="none" opacity={0.5} />
      </motion.g>
      {/* Sağ yaprak */}
      <motion.g style={{ scale: leafScale, rotate: leafRotR, originX: "60px", originY: "62px" }}>
        <path
          d="M60 62 C80 58 92 42 90 26 C72 28 60 42 60 62Z"
          fill="#a3e635"
          opacity={0.95}
        />
        <path d="M60 62 C72 50 80 40 86 30" stroke="#3f6212" strokeWidth={1.4} fill="none" opacity={0.5} />
      </motion.g>
      {/* Tepe ışıltısı */}
      <motion.circle cx="60" cy="60" r="3" fill="#d9f99d" style={{ scale: leafScale }} />
    </motion.svg>
  );
}

/* ── Toz parçacığı — çarpma noktasından radyal saçılır ────────────────── */
const DUST = [
  { dx: -90, dy: -34, size: 7 }, { dx: -62, dy: -58, size: 5 },
  { dx: -28, dy: -74, size: 6 }, { dx: 24, dy: -76, size: 5 },
  { dx: 58, dy: -60, size: 7 }, { dx: 92, dy: -30, size: 5 },
  { dx: -104, dy: -8, size: 4 }, { dx: 106, dy: -6, size: 4 },
];

function DustParticle({
  progress,
  dx,
  dy,
  size,
}: {
  progress: MotionValue<number>;
  dx: number;
  dy: number;
  size: number;
}) {
  const x = useTransform(progress, [0, 1], [0, dx]);
  const y = useTransform(progress, [0, 1], [0, dy + 26]);
  const opacity = useTransform(progress, [0, 0.15, 0.7, 1], [0, 0.9, 0.5, 0]);
  const scale = useTransform(progress, [0, 0.4, 1], [0.4, 1, 1.6]);
  return (
    <motion.span
      style={{ x, y, opacity, scale, width: size, height: size, top: "calc(50% + 52%)", left: "50%" }}
      className="absolute rounded-full bg-[#c9a06f]"
    />
  );
}

/* ── Hayalet iz — düşüş sırasında topun ardında soluk kopyalar ───────── */
function GhostTrail({
  ballY,
  trailOpacity,
  offset,
  relOpacity,
}: {
  ballY: MotionValue<string>;
  trailOpacity: MotionValue<number>;
  offset: number;
  relOpacity: number;
}) {
  const y = useTransform(ballY, (v) => `calc(${v} - ${offset}%)`);
  const opacity = useTransform(trailOpacity, (v) => v * relOpacity);
  return (
    <motion.div
      style={{ y, opacity }}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full"
    >
      <div
        className="w-full h-full rounded-full blur-[2px]"
        style={{
          background:
            "radial-gradient(circle at 32% 30%, rgba(201,160,111,0.7) 0%, rgba(74,47,24,0.55) 60%, rgba(36,20,7,0.4) 100%)",
        }}
      />
    </motion.div>
  );
}

/* ── Ortam sporları — sahnede yavaşça süzülen ışık tanecikleri ───────── */
function AmbientSpores() {
  const spores = [
    { left: "12%", delay: 0, dur: 11 }, { left: "26%", delay: 3, dur: 14 },
    { left: "44%", delay: 6, dur: 12 }, { left: "63%", delay: 1.5, dur: 15 },
    { left: "78%", delay: 4.5, dur: 13 }, { left: "90%", delay: 7.5, dur: 16 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {spores.map((s, i) => (
        <motion.span
          key={i}
          initial={{ y: "105vh", opacity: 0 }}
          animate={{ y: "-8vh", opacity: [0, 0.5, 0.5, 0] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: "linear" }}
          style={{ left: s.left }}
          className="absolute w-1 h-1 rounded-full bg-[#a3e635]/60 shadow-[0_0_8px_rgba(163,230,53,0.6)]"
        />
      ))}
    </div>
  );
}

function LabScene() {
  const t = useTranslations("seedJourney");
  return (
    <div className="absolute inset-0">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-40">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <pattern id="lab-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#22894a" strokeOpacity="0.4" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="200" height="200" fill="url(#lab-grid)" />
          {[60, 80, 100].map((r) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#34d399" strokeWidth="0.4" strokeDasharray="2 3" opacity="0.5" />
          ))}
          <line x1="100" y1="0" x2="100" y2="200" stroke="#34d399" strokeWidth="0.3" opacity="0.4" />
          <line x1="0" y1="100" x2="200" y2="100" stroke="#34d399" strokeWidth="0.3" opacity="0.4" />
        </svg>
      </div>
      <div className="absolute top-12 left-12 text-[10px] uppercase tracking-[0.2em] text-[#34d399]/70 font-bold">
        {t("lab.hudTopLeft")}
      </div>
      <div className="absolute bottom-32 right-12 text-[10px] uppercase tracking-[0.2em] text-[#34d399]/70 font-bold tabular-nums text-right">
        {t("lab.hudBottomRight")}
      </div>
    </div>
  );
}

function DroneScene() {
  const t = useTranslations("seedJourney");
  return (
    <div className="absolute inset-0">
      {/* Drone silueti — pervaneler sürekli döner */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2">
        <svg width="300" height="130" viewBox="0 0 300 130" className="opacity-85">
          <g fill="#0e2519" stroke="#34d399" strokeOpacity="0.35" strokeWidth="1">
            <rect x="110" y="34" width="80" height="42" rx="9" fill="#0a1f12" />
            <rect x="130" y="44" width="40" height="22" rx="3" fill="#22894a" opacity="0.4" />
            <line x1="70" y1="42" x2="110" y2="52" />
            <line x1="230" y1="42" x2="190" y2="52" />
            <line x1="70" y1="102" x2="110" y2="68" />
            <line x1="230" y1="102" x2="190" y2="68" />
            {/* Bırakma kapağı */}
            <path d="M140 76 L140 100 L160 100 L160 76 Z" fill="#1f3d2a" stroke="#34d399" strokeOpacity="0.5" />
          </g>
          {/* Dönen pervaneler */}
          {[
            [52, 42], [248, 42], [52, 102], [248, 102],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r={i < 2 ? 34 : 24} fill="none" stroke="#34d399" strokeOpacity="0.15" strokeDasharray="2 4" />
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                style={{ originX: `${cx}px`, originY: `${cy}px` }}
              >
                <line x1={cx - (i < 2 ? 30 : 20)} y1={cy} x2={cx + (i < 2 ? 30 : 20)} y2={cy} stroke="#a7d4a7" strokeOpacity="0.55" strokeWidth="2" />
              </motion.g>
              <circle cx={cx} cy={cy} r="3" fill="#22894a" />
            </g>
          ))}
        </svg>
      </div>
      {/* GPS huzmesi — nabız gibi atar */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[360px] h-80">
        <motion.svg
          viewBox="0 0 360 320"
          className="w-full h-full"
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <defs>
            <linearGradient id="gps-ray" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M180 0 L100 320 L260 320 Z" fill="url(#gps-ray)" />
        </motion.svg>
      </div>
      <div className="absolute top-48 right-12 text-[10px] uppercase tracking-[0.2em] text-[#34d399]/70 font-bold tabular-nums text-right">
        RTK · 36.78°N · 31.43°E
      </div>
      <div className="absolute bottom-32 left-12 text-[10px] uppercase tracking-[0.2em] text-[#34d399]/70 font-bold">
        {t("drone.hudBottomLeft")}
      </div>
    </div>
  );
}

function ImpactScene() {
  const t = useTranslations("seedJourney");
  return (
    <div className="absolute inset-0">
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(20, 60, 30, 0.7) 50%, rgba(10, 40, 20, 1) 100%)",
        }}
      />
      {/* Filizlenen siluetler */}
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
        {t("impact.hudBottomLeft")}
      </div>
    </div>
  );
}

function SceneCaption({ progress }: { progress: MotionValue<number> }) {
  const t = useTranslations("seedJourney");
  const opacity1 = useTransform(progress, [0, 0.25, 0.4], [1, 1, 0]);
  const opacity2 = useTransform(progress, [0.3, 0.45, 0.65, 0.75], [0, 1, 1, 0]);
  const opacity3 = useTransform(progress, [0.65, 0.8, 1], [0, 1, 1]);

  return (
    <div className="absolute top-1/2 left-8 lg:left-20 -translate-y-1/2 hidden md:block z-20 w-[min(40vw,26rem)]">
      {/* Sabit yükseklikli sahne: üç caption üst üste, hepsi AYNI boyutta kutu */}
      <div className="relative h-[240px] lg:h-[260px]">
        <motion.div style={{ opacity: opacity1 }} className="absolute inset-0">
          <Caption step="01" title={t("captions.lab.title")} desc={t("captions.lab.desc")} />
        </motion.div>
        <motion.div style={{ opacity: opacity2 }} className="absolute inset-0">
          <Caption step="02" title={t("captions.drone.title")} desc={t("captions.drone.desc")} />
        </motion.div>
        <motion.div style={{ opacity: opacity3 }} className="absolute inset-0">
          <Caption step="03" title={t("captions.impact.title")} desc={t("captions.impact.desc")} />
        </motion.div>
      </div>
    </div>
  );
}

function Caption({ step, title, desc }: { step: string; title: string; desc: string }) {
  const t = useTranslations("seedJourney");
  return (
    <div className="premium-glass-dark rounded-2xl p-6 h-full flex flex-col overflow-hidden">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3e635] mb-2">
        {t("stepLabel")} {step}
      </p>
      <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3 tracking-tight">{title}</h3>
      <p className="text-sm text-[#a7d4a7] leading-relaxed">{desc}</p>
    </div>
  );
}

function ProgressBar({ progress }: { progress: MotionValue<number> }) {
  const t = useTranslations("seedJourney");
  const width = useTransform(progress, (v) => `${v * 100}%`);
  return (
    <div className="absolute bottom-12 left-12 right-12 lg:left-20 lg:right-20 z-20">
      <div className="flex items-baseline justify-between mb-2 text-[10px] uppercase tracking-[0.2em] font-bold">
        <span className="text-[#a7d4a7]">{t("progress.label")}</span>
        <span className="text-[#34d399] hidden md:block">{t("progress.steps")}</span>
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
