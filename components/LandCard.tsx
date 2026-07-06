"use client";

import type { Land } from "@/lib/types";

interface LandCardProps {
  land: Land;
  onReserve?: (landId: string) => void;
}

export default function LandCard({ land, onReserve }: LandCardProps) {
  const total = land.capacity_seeds;
  const filled = land.filled_seeds;
  const reserved = land.reserved_seeds;
  const available = total - filled - reserved;
  const isFull = land.status === "full" || available <= 0;
  const fullnessPct = Math.round(((filled + reserved) / total) * 100);
  const filledPct = Math.round((filled / total) * 100);

  const statusConfig: Record<string, { label: string; color: string; glow: string }> = {
    open:       { label: "Açık",          color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20", glow: "shadow-emerald-500/10" },
    full:       { label: "Dolu",          color: "text-rose-300 bg-rose-500/10 border-rose-500/20", glow: "shadow-rose-500/10" },
    scheduled:  { label: "Planlandı",     color: "text-sky-300 bg-sky-500/10 border-sky-500/20", glow: "shadow-sky-500/10" },
    seeded:     { label: "Ekim Başladı",  color: "text-amber-300 bg-amber-500/10 border-amber-500/20", glow: "shadow-amber-500/10" },
    monitoring: { label: "İzlemede",       color: "text-violet-300 bg-violet-500/10 border-violet-500/20", glow: "shadow-violet-500/10" },
    closed:     { label: "Kapalı",        color: "text-slate-400 bg-slate-500/10 border-slate-500/20", glow: "" },
  };

  const badge = statusConfig[land.status] ?? statusConfig.open;

  return (
    <div className="liquid-glass relative rounded-3xl overflow-hidden liquid-glass-hover group">
      {/* Full overlay */}
      {isFull && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm rounded-3xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white font-semibold text-lg">Ekim Başladı</p>
          <p className="text-emerald-200/50 text-sm mt-1">Bu arazi kapasiteye ulaştı</p>
        </div>
      )}

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-lg truncate group-hover:text-emerald-100 transition-colors">
              {land.name}
            </h3>
            {land.region && (
              <p className="text-sm text-emerald-200/40 mt-0.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {land.region}
              </p>
            )}
          </div>
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${badge.color} ${badge.glow} shrink-0`}>
            {badge.label}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-5">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-emerald-200/40">Kapasite</span>
            <span className="text-emerald-200/60 font-medium">{filled + reserved} / {total} · %{fullnessPct}</span>
          </div>
          <div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden">
            <div className="h-full relative rounded-full overflow-hidden transition-all duration-700 ease-out"
              style={{ width: `${Math.min(fullnessPct, 100)}%` }}>
              {/* Filled portion */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-400"
                style={{ width: fullnessPct > 0 ? `${(filledPct / fullnessPct) * 100}%` : '0%' }}
              />
              {/* Reserved portion */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-teal-400/60 to-teal-300/50 progress-liquid"
                style={{
                  left: fullnessPct > 0 ? `${(filledPct / fullnessPct) * 100}%` : '0%',
                  width: fullnessPct > 0 ? `${((fullnessPct - filledPct) / fullnessPct) * 100}%` : '0%'
                }}
              />
            </div>
          </div>
          <div className="flex gap-5 mt-2.5 text-xs text-emerald-200/30">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Ekili ({filled})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400/60" />
              Rezerve ({reserved})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/[0.08]" />
              Boş ({available < 0 ? 0 : available})
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="glass-subtle rounded-2xl px-4 py-3 text-center">
            <p className="text-xl font-bold text-teal-300">{reserved}</p>
            <p className="text-[11px] text-emerald-200/30 mt-0.5">Rezerve</p>
          </div>
          <div className="glass-subtle rounded-2xl px-4 py-3 text-center">
            <p className={`text-xl font-bold ${available > 0 ? "text-emerald-300" : "text-rose-400"}`}>
              {available < 0 ? 0 : available}
            </p>
            <p className="text-[11px] text-emerald-200/30 mt-0.5">Müsait</p>
          </div>
        </div>

        {/* Button */}
        {onReserve && (
          <button
            onClick={() => onReserve(land.id)}
            disabled={isFull}
            className={`w-full py-3 rounded-2xl font-medium text-sm transition-all duration-300 ${
              isFull
                ? "bg-white/[0.03] text-emerald-200/20 cursor-not-allowed border border-white/[0.04]"
                : "glass-btn text-white"
            }`}
          >
            {isFull ? "Kapasite Dolu" : "Tohum Rezerve Et"}
          </button>
        )}
      </div>
    </div>
  );
}
