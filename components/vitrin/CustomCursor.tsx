"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * CustomCursor — fareyi takip eden iki katmanlı premium imleç.
 *  - Dış halo: büyük yumuşak daire, mouse'u esnek yayla takip eder
 *  - İç nokta: küçük sert nokta, neredeyse anlık takip
 *  - Hover yapılabilir element üzerinde halo büyür, içeriye yumuşak halka çizer
 *  - mix-blend-mode: difference ile arka plan rengine göre kontrast değişir
 *  - Touch / coarse pointer cihazlarda render edilmez
 */
export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [mode, setMode] = useState<"default" | "magnetic" | "text">("default");
  const [hidden, setHidden] = useState(false);

  // Motion values
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);

  const haloX = useSpring(x, { damping: 22, stiffness: 220, mass: 0.4 });
  const haloY = useSpring(y, { damping: 22, stiffness: 220, mass: 0.4 });
  const dotXS = useSpring(dotX, { damping: 30, stiffness: 600, mass: 0.2 });
  const dotYS = useSpring(dotY, { damping: 30, stiffness: 600, mass: 0.2 });

  useEffect(() => {
    // Touch device check — pointer: coarse veya hover: none ise gösterme
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setEnabled(mq.matches);
    const onChange = () => setEnabled(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      dotX.set(e.clientX);
      dotY.set(e.clientY);

      // Hover detection — interactive element altta mı?
      const el = e.target as HTMLElement | null;
      if (!el) return;

      const interactive = el.closest(
        'a, button, [role="button"], input, textarea, select, .vitrin-card, [data-cursor]'
      ) as HTMLElement | null;

      if (interactive) {
        const ds = interactive.dataset.cursor;
        if (ds === "text") setMode("text");
        else if (ds === "magnetic" || interactive.classList.contains("vitrin-cta-primary"))
          setMode("magnetic");
        else setMode("default");
        setHovering(true);
      } else {
        setHovering(false);
        setMode("default");
      }
    };

    const onLeave = () => setHidden(true);
    const onEnter = () => setHidden(false);
    const onDown = () => setHovering(true);
    const onUp = () => setHovering(false);

    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    // Vitrin alanlarında body cursor'u gizle
    document.documentElement.classList.add("custom-cursor-active");

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.documentElement.classList.remove("custom-cursor-active");
    };
  }, [enabled, x, y, dotX, dotY]);

  if (!enabled) return null;

  const haloScale = hovering ? (mode === "magnetic" ? 2.4 : mode === "text" ? 1.0 : 1.8) : 1;
  const dotScale = hovering ? (mode === "text" ? 0.6 : 0) : 1;

  return (
    <>
      {/* Outer halo */}
      <motion.div
        aria-hidden
        className="custom-cursor-halo"
        style={{
          x: haloX,
          y: haloY,
          opacity: hidden ? 0 : 1,
        }}
      >
        <motion.div
          className="custom-cursor-halo-inner"
          animate={{
            scale: haloScale,
            backgroundColor:
              mode === "magnetic"
                ? "rgba(34, 197, 94, 0.20)"
                : "rgba(255, 255, 255, 0.10)",
            borderColor:
              mode === "magnetic"
                ? "rgba(163, 230, 53, 0.55)"
                : "rgba(255, 255, 255, 0.45)",
          }}
          transition={{ type: "spring", damping: 22, stiffness: 240, mass: 0.5 }}
        />
      </motion.div>

      {/* Inner dot */}
      <motion.div
        aria-hidden
        className="custom-cursor-dot"
        style={{
          x: dotXS,
          y: dotYS,
          opacity: hidden ? 0 : 1,
        }}
      >
        <motion.div
          className="custom-cursor-dot-inner"
          animate={{ scale: dotScale }}
          transition={{ type: "spring", damping: 26, stiffness: 360, mass: 0.3 }}
        />
      </motion.div>
    </>
  );
}
