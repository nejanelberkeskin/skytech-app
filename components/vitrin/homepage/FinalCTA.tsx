"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useRef } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CTA_MODE, orderCtaHref } from "@/lib/site-config";

const MotionLink = motion.create(Link);

export default function FinalCTA() {
  const t = useTranslations("finalCta");

  return (
    <section className="relative overflow-hidden vitrin-section bg-[#f6f6f1] border-t border-[#14261a]/10">
      <div className="vitrin-container">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div className="relative max-w-3xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mb-5 flex items-center justify-center gap-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1B6B3A]"
            >
              <span aria-hidden className="h-px w-8 bg-current" />
              {t("badge")}
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="display-headline text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14261a] mb-5 hyphens-auto wrap-break-word"
            >
              {t("title")}
              <br />
              <span className="text-[#1B6B3A]">{t("titleAccent")}</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.5 }}
              className="text-base lg:text-lg text-[#3d5a3d] max-w-xl mx-auto mb-9 leading-relaxed"
            >
              {t("subtitle")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.7 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3"
            >
              <PrimaryCTA href={orderCtaHref("hub")}>
                {CTA_MODE === "order" ? t("ctaPrimary") : CTA_MODE === "request" ? t("ctaRequest") : t("ctaComingSoon")}
                <motion.svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.25}
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              </PrimaryCTA>
              <Link
                href="/iletisim"
                className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-[10px] border border-[#14261a]/25 px-7 py-3.5 font-semibold text-[#14261a] transition-colors duration-200 hover:border-[#1B6B3A] hover:text-[#1B6B3A]"
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
      className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-[10px] bg-[#1B6B3A] px-7 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-[#14552d]"
    >
      {children}
    </MotionLink>
  );
}
