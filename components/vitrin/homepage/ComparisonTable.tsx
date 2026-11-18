"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import SectionWrapper from "../SectionWrapper";
import SectionHeading from "../SectionHeading";

export default function ComparisonTable() {
  const t = useTranslations("comparisonTable");
  const TRADITIONAL = [
    t("traditional.items.manual"),
    t("traditional.items.damage"),
    t("traditional.items.untraceable"),
    t("traditional.items.reporting"),
    t("traditional.items.speed"),
  ];
  const SKYTECH = [
    t("skytech.items.access"),
    t("skytech.items.noTrace"),
    t("skytech.items.verified"),
    t("skytech.items.reporting"),
    t("skytech.items.distribution"),
  ];
  return (
    <SectionWrapper variant="light" className="relative overflow-hidden">
      <div className="relative">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7 max-w-5xl mx-auto">
          {/* Traditional */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-white border border-[#14261a]/12 rounded-xl overflow-hidden flex flex-col"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src="/images/comparison/geleneksel-agaclandirma.webp"
                alt={t("traditional.imageAlt")}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="p-7 lg:p-9 flex-1 flex flex-col">
              <div className="flex items-center gap-3 pb-5 border-b border-[#14261a]/10">
                <div className="w-11 h-11 rounded-lg bg-[#b42318]/8 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#b42318]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#14261a] tracking-tight">{t("traditional.heading")}</h3>
              </div>
              <ul>
                {TRADITIONAL.map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.06 }}
                    className="flex items-start gap-3 py-3.5 text-sm text-[#3d5a3d] border-b border-[#14261a]/10 last:border-b-0 last:pb-0"
                  >
                    <CrossIcon className="w-5 h-5 text-[#b42318] shrink-0 mt-0.5" />
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
            className="relative bg-white border-2 border-[#1B6B3A] rounded-xl overflow-hidden flex flex-col"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src="/images/comparison/skytech-drone-ekim.webp"
                alt={t("skytech.imageAlt")}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="relative p-7 lg:p-9 flex-1 flex flex-col bg-[#1B6B3A]/5">
              <div className="flex items-center gap-3 pb-5 border-b border-[#14261a]/10">
                <div className="w-11 h-11 rounded-lg bg-[#1B6B3A] flex items-center justify-center">
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
                <h3 className="text-xl font-bold text-[#14261a] tracking-tight">Skytech Green</h3>
              </div>
              <ul>
                {SKYTECH.map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: 8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.35 + i * 0.06 }}
                    className="flex items-start gap-3 py-3.5 text-sm text-[#14261a] border-b border-[#14261a]/10 last:border-b-0 last:pb-0"
                  >
                    <CheckCircleIcon className="w-5 h-5 text-[#1B6B3A] shrink-0 mt-0.5" />
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
