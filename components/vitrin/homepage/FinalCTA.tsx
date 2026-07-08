"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { TRANSACTIONS_ENABLED } from "@/lib/site-config";

const MotionLink = motion.create(Link);

export default function FinalCTA() {
  const t = useTranslations("finalCta");
  const ref = useRef<HTMLDivElement>(null);

  // Mouse-tracked aurora parallax inside the card
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { damping: 30, stiffness: 80 });
  const sy = useSpring(my, { damping: 30, stiffness: 80 });
  const sx2 = useSpring(useTransform(mx, (v) => v * -0.4), { damping: 30, stiffness: 80 });
  const sy2 = useSpring(useTransform(my, (v) => v * -0.4), { damping: 30, stiffness: 80 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set(e.clientX - rect.left - rect.width / 2);
    my.set(e.clientY - rect.top - rect.height / 2);
  };

  return (
    <section className="relative overflow-hidden vitrin-section">
      <div className="vitrin-container">
        <motion.div
          ref={ref}
          onMouseMove={handleMove}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-[2rem] mesh-dark grain-overlay p-10 sm:p-14 lg:p-24 overflow-hidden"
        >
          {/* Aurora */}
          <div className="aurora-bg">
            <motion.div className="aurora-blob aurora-blob-1" style={{ x: sx, y: sy }} />
            <motion.div className="aurora-blob aurora-blob-2" style={{ x: sx2, y: sy2 }} />
            <div className="aurora-blob aurora-blob-3" />
          </div>

          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.05] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            }}
          />

          <div className="relative max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full premium-glass-dark mb-8"
            >
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-[#34d399] opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-[#34d399]" />
              </span>
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#a7d4a7]">
                {t("badge")}
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="display-headline text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6"
            >
              {t("title")}
              <br />
              <span className="text-gradient-aurora">{t("titleAccent")}</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.5 }}
              className="text-base lg:text-xl text-[#a7d4a7] max-w-xl mx-auto mb-10 leading-relaxed font-light"
            >
              {t("subtitle")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.7 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <PrimaryCTA href={TRANSACTIONS_ENABLED ? "/bireysel/satin-al" : "/yakinda"}>
                {TRANSACTIONS_ENABLED ? t("ctaPrimary") : t("ctaComingSoon")}
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
              </PrimaryCTA>
              <Link
                href="/iletisim"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl premium-glass-dark text-white font-semibold hover:border-white/30 transition-shadow"
              >
                {t("ctaSecondary")}
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function PrimaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { damping: 18, stiffness: 240, mass: 0.6 });
  const sy = useSpring(y, { damping: 18, stiffness: 240, mass: 0.6 });

  const handleMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.25);
    y.set((e.clientY - cy) * 0.25);
  };
  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <MotionLink
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ x: sx, y: sy }}
      className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-br from-[#1B6B3A] via-[#22894a] to-[#1B6B3A] text-white font-bold shadow-xl shadow-[#1B6B3A]/40 hover:shadow-2xl hover:shadow-[#22894a]/50 transition-shadow overflow-hidden"
    >
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
          animation: "shimmer-flow 2.5s linear infinite",
          backgroundSize: "200% 100%",
        }}
      />
      <span className="relative inline-flex items-center gap-3">{children}</span>
    </MotionLink>
  );
}
