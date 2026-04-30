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
      className={`${align === "center" ? "text-center mx-auto" : ""} max-w-3xl mb-14 lg:mb-20 ${className}`}
    >
      {badge && (
        <motion.div variants={itemVariants}>
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6 text-[11px] font-bold uppercase tracking-[0.18em] ${
              invert
                ? "bg-white/10 border border-white/15 text-[#a7d4a7]"
                : "bg-[#1B6B3A]/8 border border-[#1B6B3A]/15 text-[#1B6B3A]"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {badge}
          </div>
        </motion.div>
      )}

      <motion.h2
        variants={itemVariants}
        className={`display-headline text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 ${
          invert ? "text-white" : "text-[#0e2519]"
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
