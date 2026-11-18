"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import SectionWrapper from "../SectionWrapper";
import SectionHeading from "../SectionHeading";

type MilestoneData = { year: string; title: string; description: string };

function useMilestones(): MilestoneData[] {
  const t = useTranslations("aboutPage.timeline");
  return [
    {
      year: "2021",
      title: t("milestones.spark.title"),
      description: t("milestones.spark.description"),
    },
    {
      year: "2025",
      title: t("milestones.talks.title"),
      description: t("milestones.talks.description"),
    },
    {
      year: "2026",
      title: t("milestones.protocols.title"),
      description: t("milestones.protocols.description"),
    },
  ];
}

export default function Timeline() {
  const t = useTranslations("aboutPage.timeline");
  const milestones = useMilestones();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 70%", "end 30%"],
  });

  // Smooth line height (0% → 100%)
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <SectionWrapper variant="tinted" className="relative overflow-hidden">
      <div className="relative">
        <SectionHeading
          badge={t("badge")}
          title={
            <>
              {t("titleLine1")}
              <br />
              <span className="text-[#1B6B3A]">{t("titleLine2")}</span>
            </>
          }
          subtitle={t("subtitle")}
        />

        <div ref={containerRef} className="relative max-w-4xl mx-auto pt-8 pb-12">
          {/* Static track line — mobile: left-5, desktop: center */}
          <div
            aria-hidden
            className="absolute left-5 lg:left-1/2 -translate-x-px top-0 bottom-0 w-px bg-[#1B6B3A]/15"
          />

          {/* Animated filling line */}
          <motion.div
            aria-hidden
            style={{ height: lineHeight }}
            className="absolute left-5 lg:left-1/2 -translate-x-px top-0 w-px"
          >
            <div className="relative h-full">
              <div className="absolute inset-0 bg-[#1B6B3A]" />
              {/* Leading-edge marker */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#1B6B3A]" />
            </div>
          </motion.div>

          {/* Milestones */}
          <ul className="relative space-y-12 lg:space-y-16">
            {milestones.map((m, idx) => (
              <Milestone key={m.year} milestone={m} index={idx} label={t("milestoneLabel")} />
            ))}
          </ul>
        </div>
      </div>
    </SectionWrapper>
  );
}

function Milestone({
  milestone,
  index,
  label,
}: {
  milestone: MilestoneData;
  index: number;
  label: string;
}) {
  const isLeft = index % 2 === 0;

  return (
    <motion.li
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="relative grid grid-cols-1 lg:grid-cols-2 lg:gap-10"
    >
      {/* Dot — mobile: left-5, desktop: center */}
      <motion.div
        aria-hidden
        initial={{ scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, delay: 0.25, type: "spring", stiffness: 200 }}
        className="absolute top-3 left-5 lg:left-1/2 -translate-x-1/2 z-10"
      >
        <div className="relative w-5 h-5 rounded-full bg-[#1B6B3A] flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-white" />
        </div>
      </motion.div>

      {/* Content side */}
      <div
        className={`${
          isLeft ? "lg:pr-12 lg:text-right lg:order-1" : "lg:pl-12 lg:text-left lg:order-2"
        } pl-10 lg:pl-0`}
      >
        <div className="vitrin-card p-6 lg:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1B6B3A] mb-2">
            {label}
          </p>
          <h3 className="text-2xl lg:text-3xl font-bold text-[#14261a] mb-3 tracking-tight">
            {milestone.title}
          </h3>
          <p className="text-sm text-[#3d5a3d] leading-relaxed">{milestone.description}</p>
        </div>
      </div>

      {/* Year side */}
      <div
        className={`${
          isLeft ? "lg:pl-12 lg:text-left lg:order-2" : "lg:pr-12 lg:text-right lg:order-1"
        } pl-10 lg:pl-0 mt-4 lg:mt-0`}
      >
        <motion.p
          initial={{ opacity: 0, x: isLeft ? 16 : -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="display-headline text-5xl lg:text-7xl font-bold text-[#1B6B3A] tabular-nums leading-none"
        >
          {milestone.year}
        </motion.p>
      </div>
    </motion.li>
  );
}
