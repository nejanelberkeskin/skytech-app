"use client";

import { motion, useInView, useMotionValue, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useId, useRef, useSyncExternalStore, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { JourneyScene, type Act } from "./seed-journey/JourneyScene";

const ACTS: Act[] = ["prepare", "flight", "soil", "sprout"];
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (notify: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const getMotionPreference = () => window.matchMedia(REDUCED_MOTION).matches;
const getServerPreference = () => false;

export default function SeedJourney() {
  const t = useTranslations("seedJourney");
  const id = `sj-${useId()}`;
  const ref = useRef<HTMLElement>(null);
  const reduced = useSyncExternalStore(subscribeMotion, getMotionPreference, getServerPreference);

  return (
    <section ref={ref} className={`sj-journey${reduced ? " sj-static" : ""}`} aria-labelledby={`${id}-heading`}>
      {reduced ? <StaticJourney headingId={`${id}-heading`} /> : <ScrollJourney target={ref} headingId={`${id}-heading`} />}
      <span className="sr-only">{t("progress.steps")}</span>
    </section>
  );
}

function Heading({ id }: { id: string }) {
  const t = useTranslations("seedJourney");
  return (
    <header className="sj-heading">
      <h2 id={id}>{t("heading")}</h2>
      <p>{t("intro")}</p>
    </header>
  );
}

function Background({ active = false }: { active?: boolean }) {
  return (
    <div className="sj-background mesh-dark grain-overlay" aria-hidden="true">
      <div className="aurora-bg">
        <div className="sj-aurora aurora-blob aurora-blob-1" style={{ animationPlayState: active ? "running" : "paused" }} />
      </div>
    </div>
  );
}

function ScrollJourney({ target, headingId }: { target: RefObject<HTMLElement | null>; headingId: string }) {
  const t = useTranslations("seedJourney");
  const inView = useInView(target);
  // Direct scroll mapping keeps every frame reversible, including at act boundaries.
  const { scrollYProgress } = useScroll({ target, offset: ["start start", "end end"] });
  return (
    <div className="sj-stage">
      <Background active={inView} />
      <div className="sj-content">
        <Heading id={headingId} />
        <ol className="sj-acts">
          {ACTS.map((act, index) => <ScrollAct key={act} act={act} index={index} progress={scrollYProgress} />)}
        </ol>
        <div className="sj-progress" aria-label={t("progress.label")}>
          <p>{t("progress.steps")}</p>
          <div className="sj-track" aria-hidden="true"><motion.div style={{ scaleX: scrollYProgress }} /></div>
        </div>
      </div>
    </div>
  );
}

function ScrollAct({ act, index, progress }: { act: Act; index: number; progress: MotionValue<number> }) {
  const start = index / 4;
  const end = (index + 1) / 4;
  const local = useTransform(progress, [start, end], [0, 1]);
  const opacity = useTransform(progress, value => {
    const enter = index === 0 ? 1 : Math.min(1, Math.max(0, (value - start + 0.04) / 0.08));
    const leave = index === 3 ? 1 : Math.min(1, Math.max(0, (end + 0.04 - value) / 0.08));
    return Math.min(enter, leave);
  });
  const visibility = useTransform(opacity, value => value === 0 ? "hidden" : "visible");
  // Captions switch at the boundary: never two translucent paragraphs on top of each other.
  // Opacity alone preserves all four headings/descriptions in the accessibility tree.
  const caption = useTransform(progress, value => Math.min(3, Math.floor(value * 4)) === index ? 1 : 0);
  return (
    <li className="sj-act">
      <motion.div className="sj-art" style={{ opacity, visibility }} aria-hidden="true">
        <JourneyScene act={act} progress={local} />
      </motion.div>
      <motion.div className="sj-caption premium-glass-dark" style={{ opacity: caption }}>
        <Caption act={act} index={index} />
      </motion.div>
    </li>
  );
}

function Caption({ act, index }: { act: Act; index: number }) {
  const t = useTranslations("seedJourney");
  return (
    <>
      <p className="sj-step">{t("stepLabel")} <span>{String(index + 1).padStart(2, "0")}</span></p>
      <h3>{t(`acts.${act}.title`)}</h3>
      <p className="sj-description">{t(`acts.${act}.desc`)}</p>
    </>
  );
}

function StaticJourney({ headingId }: { headingId: string }) {
  return (
    <div className="sj-stage">
      <Background />
      <div className="sj-content">
        <Heading id={headingId} />
        <ol className="sj-acts">
          {ACTS.map((act, index) => <StaticAct key={act} act={act} index={index} />)}
        </ol>
      </div>
    </div>
  );
}

function StaticAct({ act, index }: { act: Act; index: number }) {
  const frame = useMotionValue([0.24, 0.6, 0.68, 1][index]);
  return (
    <li className="sj-act">
      <div className="sj-art"><JourneyScene act={act} progress={frame} /></div>
      <div className="sj-caption premium-glass-dark"><Caption act={act} index={index} /></div>
    </li>
  );
}
