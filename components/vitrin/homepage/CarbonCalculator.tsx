"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { useMemo, useState } from "react";

export default function CarbonCalculator() {
  const [seeds, setSeeds] = useState(5000);
  const [years, setYears] = useState(10);
  const [germRate, setGermRate] = useState(65);

  const { trees, co2Total, peopleOffset } = useMemo(() => {
    const trees = Math.round((seeds * germRate) / 100);
    const co2PerTreePerYear = 5;
    const co2Total = Math.round((trees * co2PerTreePerYear * years) / 1000);
    const annualPersonFootprintTon = 4;
    const peopleOffset =
      Math.round((co2Total / (annualPersonFootprintTon * years)) * 10) / 10;
    return { trees, co2Total, peopleOffset };
  }, [seeds, years, germRate]);

  return (
    <section className="relative overflow-hidden vitrin-section mesh-dark grain-overlay">
      {/* Aurora */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      <div className="relative vitrin-container">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
          className="text-center max-w-3xl mx-auto mb-16 lg:mb-20"
        >
          <motion.div variants={itemVariants}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full premium-glass-dark mb-6 text-[11px] font-bold uppercase tracking-[0.18em] text-[#a7d4a7]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
              Karbon Hesaplayıcı
            </div>
          </motion.div>
          <motion.h2
            variants={itemVariants}
            className="display-headline text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6"
          >
            Etkinizi
            <br />
            <span className="text-gradient-aurora">Anında Görün</span>
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-base lg:text-lg text-[#a7d4a7] leading-relaxed max-w-xl mx-auto"
          >
            Tohum sayısını, yılı ve çimlenme oranını ayarlayın — kaç ağaç yetişeceğini, kaç ton karbonun nötrleneceğini canlı izleyin.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 max-w-5xl mx-auto"
        >
          {/* Sliders */}
          <motion.div variants={itemVariants} className="liquid-glass-dark rounded-3xl p-7 lg:p-9 space-y-7">
            <Slider
              label="Tohum Sayısı"
              value={seeds}
              min={500}
              max={100000}
              step={500}
              displayValue={seeds.toLocaleString("tr-TR")}
              onChange={setSeeds}
            />
            <Slider
              label="İzleme Süresi"
              value={years}
              min={1}
              max={25}
              step={1}
              displayValue={`${years} yıl`}
              onChange={setYears}
            />
            <Slider
              label="Çimlenme Oranı"
              value={germRate}
              min={40}
              max={85}
              step={1}
              displayValue={`%${germRate}`}
              onChange={setGermRate}
            />

            <p className="text-xs text-[#6b8f6b] leading-relaxed pt-3 border-t border-white/8">
              <span className="font-bold text-[#a7d4a7]">Formül:</span> Tohum × çimlenme = ağaç · Ağaç × 5kg CO₂ × yıl = toplam karbon
            </p>
          </motion.div>

          {/* Results */}
          <div className="space-y-4">
            <motion.div variants={itemVariants}>
              <ResultCard
                icon={<TreeIcon />}
                label="Yetişecek Ağaç"
                value={trees.toLocaleString("tr-TR")}
                suffix=""
                gradient="from-[#22894a] to-[#34d399]"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <ResultCard
                icon={<CloudIcon />}
                label="Nötrlenecek Karbon"
                value={co2Total.toLocaleString("tr-TR")}
                suffix="ton CO₂"
                gradient="from-[#1B6B3A] to-[#22894a]"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <ResultCard
                icon={<UserIcon />}
                label="Kişi Karbon Ayak İzi Nötrlenir"
                value={peopleOffset.toString().replace(".", ",")}
                suffix="kişi"
                gradient="from-[#34d399] to-[#a3e635]"
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <Link href="/bireysel/satin-al" className="block group">
                <motion.div
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-full py-4 rounded-2xl bg-gradient-to-br from-[#1B6B3A] via-[#22894a] to-[#1B6B3A] text-white font-bold flex items-center justify-center gap-3 shadow-xl shadow-[#1B6B3A]/30 hover:shadow-2xl transition-shadow overflow-hidden"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                      animation: "shimmer-flow 2s linear infinite",
                      backgroundSize: "200% 100%",
                    }}
                  />
                  <span className="relative inline-flex items-center gap-3">
                    Bu Etkiyi Başlat — Tohum Sipariş Et
                    <motion.svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      animate={{ x: [0, 3, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  </span>
                </motion.div>
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

function Slider({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <label className="text-sm font-bold text-white tracking-tight">{label}</label>
        <motion.span
          key={displayValue}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-base font-bold text-[#34d399] tabular-nums"
        >
          {displayValue}
        </motion.span>
      </div>
      <div className="relative">
        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#1B6B3A] via-[#22894a] to-[#34d399] rounded-full"
            style={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
          aria-label={label}
        />
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-lg pointer-events-none ring-2 ring-[#34d399]/40"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ResultCard({
  icon,
  label,
  value,
  suffix,
  gradient,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix: string;
  gradient: string;
}) {
  return (
    <div className="liquid-glass-dark rounded-2xl p-5 flex items-center gap-5 transition-shadow duration-500 hover:shadow-2xl hover:shadow-[#22894a]/15">
      <div
        className={`shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-[#a7d4a7] uppercase tracking-[0.18em] mb-1">
          {label}
        </p>
        <motion.p
          key={value}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-2xl lg:text-3xl font-bold text-white tabular-nums leading-tight"
        >
          {value}
          {suffix && (
            <span className="text-sm font-medium text-[#a7d4a7] ml-2">{suffix}</span>
          )}
        </motion.p>
      </div>
    </div>
  );
}

function TreeIcon() {
  return (
    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 2c3 0 5 3 5 6 3 0 4 3 4 5s-2 4-4 4h-2v5h-6v-5H7c-2 0-4-2-4-4s1-5 4-5c0-3 2-6 5-6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CloudIcon() {
  return (
    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M18 10a6 6 0 0 0-11.5-1A4 4 0 0 0 7 17h11a4 4 0 0 0 0-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" strokeLinecap="round" />
    </svg>
  );
}
