"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export default function DashboardParallax() {
  const t = useTranslations("corporatePage.dashboard");
  const ref = useRef<HTMLDivElement>(null);

  // Parallax yalnızca lg+ ekranda: dar ekranda mutlak konumlu kartlar
  // metin sarınca üst üste binip okunmaz hale geliyordu.
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLg(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const PORTAL_FEATURES = [
    t("features.upload"),
    t("features.certificate"),
    t("features.droneRecords"),
    t("features.carbonPanel"),
    t("features.esgModule"),
    t("features.billing"),
  ];

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Layered parallax — back card, mid card, front card all rise at different speeds
  const yBack = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const yMid = useTransform(scrollYProgress, [0, 1], [60, -120]);
  const yFront = useTransform(scrollYProgress, [0, 1], [40, -160]);
  const rotateBack = useTransform(scrollYProgress, [0, 1], [4, -2]);
  const rotateMid = useTransform(scrollYProgress, [0, 1], [-2, 1.5]);
  const rotateFront = useTransform(scrollYProgress, [0, 1], [0, -1]);
  const scaleFront = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 1.05]);

  return (
    <section ref={ref} className="relative overflow-hidden vitrin-section bg-white">
      <div className="vitrin-container">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-center max-w-6xl mx-auto">
          {/* Text */}
          <div className="lg:col-span-2">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="mb-5 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1B6B3A]"
            >
              <span aria-hidden className="h-px w-8 bg-current" />
              {t("badge")}
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="display-headline text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14261a] mb-5"
            >
              <span className="text-[#1B6B3A]">{t("title.highlight")}</span>
              <br />
              {t("title.rest")}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.2 }}
              className="text-base text-[#3d5a3d] leading-relaxed mb-7"
            >
              {t("intro")}
            </motion.p>
            <motion.ul
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } },
              }}
              className="space-y-3"
            >
              {PORTAL_FEATURES.map((f) => (
                <motion.li
                  key={f}
                  variants={{
                    hidden: { opacity: 0, x: -8 },
                    show: { opacity: 1, x: 0, transition: { duration: 0.5 } },
                  }}
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
                      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {f}
                </motion.li>
              ))}
            </motion.ul>
          </div>

          {/* 3D Stacked Mockup — lg+: mutlak konum + parallax; mobil: normal akış */}
          <div className="lg:col-span-3 relative space-y-4 lg:space-y-0 lg:h-[620px]" style={{ perspective: 1400 }}>
            {/* Back card — drone feed */}
            <motion.div
              style={
                isLg
                  ? { y: yBack, rotate: rotateBack, transformStyle: "preserve-3d" }
                  : undefined
              }
              className="relative w-full lg:absolute lg:top-8 lg:right-0 lg:w-[78%] aspect-[4/3] rounded-xl border border-[#14261a]/12 bg-[#f6f6f1] overflow-hidden"
            >
              <div className="relative p-6 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-[#1B6B3A]" />
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[#1B6B3A] font-bold">
                    {t("mockup.droneLabel")}
                  </span>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="rounded-md bg-white border border-[#14261a]/10" />
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-[10px] text-[#6b8f6b]">
                  <span>{t("mockup.gpsStatus")}</span>
                  <span className="font-mono">36.78° N · 31.43° E</span>
                </div>
              </div>
            </motion.div>

            {/* Mid card — ESG metrics */}
            <motion.div
              style={
                isLg
                  ? { y: yMid, rotate: rotateMid, transformStyle: "preserve-3d" }
                  : undefined
              }
              className="relative w-full lg:absolute lg:top-32 lg:left-0 lg:w-[68%] rounded-xl border border-[#14261a]/12 bg-white overflow-hidden shadow-sm p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#1B6B3A] font-bold mb-1">
                    {t("mockup.carbonLabel")}
                  </p>
                  <p className="text-2xl font-bold text-[#14261a] tabular-nums">{t("mockup.carbonValue")}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[#1B6B3A] font-bold">{t("mockup.quarterDelta")}</p>
                </div>
              </div>
              <div className="h-2 rounded-full bg-[#14261a]/8 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "72%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full bg-[#1B6B3A] rounded-full"
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-[#6b8f6b]">{t("mockup.treesLabel")}</p>
                  <p className="text-[#14261a] font-bold tabular-nums">128K</p>
                </div>
                <div>
                  <p className="text-[#6b8f6b]">{t("mockup.employeesLabel")}</p>
                  <p className="text-[#14261a] font-bold tabular-nums">2.450</p>
                </div>
                <div>
                  <p className="text-[#6b8f6b]">{t("mockup.regionsLabel")}</p>
                  <p className="text-[#14261a] font-bold tabular-nums">{t("mockup.regionsValue")}</p>
                </div>
              </div>
            </motion.div>

            {/* Front card — alert / certificate */}
            <motion.div
              style={
                isLg
                  ? {
                      y: yFront,
                      rotate: rotateFront,
                      scale: scaleFront,
                      transformStyle: "preserve-3d",
                    }
                  : undefined
              }
              className="relative w-full lg:absolute lg:bottom-0 lg:right-12 lg:w-[60%] rounded-xl border border-[#14261a]/12 bg-white overflow-hidden shadow-sm p-5"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-[#1B6B3A] flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <polyline points="9 12 11 14 15 10" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#14261a] truncate">{t("mockup.certTitle")}</p>
                  <p className="text-xs text-[#3d5a3d] truncate">
                    {t("mockup.certDesc")}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em]">
                <span className="text-[#1B6B3A] font-bold">{t("mockup.certStatus")}</span>
                <span className="text-[#6b8f6b]">{t("mockup.certTime")}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
