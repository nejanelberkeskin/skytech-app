"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/admin-context";
import RoleGuard from "@/components/RoleGuard";
import { CardStat } from "@/components/ui";
import { ROLE_META } from "@/lib/rbac";

// ── Tip tanımları ─────────────────────────────────────────────────────────────
interface MonthlyPoint {
  month: string;
  revenue: number;
  seeds: number;
}

interface CapacityAlert {
  id: string;
  name: string;
  pct: number;
  available: number;
  status: string;
  is_public: boolean;
}

interface DashboardData {
  kpis: {
    totalRevenue: number;
    totalFilledSeeds: number;
    totalCapacity: number;
    carbonTons: number;
    pendingB2b: number;
    quotedB2b: number;
    totalLands: number;
  };
  monthlyGrowth: MonthlyPoint[];
  capacityAlerts: CapacityAlert[];
}

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────
function BarChart({ data }: { data: MonthlyPoint[] }) {
  if (!data.length) return null;

  const W = 600;
  const H = 160;
  const PAD = { top: 12, right: 16, bottom: 32, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const barW = Math.floor((chartW / data.length) * 0.55);
  const gap = chartW / data.length;

  // Y eksen ticks (3 adet)
  const yTicks = [0, 0.5, 1].map((r) => ({
    val: maxRevenue * r,
    y: PAD.top + chartH * (1 - r),
  }));

  const formatRevenue = (v: number) => {
    if (v >= 1_000_000) return `₺${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `₺${(v / 1_000).toFixed(0)}K`;
    return `₺${v}`;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 160 }}
      aria-label="Aylık gelir grafiği"
    >
      {/* Y grid çizgileri */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={t.y}
            y2={t.y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
          <text
            x={PAD.left - 8}
            y={t.y + 4}
            textAnchor="end"
            fontSize="9"
            fill="rgba(148,163,184,0.7)"
          >
            {formatRevenue(t.val)}
          </text>
        </g>
      ))}

      {/* Barlar */}
      {data.map((d, i) => {
        const x = PAD.left + i * gap + gap / 2 - barW / 2;
        const pct = d.revenue / maxRevenue;
        const barH = Math.max(pct * chartH, 2);
        const y = PAD.top + chartH - barH;

        return (
          <g key={i}>
            {/* Glow efekti */}
            <rect
              x={x - 1}
              y={y - 1}
              width={barW + 2}
              height={barH + 2}
              rx="5"
              fill="rgba(16,185,129,0.12)"
              filter="blur(4px)"
            />
            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx="4"
              fill="url(#emeraldGrad)"
            />
            {/* Değer etiketi (büyük barlarda göster) */}
            {pct > 0.2 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="8"
                fill="rgba(52,211,153,0.8)"
              >
                {formatRevenue(d.revenue)}
              </text>
            )}
            {/* X ekseni ay etiketi */}
            <text
              x={x + barW / 2}
              y={H - 4}
              textAnchor="middle"
              fontSize="9"
              fill="rgba(148,163,184,0.6)"
            >
              {d.month}
            </text>
          </g>
        );
      })}

      {/* Gradient tanımı */}
      <defs>
        <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Tohum Grafiği ─────────────────────────────────────────────────────────────
function SeedChart({ data }: { data: MonthlyPoint[] }) {
  if (!data.length) return null;

  const W = 600;
  const H = 100;
  const PAD = { top: 8, right: 16, bottom: 24, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxSeeds = Math.max(...data.map((d) => d.seeds), 1);

  // Polyline noktaları
  const points = data.map((d, i) => {
    const x = PAD.left + (i / (data.length - 1 || 1)) * chartW;
    const y = PAD.top + chartH * (1 - d.seeds / maxSeeds);
    return [x, y] as [number, number];
  });

  const pathD = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");

  // Alan dolgu için kapat
  const areaD =
    pathD +
    ` L ${points[points.length - 1][0]} ${PAD.top + chartH}` +
    ` L ${points[0][0]} ${PAD.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      <defs>
        <linearGradient id="seedAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Alan dolgu */}
      <path d={areaD} fill="url(#seedAreaGrad)" />
      {/* Çizgi */}
      <path d={pathD} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Noktalar */}
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#34d399" />
      ))}

      {/* X etiketleri */}
      {data.map((d, i) => {
        const x = PAD.left + (i / (data.length - 1 || 1)) * chartW;
        return (
          <text key={i} x={x} y={H - 2} textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.5)">
            {d.month}
          </text>
        );
      })}
    </svg>
  );
}

// ── Dashboard Content ─────────────────────────────────────────────────────────
function DashboardContent() {
  const { admin } = useAdmin();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
      }
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Her 60 saniyede otomatik yenile
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!admin) return null;

  const roleMeta = ROLE_META[admin.role];
  const kpis = data?.kpis;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* ── Başlık ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">Yönetim Paneli</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${roleMeta.color}`}>
              {roleMeta.icon} {roleMeta.label}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Hoş geldin, {admin.full_name} —{" "}
            <span className="text-slate-500 text-xs">
              Son güncelleme: {lastRefresh.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-xl hover:bg-white/[0.05] border border-white/[0.08]"
        >
          <span className={loading ? "animate-spin" : ""}>🔄</span>
          Yenile
        </button>
      </div>

      {/* ── KPI Kartları ── */}
      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {(admin.role === "SUPER_ADMIN" || admin.role === "FINANCE") && (
            <CardStat
              icon="💰"
              label="Toplam Ciro"
              value={
                kpis
                  ? kpis.totalRevenue >= 1_000_000
                    ? `₺${(kpis.totalRevenue / 1_000_000).toFixed(2)}M`
                    : `₺${kpis.totalRevenue.toLocaleString("tr-TR")}`
                  : "—"
              }
              sub="tüm zamanlar"
            />
          )}
          <CardStat
            icon="🌱"
            label="Dikilen Tohum"
            value={kpis ? kpis.totalFilledSeeds.toLocaleString("tr-TR") : "—"}
            sub="arazi toplamı"
          />
          <CardStat
            icon="♻️"
            label="Karbon Nötrleme"
            value={kpis ? `${kpis.carbonTons.toLocaleString("tr-TR")} Ton` : "—"}
            sub="tahmini CO₂"
          />
          {(admin.role === "SUPER_ADMIN" || admin.role === "FINANCE") && (
            <CardStat
              icon="🏢"
              label="Bekleyen B2B"
              value={kpis ? `${kpis.pendingB2b} Teklif` : "—"}
              sub={kpis ? `${kpis.quotedB2b} fiyatlandırıldı` : ""}
            />
          )}
          {admin.role === "ENGINEER" && (
            <CardStat
              icon="🗺️"
              label="Aktif Arazi"
              value={kpis ? `${kpis.totalLands}` : "—"}
              sub="toplam alan"
            />
          )}
          {admin.role === "OPERATIONS" && (
            <CardStat
              icon="📦"
              label="Toplam Kapasite"
              value={kpis ? kpis.totalCapacity.toLocaleString("tr-TR") : "—"}
              sub="tohum kapasitesi"
            />
          )}
        </div>
      )}

      {/* ── Grafikler ── */}
      {(admin.role === "SUPER_ADMIN" || admin.role === "FINANCE") && (
        <div className="grid md:grid-cols-2 gap-5">
          {/* Aylık Gelir */}
          <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-white text-sm">Aylık Gelir</h2>
                <p className="text-xs text-slate-500 mt-0.5">Son 6 ay</p>
              </div>
              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                💰 TL
              </span>
            </div>
            {data ? (
              <BarChart data={data.monthlyGrowth} />
            ) : (
              <div className="h-40 bg-white/[0.03] rounded-xl animate-pulse" />
            )}
          </div>

          {/* Aylık Tohum */}
          <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-white text-sm">Aylık Tohum Satışı</h2>
                <p className="text-xs text-slate-500 mt-0.5">Son 6 ay</p>
              </div>
              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                🌱 Adet
              </span>
            </div>
            {data ? (
              <SeedChart data={data.monthlyGrowth} />
            ) : (
              <div className="h-24 bg-white/[0.03] rounded-xl animate-pulse" />
            )}

            {/* Toplam tohum özet */}
            {data && (
              <div className="mt-3 flex gap-4 pt-3 border-t border-white/[0.06]">
                <div>
                  <p className="text-xs text-slate-500">Son 6 Ay Toplam</p>
                  <p className="text-sm font-bold text-white">
                    {data.monthlyGrowth
                      .reduce((s, d) => s + d.seeds, 0)
                      .toLocaleString("tr-TR")}{" "}
                    <span className="text-xs font-normal text-slate-400">tohum</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ortalama / Ay</p>
                  <p className="text-sm font-bold text-white">
                    {Math.round(
                      data.monthlyGrowth.reduce((s, d) => s + d.seeds, 0) /
                        (data.monthlyGrowth.filter((d) => d.seeds > 0).length || 1)
                    ).toLocaleString("tr-TR")}{" "}
                    <span className="text-xs font-normal text-slate-400">tohum</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Kapasite Uyarıları ── */}
      {data && data.capacityAlerts.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            <h2 className="font-semibold text-white text-sm">
              Kapasite Uyarıları
            </h2>
            <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
              {data.capacityAlerts.length} arazi
            </span>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {data.capacityAlerts.map((alert) => (
              <div
                key={alert.id}
                className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{alert.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {alert.available > 0
                      ? `${alert.available.toLocaleString("tr-TR")} boş alan kaldı`
                      : "Kapasite tamamen doldu"}
                  </p>
                </div>

                {/* Doluluk çubuğu */}
                <div className="flex items-center gap-3 w-40">
                  <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        alert.pct >= 100 ? "bg-red-500" : "bg-amber-400"
                      }`}
                      style={{ width: `${Math.min(alert.pct, 100)}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs font-bold w-10 text-right ${
                      alert.pct >= 100 ? "text-red-400" : "text-amber-400"
                    }`}
                  >
                    %{alert.pct}
                  </span>
                </div>

                {/* Durum rozeti */}
                {!alert.is_public ? (
                  <span className="text-xs px-2.5 py-1 rounded-full ring-1 ring-orange-500/40 bg-orange-500/10 text-orange-400 shrink-0">
                    🔧 Bakımda
                  </span>
                ) : alert.pct >= 100 ? (
                  <span className="text-xs px-2.5 py-1 rounded-full ring-1 ring-red-500/40 bg-red-500/10 text-red-400 shrink-0">
                    Dolu
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full ring-1 ring-amber-500/40 bg-amber-500/10 text-amber-400 shrink-0">
                    Dolmak Üzere
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hızlı Erişim (SUPER_ADMIN için) ── */}
      {admin.role === "SUPER_ADMIN" && data && data.capacityAlerts.length === 0 && (
        <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-emerald-400">Tüm Sistemler Normal</p>
              <p className="text-sm text-slate-400 mt-0.5">
                Kapasitesi %90&apos;ın üzerinde olan arazi bulunmuyor.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Rol Bazlı Bilgi Kartı ── */}
      <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-3 text-sm">Rol Bazlı Erişim</h2>
        <p className="text-sm text-slate-400 mb-2">
          Mevcut rolünüz:{" "}
          <span className="text-white font-medium">{roleMeta.label}</span>.
          Sol menüde sadece yetkiniz dahilindeki modüller görünmektedir.
        </p>
        {admin.role === "SUPER_ADMIN" && (
          <p className="text-xs text-amber-400/70 mt-1">
            👑 Super Admin olarak tüm modüllere tam erişiminiz bulunmaktadır.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  return (
    <RoleGuard path="/admin">
      <DashboardContent />
    </RoleGuard>
  );
}
