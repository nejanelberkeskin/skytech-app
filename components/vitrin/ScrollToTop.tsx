"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Ekranı kaplayan (sticky) anlatı sahneleri `data-immersive` ile işaretlenir.
 * Böyle bir sahne görünümü tamamen doldururken düğme gizlenir; aksi hâlde
 * sahnenin alt köşesindeki içeriğin (ör. mobilde altyazı kartı) üstüne biner.
 */
function isImmersivePinned(): boolean {
  const sections = document.querySelectorAll<HTMLElement>("[data-immersive]");
  for (const section of sections) {
    const rect = section.getBoundingClientRect();
    if (rect.top <= 0 && rect.bottom >= window.innerHeight) return true;
  }
  return false;
}

export default function ScrollToTop() {
  const t = useTranslations("common");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > 400 && !isImmersivePinned());
    };
    // Ölçüm rAF'a ertelenir: kaydırma olayı başına en fazla bir düzen okuması.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("scrollTop")}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-6 right-6 z-30 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      style={{
        background: "linear-gradient(135deg, #1B6B3A 0%, #22894a 100%)",
        boxShadow: "0 8px 24px rgba(27, 107, 58, 0.35), 0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <polyline points="18 15 12 9 6 15" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
