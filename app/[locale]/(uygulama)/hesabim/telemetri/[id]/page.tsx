"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ── Mock Data Generators ─────────────────────────────────────────────

function mockNem() { return (55 + Math.random() * 20).toFixed(0); }
function mockPh() { return (6.2 + Math.random() * 1.2).toFixed(1); }
function mockTemp() { return (16 + Math.random() * 12).toFixed(0); }
function mockCO2(seeds: number) { return ((seeds / 100) * 0.015 * (1 + Math.random() * 0.3)).toFixed(3); }
function mockHumidity() { return (40 + Math.random() * 30).toFixed(0); }

const TIMELINE_STEPS = [
  { key: "seeded",    label: "Tohumlandı",    icon: "🌰", date: "12 Oca 2026" },
  { key: "sprouted",  label: "Filizlendi",    icon: "🌱", date: "28 Şub 2026" },
  { key: "sapling",   label: "Fidan",         icon: "🌿", date: "Tahmini: Haz 2026" },
  { key: "mature",    label: "Yetişkin Ağaç", icon: "🌳", date: "Tahmini: 2030+" },
];
const ACTIVE_STEP = 1; // "Filizlendi"

// ── Radar Blip Component ─────────────────────────────────────────────

function RadarBlip({ cx, cy, delay, color }: { cx: number; cy: number; delay: number; color: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="3" fill={color} opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2s" begin={`${delay}s`} repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r="8" fill="none" stroke={color} strokeWidth="1" opacity="0">
        <animate attributeName="r" values="3;12" dur="1.5s" begin={`${delay}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0" dur="1.5s" begin={`${delay}s`} repeatCount="indefinite" />
      </circle>
    </g>
  );
}

// ── Animated Counter ─────────────────────────────────────────────────

function AnimCounter({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    start.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    const animate = (ts: number) => {
      if (!start.current) start.current = ts;
      const p = Math.min((ts - start.current) / 1200, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(parseFloat((value * eased).toFixed(decimals)));
      if (p < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, decimals]);

  return (
    <span>
      {displayed.toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

// ── Main Telemetry Page ──────────────────────────────────────────────

export default function TelemetryPage() {
  const params = useParams();
  const orderId = params.id as string;

  // Mock order data
  const [orderData] = useState({
    id: orderId,
    landName: "Bolu 100. Yıl Otonom İmece Projesi",
    region: "Karadeniz",
    seeds: 250,
    plantedDate: "2026-01-12",
    status: "sprouted" as string,
  });

  // Telemetry data — simulated live updates
  const [telemetry, setTelemetry] = useState({
    nem: mockNem(),
    ph: mockPh(),
    temp: mockTemp(),
    co2: mockCO2(orderData.seeds),
    humidity: mockHumidity(),
    lastDrone: "Dün 14:30",
    droneStatus: "Sorunsuz",
    signalStrength: 87,
  });

  // Radar sweep angle
  const [sweepAngle, setSweepAngle] = useState(0);
  const sweepRef = useRef<number | null>(null);

  // Lite Mode — reduce animations on mobile to preserve battery & frame rate
  const [isLiteMode, setIsLiteMode] = useState(false);
  useEffect(() => {
    setIsLiteMode(window.innerWidth < 768);
    const onResize = () => setIsLiteMode(window.innerWidth < 768);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Live telemetry updates — 5 s desktop, 8 s mobile (Lite Mode)
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry({
        nem: mockNem(),
        ph: mockPh(),
        temp: mockTemp(),
        co2: mockCO2(orderData.seeds),
        humidity: mockHumidity(),
        lastDrone: "Dün 14:30",
        droneStatus: "Sorunsuz",
        signalStrength: 82 + Math.floor(Math.random() * 15),
      });
    }, isLiteMode ? 8000 : 5000);
    return () => clearInterval(interval);
  }, [orderData.seeds, isLiteMode]);

  // Radar sweep animation
  useEffect(() => {
    let last = 0;
    const rotate = (ts: number) => {
      if (!last) last = ts;
      const delta = ts - last;
      last = ts;
      setSweepAngle((prev) => (prev + delta * 0.04) % 360);
      sweepRef.current = requestAnimationFrame(rotate);
    };
    sweepRef.current = requestAnimationFrame(rotate);
    return () => { if (sweepRef.current) cancelAnimationFrame(sweepRef.current); };
  }, []);

  // Seed positions on radar — Lite Mode uses 4 blips on mobile (battery & perf)
  const allSeedBlips = [
    { cx: 155, cy: 130, delay: 0,   color: "#10b981" },
    { cx: 200, cy: 170, delay: 0.5, color: "#10b981" },
    { cx: 120, cy: 190, delay: 1.0, color: "#10b981" },
    { cx: 180, cy: 220, delay: 0.3, color: "#34d399" },
    { cx: 230, cy: 150, delay: 0.8, color: "#34d399" },
    { cx: 140, cy: 240, delay: 1.2, color: "#fbbf24" },
    { cx: 260, cy: 200, delay: 0.6, color: "#10b981" },
    { cx: 100, cy: 160, delay: 1.5, color: "#fbbf24" },
  ];
  const seedBlips = isLiteMode ? allSeedBlips.slice(0, 4) : allSeedBlips;

  const phVal = parseFloat(telemetry.ph);
  const phStatus = phVal >= 6.0 && phVal <= 7.5 ? "Optimal" : phVal < 6.0 ? "Asidik" : "Bazik";

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{
        background: "linear-gradient(135deg, #020617 0%, #0a0f1e 50%, #0f172a 100%)",
        color: "#e2e8f0",
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/hesabim/rezervasyonlar"
              className="text-slate-500 hover:text-white text-sm transition-colors"
            >
              ← Geri
            </Link>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-red-500"
                style={{ animation: "pulse 1.5s ease-in-out infinite" }}
              />
              <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
                Canlı Uydu Bağlantısı
              </span>
            </div>
          </div>
          <h1
            className="text-2xl font-black tracking-tight"
            style={{
              background: "linear-gradient(135deg, #e2e8f0 0%, #64748b 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Dijital İkiz — Otonom Kumanda Merkezi
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {orderData.landName} · {orderData.region} · #{orderId.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
          style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(52,211,153,0.2)",
            color: "rgb(52,211,153)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Sinyal: %{telemetry.signalStrength}
        </div>
      </div>

      {/* ── Main Grid: 3 columns ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* ─── Left Column: Soil & Climate ─── */}
        <div className="space-y-5">
          {/* Soil Analysis */}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🌡️</span>
              <h3 className="text-sm font-bold text-white">Toprak & İklim Analizi</h3>
            </div>

            <div className="space-y-3">
              {/* Nem */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Toprak Nemi</span>
                  <span className="font-bold text-sky-400">%{telemetry.nem}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(30,41,59,0.8)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${telemetry.nem}%`,
                      background: "linear-gradient(90deg, #0ea5e9, #38bdf8)",
                      boxShadow: "0 0 8px rgba(14,165,233,0.4)",
                    }}
                  />
                </div>
              </div>

              {/* pH */}
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-xs text-slate-400">Toprak pH</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{telemetry.ph}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: phStatus === "Optimal"
                        ? "rgba(16,185,129,0.15)"
                        : "rgba(245,158,11,0.15)",
                      color: phStatus === "Optimal" ? "rgb(52,211,153)" : "rgb(251,191,36)",
                      border: `1px solid ${phStatus === "Optimal" ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)"}`,
                    }}
                  >
                    {phStatus}
                  </span>
                </div>
              </div>

              {/* Temperature */}
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-xs text-slate-400">Bölgesel Sıcaklık</span>
                <span className="text-sm font-bold text-amber-400">{telemetry.temp}°C</span>
              </div>

              {/* Humidity */}
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-xs text-slate-400">Hava Nemi</span>
                <span className="text-sm font-bold text-sky-300">%{telemetry.humidity}</span>
              </div>
            </div>
          </div>

          {/* Carbon Capture */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(135deg, rgba(5,150,105,0.08), rgba(16,185,129,0.04))",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(52,211,153,0.12)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🌬️</span>
              <h3 className="text-sm font-bold text-white">Karbon Emici Durumu</h3>
            </div>
            <div className="text-center py-3">
              <p
                className="text-4xl font-black tabular-nums"
                style={{
                  color: "rgb(52,211,153)",
                  textShadow: "0 0 30px rgba(16,185,129,0.3)",
                }}
              >
                <AnimCounter value={parseFloat(telemetry.co2)} decimals={3} />
              </p>
              <p className="text-xs text-slate-400 mt-1">Ton CO₂ temizlendi (kümülatif)</p>
            </div>
            <div
              className="mt-3 p-3 rounded-xl text-xs text-center"
              style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(52,211,153,0.1)" }}
            >
              <span className="text-emerald-400">
                {orderData.seeds} tohum × yıllık ~0.015 ton/tohum
              </span>
            </div>
          </div>
        </div>

        {/* ─── Center Column: Radar ─── */}
        <div
          className="rounded-2xl p-5 flex flex-col transform-gpu"
          style={{
            background: "rgba(255,255,255,0.02)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📡</span>
              <h3 className="text-sm font-bold text-white">Radar / Topografik Görüntü</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full bg-red-500"
                style={{ animation: "pulse 1.5s ease-in-out infinite" }}
              />
              <span className="text-xs text-red-400 font-semibold">CANLI</span>
            </div>
          </div>

          {/* SVG Radar */}
          <div className="flex-1 flex items-center justify-center"
            style={{ willChange: "transform", transform: "translateZ(0)" }}>
            <svg
              viewBox="0 0 350 350"
              className="w-full max-w-[320px] h-auto"
              style={{ filter: "drop-shadow(0 0 20px rgba(16,185,129,0.1))" }}
            >
              <defs>
                <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(16,185,129,0.05)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
                <linearGradient id="sweepGrad" gradientTransform={`rotate(${sweepAngle}, 175, 175)`}>
                  <stop offset="0%" stopColor="rgba(16,185,129,0)" />
                  <stop offset="70%" stopColor="rgba(16,185,129,0.08)" />
                  <stop offset="100%" stopColor="rgba(16,185,129,0.25)" />
                </linearGradient>
              </defs>

              {/* Background */}
              <circle cx="175" cy="175" r="165" fill="url(#radarBg)" stroke="rgba(52,211,153,0.1)" strokeWidth="1" />

              {/* Concentric rings */}
              {[55, 110, 165].map((r) => (
                <circle key={r} cx="175" cy="175" r={r} fill="none" stroke="rgba(52,211,153,0.08)" strokeWidth="0.5" />
              ))}

              {/* Cross-hairs */}
              <line x1="10" y1="175" x2="340" y2="175" stroke="rgba(52,211,153,0.06)" strokeWidth="0.5" />
              <line x1="175" y1="10" x2="175" y2="340" stroke="rgba(52,211,153,0.06)" strokeWidth="0.5" />
              <line x1="50" y1="50" x2="300" y2="300" stroke="rgba(52,211,153,0.04)" strokeWidth="0.5" />
              <line x1="300" y1="50" x2="50" y2="300" stroke="rgba(52,211,153,0.04)" strokeWidth="0.5" />

              {/* Sweep beam */}
              <path
                d={`M 175,175 L ${175 + 165 * Math.cos((sweepAngle * Math.PI) / 180)},${175 + 165 * Math.sin((sweepAngle * Math.PI) / 180)} A 165,165 0 0,0 ${175 + 165 * Math.cos(((sweepAngle - 40) * Math.PI) / 180)},${175 + 165 * Math.sin(((sweepAngle - 40) * Math.PI) / 180)} Z`}
                fill="rgba(16,185,129,0.08)"
              />
              <line
                x1="175"
                y1="175"
                x2={175 + 165 * Math.cos((sweepAngle * Math.PI) / 180)}
                y2={175 + 165 * Math.sin((sweepAngle * Math.PI) / 180)}
                stroke="rgba(52,211,153,0.4)"
                strokeWidth="1"
              />

              {/* Topographic texture lines */}
              <ellipse cx="170" cy="180" rx="80" ry="50" fill="none" stroke="rgba(52,211,153,0.06)" strokeWidth="0.5" />
              <ellipse cx="170" cy="180" rx="55" ry="35" fill="none" stroke="rgba(52,211,153,0.08)" strokeWidth="0.5" />
              <ellipse cx="170" cy="185" rx="30" ry="18" fill="none" stroke="rgba(52,211,153,0.1)" strokeWidth="0.5" />

              {/* Seed blips */}
              {seedBlips.map((blip, i) => (
                <RadarBlip key={i} {...blip} />
              ))}

              {/* Center dot */}
              <circle cx="175" cy="175" r="2" fill="rgba(52,211,153,0.6)" />

              {/* Labels */}
              <text x="175" y="22" textAnchor="middle" fontSize="8" fill="rgba(148,163,184,0.5)">K</text>
              <text x="175" y="342" textAnchor="middle" fontSize="8" fill="rgba(148,163,184,0.5)">G</text>
              <text x="8" y="178" textAnchor="middle" fontSize="8" fill="rgba(148,163,184,0.5)">B</text>
              <text x="345" y="178" textAnchor="middle" fontSize="8" fill="rgba(148,163,184,0.5)">D</text>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Aktif filiz
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Tohumlanan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Canlı sinyal
            </span>
          </div>
        </div>

        {/* ─── Right Column: Drone & Stats ─── */}
        <div className="space-y-5">
          {/* Drone Status */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🚁</span>
              <h3 className="text-sm font-bold text-white">Drone Devriye Raporu</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-slate-400">Son Devriye</span>
                <span className="text-sm font-bold text-white">{telemetry.lastDrone}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-xs text-slate-400">Durum</span>
                <span
                  className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(16,185,129,0.12)",
                    color: "rgb(52,211,153)",
                    border: "1px solid rgba(52,211,153,0.2)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {telemetry.droneStatus}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-xs text-slate-400">Tohum Sayısı</span>
                <span className="text-sm font-bold text-emerald-400">{orderData.seeds} adet</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-xs text-slate-400">Ekim Alanı</span>
                <span className="text-sm font-bold text-white">{orderData.landName}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Tohum", value: orderData.seeds.toString(), icon: "🌱", color: "#10b981" },
              { label: "Yaş (gün)", value: String(Math.floor((Date.now() - new Date(orderData.plantedDate).getTime()) / 86400000)), icon: "📅", color: "#38bdf8" },
              { label: "Hayatta", value: "98%", icon: "💚", color: "#34d399" },
              { label: "Sonraki Drone", value: "2 gün", icon: "🛸", color: "#a78bfa" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-3 text-center"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span className="text-lg block">{s.icon}</span>
                <p className="text-lg font-black mt-1" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Alert */}
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{
              background: "rgba(16,185,129,0.05)",
              border: "1px solid rgba(52,211,153,0.12)",
            }}
          >
            <span className="text-lg shrink-0">✅</span>
            <div>
              <p className="text-xs font-bold text-emerald-400">Tüm Sistemler Normal</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Tohumlarınız sağlıklı bir şekilde büyümeye devam ediyor.
                Bir sonraki otonom drone devriyesi 2 gün içinde gerçekleşecek.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <h3 className="text-sm font-bold text-white mb-6">🌿 Yaşam Döngüsü Çizelgesi</h3>

        <div className="relative flex items-start justify-between">
          {/* Connecting line */}
          <div
            className="absolute top-5 left-0 right-0 h-0.5"
            style={{ background: "rgba(51,65,85,0.5)" }}
          />
          {/* Active portion of line */}
          <div
            className="absolute top-5 left-0 h-0.5 transition-all duration-1000"
            style={{
              width: `${((ACTIVE_STEP + 0.5) / TIMELINE_STEPS.length) * 100}%`,
              background: "linear-gradient(90deg, #10b981, #34d399)",
              boxShadow: "0 0 10px rgba(16,185,129,0.5)",
            }}
          />

          {TIMELINE_STEPS.map((step, i) => {
            const isActive = i === ACTIVE_STEP;
            const isPast = i < ACTIVE_STEP;
            const isFuture = i > ACTIVE_STEP;

            return (
              <div key={step.key} className="relative flex flex-col items-center text-center z-10" style={{ flex: 1 }}>
                {/* Dot */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 transition-all duration-500 ${
                    isActive ? "scale-110" : ""
                  }`}
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg, #059669, #10b981)"
                      : isPast
                      ? "rgba(16,185,129,0.2)"
                      : "rgba(30,41,59,0.8)",
                    border: isActive
                      ? "2px solid rgba(52,211,153,0.6)"
                      : isPast
                      ? "1px solid rgba(52,211,153,0.3)"
                      : "1px solid rgba(51,65,85,0.5)",
                    boxShadow: isActive ? "0 0 20px rgba(16,185,129,0.4)" : "none",
                  }}
                >
                  {step.icon}
                </div>

                {/* Label */}
                <p
                  className={`text-xs font-bold mt-3 ${
                    isActive ? "text-emerald-400" : isPast ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">{step.date}</p>

                {/* Active indicator */}
                {isActive && (
                  <div
                    className="mt-2 px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      background: "rgba(16,185,129,0.12)",
                      color: "rgb(52,211,153)",
                      border: "1px solid rgba(52,211,153,0.25)",
                    }}
                  >
                    Şu anki durum
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Global keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
