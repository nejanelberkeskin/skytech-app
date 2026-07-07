"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import SectionHeading from "../SectionHeading";

/**
 * MagicLens — fareyi/parmağı takip eden "Önce / Sonra" maskesi.
 *
 * Arka planda yanmış / çorak alan sahnesi; imlecin altında dairesel mercek
 * içinde yemyeşil orman görünür. CSS mask-image: radial-gradient +
 * Framer Motion useMotionTemplate.
 *
 * Mercek yarıçapı konteyner genişliğine göre ölçeklenir (genişliğin ~%22'si,
 * 70–200px aralığında): masaüstünde eski 200px korunur, mobilde parmakla
 * gezdirirken alanı boğmayan ~80-90px'e iner.
 */
export default function MagicLens() {
  const t = useTranslations("magicLens");
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  // Responsive mercek yarıçapı — konteyner ölçüldükçe güncellenir
  const [radius, setRadius] = useState(200);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      setRadius(Math.max(70, Math.min(200, Math.round(w * 0.22))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 50% / 50% default position
  const x = useMotionValue(50);
  const y = useMotionValue(50);
  const sx = useSpring(x, { damping: 24, stiffness: 280, mass: 0.4 });
  const sy = useSpring(y, { damping: 24, stiffness: 280, mass: 0.4 });

  // mask-image string with live coordinates (percentage based)
  const maskImage = useMotionTemplate`radial-gradient(circle ${radius}px at ${sx}% ${sy}%, black 0%, black 60%, transparent 100%)`;

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
          badge={t("badge")}
          title={
            <>
              {t("title")}
              <br />
              <span className="text-gradient-aurora">{t("titleAccent")}</span>
            </>
          }
          subtitle={t("subtitle")}
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

          {/* Lens ring — boyutlar mercek yarıçapıyla ölçeklenir */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              left: useMotionTemplate`calc(${sx}% - ${radius}px)`,
              top: useMotionTemplate`calc(${sy}% - ${radius}px)`,
              width: radius * 2,
              height: radius * 2,
              opacity: active ? 1 : 0,
            }}
            animate={{ opacity: active ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Inner glow ring */}
            <div
              className="absolute rounded-full ring-2 ring-white/40 ring-offset-0 shadow-[0_0_60px_rgba(34,197,94,0.4)]"
              style={{ inset: Math.round(radius * 0.3) }}
            />
            {/* Outer subtle ring */}
            <div
              className="absolute rounded-full ring-1 ring-white/15"
              style={{ inset: Math.round(radius * 0.2) }}
            />
          </motion.div>

          {/* Hint label */}
          <motion.div
            className="absolute top-6 left-6 px-3.5 py-1.5 rounded-full premium-glass-dark text-[10px] font-bold uppercase tracking-[0.2em] text-[#a7d4a7] pointer-events-none"
            animate={{ opacity: active ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
              {t("hint")}
            </span>
          </motion.div>

          {/* Labels */}
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-xs font-bold uppercase tracking-[0.2em] pointer-events-none">
            <span className="px-3 py-1.5 rounded-full premium-glass-dark text-[#fda4af]">
              {t("labelBefore")}
            </span>
            <span className="px-3 py-1.5 rounded-full premium-glass-dark text-[#a3e635]">
              {t("labelAfter")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function BarrenScene() {
  const t = useTranslations("magicLens");
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Image
        src="/images/lens/lens-burnt.webp"
        alt={t("barrenAlt")}
        fill
        sizes="(max-width: 1024px) 100vw, 80vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0 opacity-25 mix-blend-multiply pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </div>
  );
}

function ForestScene() {
  const t = useTranslations("magicLens");
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Image
        src="/images/lens/lens-forest.webp"
        alt={t("forestAlt")}
        fill
        sizes="(max-width: 1024px) 100vw, 80vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0 opacity-20 mix-blend-screen pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(163, 230, 53, 0.4), transparent 60%)",
        }}
      />
      {/* Misty highlights — kept for atmosphere */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
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

