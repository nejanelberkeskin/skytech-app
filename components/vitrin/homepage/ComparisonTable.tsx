"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import SectionWrapper from "../SectionWrapper";
import SectionHeading from "../SectionHeading";

const TRADITIONAL = [
  "İnsan gücüyle, zorlu coğrafyalarda yetersiz",
  "Saha tahribatı kaçınılmaz",
  "Tedarik zinciri belgesiz, izlenemez",
  "Manuel raporlama, denetim zayıf",
  "Dakika başına 2-3 fidan dikim hızı",
];

const SKYTECH = [
  "Drone teknolojisiyle her bölgeye erişim",
  "Sıfır saha izi, ekosistem korunur",
  "Ağaçtan toplanma tarihi + orijin blok zinciri ile doğrulanır",
  "Yıllık drone raporlama, ESG entegre",
  "Bir uçuşta 200+ tohum dağıtımı",
];

export default function ComparisonTable() {
  return (
    <SectionWrapper variant="light" className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 mesh-gradient opacity-40 pointer-events-none" />

      <div className="relative">
        <SectionHeading
          badge="Karşılaştırma"
          title={
            <>
              Geleneksel Yöntem vs.
              <br />
              <span className="text-gradient-aurora">Skytech Green</span>
            </>
          }
          subtitle="Ölçülebilir farkları yan yana koyduk. Karar sizin."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7 max-w-5xl mx-auto">
          {/* Traditional */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-white border border-black/8 rounded-3xl overflow-hidden flex flex-col"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src="/images/comparison/geleneksel-agaclandirma.webp"
                alt="Geleneksel ağaçlandırma — elle ekim"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#dc2626]/60 to-[#dc2626]/15 z-10" />
            </div>
            <div className="p-7 lg:p-9 flex-1 flex flex-col">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-xl bg-[#dc2626]/8 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#dc2626]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[#0e2519] tracking-tight">Geleneksel Ağaçlandırma</h3>
            </div>
            <ul className="space-y-4">
              {TRADITIONAL.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.06 }}
                  className="flex items-start gap-3 text-sm text-[#3d5a3d]"
                >
                  <CrossIcon className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
                  {item}
                </motion.li>
              ))}
            </ul>
            </div>
          </motion.div>

          {/* Skytech */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-gradient-to-br from-[#1B6B3A] via-[#22894a] to-[#1B6B3A] rounded-3xl overflow-hidden text-white shadow-2xl shadow-[#1B6B3A]/25 flex flex-col"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src="/images/comparison/skytech-drone-ekim.webp"
                alt="Skytech Green drone ekim"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1B6B3A]/95 via-[#1B6B3A]/30 to-transparent pointer-events-none" />
            </div>
            <div className="relative p-7 lg:p-9 flex-1 flex flex-col">
            {/* Shimmer band */}
            <span
              aria-hidden
              className="absolute -top-20 -left-20 w-[200%] h-40 pointer-events-none rotate-[-12deg]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                animation: "shimmer-flow 5s ease-in-out infinite",
                backgroundSize: "200% 100%",
              }}
            />
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />

            <div className="relative flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-xl font-bold tracking-tight">Skytech Green</h3>
            </div>
            <ul className="relative space-y-4">
              {SKYTECH.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.35 + i * 0.06 }}
                  className="flex items-start gap-3 text-sm text-white/90"
                >
                  <CheckCircleIcon className="w-5 h-5 text-[#a3e635] shrink-0 mt-0.5" />
                  {item}
                </motion.li>
              ))}
            </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </SectionWrapper>
  );
}

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" strokeLinecap="round" />
      <line x1="9" y1="9" x2="15" y2="15" strokeLinecap="round" />
    </svg>
  );
}
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 9 11 14 8 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
