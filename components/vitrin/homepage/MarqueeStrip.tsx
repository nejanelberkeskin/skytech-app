"use client";

import { useTranslations } from "next-intl";

export default function MarqueeStrip() {
  const t = useTranslations("marqueeStrip");
  const KEYWORDS = [
    t("keywords.reforestation"),
    t("keywords.carbonNeutral"),
    t("keywords.seedBall"),
    t("keywords.droneTech"),
    t("keywords.ecologicalImpact"),
    t("keywords.sustainability"),
    t("keywords.transparentSupply"),
    t("keywords.annualMonitoring"),
  ];
  return (
    <div
      className="relative overflow-hidden py-8 border-y border-[#1B6B3A]/20"
      style={{
        background:
          "linear-gradient(90deg, #0e2519 0%, #1B6B3A 25%, #22894a 50%, #1B6B3A 75%, #0e2519 100%)",
      }}
    >
      {/* Subtle inner glow */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(163, 230, 53, 0.20) 0%, transparent 60%)",
        }}
      />

      {/* Edge fade masks */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-32 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(90deg, #0e2519 0%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-32 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(270deg, #0e2519 0%, transparent 100%)",
        }}
      />

      <div className="marquee-container">
        <div className="marquee-track">
          {/* Render twice for seamless loop */}
          {[...Array(2)].map((_, repeat) => (
            <div key={repeat} className="flex items-center gap-14 pr-14 shrink-0">
              {KEYWORDS.map((word, i) => (
                <div key={`${repeat}-${i}`} className="flex items-center gap-14 shrink-0">
                  <span
                    className="text-2xl sm:text-3xl lg:text-4xl font-bold whitespace-nowrap tracking-tight"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.65) 100%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
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
      className="w-7 h-7 text-[#a3e635]/70 shrink-0"
      viewBox="0 0 32 32"
      fill="currentColor"
    >
      <path d="M27 5C27 5 22 4 16 6C10 8 6 13 6 19C6 22 8 25 11 26C8 24 7 21 7 19C7 14 11 9 17 8C12 11 9 16 9 20C9 24 11 27 14 27C20 27 26 22 27 5Z" />
    </svg>
  );
}
