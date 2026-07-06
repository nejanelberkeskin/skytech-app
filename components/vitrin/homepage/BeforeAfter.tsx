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
    <section className="relative bg-[#f8faf5] vitrin-section">
      <div className="vitrin-container">
        <SectionHeading
          badge={t("badge")}
          title={
            <>
              {t("titleLine1")}
              <br />
              <span className="text-gradient-aurora">{t("titleAccent")}</span>
            </>
          }
        />

        <div
          ref={ref}
          className="relative aspect-[16/9] max-w-6xl mx-auto rounded-3xl overflow-hidden shadow-2xl"
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
            <div
              className="absolute inset-0 opacity-25 mix-blend-multiply pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.4) 100%)",
              }}
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
              <div
                className="absolute inset-0 opacity-15 mix-blend-screen pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at 30% 0%, rgba(163, 230, 53, 0.5), transparent 60%)",
                }}
              />
            </div>
          </motion.div>

          {/* Dikey sürgü çizgisi + tutamaç — ilerlemeyi takip eder */}
          <motion.div
            style={{ left: seamLeft, opacity: seamOpacity }}
            className="absolute top-0 bottom-0 w-px pointer-events-none -translate-x-1/2 z-10"
          >
            <div className="relative h-full w-px bg-gradient-to-b from-[#a3e635] via-[#34d399] to-[#22894a] shadow-[0_0_24px_rgba(52,211,153,0.7)]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full premium-glass-dark flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.5)]">
              <svg
                className="w-6 h-6 text-[#a3e635]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path d="M8 7l-4 5 4 5M16 7l4 5-4 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </motion.div>

          {/* Rozetler — sol: yeşilin üzerinde Öncesi, sağ: yanığın üzerinde Sonrası */}
          <div className="absolute top-6 left-6 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3e635] z-20">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635]" />
              {t("labelBefore")}
            </span>
          </div>
          <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-[0.2em] text-[#fda4af] z-20">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fda4af]" />
              {t("labelAfter")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
