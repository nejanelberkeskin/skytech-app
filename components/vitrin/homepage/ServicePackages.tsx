"use client";

import { Link } from "@/i18n/navigation";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  type MotionValue,
} from "framer-motion";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import SectionWrapper from "../SectionWrapper";
import { REQUESTS_ENABLED, orderCtaHref } from "@/lib/site-config";
import { RELEASE_QTY } from "@/lib/pricing";

/*
 * İki yol + kurumsal:
 *   1. Proje Uygulama Sahasına tohum topu bıraktırma (önerilen) → saha seçimi
 *   2. Kendi arazim için işlem yaptırmak istiyorum → başvuru formu
 *   3. Kurumsal katılım → bilgi al
 * Doğrudan tohum satışı yoktur; eski "Kendin Ek" kartı bu yüzden kaldırıldı.
 */
type Package = {
  key: "ownLand" | "site" | "corporate";
  name: string;
  tag: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlight: boolean;
};

function usePackages(): Package[] {
  const t = useTranslations("servicePackages");
  const features = (key: Package["key"]) =>
    (t.raw(`packages.${key}.features`) as string[]).map((f) => f.replace("{min}", String(RELEASE_QTY.min)));
  // Talep toplama kapalıysa çağrılar /yakinda'ya gider; etiket de ona göre değişir.
  const requestCta = (key: "ownLand" | "site", kind: "land" | "openLand") => ({
    label: REQUESTS_ENABLED ? t(`packages.${key}.cta`) : t("ctaFallback.soon"),
    href: orderCtaHref(kind),
  });
  return [
    {
      key: "ownLand",
      name: t("packages.ownLand.name"),
      tag: t("packages.ownLand.tag"),
      description: t("packages.ownLand.description"),
      features: features("ownLand"),
      cta: requestCta("ownLand", "land"),
      highlight: false,
    },
    {
      key: "site",
      name: t("packages.site.name"),
      tag: t("packages.site.tag"),
      description: t("packages.site.description"),
      features: features("site"),
      cta: requestCta("site", "openLand"),
      highlight: true,
    },
    {
      key: "corporate",
      name: t("packages.corporate.name"),
      tag: t("packages.corporate.tag"),
      description: t("packages.corporate.description"),
      features: features("corporate"),
      cta: { label: t("packages.corporate.cta"), href: "/bilgi-al" },
      highlight: false,
    },
  ];
}

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.14, delayChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const headingVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export default function ServicePackages() {
  const t = useTranslations("servicePackages");
  const PACKAGES = usePackages();
  return (
    <SectionWrapper variant="tinted" className="relative overflow-hidden !pb-32">
      {/* Aurora behind cards */}
      <div aria-hidden className="absolute inset-0 mesh-gradient opacity-60 pointer-events-none" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="relative max-w-3xl mx-auto text-center mb-16 lg:mb-20"
      >
        <motion.div variants={headingVariants}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B6B3A]/8 border border-[#1B6B3A]/15 mb-6 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1B6B3A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B3A]" />
            {t("badge")}
          </div>
        </motion.div>

        <motion.h2
          variants={headingVariants}
          className="display-headline text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-[#0e2519] mb-6"
        >
          {t("titleLine1")}
          <br />
          <span className="text-gradient-aurora">{t("titleAccent")}</span>
        </motion.h2>

        <motion.p
          variants={headingVariants}
          className="text-base lg:text-lg text-[#3d5a3d] max-w-2xl mx-auto leading-relaxed"
        >
          {t("subtitle")}
        </motion.p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-7 max-w-6xl mx-auto"
      >
        {PACKAGES.map((pkg) => (
          // Önerilen kart masaüstünde ortada, tek sütunda (mobil) en üstte durur.
          <motion.div key={pkg.key} variants={cardVariants} className={pkg.highlight ? "order-first lg:order-none" : undefined}>
            <PackageCard pkg={pkg} />
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  );
}

function PackageCard({ pkg }: { pkg: Package }) {
  const t = useTranslations("servicePackages");
  const ref = useRef<HTMLDivElement>(null);

  // Liquid hover position
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const spring = { damping: 26, stiffness: 240 };
  const sx = useSpring(x, spring);
  const sy = useSpring(y, spring);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  };

  const isHighlight = pkg.highlight;
  const ctaHref = pkg.cta.href;
  const ctaLabel = pkg.cta.label;

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={`relative h-full ${isHighlight ? "lg:-translate-y-3" : ""}`}
    >
      {/* Most popular badge — kartın DIŞINDA konumlanır; kart overflow-hidden
          olduğu için içeride kırpılıyordu. Konum sınıfları düz div'de, entrance
          animasyonu iç motion.div'de: framer'ın transform'u -translate-x-1/2'yi
          ezmesin diye ayrıldı. */}
      {isHighlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
            className="relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#a3e635] text-[#0e2519] text-[11px] font-bold uppercase tracking-[0.14em] shadow-lg shadow-[#a3e635]/40 whitespace-nowrap"
          >
            <StarIcon className="w-3 h-3" />
            <span className="shimmer-text">{t("mostPopular")}</span>
          </motion.div>
        </div>
      )}

      <div
        className={`relative rounded-3xl overflow-hidden h-full flex flex-col p-7 lg:p-9 transition-shadow duration-500 ${
          isHighlight
            ? "bg-gradient-to-br from-[#1B6B3A] via-[#22894a] to-[#1B6B3A] text-white breathe-popular"
            : "premium-glass"
        }`}
      >
      <LiquidGlow x={sx} y={sy} highlight={isHighlight} />

      {/* Highlight: shimmer band */}
      {isHighlight && (
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
      )}

      <div className="relative flex flex-col flex-1">
        {/* Tag */}
        <div
          className={`text-[10px] font-bold uppercase tracking-[0.18em] mb-3 ${
            isHighlight ? "text-[#a3e635]" : "text-[#1B6B3A]"
          }`}
        >
          {pkg.tag}
        </div>

        {/* Name */}
        <h3
          className={`text-2xl lg:text-3xl font-bold mb-3 leading-tight tracking-tight ${
            isHighlight ? "text-white" : "text-[#0e2519]"
          }`}
        >
          {pkg.name}
        </h3>

        {/* Description */}
        <p
          className={`text-sm leading-relaxed mb-7 ${
            isHighlight ? "text-white/85" : "text-[#3d5a3d]"
          }`}
        >
          {pkg.description}
        </p>

        {/* Features */}
        <ul className="space-y-3 mb-9 flex-1">
          {pkg.features.map((feature, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
              className={`flex items-start gap-2.5 text-sm ${
                isHighlight ? "text-white/90" : "text-[#3d5a3d]"
              }`}
            >
              <CheckIcon
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  isHighlight ? "text-[#a3e635]" : "text-[#1B6B3A]"
                }`}
              />
              {feature}
            </motion.li>
          ))}
        </ul>

        {/* CTA */}
        <Link href={ctaHref} className="block">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`group/btn relative w-full py-3.5 rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2 overflow-hidden transition-shadow duration-300 ${
              isHighlight
                ? "bg-white text-[#0e2519] shadow-lg shadow-black/15 hover:shadow-xl hover:shadow-black/25"
                : "bg-[#0e2519] text-white shadow-md shadow-[#0e2519]/20 hover:shadow-xl hover:shadow-[#1B6B3A]/30"
            }`}
          >
            <span className="relative z-10 inline-flex items-center gap-2">
              {ctaLabel}
              <motion.svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                animate={{ x: [0, 3, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <path
                  d="M5 12h14M13 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            </span>
            {/* CTA inner liquid wash */}
            <span
              aria-hidden
              className={`absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500 ${
                isHighlight
                  ? "bg-gradient-to-r from-[#a3e635]/30 via-transparent to-[#a3e635]/30"
                  : "bg-gradient-to-r from-[#1B6B3A]/30 via-transparent to-[#1B6B3A]/30"
              }`}
            />
          </motion.div>
        </Link>
      </div>
      </div>
    </motion.div>
  );
}

/* Reactive liquid glow that follows cursor — uses useMotionTemplate to
   produce a live-updating background string from motion values. */
function LiquidGlow({
  x,
  y,
  highlight,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  highlight: boolean;
}) {
  const background = useMotionTemplate`radial-gradient(${
    highlight ? "420px" : "520px"
  } circle at ${x}px ${y}px, ${
    highlight ? "rgba(163, 230, 53, 0.22)" : "rgba(34, 197, 94, 0.14)"
  }, transparent 55%)`;

  return (
    <motion.div
      aria-hidden
      className="absolute inset-0 pointer-events-none opacity-70"
      style={{ background }}
    />
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.5 8.5 22 9.5 17 14.5 18.5 21 12 17.5 5.5 21 7 14.5 2 9.5 8.5 8.5" />
    </svg>
  );
}
