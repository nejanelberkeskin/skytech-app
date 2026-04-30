"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useState } from "react";
import SectionWrapper from "../SectionWrapper";
import SectionHeading from "../SectionHeading";

type Tab = {
  id: string;
  label: string;
  Icon: (p: { className?: string }) => React.JSX.Element;
  title: string;
  description: string;
  bullets: string[];
  stat: string;
  statLabel: string;
};

const TABS: Tab[] = [
  {
    id: "yangin",
    label: "Yangın Sonrası",
    Icon: FlameIcon,
    title: "Yanan Ormanları Yeniden Yeşertiyoruz",
    description:
      "Orman yangınları sonrası ulaşılması zor, eğimli ve tehlikeli alanlara dronlarla tohum topu atarak hızlı rejenerasyon sağlıyoruz. Toprak hala sıcakken yapılan ekim, doğal ardıllıkla harmanlanır.",
    bullets: [
      "Yangından sonraki ilk 6 ay kritik — drone ile hızlı müdahale",
      "Eğimli, ulaşılması zor alanlarda tek çözüm",
      "Yerli tür karışımları, biyoçeşitliliği korur",
    ],
    stat: "%65+",
    statLabel: "Çimlenme oranı",
  },
  {
    id: "erozyon",
    label: "Erozyon Bölgesi",
    Icon: WaveIcon,
    title: "Toprak Kaybını Köklerle Durdurun",
    description:
      "Erozyon riskli yamaçlara, su havzalarına ve bozulmuş alanlara hızlıca derin kök yapan tohum türleri ekiyoruz. Toprak tutucu bitki örtüsü, sediment kaybını minimize eder.",
    bullets: [
      "Derin kök yapan yerli türler (meşe, akçaağaç)",
      "Eğimli arazilere uçaklı erişim",
      "5 yılda toprak tutuş kapasitesi 3 kat artar",
    ],
    stat: "3×",
    statLabel: "Toprak tutuş artışı",
  },
  {
    id: "hazine",
    label: "Boş Hazine Alanı",
    Icon: LandIcon,
    title: "Atıl Devlet Arazilerini Üretken Hale Getiriyoruz",
    description:
      "Hazine ve İl Orman Müdürlüğü işbirliğiyle, kullanılmayan kamu arazileri ağaçlandırılarak ekonomik ve ekolojik değer kazanır. Tüm projeler yasal izin dahilindedir.",
    bullets: [
      "İl Orman Müdürlüğü ile koordineli yasal izin",
      "Uzun vadeli (25+ yıl) izleme garantisi",
      "ESG entegrasyonlu kurumsal alanlar",
    ],
    stat: "100%",
    statLabel: "Yasal uyum",
  },
  {
    id: "karbon",
    label: "Karbon Nötrleme",
    Icon: AtomIcon,
    title: "Şirketler İçin Ölçülebilir ESG Etkisi",
    description:
      "Holdingler ve şirketler için karbon nötrleme programı. Yıllık karbon ayak izinizi hesaplıyor, ona göre dronlu hatıra ormanı kurup ESG raporlarınıza entegre ediyoruz.",
    bullets: [
      "Şirket karbon ayak izi hesaplaması",
      "Çalışan sertifikası — bireysel atıf",
      "ESG, GRI, CDP raporlarına hazır veri",
    ],
    stat: "ESG",
    statLabel: "Tam uyum",
  },
  {
    id: "su",
    label: "Su Havzası",
    Icon: DropIcon,
    title: "İçme Suyu Kaynaklarını Korumak",
    description:
      "Baraj ve göl havzaları çevresine yapılan ağaçlandırma, su kalitesini korur ve sediment yükünü azaltır. Belediyelerle işbirliğiyle yürütülen kritik altyapı projeleridir.",
    bullets: [
      "Su kalitesi koruması — tortu filtreleme",
      "Yağmur infiltrasyonu artışı",
      "Belediye işbirlikleri",
    ],
    stat: "+40%",
    statLabel: "Su kalitesi",
  },
];

const contentVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25 } },
};

export default function ImpactTabs() {
  const [active, setActive] = useState(TABS[0].id);
  const tab = TABS.find((t) => t.id === active) ?? TABS[0];

  return (
    <SectionWrapper variant="light" className="relative overflow-hidden">
      {/* Soft mesh wash */}
      <div aria-hidden className="absolute inset-0 mesh-gradient opacity-40 pointer-events-none" />

      <div className="relative">
        <SectionHeading
          badge="Etki Alanları"
          title={
            <>
              Nerelerde
              <br />
              <span className="text-gradient-aurora">Etkimiz Var</span>
            </>
          }
          subtitle="Beş kritik ekosistem alanında, bilimle ve teknolojiyle ölçülebilir değişim yaratıyoruz."
        />

        {/* Tab list */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="flex flex-wrap items-center justify-center gap-2 mb-12"
        >
          {TABS.map((t) => {
            const isActive = t.id === active;
            return (
              <motion.button
                key={t.id}
                onClick={() => setActive(t.id)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`relative inline-flex items-center gap-2 px-4 lg:px-5 py-2.5 lg:py-3 rounded-2xl text-sm font-bold transition-colors ${
                  isActive
                    ? "text-white"
                    : "bg-white border border-black/8 text-[#3d5a3d] hover:border-[#1B6B3A]/20 hover:text-[#1B6B3A]"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="impact-tab-active"
                    className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1B6B3A] to-[#22894a] shadow-lg shadow-[#1B6B3A]/25"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative inline-flex items-center gap-2">
                  <t.Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-[#22894a]"}`} />
                  {t.label}
                </span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Active content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab.id}
            variants={contentVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-6xl mx-auto"
          >
            {/* Visual */}
            <div className="lg:col-span-2 relative">
              <div className="relative aspect-square rounded-3xl mesh-dark overflow-hidden">
                <div className="aurora-bg">
                  <div className="aurora-blob aurora-blob-1" />
                  <div className="aurora-blob aurora-blob-2" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.35 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <tab.Icon className="w-32 h-32 text-white" />
                  </motion.div>
                </div>
                <div className="absolute bottom-6 left-6 right-6 liquid-glass-dark rounded-2xl p-5 text-center">
                  <p className="text-4xl font-bold text-white tracking-tight mb-1 tabular-nums">{tab.stat}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#a7d4a7] font-bold">
                    {tab.statLabel}
                  </p>
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="lg:col-span-3 flex flex-col justify-center">
              <h3 className="text-2xl lg:text-4xl font-bold text-[#0e2519] leading-tight mb-5 tracking-tight">
                {tab.title}
              </h3>
              <p className="text-base text-[#3d5a3d] leading-relaxed mb-6">{tab.description}</p>
              <ul className="space-y-3">
                {tab.bullets.map((b, i) => (
                  <motion.li
                    key={`${tab.id}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.15 + i * 0.06 }}
                    className="flex items-start gap-3 text-sm text-[#3d5a3d]"
                  >
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#1B6B3A]/10 flex items-center justify-center mt-0.5">
                      <svg
                        className="w-3 h-3 text-[#1B6B3A]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <polyline
                          points="20 6 9 17 4 12"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    {b}
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </SectionWrapper>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 1-4 2-5 0 2 2 2 3 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function WaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0" strokeLinecap="round" />
    </svg>
  );
}
function LandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 17l5-5 4 4 4-4 5 7M3 21h18" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="7" r="2" />
    </svg>
  );
}
function AtomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
    </svg>
  );
}
function DropIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 2c4 5 7 9 7 13a7 7 0 0 1-14 0c0-4 3-8 7-13z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
