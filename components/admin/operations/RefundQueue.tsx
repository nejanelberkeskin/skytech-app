"use client";
import { useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button, Select } from "@/components/ui";
import type { RefundQueueItem } from "@/lib/refunds/model";
import { formatTry } from "@/lib/pricing";
import { AdminApiError, adminRequest, errorText, istanbulDate } from "./client";
import { RefundDeadline, RefundStatus } from "./RefundStatus";

type Queue = { items: RefundQueueItem[]; total: number; generatedAt: string };
export default function RefundQueue() {
  const router = useRouter();
  const [filter, setFilter] = useState("open");
  const [includeTest, setIncludeTest] = useState(false);
  const [limit, setLimit] = useState(50);
  const [data, setData] = useState<Queue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef({ value: 0 });
  const load = useCallback(async () => {
    const generation = ++latest.current.value;
    try {
      const { data } = await adminRequest<Queue>(`/api/admin/refunds?filter=${filter}&limit=${limit}${includeTest ? "&includeTest=1" : ""}`);
      if (generation !== latest.current.value) return;
      setData(data); setError(null);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) router.replace("/admin/giris"); if (generation === latest.current.value) { setError(errorText(e)); setData(null); } }
    finally { if (generation === latest.current.value) setLoading(false); }
  }, [filter, includeTest, limit, router]);
  useEffect(() => { const token = latest.current; void load(); return () => { token.value++; }; }, [load]);
  return <div className="p-4 md:p-8 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-white">İadeler ve mutabakat</h1><p className="mt-2 text-sm text-slate-300">Önce süresi geçen, ardından son tarihi yaklaşan iadeler. Her ödeme ayrı izlenir.</p></div><Button variant="secondary" disabled={loading} onClick={() => { setLoading(true); void load(); }}>Yenile</Button></div>
    <div className="flex flex-wrap items-end gap-4">
      <Select label="Gösterilecek işlemler" value={filter} onChange={e => { setLoading(true); setFilter(e.target.value); }}><option value="open">İşlem bekleyenler</option><option value="all">Tamamlananlar dâhil tümü</option></Select>
      <Select label="Kayıt sınırı" value={String(limit)} onChange={e => { setLoading(true); setLimit(Number(e.target.value)); }}><option value="50">50 kayıt</option><option value="200">200 kayıt</option></Select>
      <label className="min-h-11 flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={includeTest} onChange={e => { setLoading(true); setIncludeTest(e.target.checked); }} />Deneme kayıtlarını göster</label>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-400/40 p-4 text-red-200">{error} <Button variant="ghost" onClick={() => { setLoading(true); void load(); }}>Tekrar dene</Button></div>}
    {loading ? <p role="status" className="text-slate-300">İade kuyruğu yükleniyor…</p> : data && <>
      <p className="text-sm text-slate-400">{data.total} işlemden {data.items.length} gösteriliyor · Son güncelleme {istanbulDate(data.generatedAt)}{data.total > data.items.length ? ". Liste sınırlandı; daha fazla kayıt için sınırı artırın veya sipariş numarasıyla Siparişler ekranından arayın." : ""}</p>
      {data.items.length === 0 ? <p className="rounded-2xl border border-white/10 p-8 text-slate-300">Bu filtrelerde iade işlemi bulunmuyor.</p> : <ul className="space-y-3">{data.items.map(item => <li key={`${item.orderId}:${item.paymentId}`} className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-4 md:p-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-3"><div><Link className="font-mono text-emerald-300 underline underline-offset-4 break-all" href={`/admin/iadeler/${item.orderId}`}>{item.orderNo}</Link><p className="mt-2 text-sm text-slate-300">{item.kind === "duplicate" ? "Çift tahsilat iadesi" : "Sipariş iadesi"}{item.isTest && <strong className="ml-2 text-amber-200">Deneme</strong>}</p></div><div className="space-y-2"><p className="text-lg font-semibold text-white">{formatTry(item.amountKurus, "tr")}</p><RefundStatus state={item.state} stale={item.stale} /></div></div>
        <p className="text-xs text-slate-400 break-all">Ödeme kimliği: {item.paymentId} · Deneme: {item.attempt}</p>
        <RefundDeadline due={item.due} />
        {item.attention && item.state !== "completed" && <p className="text-sm text-amber-200">Geç ya da çelişen sağlayıcı sonucu var; mutabakat gerekli.</p>}
        <Link className="inline-flex min-h-11 items-center text-sm text-emerald-300 underline" href={`/admin/iadeler/${item.orderId}`}>İşlemi incele →</Link>
      </li>)}</ul>}
    </>}
  </div>;
}
