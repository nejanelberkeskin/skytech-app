"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { TRANSACTIONS_ENABLED } from "@/lib/site-config";

export default function HeroSection() {
  const t = useTranslations("hero");
  const tNav = useTranslations("nav");
  const HEADLINE_LINE_1 = t("headlineLine1");
  const HEADLINE_LINE_2 = t("headlineLine2");
  const SUBTEXT = t("subtitle");
  const TRUST_BADGES = [
    t("trustForestRegions"),
    t("trustAnnualReport"),
    t("trustCertificate"),
  ];

  const heroRef = useRef<HTMLElement>(null);

  // Mouse-tracked aurora parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 30, stiffness: 80, mass: 1 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const aurora1X = useTransform(smoothX, (v) => v * 0.04);
  const aurora1Y = useTransform(smoothY, (v) => v * 0.04);
  const aurora2X = useTransform(smoothX, (v) => v * -0.025);
  const aurora2Y = useTransform(smoothY, (v) => v * -0.025);
  const aurora3X = useTransform(smoothX, (v) => v * 0.015);
  const aurora3Y = useTransform(smoothY, (v) => v * -0.02);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rect = heroRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX.set(e.clientX - rect.left - rect.width / 2);
      mouseY.set(e.clientY - rect.top - rect.height / 2);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY]);

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden -mt-20 pt-32 pb-24 lg:pb-36 mesh-dark grain-overlay"
    >
      {/* Background image — drone seeding action, subtle blend with mesh-dark */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/images/anasayfa/hero-bg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-30 mix-blend-screen"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,31,18,0.55) 0%, rgba(10,31,18,0.35) 50%, rgba(10,31,18,0.85) 100%)",
          }}
        />
      </div>

      {/* Aurora layer */}
      <div className="aurora-bg">
        <motion.div
          className="aurora-blob aurora-blob-1"
          style={{ x: aurora1X, y: aurora1Y }}
        />
        <motion.div
          className="aurora-blob aurora-blob-2"
          style={{ x: aurora2X, y: aurora2Y }}
        />
        <motion.div
          className="aurora-blob aurora-blob-3"
          style={{ x: aurora3X, y: aurora3Y }}
        />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
        }}
      />

      <div className="relative vitrin-container">
        <div className="max-w-6xl mx-auto text-center">
          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full premium-glass-dark mb-10"
          >
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-[#34d399] opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-[#34d399]" />
            </span>
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#a7d4a7]">
              {t("badge")}
            </span>
          </motion.div>

          {/* Headline — word-by-word reveal */}
          <h1 className="display-headline text-6xl sm:text-7xl lg:text-8xl xl:text-[9.5rem] font-bold mb-10 leading-[1.05]">
            <WordReveal text={HEADLINE_LINE_1} className="text-white" delay={0.15} />
            <br />
            <WordReveal text={HEADLINE_LINE_2} gradient delay={0.5} />
          </h1>

          {/* Sub headline — line reveal */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.95, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg sm:text-xl lg:text-2xl text-[#a7d4a7] max-w-3xl mx-auto mb-12 leading-relaxed font-light"
          >
            {SUBTEXT}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.15, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <MagneticCTA href={TRANSACTIONS_ENABLED ? "/bireysel/satin-al" : "/yakinda"} variant="primary">
              <span>{TRANSACTIONS_ENABLED ? t("ctaPrimary") : tNav("comingSoon")}</span>
              <motion.svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <motion.path
                  d="M5 12h14M13 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            </MagneticCTA>
            <MagneticCTA href="/kurumsal-cozumler" variant="ghost">
              {t("ctaSecondary")}
            </MagneticCTA>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.4 }}
            className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-xs sm:text-sm font-medium text-[#a7d4a7]"
          >
            {TRUST_BADGES.map((badge, i) => (
              <span key={badge} className="flex items-center gap-x-7">
                <TrustItem>{badge}</TrustItem>
                {i < TRUST_BADGES.length - 1 && (
                  <span className="w-1 h-1 rounded-full bg-[#22894a]/50" />
                )}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2"
      >
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#6b8f6b] font-semibold">
          {t("discover")}
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg
            className="w-5 h-5 text-[#22894a]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* Word-by-word reveal for headlines */
function WordReveal({
  text,
  delay = 0,
  className = "",
  gradient = false,
}: {
  text: string;
  delay?: number;
  className?: string;
  gradient?: boolean;
}) {
  const words = text.split(" ");
  return (
    <span className={`${gradient ? "text-gradient-aurora" : ""} ${className}`}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom py-[0.1em]">
          <motion.span
            className="inline-block"
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            transition={{
              duration: 0.9,
              delay: delay + i * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {word}
            {i < words.length - 1 && " "}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* Magnetic CTA button — follows cursor slightly on hover */
function MagneticCTA({
  href,
  children,
  variant,
}: {
  href: string;
  children: React.ReactNode;
  variant: "primary" | "ghost";
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { damping: 18, stiffness: 240, mass: 0.6 };
  const sx = useSpring(x, springConfig);
  const sy = useSpring(y, springConfig);

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

  const baseClasses =
    "group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold transition-shadow duration-300";
  const variantClasses =
    variant === "primary"
      ? "bg-gradient-to-br from-[#1B6B3A] via-[#22894a] to-[#1B6B3A] text-white shadow-xl shadow-[#1B6B3A]/40 hover:shadow-2xl hover:shadow-[#22894a]/50"
      : "premium-glass-dark text-white hover:border-white/30";

  return (
    <motion.a
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ x: sx, y: sy }}
      className={`${baseClasses} ${variantClasses}`}
    >
      {/* Inner shimmer for primary */}
      {variant === "primary" && (
        <span
          className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
          aria-hidden
        >
          <span
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
              transform: "translateX(-100%)",
              animation: "shimmer-flow 3s ease-in-out infinite",
              backgroundSize: "200% 100%",
            }}
          />
        </span>
      )}
      <span className="relative inline-flex items-center gap-3">{children}</span>
    </motion.a>
  );
}

function TrustItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg
        className="w-4 h-4 text-[#34d399]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </span>
  );
}
