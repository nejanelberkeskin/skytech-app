"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdmin } from "@/lib/admin-context";
import { Button, Input, Select } from "@/components/ui";
import type { RequestListDto } from "@/lib/requests/admin-dto";
import { REQUEST_TYPES, REQUEST_STATUSES } from "@/lib/requests/schema";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/requests/labels";
import { AdminApiError, adminRequest, errorText } from "../operations/client";
import RequestDialog from "./RequestDialog";
import { date } from "./view";
export default function Requests() {
  const { refresh } = useAdmin();
  const initialNo = useSearchParams().get("no") ?? "";
  const [q, setQ] = useState(initialNo), [search, setSearch] = useState(initialNo);
  const [status, setStatus] = useState(""), [type, setType] = useState(""), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data: RequestListDto } | null>(null);
  const [problem, setProblem] = useState<{ key: string; message: string } | null>(null);
  const [selected, setSelected] = useState<{ id: string; no: string } | null>(null);
  const deepLinkUsed = useRef(false);
  const query = new URLSearchParams({ q: search, status, type, page: String(page), pageSize: "25" }).toString();
  const key = `${query}:${revision}`;
  const data = result?.key === key ? result.data : null;
  const error = problem?.key === key ? problem.message : null;
  const loading = !data && !error;
  const close = useCallback(() => setSelected(null), []);
  const reload = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => { const timer = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 350); return () => clearTimeout(timer); }, [q]);
  useEffect(() => {
    const abort = new AbortController();
    void adminRequest<RequestListDto>(`/api/admin/requests?${query}`, undefined, abort.signal).then(({ data }) => {
      if (abort.signal.aborted) return;
      if (!Array.isArray(data?.items) || !data.counts || !data.scope || !data.search) throw new Error("Talep yanıtı okunamadı.");
      setResult({ key, data });
      if (initialNo && !deepLinkUsed.current) { deepLinkUsed.current = true; const item = data.items.find(i => i.requestNo === initialNo.toUpperCase()); if (item) setSelected({ id: item.id, no: item.requestNo }); }
    }).catch(e => {
      if (abort.signal.aborted) return;
      setResult(null); setProblem({ key, message: errorText(e) });
      if (e instanceof AdminApiError && [401, 403].includes(e.status)) { setSelected(null); void refresh(); }
    });
    return () => abort.abort();
  }, [query, key, refresh, initialNo]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <div className="p-4 md:p-8 space-y-6 min-w-0">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold text-white">Talepler</h1><p className="text-sm text-slate-400 mt-1">Saha hizmeti ve arazi başvurularını takip edin.</p></div><Button variant="secondary" onClick={reload} disabled={loading}>Listeyi yenile</Button></div>
    <p className="text-sm text-slate-300">{data ? data.scope.kind === "all" ? "Kapsam: tüm talepler" : `Kapsam: yetkili olduğunuz ${data.scope.siteIds.length} saha; sahasız başvurular dahil değil.` : "Kapsam doğrulanıyor."}</p>
    <div className="grid sm:grid-cols-3 gap-3"><Input label="Talep ara" type="search" maxLength={60} value={q} onChange={e => setQ(e.target.value)} placeholder="Talep numarası" helperText={data?.search.contactFields ? "Ad, e-posta, telefon veya şirketle de arayabilirsiniz." : "İletişim alanlarında arama kapalı."} /><Select label="Talep durumu" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tüm durumlar</option>{REQUEST_STATUSES.map(s => <option key={s} value={s}>{REQUEST_STATUS_LABELS.tr[s]}{data ? ` (${data.counts[s]})` : ""}</option>)}</Select><Select label="Talep türü" value={type} onChange={e => { setType(e.target.value); setPage(1); }}><option value="">Tüm türler</option>{REQUEST_TYPES.map(t => <option key={t} value={t}>{REQUEST_TYPE_LABELS.tr[t]}</option>)}</Select></div>
    <Button variant="ghost" onClick={() => { setQ(""); setSearch(""); setType(""); setStatus(""); setPage(1); }}>Filtreleri temizle</Button>
    {loading && <p role="status" className="py-8 text-slate-300">Talepler yükleniyor…</p>}
    {error && <div role="alert" className="border border-red-400/40 rounded-xl p-4 space-y-3 text-red-200"><p>{error}</p><Button variant="secondary" onClick={reload}>Yeniden dene</Button></div>}
    {data && <><p role="status" className="text-sm text-slate-400">{data.total} talep bulundu.</p>{!data.items.length && <p className="p-8 border border-white/10 rounded-xl text-slate-300">Bu filtrelerde talep bulunamadı.</p>}<div className="space-y-3">{data.items.map(r => <button type="button" key={r.id} onClick={() => setSelected({ id: r.id, no: r.requestNo })} className="w-full text-left border border-white/10 hover:border-emerald-400/40 rounded-2xl p-4 space-y-2 focus-visible:outline-2 focus-visible:outline-emerald-400">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-mono text-emerald-300 font-semibold">{r.requestNo}</span><span className="text-xs text-slate-400">{date(r.createdAt)}</span></div><p className="text-sm text-white">{REQUEST_TYPE_LABELS.tr[r.type]} · {REQUEST_STATUS_LABELS.tr[r.status]}</p>{r.contact && <p className="text-sm text-slate-200 break-words">{r.contact.name}{r.contact.company && ` · ${r.contact.company}`}</p>}<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400"><span>{r.site?.name ?? "Sahasız başvuru"}</span>{r.totalSeeds !== null && <span>{r.totalSeeds.toLocaleString("tr-TR")} adet</span>}{r.contact?.email && <span className="break-all">{r.contact.email}</span>}{r.contact?.hasAccount && <span>Üye hesabıyla</span>}{!r.canUpdate && <span>Salt okunur</span>}</div>
    </button>)}</div>{(pages > 1 || page > 1) && <nav aria-label="Talep sayfaları" className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-slate-300">Sayfa {page} / {pages}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(n => n - 1)}>Önceki</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage(n => n + 1)}>Sonraki</Button></div></nav>}</>}
    {selected && <RequestDialog key={selected.id} id={selected.id} no={selected.no} onClose={close} onChanged={reload} />}
  </div>;
}
