"use client";

import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import SectionWrapper from "../SectionWrapper";
import { REQUESTS_ENABLED, orderCtaHref } from "@/lib/site-config";
import { formatCount, type PriceLocale } from "@/lib/pricing";

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

function usePackages(minQuantity: number): Package[] {
  const t = useTranslations("servicePackages");
  const min = formatCount(minQuantity, useLocale() as PriceLocale);
  const features = (key: Package["key"]) =>
    (t.raw(`packages.${key}.features`) as string[]).map((f) => f.replace("{min}", min));
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

/** `minQuantity`: satış ayarlarındaki en az adet (ana sayfa sunucuda okur). */
export default function ServicePackages({ minQuantity }: { minQuantity: number }) {
  const t = useTranslations("servicePackages");
  const PACKAGES = usePackages(minQuantity);
  return (
    <SectionWrapper variant="light" className="relative overflow-hidden">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="relative max-w-3xl mx-auto text-center mb-12 lg:mb-16"
      >
        <motion.div variants={headingVariants}>
          <p className="mb-5 flex items-center justify-center gap-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1B6B3A]">
            <span aria-hidden className="h-px w-8 bg-current" />
            {t("badge")}
          </p>
        </motion.div>

        <motion.h2
          variants={headingVariants}
          className="display-headline text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14261a] mb-5 hyphens-auto wrap-break-word"
        >
          {t("titleLine1")}
          <br />
          <span className="text-[#1B6B3A]">{t("titleAccent")}</span>
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

  const isHighlight = pkg.highlight;
  const ctaHref = pkg.cta.href;
  const ctaLabel = pkg.cta.label;

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="relative h-full"
    >
      {/* Önerilen etiketi — kartın DIŞINDA konumlanır; kart overflow-hidden
          olduğu için içeride kırpılıyordu. Konum sınıfları düz div'de, giriş
          animasyonu iç motion.div'de: framer'ın transform'u -translate-x-1/2'yi
          ezmesin diye ayrıldı. */}
      {isHighlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
            className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1B6B3A] text-white text-[11px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap"
          >
            <StarIcon className="w-3 h-3" />
            <span>{t("mostPopular")}</span>
          </motion.div>
        </div>
      )}

      <div
        className={`relative rounded-xl overflow-hidden h-full flex flex-col bg-white p-7 lg:p-9 transition-colors duration-300 ${
          isHighlight
            ? "border-2 border-[#1B6B3A]"
            : "border border-[#14261a]/12 hover:border-[#1B6B3A]/50"
        }`}
      >
        <div className="relative flex flex-col flex-1">
          {/* Tag */}
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3 text-[#1B6B3A]">
            {pkg.tag}
          </div>

          {/* Name */}
          <h3 className="text-2xl lg:text-3xl font-bold mb-3 leading-tight tracking-tight text-[#14261a]">
            {pkg.name}
          </h3>

          {/* Description */}
          <p className="text-sm leading-relaxed mb-7 text-[#3d5a3d]">
            {pkg.description}
          </p>

          {/* Features */}
          <ul className="space-y-3 mb-9 flex-1 border-t border-[#14261a]/10 pt-6">
            {pkg.features.map((feature, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                className="flex items-start gap-2.5 text-sm text-[#3d5a3d]"
              >
                <CheckIcon className="w-4 h-4 shrink-0 mt-0.5 text-[#1B6B3A]" />
                {feature}
              </motion.li>
            ))}
          </ul>

          {/* CTA */}
          <Link href={ctaHref} className="block">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative w-full min-h-12 px-6 py-3 rounded-[10px] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors duration-200 ${
                isHighlight
                  ? "bg-[#1B6B3A] text-white hover:bg-[#14552d]"
                  : "border border-[#14261a]/25 text-[#14261a] hover:border-[#1B6B3A] hover:text-[#1B6B3A]"
              }`}
            >
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
            </motion.div>
          </Link>
        </div>
      </div>
    </motion.div>
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
