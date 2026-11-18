"use client";

import { useTranslations } from "next-intl";

export default function MarqueeStrip() {
  const t = useTranslations("marqueeStrip");
  const KEYWORDS = [
    t("keywords.reforestation"),
    t("keywords.regeneration"),
    t("keywords.seedBall"),
    t("keywords.droneTech"),
    t("keywords.ecologicalImpact"),
    t("keywords.sustainability"),
    t("keywords.transparentSupply"),
    t("keywords.annualMonitoring"),
  ];
  return (
    <div className="relative overflow-hidden border-y border-[#14261a]/10 bg-white py-6">
      <div className="marquee-container">
        <div className="marquee-track">
          {/* Render twice for seamless loop */}
          {[...Array(2)].map((_, repeat) => (
            <div key={repeat} className="flex items-center gap-14 pr-14 shrink-0">
              {KEYWORDS.map((word, i) => (
                <div key={`${repeat}-${i}`} className="flex items-center gap-14 shrink-0">
                  <span className="whitespace-nowrap text-xl font-semibold tracking-tight text-[#14261a] sm:text-2xl lg:text-3xl">
                    {word}
                  </span>
                  <LeafDivider />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeafDivider() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-[#1B6B3A]"
      viewBox="0 0 32 32"
      fill="currentColor"
    >
      <path d="M27 5C27 5 22 4 16 6C10 8 6 13 6 19C6 22 8 25 11 26C8 24 7 21 7 19C7 14 11 9 17 8C12 11 9 16 9 20C9 24 11 27 14 27C20 27 26 22 27 5Z" />
    </svg>
  );
}
