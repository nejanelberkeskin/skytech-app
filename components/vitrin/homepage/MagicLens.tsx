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
 * içinde yemyeşil orman görünür. CSS mask-image: radial-gradient (keskin
 * kenarlı daire) + Framer Motion useMotionTemplate. Merceğin kenarı düz
 * 2px beyaz çizgidir.
 *
 * Mercek yarıçapı konteyner genişliğine göre ölçeklenir (genişliğin ~%22'si,
 * 70–200px aralığında): masaüstünde eski 200px korunur, mobilde parmakla
 * gezdirirken alanı boğmayan ~80-90px'e iner.
 */
export default function MagicLens() {
  const seo = useTranslations("seoContent");
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
  const maskImage = useMotionTemplate`radial-gradient(circle ${radius}px at ${sx}% ${sy}%, black 0, black calc(100% - 1px), transparent 100%)`;

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(((e.clientX - rect.left) / rect.width) * 100);
    y.set(((e.clientY - rect.top) / rect.height) * 100);
  };

  return (
    <section className="relative overflow-hidden vitrin-section bg-white">
      <div className="vitrin-container">
        <p className="mb-6 text-center text-sm leading-relaxed text-[#3d5a3d]">{seo("illustration")}</p>
        <SectionHeading
          badge={t("badge")}
          title={
            <>
              {t("title")}
              <br />
              <span className="text-[#1B6B3A]">{t("titleAccent")}</span>
            </>
          }
          subtitle={t("subtitle")}
        />

        <div
          ref={containerRef}
          onPointerMove={handleMove}
          onPointerEnter={() => setActive(true)}
          onPointerLeave={() => setActive(false)}
          className="relative aspect-[16/9] max-w-6xl mx-auto rounded-xl overflow-hidden cursor-none border border-[#14261a]/12"
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
            {/* Mercek kenarı — maskenin sınırıyla aynı çapta düz çizgi */}
            <div className="absolute inset-0 rounded-full border-2 border-white" />
          </motion.div>

          {/* Hint label */}
          <motion.div
            className="absolute top-4 left-4 sm:top-6 sm:left-6 px-2.5 py-1.5 rounded-md bg-[#14261a]/80 text-white text-[10px] font-semibold uppercase tracking-[0.16em] pointer-events-none"
            animate={{ opacity: active ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          >
            {t("hint")}
          </motion.div>

          {/* Labels */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex items-center justify-between gap-3 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.16em] pointer-events-none">
            <span className="px-2.5 py-1.5 rounded-md bg-[#14261a]/80 text-white">
              {t("labelBefore")}
            </span>
            <span className="px-2.5 py-1.5 rounded-md bg-[#1B6B3A] text-white">
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
    </div>
  );
}

