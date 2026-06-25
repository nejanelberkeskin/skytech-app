"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────

interface CompanyForestData {
  profile: {
    id: string;
    company_name: string;
    slug: string;
    logo_url: string | null;
    website_url: string | null;
    sector: string | null;
    employee_count: number | null;
    carbon_goal: string | null;
  };
  stats: {
    total_seeds: number;
    total_invested: number;
    co2_tons: number;
    o2_tons: number;
    land_ha: number;
    quote_count: number;
    latest_paid_at: string | null;
  };
  regions: Record<string, number>;
}

// ── Turkey SVG Map ───────────────────────────────────────────────────

const REGION_DEFS: Record<
  string,
  { d: string; cx: number; cy: number; short: string; aliases: string[] }
> = {
  Marmara: {
    aliases: ["marmara", "istanbul", "bursa", "edirne", "tekirdağ", "kocaeli", "sakarya", "bolu", "yalova", "bilecik"],
    short: "MAR",
    cx: 155,
    cy: 60,
    d: "M 0,0 L 250,0 L 255,40 L 240,80 L 200,100 L 160,115 L 130,90 L 100,80 L 60,75 L 30,55 L 0,50 Z",
  },
  Ege: {
    aliases: ["ege", "izmir", "aydın", "denizli", "muğla", "manisa", "afyon", "uşak", "kütahya"],
    short: "EGE",
    cx: 80,
    cy: 175,
    d: "M 0,50 L 60,75 L 100,80 L 130,90 L 140,140 L 130,180 L 110,220 L 80,250 L 50,260 L 20,240 L 0,200 Z",
  },
  Akdeniz: {
    aliases: ["akdeniz", "antalya", "mersin", "adana", "hatay", "isparta", "burdur", "kahramanmaraş"],
    short: "AKD",
    cx: 200,
    cy: 290,
    d: "M 50,260 L 80,250 L 110,220 L 130,180 L 180,200 L 230,210 L 280,240 L 320,255 L 360,260 L 380,290 L 340,310 L 280,320 L 220,315 L 160,305 L 100,300 Z",
  },
  "İç Anadolu": {
    aliases: ["iç anadolu", "ankara", "konya", "eskişehir", "sivas", "yozgat", "kırşehir", "nevşehir", "aksaray", "niğde", "karaman"],
    short: "İÇA",
    cx: 260,
    cy: 175,
    d: "M 160,115 L 200,100 L 255,40 L 350,50 L 400,70 L 430,100 L 420,150 L 400,190 L 360,205 L 320,210 L 280,240 L 230,210 L 180,200 L 130,180 L 140,140 L 160,115 Z",
  },
  Karadeniz: {
    aliases: ["karadeniz", "trabzon", "samsun", "zonguldak", "sinop", "kastamonu", "bartın", "karabük", "artvin", "rize", "giresun", "ordu", "amasya", "tokat", "çorum"],
    short: "KAR",
    cx: 370,
    cy: 50,
    d: "M 255,40 L 350,50 L 400,70 L 430,100 L 500,90 L 560,80 L 620,70 L 680,60 L 720,50 L 750,40 L 800,30 L 800,0 L 600,0 L 400,0 L 255,0 Z",
  },
  "Doğu Anadolu": {
    aliases: ["doğu anadolu", "erzurum", "erzincan", "kars", "ağrı", "iğdır", "ardahan", "van", "bitlis", "muş", "bingöl", "tunceli", "elazığ", "malatya"],
    short: "DOĞ",
    cx: 570,
    cy: 175,
    d: "M 430,100 L 500,90 L 560,80 L 620,70 L 680,60 L 720,50 L 750,40 L 800,30 L 800,200 L 730,230 L 680,220 L 620,240 L 570,255 L 520,245 L 470,220 L 420,200 L 420,150 L 430,100 Z",
  },
  "Güneydoğu Anadolu": {
    aliases: ["güneydoğu anadolu", "gaziantep", "şanlıurfa", "diyarbakır", "batman", "siirt", "şırnak", "mardin", "adıyaman", "kilis"],
    short: "GDA",
    cx: 530,
    cy: 300,
    d: "M 360,260 L 380,290 L 420,310 L 480,320 L 540,330 L 600,320 L 660,310 L 720,290 L 730,230 L 680,220 L 620,240 L 570,255 L 520,245 L 470,220 L 420,200 L 400,190 L 360,205 L 320,210 L 280,240 L 320,255 Z",
  },
};

function getGeoRegion(regionStr: string | null): string | null {
  if (!regionStr) return null;
  const lower = regionStr.toLowerCase();
  for (const [key, def] of Object.entries(REGION_DEFS)) {
    if (def.aliases.some((a) => lower.includes(a))) return key;
  }
  return null;
}

function TurkeyMapViz({
  regions,
  totalSeeds,
}: {
  regions: Record<string, number>;
  totalSeeds: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Map raw region strings from DB to canonical names
  const canonicalRegions: Record<string, number> = {};
  for (const [rawRegion, seeds] of Object.entries(regions)) {
    const canonical = getGeoRegion(rawRegion) ?? rawRegion;
    canonicalRegions[canonical] = (canonicalRegions[canonical] ?? 0) + seeds;
  }

  const maxSeeds = Math.max(...Object.values(canonicalRegions), 1);

  return (
    <div className="relative">
      <svg
        viewBox="0 0 800 420"
        className="w-full h-auto"
        style={{ filter: "drop-shadow(0 0 20px rgba(16,185,129,0.15))" }}
      >
        <defs>
          <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background ocean */}
        <rect width="800" height="420" fill="rgba(15,23,42,0.0)" rx="12" />

        {Object.entries(REGION_DEFS).map(([name, def]) => {
          const seeds = canonicalRegions[name] ?? 0;
          const hasData = seeds > 0;
          const intensity = hasData ? 0.25 + (seeds / maxSeeds) * 0.75 : 0;
          const isHovered = hovered === name;

          return (
            <g key={name}>
              <path
                d={def.d}
                fill={
                  hasData
                    ? `rgba(16,185,129,${intensity})`
                    : "rgba(30,41,59,0.4)"
                }
                stroke={hasData ? "rgba(52,211,153,0.6)" : "rgba(51,65,85,0.5)"}
                strokeWidth={isHovered ? 2 : 1}
                style={{
                  transition: "all 0.3s ease",
                  cursor: hasData ? "pointer" : "default",
                  filter: isHovered && hasData ? "url(#glow)" : "none",
                }}
                onMouseEnter={() => setHovered(name)}
                onMouseLeave={() => setHovered(null)}
              />
              {/* Glow pulse for active regions */}
              {hasData && (
                <circle
                  cx={def.cx}
                  cy={def.cy}
                  r={8 + (seeds / maxSeeds) * 16}
                  fill="rgba(16,185,129,0.15)"
                  style={{
                    animation: "glowPulse 2s ease-in-out infinite",
                    animationDelay: `${Math.random() * 1}s`,
                  }}
                />
              )}
              <text
                x={def.cx}
                y={def.cy + 4}
                textAnchor="middle"
                fontSize={hasData ? "10" : "9"}
                fontWeight={hasData ? "700" : "400"}
                fill={hasData ? "rgba(52,211,153,0.9)" : "rgba(100,116,139,0.6)"}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {def.short}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div
            className="px-3 py-2 rounded-lg text-xs text-center whitespace-nowrap"
            style={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(52,211,153,0.3)", color: "#e2e8f0" }}
          >
            <div className="font-semibold text-emerald-400">{hovered}</div>
            <div>
              {(canonicalRegions[hovered] ?? 0) > 0
                ? `🌱 ${(canonicalRegions[hovered] ?? 0).toLocaleString("tr-TR")} tohum`
                : "Henüz ekim yok"}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes glowPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

// ── Animated Counter ─────────────────────────────────────────────────

function AnimatedCount({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const DURATION = 1400;

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(parseFloat((value * eased).toFixed(decimals)));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, decimals]);

  return (
    <span>
      {decimals > 0
        ? displayed.toLocaleString("tr-TR", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : displayed.toLocaleString("tr-TR")}
      {suffix}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export default function CompanyForestPage() {
  const params = useParams();
  const slug = params["company-slug"] as string;

  const [data, setData] = useState<CompanyForestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/orman/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Firma bulunamadı");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "var(--bg-base)" }}
      >
        <span className="text-6xl">🌲</span>
        <p className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Orman sayfası bulunamadı
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Bu firma henüz herkese açık bir orman profili oluşturmamış.
        </p>
        <Link
          href="/"
          className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-xl font-medium transition-colors"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    );
  }

  const { profile, stats, regions } = data;
  const latestDate = stats.latest_paid_at
    ? new Date(stats.latest_paid_at).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--bg-base)" }}
    >
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(5,150,105,0.15) 0%, rgba(6,78,59,0.08) 50%, transparent 100%)",
          borderBottom: "1px solid rgba(52,211,153,0.1)",
        }}
      >
        {/* Decorative glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 100%)",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 py-16">
          <div className="flex flex-col items-center text-center gap-6">
            {/* Logo or Avatar */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
              style={{
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(52,211,153,0.25)",
              }}
            >
              {profile.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt={profile.company_name}
                  className="w-full h-full object-contain rounded-2xl"
                />
              ) : (
                "🏢"
              )}
            </div>

            {/* Carbon neutral badge */}
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(52,211,153,0.25)",
                color: "rgb(52,211,153)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                style={{ animation: "glowPulse 2s ease-in-out infinite" }}
              />
              Carbon Neutral Partner — Skytech Green
            </div>

            <div>
              <h1
                className="text-4xl md:text-5xl font-black mb-3 tracking-tight"
                style={{
                  background: "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {profile.company_name}
              </h1>
              {(profile.sector || profile.carbon_goal) && (
                <p
                  className="text-base"
                  style={{ color: "var(--text-muted)" }}
                >
                  {[profile.sector, profile.carbon_goal]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>

            {/* Share buttons */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={copyLink}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: copied ? "rgba(16,185,129,0.15)" : "rgba(30,41,59,0.5)",
                  border: copied
                    ? "1px solid rgba(52,211,153,0.4)"
                    : "1px solid rgba(51,65,85,0.5)",
                  color: copied ? "rgb(52,211,153)" : "var(--text-secondary)",
                }}
              >
                {copied ? "✓ Kopyalandı" : "🔗 Linki Paylaş"}
              </button>

              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                  typeof window !== "undefined" ? window.location.href : ""
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: "rgba(10,102,194,0.15)",
                  border: "1px solid rgba(10,102,194,0.3)",
                  color: "rgb(96,165,250)",
                }}
              >
                LinkedIn
              </a>

              {profile.website_url && (
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: "rgba(30,41,59,0.5)",
                    border: "1px solid rgba(51,65,85,0.5)",
                    color: "var(--text-muted)",
                  }}
                >
                  🌐 Web Sitesi
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 -mt-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              emoji: "🌱",
              label: "Toplam Tohum",
              value: <AnimatedCount value={stats.total_seeds} />,
              sub: "ekildi",
              color: "rgba(16,185,129,0.12)",
              border: "rgba(52,211,153,0.2)",
              text: "rgb(52,211,153)",
            },
            {
              emoji: "☁️",
              label: "CO₂ Tutuldu",
              value: <AnimatedCount value={stats.co2_tons} decimals={1} />,
              sub: "ton/yıl",
              color: "rgba(59,130,246,0.12)",
              border: "rgba(96,165,250,0.2)",
              text: "rgb(96,165,250)",
            },
            {
              emoji: "💨",
              label: "O₂ Üretildi",
              value: <AnimatedCount value={stats.o2_tons} decimals={1} />,
              sub: "ton/yıl",
              color: "rgba(139,92,246,0.12)",
              border: "rgba(167,139,250,0.2)",
              text: "rgb(167,139,250)",
            },
            {
              emoji: "🗺️",
              label: "Ormanlık Alan",
              value: <AnimatedCount value={stats.land_ha} decimals={2} />,
              sub: "hektar",
              color: "rgba(245,158,11,0.12)",
              border: "rgba(251,191,36,0.2)",
              text: "rgb(251,191,36)",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl p-5 text-center"
              style={{
                background: card.color,
                border: `1px solid ${card.border}`,
              }}
            >
              <div className="text-2xl mb-2">{card.emoji}</div>
              <div
                className="text-2xl font-black tabular-nums"
                style={{ color: card.text }}
              >
                {card.value}
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                {card.label}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {card.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Map + Info ──────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 mt-10 pb-16">
        <div className="grid md:grid-cols-5 gap-6">
          {/* Turkey Map */}
          <div
            className="md:col-span-3 rounded-2xl p-6"
            style={{
              background: "rgba(15,23,42,0.6)",
              border: "1px solid rgba(30,41,59,0.8)",
            }}
          >
            <div className="mb-4">
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                🗺️ Ekim Bölgeleri
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Parlayan bölgeler aktif ekim alanlarını göstermektedir
              </p>
            </div>
            <TurkeyMapViz regions={regions} totalSeeds={stats.total_seeds} />

            {/* Region legend */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Object.entries(regions)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([region, seeds]) => (
                  <div key={region} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: "rgb(52,211,153)" }}
                    />
                    <span
                      className="text-xs truncate"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {region}
                    </span>
                    <span
                      className="text-xs font-semibold ml-auto shrink-0"
                      style={{ color: "rgb(52,211,153)" }}
                    >
                      {seeds.toLocaleString("tr-TR")}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Company Info Card */}
          <div className="md:col-span-2 flex flex-col gap-4">
            {/* Company details */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: "rgba(15,23,42,0.6)",
                border: "1px solid rgba(30,41,59,0.8)",
              }}
            >
              <h2
                className="text-lg font-bold mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                🏢 Firma Bilgileri
              </h2>
              <div className="space-y-3">
                {profile.sector && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Sektör
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {profile.sector}
                    </span>
                  </div>
                )}
                {profile.employee_count && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Çalışan Sayısı
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {profile.employee_count.toLocaleString("tr-TR")} kişi
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Ekim Paketi
                  </span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {stats.quote_count} proje
                  </span>
                </div>
                {latestDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Son Ekim
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {latestDate}
                    </span>
                  </div>
                )}
                {profile.carbon_goal && (
                  <div
                    className="mt-3 p-3 rounded-xl"
                    style={{
                      background: "rgba(16,185,129,0.08)",
                      border: "1px solid rgba(52,211,153,0.15)",
                    }}
                  >
                    <p className="text-xs" style={{ color: "rgb(52,211,153)" }}>
                      🎯 {profile.carbon_goal}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ESG Impact */}
            <div
              className="rounded-2xl p-6"
              style={{
                background:
                  "linear-gradient(135deg, rgba(5,150,105,0.12) 0%, rgba(6,78,59,0.08) 100%)",
                border: "1px solid rgba(52,211,153,0.15)",
              }}
            >
              <h2
                className="text-lg font-bold mb-3"
                style={{ color: "var(--text-primary)" }}
              >
                🌍 ESG Taahhüdü
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                <strong style={{ color: "rgb(52,211,153)" }}>
                  {profile.company_name}
                </strong>{" "}
                Skytech Green iş birliğiyle{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {stats.total_seeds.toLocaleString("tr-TR")} tohum
                </strong>{" "}
                ekerek Türkiye'nin yeşil geleceğine katkı sağlıyor.
              </p>
              <div
                className="mt-4 text-center py-3 rounded-xl text-xs font-bold tracking-wide"
                style={{
                  background: "rgba(16,185,129,0.15)",
                  color: "rgb(52,211,153)",
                  border: "1px solid rgba(52,211,153,0.2)",
                }}
              >
                ✓ Doğrulanmış Karbon Ortağı
              </div>
            </div>

            {/* CTA */}
            <Link
              href="/kurumsal/teklif-al"
              className="w-full py-3.5 rounded-2xl text-center text-sm font-bold transition-all"
              style={{
                background: "linear-gradient(135deg, #059669, #0d9488)",
                color: "white",
                boxShadow: "0 4px 20px rgba(5,150,105,0.3)",
              }}
            >
              🌱 Siz de Orman Kurun
            </Link>
          </div>
        </div>
      </div>

      {/* Global keyframes */}
      <style>{`
        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
      `}</style>
    </main>
  );
}
