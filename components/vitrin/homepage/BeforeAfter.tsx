"use client";

import {
  motion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import SectionHeading from "../SectionHeading";

/**
 * BeforeAfter — scroll'a bağlı karşılaştırma sürgüsü.
 *
 * Sayfa kaydırıldıkça yeşil (yangın öncesi) görsel, yanmış arazinin üzerine
 * SOLDAN sağa doğru açılır; dikey sürgü çizgisi ilerlemeyle birlikte süpürülür.
 * Orta noktada klasik önce/sonra karşılaştırması okunur:
 *   sol yarı = yeşil  → "Yangın Öncesi" rozeti (solda)
 *   sağ yarı = yanık  → "Yangın Sonrası" rozeti (sağda)
 */
export default function BeforeAfter() {
  const t = useTranslations("beforeAfter");
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 35%"],
  });

  const smooth = useSpring(scrollYProgress, {
    damping: 28,
    stiffness: 120,
    mass: 0.4,
  });

  // Yeşil katmanın açılma yüzdesi (0 → 100)
  const revealPct = useTransform(smooth, [0, 1], [0, 100]);
  const clipPath = useTransform(revealPct, (v) => `inset(0 ${100 - v}% 0 0)`);

  // Sürgü çizgisi konumu + uçlarda kaybolma
  const seamLeft = useTransform(revealPct, (v) => `${v}%`);
  const seamOpacity = useTransform(smooth, [0, 0.04, 0.96, 1], [0, 1, 1, 0]);

  return (
    <section className="relative bg-[#f6f6f1] vitrin-section">
      <div className="vitrin-container">
        <SectionHeading
          badge={t("badge")}
          title={
            <>
              {t("titleLine1")}
              <br />
              <span className="text-[#1B6B3A]">{t("titleAccent")}</span>
            </>
          }
        />

        <div
          ref={ref}
          className="relative aspect-[16/9] max-w-6xl mx-auto rounded-xl overflow-hidden border border-[#14261a]/12 bg-[#dfe3d6]"
        >
          {/* Taban katman — yanmış arazi (Yangın Sonrası): sağ tarafta kalır */}
          <div className="absolute inset-0 overflow-hidden">
            <Image
              src="/images/before-after/manavgat-2021.webp"
              alt={t("altAfter")}
              fill
              sizes="(max-width: 1024px) 100vw, 80vw"
              className="object-cover"
            />
          </div>

          {/* Üst katman — yeşil orman (Yangın Öncesi): scroll ile SOLDAN açılır */}
          <motion.div style={{ clipPath }} className="absolute inset-0">
            <div className="absolute inset-0 overflow-hidden">
              <Image
                src="/images/before-after/manavgat-2026.webp"
                alt={t("altBefore")}
                fill
                sizes="(max-width: 1024px) 100vw, 80vw"
                className="object-cover"
              />
            </div>
          </motion.div>

          {/* Dikey sürgü çizgisi + tutamaç — ilerlemeyi takip eder */}
          <motion.div
            style={{ left: seamLeft, opacity: seamOpacity }}
            className="absolute top-0 bottom-0 w-0.5 pointer-events-none -translate-x-1/2 z-10"
          >
            <div className="relative h-full w-0.5 bg-white" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white border border-[#14261a]/25 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-[#1B6B3A]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path d="M8 7l-4 5 4 5M16 7l4 5-4 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </motion.div>

          {/* Etiketler — sol: yeşilin üzerinde Öncesi, sağ: yanığın üzerinde Sonrası */}
          <div className="absolute top-3 left-3 sm:top-6 sm:left-6 px-2.5 py-1.5 rounded-md bg-[#14261a]/80 text-[10px] font-semibold uppercase tracking-[0.16em] text-white z-20">
            {t("labelBefore")}
          </div>
          <div className="absolute top-3 right-3 sm:top-6 sm:right-6 px-2.5 py-1.5 rounded-md bg-[#14261a]/80 text-[10px] font-semibold uppercase tracking-[0.16em] text-white z-20">
            {t("labelAfter")}
          </div>
        </div>
      </div>
    </section>
  );
}
