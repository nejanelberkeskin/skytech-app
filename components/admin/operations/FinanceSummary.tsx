import { FINANCE_DEFINITIONS as D, monthLabel, type FinanceOverview } from "@/lib/finance/overview";
import { formatTry } from "@/lib/pricing";
import { Link } from "@/i18n/navigation";
import { istanbulDate } from "./client";

export default function FinanceSummary({ overview: o }: { overview: FinanceOverview }) {
  const cards = [
    { ...D.netCash, value: o.currentMonth.netCashKurus },
    { ...D.orderCollections, value: o.currentMonth.orderCollectionsKurus },
    { ...D.duplicateCharges, value: o.currentMonth.duplicateChargesKurus },
    { ...D.refunds, value: o.currentMonth.orderRefundsKurus + o.currentMonth.duplicateRefundsKurus },
    { ...D.payable, value: o.pending.payableKurus },
    { ...D.refundLiability, value: o.liabilities.orderRefundLiabilityKurus + o.liabilities.duplicateLiabilityKurus },
    { ...D.heldOrderValue, value: o.allTime.heldOrderValueKurus },
  ];
  return <section aria-label="Finans özeti" className="space-y-4">
    <p className="text-sm text-slate-300">Dönem: <strong className="text-white">{monthLabel(o.currentMonth.key)}</strong> · Türkiye takvim ayı · KDV dâhil · Deneme siparişleri hariç.</p>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{cards.map((card, i) => <div key={card.label} className={`rounded-2xl border p-5 ${i === 0 ? "border-emerald-400/30 bg-emerald-500/5" : "border-white/10 bg-[var(--bg-surface)]"}`}><p className="text-sm text-slate-200">{card.label}{i < 4 ? " · bu ay" : ""}</p><p className={`mt-2 text-2xl font-semibold ${card.value < 0 ? "text-red-200" : "text-white"}`}>{formatTry(card.value, "tr")}</p><p className="mt-3 text-xs leading-relaxed text-slate-400">{card.description}</p></div>)}</div>
    <div className={`rounded-xl border p-4 text-sm ${o.liabilities.overdueRefundCount ? "border-red-400/40 text-red-200" : "border-white/10 text-slate-300"}`}><p>{o.liabilities.overdueRefundCount} sipariş iadesinin son tarihi geçti.</p><p className="mt-1">Bekleyen: {o.liabilities.orderRefundLiabilityCount} sipariş iadesi · {o.liabilities.duplicateLiabilityCount} çift tahsilat iadesi</p><Link className="inline-flex min-h-11 items-center text-emerald-300 underline" href="/admin/iadeler">İade kuyruğunu aç →</Link></div>
    <p className="text-xs text-slate-400">Nakit hareketleri görünümüdür; sağlayıcı hesap ekstresi veya muhasebe hasılatı raporu değildir. Hesap zamanı: {istanbulDate(o.generatedAt)}.</p>
  </section>;
}

/** A zero baseline represents negative refund-heavy months without clipping or positive-looking bars. */
export function NetCashChart({ months }: { months: { month: string; revenue: number }[] }) {
  const max = Math.max(1, ...months.map(m => Math.abs(m.revenue)));
  return <div className="space-y-3" aria-label="Aylık net tahsilat">
    <p className="text-xs text-slate-400">Sol: negatif · Orta: 0 · Sağ: pozitif</p>
    {months.map(m => <div key={m.month} className="grid grid-cols-[4rem_1fr] gap-x-3 gap-y-1 items-center text-xs"><span className="text-slate-300">{m.month}</span><span className={m.revenue < 0 ? "text-red-200" : "text-emerald-200"}>{formatTry(Math.round(m.revenue * 100), "tr")}</span><div aria-hidden="true" className="col-start-2 relative h-3 rounded bg-white/5"><span className="absolute left-1/2 top-0 h-3 border-l border-slate-400" /><span className={`absolute top-0 h-3 rounded ${m.revenue < 0 ? "bg-red-400" : "bg-emerald-400"}`} style={{ width: `${Math.abs(m.revenue) / max * 50}%`, left: m.revenue < 0 ? `${50 - Math.abs(m.revenue) / max * 50}%` : "50%" }} /></div></div>)}
  </div>;
}
