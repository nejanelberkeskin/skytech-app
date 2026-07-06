"use client";

import { motion, useInView } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import SectionHeading from "../SectionHeading";

/**
 * BeforeAfter — görünüme girince tetiklenen clip-path reveal.
 *
 * Bölüm ekrana girdiğinde yeşil orman görseli, yanmış arazinin üzerine
 * soldan sağa doğru sıvı bir dalga gibi açılır. Scroll-scrubbing (scrollYProgress)
 * yerine tek seferlik in-view animasyon kullanılır: uzun sayfada / mobilde
 * scroll offset ölçümüne bağlı kalmadan her cihazda güvenilir çalışır.
 */
export default function BeforeAfter() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });

  // Yeşilin açılma animasyonu — yumuşak, sıvımsı sweep
  const REVEAL = { duration: 2, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <section className="relative bg-[#f8faf5] vitrin-section">
      <div className="vitrin-container">
        <SectionHeading
          badge="Yangın Öncesi / Sonrası"
          title={
            <>
              Aşağı Kaydırın —
              <br />
              <span className="text-gradient-aurora">Doğanın Geri Dönüşü</span>
            </>
          }
        />

        <div
          ref={ref}
          className="relative aspect-[16/9] max-w-6xl mx-auto rounded-3xl overflow-hidden shadow-2xl"
        >
          {/* Arka plan — yanmış arazi (Yangın Öncesi) */}
          <BarrenLayer />

          {/* Ön plan — yeşil orman (Yangın Sonrası), clip-path ile açılır */}
          <motion.div
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={inView ? { clipPath: "inset(0 0% 0 0)" } : undefined}
            transition={REVEAL}
            className="absolute inset-0"
          >
            <ForestLayer />
          </motion.div>

          {/* Dikey dikiş çizgisi — reveal ile birlikte soldan sağa süpürülür */}
          <motion.div
            initial={{ left: "0%", opacity: 0 }}
            animate={inView ? { left: "100%", opacity: [0, 1, 1, 0] } : undefined}
            transition={REVEAL}
            className="absolute top-0 bottom-0 w-px pointer-events-none -translate-x-1/2"
          >
            <div className="relative h-full w-px bg-gradient-to-b from-[#a3e635] via-[#34d399] to-[#22894a] shadow-[0_0_24px_rgba(52,211,153,0.7)]" />
            {/* Dikiş tutamağı */}
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

          {/* Etiketler */}
          <div className="absolute top-6 left-6 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-[0.2em] text-[#fda4af] z-10">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fda4af]" />
              Yangın Öncesi
            </span>
          </div>
          <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3e635] z-10">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635] animate-pulse" />
              Yangın Sonrası
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function BarrenLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Image
        src="/images/before-after/manavgat-2021.webp"
        alt="Yangın öncesi çorak arazi"
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
        alt="Yangın sonrası yeşeren orman"
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
