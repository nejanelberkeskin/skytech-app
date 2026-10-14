"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canVisit, hasFullPermission, visibleModules } from "@/components/admin/access/policy";
import type { AdminMe } from "@/components/admin/access/types";
import { useAdmin } from "@/lib/admin-context";
import { Link } from "@/i18n/navigation";
import type { DashboardData } from "@/lib/admin/dashboard-dto";
import { FINANCE_DEFINITIONS } from "@/lib/finance/overview";
import { formatCount, formatTry } from "@/lib/pricing";
import { CardStat } from "@/components/ui";
import JobsHealth from "./JobsHealth";
import { NetCashChart } from "./FinanceSummary";
import SalesSwitch from "./SalesSwitch";

const panel = "rounded-2xl border border-white/10 bg-white p-5";
const numeric = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Bozuk başarılı yanıt hata görünümüne gider; eksik veri sıfır diye gösterilmez. */
function readDashboard(value: unknown): DashboardData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_dashboard");
  const data = value as DashboardData;
  if (!data.kpis || typeof data.kpis !== "object" || Array.isArray(data.kpis) ||
      Object.values(data.kpis).some((v) => !numeric(v)) ||
      typeof data.generatedAt !== "string" || !Number.isFinite(Date.parse(data.generatedAt))) throw new Error("invalid_dashboard");
  if (data.monthlyGrowth !== undefined && (!Array.isArray(data.monthlyGrowth) ||
      data.monthlyGrowth.some((p) => !p || typeof p.month !== "string" ||
        (p.seeds !== undefined && !numeric(p.seeds)) || (p.revenue !== undefined && !numeric(p.revenue))))) throw new Error("invalid_dashboard");
  if (data.capacityAlerts !== undefined && (!Array.isArray(data.capacityAlerts) ||
      data.capacityAlerts.some((a) => !a || typeof a.id !== "string" || typeof a.name !== "string" ||
        !numeric(a.pct) || !numeric(a.available)))) throw new Error("invalid_dashboard");
  return data;
}

/** Yetki/kimlik değişimi aynı render'da eski verinin tamamını bırakır. */
export default function Dashboard() {
  const { me } = useAdmin();
  if (!me?.admin.isActive) return null;
  const accessKey = JSON.stringify([me.admin.userId, me.admin.legacyRole, me.permissions, me.roles]);
  return <DashboardContent key={accessKey} me={me} />;
}

function DashboardContent({ me }: { me: AdminMe }) {
  const { refresh } = useAdmin();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef<{ generation: number; controller?: AbortController }>({ generation: 0 });
  const fetchDashboard = useCallback(async () => {
    request.current.controller?.abort();
    const controller = new AbortController();
    const generation = ++request.current.generation;
    request.current.controller = controller;
    const current = () => !controller.signal.aborted && generation === request.current.generation;
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store", signal: controller.signal });
      if (!current()) return;
      if (response.status === 401 || response.status === 403) {
        setData(null);
        void refresh();
        throw new Error("access_changed");
      }
      if (!response.ok) throw new Error("unavailable");
      const next = readDashboard(await response.json());
      if (!current()) return;
      setData(next);
      setError(null);
    } catch {
      if (!current()) return;
      setData(null);
      setError("Genel Bakış verisi alınamadı. Yeniden deneyin; önceki değerler güncel veri olarak gösterilmiyor.");
    } finally {
      if (current()) setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void fetchDashboard();
    const interval = setInterval(() => void fetchDashboard(), 60_000);
    const active = request.current;
    return () => {
      clearInterval(interval);
      active.controller?.abort();
      active.generation++;
    };
  }, [fetchDashboard]);

  const full = (key: Parameters<typeof hasFullPermission>[1]) => hasFullPermission(me, key);
  const k = data?.kpis;
  const cards: { label: string; icon: string; value: string; sub: string; href?: string }[] = [];
  const add = (allowed: boolean, value: unknown, label: string, icon: string, sub: string, href?: string, money = false) => {
    if (allowed && numeric(value)) cards.push({ label, icon, value: money ? formatTry(value, "tr") : formatCount(value, "tr"), sub, href });
  };
  add(full("finance.read"), k?.netRevenueKurus, FINANCE_DEFINITIONS.heldOrderValue.label, "", "Tüm zamanlar · iade sürecindekiler hariç", "/admin/finans", true);
  add(full("orders.read"), k?.orderCount, "Siparişler", "", "Ödenmiş ve iade sürecinde olmayan", "/admin/birakma-siparisleri");
  add(full("orders.read"), k?.releasedQuantity, "Bırakılan Tohum Topu", "", "Bırakması tamamlanan siparişler");
  add(full("requests.read"), k?.newRequests, "Yeni Talepler", "", numeric(k?.contactedRequests) ? `${formatCount(k.contactedRequests, "tr")} talep için iletişim kuruldu` : "", "/admin/talepler");
  add(full("finance.read"), k?.pendingRefunds, "Bekleyen Sipariş İadeleri", "↩️", "İadesi tamamlanmamış siparişler", "/admin/iadeler");
  add(full("finance.read"), k?.pendingDuplicateRefunds, "Çift Tahsilat İadeleri", "↩️", "İadesi bekleyen ikinci ödemeler", "/admin/iadeler");
  add(full("invoices.read"), k?.pendingInvoices, "Bekleyen Faturalar", "", "Düzenlenmesi bekleyen faturalar", "/admin/finans");
  add(full("batches.read"), k?.awaitingBatch, "Partiye Alınacak Siparişler", "", "Planlama bekleyen siparişler", "/admin/birakma-partileri");
  add(["SUPER_ADMIN", "FINANCE"].includes(me.admin.legacyRole), k?.pendingB2b, "Bekleyen B2B Teklifleri", "", numeric(k?.quotedB2b) ? `${formatCount(k.quotedB2b, "tr")} teklif fiyatlandırıldı` : "", "/admin/b2b");
  add(full("sites.read"), k?.publicSites, "Yayındaki Sahalar", "", numeric(k?.freeCapacity) ? `${formatCount(k.freeCapacity, "tr")} tohum topu boş kapasite` : "", "/admin/araziler");

  const seedMonths = full("orders.read") ? (data?.monthlyGrowth ?? []).flatMap((p) => numeric(p.seeds) ? [{ month: p.month, seeds: p.seeds }] : []) : [];
  const moneyMonths = full("finance.read") ? (data?.monthlyGrowth ?? []).flatMap((p) => numeric(p.revenue) ? [{ month: p.month, revenue: p.revenue }] : []) : [];
  const alerts = full("sites.read") ? data?.capacityAlerts : undefined;
  const modules = visibleModules(me).filter((m) => m.id !== "dashboard");

  return <div className="space-y-7 p-4 md:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Yönetim Paneli</h1>
        <p className="mt-2 text-sm text-slate-700">Hoş geldin, {me.admin.fullName}.</p>
        <p className="mt-1 text-xs text-slate-600">{data ? `Son güncelleme: ${new Date(data.generatedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}` : "Güncel veriler sunucudan alınır."}</p>
      </div>
      <button type="button" onClick={() => { setLoading(true); void fetchDashboard(); }} disabled={loading}
        className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 hover:bg-slate-50 disabled:opacity-50">
        {loading ? "Yükleniyor…" : "Yenile"}
      </button>
    </header>

    <SalesSwitch />
    {error && <p role="alert" className="rounded-xl border border-red-400/40 p-4 text-sm text-red-700">{error}</p>}
    {loading && !data && <p role="status" className={panel + " text-sm text-slate-700"}>Yetkiniz kapsamındaki özet hazırlanıyor…</p>}
    {cards.length > 0 && <section aria-label="İş özeti" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map((card) => card.href && canVisit(me, card.href)
        ? <Link key={card.label} href={card.href} aria-label={`${card.label}: ayrıntıları aç`} className="block min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B6B3A] [&>div]:transition-colors [&>div]:hover:border-[#1B6B3A]/40"><CardStat {...card} /></Link>
        : <div key={card.label} className="min-w-0"><CardStat {...card} /></div>)}
    </section>}
    {!loading && !error && cards.length === 0 && <section className={panel} aria-label="Özet erişimi">
      <h2 className="font-semibold text-slate-900">Bu hesap için genel özet bulunmuyor</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">Genel özetler ilgili modülde tüm kayıtları görme izni gerektirir. Kullanabildiğiniz bölümlere aşağıdan ulaşabilirsiniz.</p>
    </section>}

    {full("finance.read") && numeric(k?.overdueRefunds) && <section className={`rounded-xl border p-4 text-sm ${k.overdueRefunds > 0 ? "border-red-400/40 text-red-700" : "border-slate-200 text-slate-700"}`} aria-label="İade takibi">
      <p>{k.overdueRefunds > 0 ? `${formatCount(k.overdueRefunds, "tr")} sipariş iadesinin son tarihi geçti.` : "Son tarihi geçmiş sipariş iadesi bulunmuyor."}</p>
      {canVisit(me, "/admin/iadeler") && <Link href="/admin/iadeler" className="inline-flex min-h-11 items-center text-emerald-700 underline">İade kuyruğunu aç →</Link>}
    </section>}

    {(moneyMonths.length > 0 || seedMonths.length > 0) && <section aria-label="Aylık göstergeler" className="grid gap-5 lg:grid-cols-2">
      {moneyMonths.length > 0 && <div className={panel}>
        <h2 className="font-semibold text-slate-900">Aylık net tahsilat</h2>
        <p className="mb-5 mt-2 text-xs leading-relaxed text-slate-600">Son 6 ay · sipariş + çift tahsilat − tamamlanan iadeler · Türkiye takvimi</p>
        <NetCashChart months={moneyMonths} />
      </div>}
      {seedMonths.length > 0 && <div className={panel}>
        <h2 className="font-semibold text-slate-900">Aylık Tohum Topu (sipariş)</h2>
        <p className="mb-5 mt-2 text-xs text-slate-600">Son 6 ay · ödenen siparişlerdeki adet</p>
        <div className="space-y-4">
          {seedMonths.map((m) => <div key={m.month} className="text-sm">
            <div className="flex justify-between gap-3 text-slate-700"><span>{m.month}</span><span>{formatCount(m.seeds, "tr")}</span></div>
            <div aria-hidden="true" className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-[#1B6B3A]" style={{ width: `${Math.max(0, m.seeds) / Math.max(1, ...seedMonths.map((p) => p.seeds)) * 100}%` }} /></div>
          </div>)}
        </div>
        <p className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-700">Dönem toplamı: {formatCount(seedMonths.reduce((sum, m) => sum + m.seeds, 0), "tr")} tohum topu</p>
      </div>}
    </section>}

    {alerts !== undefined && <section className={panel} aria-label="Saha kapasitesi">
      <h2 className="font-semibold text-slate-900">Saha Kapasitesi</h2>
      {alerts.length === 0 ? <p className="mt-3 text-sm text-slate-700">Yayındaki sahalarda %90 ve üzeri doluluk uyarısı bulunmuyor.</p> : <ul className="mt-3 divide-y divide-slate-200">
        {alerts.map((alert) => <li key={alert.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="break-words font-medium text-slate-900">{alert.name}</p><p className="mt-1 text-sm text-slate-600">{alert.available > 0 ? `${formatCount(alert.available, "tr")} tohum topu yer kaldı` : "Kapasite tamamen doldu"}</p></div>
          <p className={`shrink-0 text-sm font-semibold ${alert.pct >= 100 ? "text-red-700" : "text-amber-800"}`}>%{alert.pct} dolu</p>
        </li>)}
      </ul>}
      {canVisit(me, "/admin/araziler") && <Link href="/admin/araziler" className="inline-flex min-h-11 items-center text-sm text-emerald-700 underline">Sahaları aç →</Link>}
    </section>}

    {full("system.readiness.read") && <JobsHealth canRun={full("system.jobs.run")} />}
    <nav className={panel} aria-label="Kullanabildiğiniz bölümler">
      <h2 className="font-semibold text-slate-900">Kullanabildiğiniz Bölümler</h2>
      <p className="mt-2 text-sm text-slate-600">Menü ve işlemler hesabınıza atanan izinlere göre gösterilir.</p>
      <div className="mt-3 flex flex-wrap gap-2">{modules.map((m) => <Link key={m.id} href={m.href} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 hover:bg-slate-50">{m.label}</Link>)}</div>
    </nav>
  </div>;
}
