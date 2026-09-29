"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdmin } from "@/lib/admin-context";
import { Button, Input, Select } from "@/components/ui";
import { ORDER_STATUSES } from "@/lib/orders/types";
import type { OrderListDto } from "@/lib/orders/admin-dto";
import { ORDER_STATUS_LABELS } from "@/lib/orders/labels";
import { formatCount, formatTry } from "@/lib/pricing";
import { AdminApiError, adminRequest, errorText } from "../operations/client";
import { dt, STATUS_BADGE } from "../ReleaseOrderDetail";
import OrderDialog from "./OrderDialog";
import { availableAlerts } from "./view";

export default function OrderManagement() {
  const { refresh } = useAdmin();
  const initialNo = useSearchParams().get("no") ?? "";
  const [q, setQ] = useState(initialNo);
  const [search, setSearch] = useState(initialNo);
  const [status, setStatus] = useState("");
  const [test, setTest] = useState("all");
  const [flag, setFlag] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ query: string; data: OrderListDto } | null>(null);
  const [problem, setProblem] = useState<{ query: string; message: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const deepLinkUsed = useRef(false);
  const query = new URLSearchParams({ q: search, status, test, flag, page: String(page), pageSize: "25", }).toString();
  const requestKey = `${query}:${revision}`;
  const data = result?.query === requestKey ? result.data : null;
  const error = problem?.query === requestKey ? problem.message : null;
  const loading = !data && !error;
  const reload = useCallback(() => setRevision(n => n + 1), []);
  const close = useCallback(() => setSelected(null), []);
  useEffect(() => { const t = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    const abort = new AbortController();
    void adminRequest<OrderListDto>(`/api/admin/release-orders?${query}`, undefined, abort.signal).then(({ data }) => {
      if (abort.signal.aborted) return;
      if (!Array.isArray(data?.items) || !data.counts || !data.alerts || !data.scope || !data.search || !Array.isArray(data.groups)) throw new Error("Sipariş yanıtı okunamadı. Yeniden deneyin.");
      setResult({ query: requestKey, data });
      if (initialNo && !deepLinkUsed.current) {
        deepLinkUsed.current = true;
        const hit = data.items.find(r => r.orderNo === initialNo.toUpperCase());
        if (hit) setSelected(hit.id);
      }
    }).catch(e => {
      if (abort.signal.aborted) return;
      setResult(null); setProblem({ query: requestKey, message: errorText(e) });
      if (e instanceof AdminApiError && [401, 403].includes(e.status)) { setSelected(null); void refresh(); }
    });
    return () => abort.abort();
  }, [query, requestKey, initialNo, refresh]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <div className="p-4 md:p-8 space-y-6 min-w-0">
    <div className="flex flex-wrap justify-between items-start gap-4"><div><h1 className="text-2xl font-bold text-white">Siparişler</h1><p className="mt-1 text-sm text-slate-400">Saha hizmeti siparişleri ve işlem takibi</p></div><Button variant="secondary" onClick={reload} disabled={loading}>Listeyi yenile</Button></div>
    <p className="text-sm text-slate-300">{data ? data.scope.kind === "all" ? "Kapsam: tüm siparişler" : `Kapsam: yetkili olduğunuz ${data.scope.siteIds.length} saha` : "Kapsam ve bilgiler sunucudan doğrulanıyor."}</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Input label="Sipariş ara" type="search" value={q} maxLength={60} onChange={e => setQ(e.target.value)} placeholder="Sipariş no, ad veya şirket" helperText={data?.search.contactFields ? "E-posta, telefon ve sertifikadaki adla da arayabilirsiniz." : "Sertifikadaki adla da arayabilirsiniz. İletişim alanlarında arama kapalı."} />
      <Select label="Sipariş durumu" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tüm durumlar</option>{ORDER_STATUSES.map(s => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}{data ? ` (${data.counts[s] ?? 0})` : ""}</option>)}</Select>
      <Select label="Sipariş türü" value={test} onChange={e => { setTest(e.target.value); setPage(1); }}><option value="all">Gerçek ve deneme</option><option value="hide">Yalnız gerçek</option><option value="only">Yalnız deneme</option></Select>
      <div className="flex items-start sm:items-end"><Button variant="ghost" onClick={() => { setQ(""); setSearch(""); setStatus(""); setTest("all"); setFlag(""); setPage(1); }}>Filtreleri temizle</Button></div>
    </div>
    {data && <div className="flex flex-wrap gap-2" aria-label="Sipariş uyarıları">{availableAlerts(data).map(a => <button type="button" key={a.key} aria-pressed={flag === a.flag} onClick={() => { setFlag(flag === a.flag ? "" : a.flag); setPage(1); }} className={`min-h-11 rounded-xl border px-3 py-2 text-sm ${flag === a.flag ? "border-amber-300 text-amber-100 bg-amber-500/10" : "border-white/15 text-slate-300"}`}>{a.label}: {data.alerts[a.key]}</button>)}</div>}
    {loading && <p role="status" className="py-12 text-slate-300">Siparişler yükleniyor…</p>}
    {error && <div role="alert" className="rounded-xl border border-red-400/40 p-4 space-y-3 text-red-200"><p>{error}</p><Button variant="secondary" onClick={reload}>Yeniden dene</Button></div>}
    {data && <>
      <p role="status" className="text-sm text-slate-400">{data.total} sipariş bulundu.</p>
      {!data.items.length && <p className="rounded-xl border border-white/10 p-8 text-slate-300">Bu filtrelerde sipariş bulunamadı.</p>}
      <div className="space-y-3">{data.items.map(r => <button type="button" key={r.id} onClick={() => setSelected(r.id)} className="w-full text-left rounded-2xl border border-white/10 p-4 md:p-5 hover:border-emerald-400/40 focus-visible:outline-2 focus-visible:outline-emerald-400">
        <div className="flex flex-wrap justify-between gap-2"><div className="flex flex-wrap gap-2 items-center"><span className="font-mono font-semibold text-emerald-300">{r.orderNo}</span><span className={`rounded-full px-2 py-1 text-xs ${STATUS_BADGE[r.status]}`}>{ORDER_STATUS_LABELS[r.status]}</span>{r.isTest && <span className="text-xs text-amber-200">DENEME</span>}</div><span className="text-xs text-slate-400">{dt(r.createdAt)}</span></div>
        <p className="mt-3 font-semibold text-white break-words">{r.buyer.firstName} {r.buyer.lastName}{r.buyer.companyTitle && ` · ${r.buyer.companyTitle}`}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300"><span>{r.site.name ?? "Saha"}</span><span>{formatCount(r.quantity, "tr")} tohum topu</span>{r.finance && <span>{formatTry(r.finance.totalKurus, "tr")}</span>}{r.contact && <span className="break-all">{r.contact.email}</span>}</div>
      </button>)}</div>
      {(pages > 1 || page > 1) && <nav aria-label="Sipariş sayfaları" className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-slate-300">Sayfa {page} / {pages}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(n => n - 1)}>Önceki</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage(n => n + 1)}>Sonraki</Button></div></nav>}
    </>}
    {selected && <OrderDialog key={selected} id={selected} onClose={close} onChanged={reload} />}
  </div>;
}
