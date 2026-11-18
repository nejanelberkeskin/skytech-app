"use client";

import { motion, type Variants } from "framer-motion";
import { ReactNode } from "react";

interface SectionHeadingProps {
  badge?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  invert?: boolean;
  className?: string;
}

const EYE_BASE = "mb-5 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.16em]";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function SectionHeading({
  badge,
  title,
  subtitle,
  align = "center",
  invert = false,
  className = "",
}: SectionHeadingProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className={`${align === "center" ? "text-center mx-auto" : ""} max-w-3xl mb-12 lg:mb-16 ${className}`}
    >
      {badge && (
        <motion.div variants={itemVariants}>
          <p
            className={`${EYE_BASE} ${align === "center" ? "justify-center" : ""} ${invert ? "text-[#a7d4a7]" : "text-[#1B6B3A]"}`}
          >
            <span aria-hidden className="h-px w-8 bg-current" />
            {badge}
          </p>
        </motion.div>
      )}

      <motion.h2
        variants={itemVariants}
        className={`display-headline text-3xl sm:text-4xl lg:text-5xl font-bold mb-5 hyphens-auto wrap-break-word ${
          invert ? "text-white" : "text-[#14261a]"
        }`}
      >
        {title}
      </motion.h2>

      {subtitle && (
        <motion.p
          variants={itemVariants}
          className={`text-base lg:text-lg leading-relaxed ${
            invert ? "text-[#a7d4a7]" : "text-[#3d5a3d]"
          } ${align === "center" ? "max-w-2xl mx-auto" : ""}`}
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}
