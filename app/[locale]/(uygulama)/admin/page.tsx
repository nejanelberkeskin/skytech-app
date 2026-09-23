"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/lib/admin-context";
import { Link } from "@/i18n/navigation";
import JobsHealth from "@/components/admin/operations/JobsHealth";
import { NetCashChart } from "@/components/admin/operations/FinanceSummary";
import { FINANCE_DEFINITIONS } from "@/lib/finance/overview";
import RoleGuard from "@/components/RoleGuard";
import { CardStat } from "@/components/ui";
import { ROLE_META } from "@/lib/rbac";
import { formatCount, formatTry } from "@/lib/pricing";

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

/** Satış modeli v2 göstergeleri (deneme siparişleri hariç) — kaynak: /api/admin/dashboard. */
interface DashboardData {
  kpis: {
    netRevenueKurus: number;
    orderCount: number;
    releasedQuantity: number;
    pendingRefunds: number;
    pendingDuplicateRefunds: number;
    overdueRefunds: number;
    pendingInvoices: number;
    awaitingBatch: number;
    publicSites: number;
    freeCapacity: number;
    pendingB2b: number;
    quotedB2b: number;
    newRequests: number;
    contactedRequests: number;
  };
  monthlyGrowth: MonthlyPoint[];
  capacityAlerts: CapacityAlert[];
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Durum yalnız ağ yanıtından SONRA güncellenir (effect içinde eşzamanlı setState yok).
  const fetchDashboard = useCallback(
    () =>
      fetch("/api/admin/dashboard")
        .then((res) => { if (!res.ok) throw new Error("Genel Bakış verisi alınamadı; görünen eski değerleri güncel kabul etmeyin."); return res.json() as Promise<DashboardData>; })
        .then((json) => {
          if (json) {
            setError(null);
            setData(json);
            setLastRefresh(new Date());
          }
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Veri alınamadı."))
        .finally(() => setLoading(false)),
    [],
  );

  /** "Yenile" düğmesi: yükleniyor göstergesiyle yeniden çeker. */
  const load = () => {
    setLoading(true);
    void fetchDashboard();
  };

  useEffect(() => {
    fetchDashboard();
    // Her 60 saniyede otomatik yenile
    const interval = setInterval(fetchDashboard, 60_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (!admin) return null;

  const roleMeta = ROLE_META[admin.role];
  const kpis = data?.kpis;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-fade-in">
      {/* ── Başlık ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
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

      {error && <p role="alert" className="rounded-xl border border-red-400/40 p-4 text-sm text-red-200">{error}</p>}

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
              label={FINANCE_DEFINITIONS.heldOrderValue.label}
              value={kpis ? formatTry(kpis.netRevenueKurus, "tr") : "—"}
              sub={kpis ? `${formatCount(kpis.orderCount, "tr")} sipariş · tüm zamanlar · iade sürecindekiler hariç` : ""}
            />
          )}
          {(admin.role === "SUPER_ADMIN" || admin.role === "FINANCE" || admin.role === "OPERATIONS") && (
            <CardStat
              icon="📥"
              label="Bekleyen Talep"
              value={kpis ? `${kpis.newRequests ?? 0}` : "—"}
              sub={kpis ? `${kpis.contactedRequests ?? 0} iletişimde` : ""}
            />
          )}
          <CardStat
            icon="🌱"
            label="Bırakılan Tohum Topu"
            value={kpis ? formatCount(kpis.releasedQuantity, "tr") : "—"}
            sub="bırakması tamamlanan siparişler"
          />
          {(admin.role === "SUPER_ADMIN" || admin.role === "FINANCE" || admin.role === "OPERATIONS") && (
            <CardStat
              icon="🧾"
              label="Bekleyen İşler"
              value={kpis ? formatCount(kpis.pendingRefunds + kpis.pendingDuplicateRefunds + kpis.pendingInvoices + kpis.awaitingBatch, "tr") : "—"}
              sub={kpis ? `${kpis.pendingRefunds} sipariş iadesi · ${kpis.pendingDuplicateRefunds} çift tahsilat · ${kpis.pendingInvoices} fatura · ${kpis.awaitingBatch} partiye alınacak` : ""}
            />
          )}
          {(admin.role === "SUPER_ADMIN" || admin.role === "FINANCE") && (
            <CardStat
              icon="🏢"
              label="Bekleyen B2B"
              value={kpis ? `${kpis.pendingB2b} Teklif` : "—"}
              sub={kpis ? `${kpis.quotedB2b} fiyatlandırıldı` : ""}
            />
          )}
          {(admin.role === "ENGINEER" || admin.role === "OPERATIONS") && (
            <CardStat
              icon="🗺️"
              label="Yayındaki Saha"
              value={kpis ? `${kpis.publicSites}` : "—"}
              sub={kpis ? `${formatCount(kpis.freeCapacity, "tr")} tohum topu boş kapasite` : ""}
            />
          )}
        </div>
      )}

      {(admin.role === "SUPER_ADMIN" || admin.role === "FINANCE") && kpis && <div className={`rounded-xl border p-4 text-sm ${kpis.overdueRefunds ? "border-red-400/40 text-red-200" : "border-white/10 text-slate-300"}`}><p>{kpis.overdueRefunds} sipariş iadesinin son tarihi geçti.</p><Link href="/admin/iadeler" className="inline-flex min-h-11 items-center text-emerald-300 underline">İade kuyruğunu aç →</Link></div>}
      {(admin.role === "SUPER_ADMIN" || admin.role === "OPERATIONS") && <JobsHealth canRun={admin.role === "SUPER_ADMIN"} />}

      {/* ── Grafikler ── */}
      {(admin.role === "SUPER_ADMIN" || admin.role === "FINANCE") && (
        <div className="grid md:grid-cols-2 gap-5">
          {/* Aylık Gelir */}
          <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-white text-sm">Aylık net tahsilat</h2>
                <p className="text-xs text-slate-500 mt-0.5">Son 6 ay · sipariş + çift tahsilat − tamamlanan iadeler · Türkiye takvimi</p>
              </div>
              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                💰 TL
              </span>
            </div>
            {data ? (
              <NetCashChart months={data.monthlyGrowth} />
            ) : (
              <div className="h-40 bg-white/[0.03] rounded-xl animate-pulse" />
            )}
          </div>

          {/* Aylık Tohum */}
          <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-white text-sm">Aylık Tohum Topu (sipariş)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Son 6 ay · ödenen siparişlerdeki adet</p>
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
                    <span className="text-xs font-normal text-slate-400">tohum topu</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ortalama / Ay</p>
                  <p className="text-sm font-bold text-white">
                    {Math.round(
                      data.monthlyGrowth.reduce((s, d) => s + d.seeds, 0) /
                        (data.monthlyGrowth.filter((d) => d.seeds > 0).length || 1)
                    ).toLocaleString("tr-TR")}{" "}
                    <span className="text-xs font-normal text-slate-400">tohum topu</span>
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
              {data.capacityAlerts.length} saha
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
                      ? `${alert.available.toLocaleString("tr-TR")} tohum topu yer kaldı`
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
              <p className="font-semibold text-emerald-400">Saha kapasitesinde uyarı yok</p>
              <p className="text-sm text-slate-400 mt-0.5">
                Yayındaki sahalarda kapasitesi %90&apos;ın üzerinde olan saha yok.
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
