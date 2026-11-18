"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CTA_MODE, orderCtaHref } from "@/lib/site-config";

const MotionLink = motion.create(Link);

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

  // Fareyi izleyen hafif derinlik: fotoğraf ve künye kartı ters yönde birkaç piksel kayar.
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 30, stiffness: 80, mass: 1 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);
  const photoX = useTransform(smoothX, (v) => v * -0.012);
  const photoY = useTransform(smoothY, (v) => v * -0.012);
  const noteX = useTransform(smoothX, (v) => v * 0.02);
  const noteY = useTransform(smoothY, (v) => v * 0.02);

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
    <section ref={heroRef} className="relative overflow-hidden bg-[#f6f6f1] pt-10 pb-16 lg:pt-16 lg:pb-24">
      <div className="vitrin-container grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        <div>
          <motion.p
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1B6B3A]"
          >
            <span aria-hidden className="h-px w-8 bg-[#1B6B3A]" />
            {t("badge")}
          </motion.p>

          <h1 className="display-headline mb-7 text-[2.6rem] font-bold text-[#14261a] sm:text-6xl xl:text-7xl">
            <WordReveal text={HEADLINE_LINE_1} delay={0.1} />
            <br />
            <WordReveal text={HEADLINE_LINE_2} className="text-[#1B6B3A]" delay={0.4} />
          </h1>

          <motion.p
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="mb-9 max-w-xl text-lg leading-relaxed text-[#3d5a3d] sm:text-xl"
          >
            {SUBTEXT}
          </motion.p>

          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <MagneticCTA href={orderCtaHref("hub")} variant="primary">
              <span>{CTA_MODE === "order" ? t("ctaPrimary") : CTA_MODE === "request" ? t("ctaRequest") : tNav("comingSoon")}</span>
              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </MagneticCTA>
            <MagneticCTA href="/kurumsal-cozumler" variant="ghost">
              {t("ctaSecondary")}
            </MagneticCTA>
          </motion.div>

          <motion.ul
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="flex flex-col gap-2 border-t border-[#14261a]/10 pt-6 text-sm font-medium text-[#3d5a3d] sm:flex-row sm:flex-wrap sm:gap-x-7"
          >
            {TRUST_BADGES.map((badge) => (
              <li key={badge}>
                <TrustItem>{badge}</TrustItem>
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#dfe3d6] sm:aspect-[16/11] lg:aspect-[4/5]">
            <motion.div className="absolute -inset-3" style={{ x: photoX, y: photoY }}>
              <Image
                src="/images/anasayfa/hero-bg.webp"
                alt={t("backgroundAlt")}
                fill
                priority
                sizes="(min-width: 1024px) 46vw, 100vw"
                className="object-cover"
              />
            </motion.div>
          </div>
          <motion.p
            style={{ x: noteX, y: noteY }}
            className="absolute -bottom-4 left-4 right-4 rounded-lg border border-[#14261a]/10 bg-white px-4 py-3 text-sm font-medium text-[#14261a] sm:left-6 sm:right-auto sm:max-w-xs"
          >
            {t("backgroundAlt")}
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

/* Word-by-word reveal for headlines */
function WordReveal({
  text,
  delay = 0,
  className = "",
}: {
  text: string;
  delay?: number;
  className?: string;
}) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom py-[0.1em]">
          <motion.span
            className="inline-block"
            initial={false}
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
    "group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-[10px] px-7 py-3.5 font-semibold transition-colors duration-200";
  const variantClasses =
    variant === "primary"
      ? "bg-[#1B6B3A] text-white hover:bg-[#14552d]"
      : "border border-[#14261a]/25 text-[#14261a] hover:border-[#1B6B3A] hover:text-[#1B6B3A]";

  return (
    <MotionLink
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ x: sx, y: sy }}
      className={`${baseClasses} ${variantClasses}`}
    >
      {children}
    </MotionLink>
  );
}

function TrustItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg
        className="w-4 h-4 text-[#1B6B3A]"
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
