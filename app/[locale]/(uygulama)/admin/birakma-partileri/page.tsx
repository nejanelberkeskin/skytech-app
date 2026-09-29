"use client";

import { useAdmin } from "@/lib/admin-context";
import { Link } from "@/i18n/navigation";
import { containDialogTab } from "@/lib/hooks/dialog-keyboard";
import { accessRequest } from "@/components/admin/access/transport";
import { AdminApiError, errorText } from "@/components/admin/operations/client";
import type { BatchListDto as ListResponse, BatchDetailDto as DetailResponse, BatchOrderRow as OrderRow, BatchSummary } from "@/lib/batches/admin-dto";
import type { ApiWarning } from "@/lib/api/envelope";
import { batchAccessKey, batchPatch, validBatchResult } from "@/components/admin/batches/view";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import RoleGuard from "@/components/RoleGuard";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { formatCount, formatTry } from "@/lib/pricing";

/* ═══════════════════════════════════════════════════════════════════════
   Admin — Bırakma Partileri
   ═══════════════════════════════════════════════════════════════════════
   Parti = bir sahada, bir sezonda, aynı gün yapılacak bırakma çalışması.
   Kesinleşmiş (cayma süresi dolmuş) siparişler partiye alınır; bırakma
   yapılınca parti "bırakıldı" işaretlenir → siparişler "Bırakıldı" olur,
   kapasite kalıcıya geçer, fatura kuyruğu dolar. Bu adım geri alınamaz.
   İşlemler sunucunun parti ve saha kapsamındaki yeteneklerine bağlıdır.
   ═══════════════════════════════════════════════════════════════════════ */

const day = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("tr-TR", { dateStyle: "long" }) : "—");
const todayTr = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

export default function PartilerPage() {
  const { me } = useAdmin();
  return (
    <RoleGuard path="/admin/birakma-partileri">
      <Content key={batchAccessKey(me)} />
    </RoleGuard>
  );
}

function Content() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ landId: "", seasonLabel: "", title: "", plannedOn: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const { refresh } = useAdmin();
  const state = useRef({ alive: false, generation: 0, busy: false });
  const [blocked, setBlocked] = useState(false), [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const close = useCallback(() => setSelectedId(null), []);
  const deleted = useCallback((messages: ApiWarning[]) => { setSuccess("Parti silindi."); setWarnings(w=>[...w,...messages]);setSelectedId(null); }, []);
  const load = useCallback(async () => {
    const generation = ++state.current.generation; setLoading(true); setData(null);
    try {
      const { data: json } = await accessRequest<ListResponse>("/api/admin/release-batches");
      if (!state.current.alive || generation !== state.current.generation) return;
      if (!Array.isArray(json?.batches) || !Array.isArray(json.lands) || !json.capabilities) throw new Error("Parti listesi okunamadı.");
      setData(json); setBlocked(false); setError(null);
      setForm(f => ({ ...f, seasonLabel: f.seasonLabel || json.seasons[0] || "" }));
    } catch(e) {
      if (!state.current.alive || generation !== state.current.generation) return;
      setError(errorText(e));
      if (e instanceof AdminApiError && [401,403].includes(e.status)) { setSelectedId(null); setCreating(false); void refresh(); }
    } finally { if (state.current.alive && generation === state.current.generation) setLoading(false); }
  }, [refresh]);
  useEffect(() => { const token=state.current; token.alive=true; void load(); return () => { token.alive=false;token.generation++; }; }, [load]);
  const create = async () => {
    if(state.current.busy || blocked || !data?.capabilities.create || !data.lands.some(l => l.id === form.landId && l.canPlan))return;
    state.current.busy=true;setSaving(true);setError(null);
    try {
      const result=await accessRequest<{batch:BatchSummary}>("/api/admin/release-batches","POST",{landId:form.landId,seasonLabel:form.seasonLabel,title:form.title.trim()||null,plannedOn:form.plannedOn||null,notes:form.notes.trim()||null});
      if(!state.current.alive)return;
      if(!result.data?.batch?.id)throw new Error("Oluşturma sonucu doğrulanamadı. Yeniden göndermeden önce listeyi yenileyin.");
      setWarnings(w=>[...w,...result.warnings]);setSuccess("Parti oluşturuldu.");setCreating(false);setForm(f=>({...f,title:"",plannedOn:"",notes:""}));await load();
      if(state.current.alive)setSelectedId(result.data.batch.id);
    } catch(e) { if(!state.current.alive)return;setError(errorText(e));setBlocked(!(e instanceof AdminApiError && e.code === "invalid_body"));if(e instanceof AdminApiError && [401,403,404].includes(e.status)){setCreating(false);setData(null);void refresh();} }
    finally { state.current.busy=false;if(state.current.alive)setSaving(false); }
  };
  const canCreate = data?.capabilities.create ?? false;
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Bırakma Partileri</h1>
          <p className="text-sm text-slate-400 mt-1">Kesinleşmiş siparişleri bırakma çalışmalarına atayın; bırakma yapılınca partiyi işaretleyin.</p>
        </div>
        {canCreate && <Button disabled={saving || blocked} variant="primary" onClick={() => setCreating((v) => !v)}>{creating ? "Vazgeç" : "+ Yeni parti"}</Button>}
      </div>

      <Button variant="secondary" disabled={saving || loading} onClick={() => { setCreating(false); void load(); }}>Listeyi yenile</Button>
      {blocked && <p className="text-amber-100 text-sm">Sonuç belirsiz veya kayıt değişti. Yeniden göndermeden önce listeyi yenileyin.</p>}
      {warnings.map((w,i)=><p role="alert" key={i} className="text-amber-100">{w.message} İşlemi tekrar göndermeyin.</p>)}
      {data && <p className="text-sm text-slate-300">{data.scope.kind === "all" ? "Kapsam: tüm sahalar" : `Kapsam: yetkili olduğunuz ${data.scope.siteIds.length} saha`}</p>}
      {data && data.dueForConfirmation > 0 && <p role="alert" className="text-sm border border-amber-400/40 p-4 rounded-xl text-amber-100">{data.dueForConfirmation} siparişin cayma süresi dolmuş ancak kesinleştirme işi henüz tamamlanmamış. Bekleyen sipariş listesi eksik olabilir. Yetkili kişi zamanlanmış işleri kontrol etmeli.</p>}
      {success && <div role="status" className="bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">✅ {success}</div>}
      {error && <div role="alert" className="bg-red-500/10 ring-1 ring-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">❌ {error}</div>}

      {data && data.waiting.length > 0 && (
        <div className="bg-white/[0.03] ring-1 ring-sky-500/30 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-sky-200 mb-2">Partiye alınmayı bekleyen siparişler</h2>
          <ul className="text-sm text-slate-300 space-y-1">
            {data.waiting.map((w) => (
              <li key={`${w.landId}|${w.seasonLabel}`}>
                <span className="text-white font-medium">{w.landName}</span> · {w.seasonLabel} — {w.orders} sipariş, {formatCount(w.quantity, "tr")} tohum topu
              </li>
            ))}
          </ul>
        </div>
      )}

      {creating && data && (
        <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-white text-sm">Yeni parti</h2>
          <fieldset disabled={saving || blocked} className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Proje Uygulama Sahası" value={form.landId} onChange={(e) => setForm({ ...form, landId: e.target.value })}>
              <option value="">Saha seçin</option>
              {data.lands.filter(l => l.canPlan).map((l) => (
                <option key={l.id} value={l.id}>{l.name}{l.isPublic ? "" : " (yayında değil)"}</option>
              ))}
            </Select>
            <Select label="Sezon" value={form.seasonLabel} onChange={(e) => setForm({ ...form, seasonLabel: e.target.value })}>
              {data.seasons.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input label="Başlık (isteğe bağlı)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} placeholder="Kasım 1. çalışma" />
            <Input label="Planlanan tarih (isteğe bağlı)" type="date" value={form.plannedOn} onChange={(e) => setForm({ ...form, plannedOn: e.target.value })} />
          </div>
          <Textarea label="Not" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} maxLength={2000} />
          <Button variant="primary" loading={saving} disabled={!form.landId || !form.seasonLabel} onClick={create}>Partiyi oluştur</Button></fieldset>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : !data ? null : data.batches.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl block mb-3">🚁</span>
          <p className="text-slate-400">Henüz parti yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.batches.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              className="w-full text-left bg-[var(--bg-surface)] border border-white/[0.06] hover:border-white/[0.1] rounded-2xl p-5 transition-all hover:bg-white/[0.03]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-white break-words">{b.landName} <span className="text-slate-400 font-normal">· {b.seasonLabel}{b.title ? ` · ${b.title}` : ""}</span></p>
                  <p className="text-xs text-slate-500 mt-1">{b.orders} sipariş · {formatCount(b.quantity, "tr")} tohum topu · plan {day(b.plannedOn)}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${b.releasedOn ? "ring-1 ring-green-500/50 bg-green-500/10 text-green-300" : "ring-1 ring-teal-500/50 bg-teal-500/10 text-teal-300"}`}>
                  {b.releasedOn ? `Bırakıldı · ${day(b.releasedOn)}` : "Planlandı"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <BatchDetail
          id={selectedId}
          onClose={close} onDeleted={deleted}
          onChanged={load}
        />
      )}
    </div>
  );
}

function BatchDetail({ id, onClose, onChanged, onDeleted }: { id: string; onClose: () => void; onChanged: () => Promise<void>; onDeleted: (warnings: ApiWarning[]) => void }) {
  const { refresh } = useAdmin();
  const state=useRef({alive:false,generation:0,busy:false}); const dialog=useRef<HTMLDialogElement>(null);
  const [detail,setDetail]=useState<DetailResponse|null>(null),[picked,setPicked]=useState<Set<string>>(new Set());
  const [busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null),[success,setSuccess]=useState<string|null>(null),[warnings,setWarnings]=useState<ApiWarning[]>([]);
  const [releasedOn,setReleasedOn]=useState(todayTr),[confirmRelease,setConfirmRelease]=useState(false),[confirmVideo,setConfirmVideo]=useState(false),[confirmDelete,setConfirmDelete]=useState(false);
  const [edit,setEdit]=useState({title:"",plannedOn:"",notes:"",reportUrl:""}),[videoUrl,setVideoUrl]=useState("");
  const load=useCallback(async()=>{
    const generation=++state.current.generation;setLoading(true);setDetail(null);setError(null);setBlocked(true);setPicked(new Set());setConfirmRelease(false);setConfirmVideo(false);setConfirmDelete(false);
    try {
      const {data}=await accessRequest<DetailResponse>(`/api/admin/release-batches/${id}`);
      if(!state.current.alive||generation!==state.current.generation)return;
      if(data?.batch?.id!==id||!Array.isArray(data.orders)||!Array.isArray(data.candidates))throw new Error("Parti ayrıntısı okunamadı.");
      setDetail(data);setEdit({title:data.batch.title??"",plannedOn:data.batch.plannedOn??"",notes:data.batch.notes??"",reportUrl:data.batch.monitoringReportUrl??""});setVideoUrl(data.batch.videoUrl??"");setBlocked(false);
    }catch(e){if(!state.current.alive||generation!==state.current.generation)return;setError(errorText(e));if(e instanceof AdminApiError&&[401,403].includes(e.status))void refresh();}
    finally{if(state.current.alive&&generation===state.current.generation)setLoading(false);}
  },[id,refresh]);
  useEffect(()=>{const token=state.current;token.alive=true;const el=dialog.current,previous=document.activeElement instanceof HTMLElement?document.activeElement:null;el?.showModal();void load();return()=>{token.alive=false;token.generation++;el?.close();if(previous?.isConnected)previous.focus();};},[load]);
  const send=async(method:"POST"|"PATCH"|"DELETE",body:Record<string,unknown>|null,okMessage:string)=>{
    if(state.current.busy||blocked||loading)return false;
    state.current.busy=true;setBusy(true);setError(null);setSuccess(null);
    try {
      const result=await accessRequest<Record<string,unknown>>(`/api/admin/release-batches/${id}`,method,body??undefined);
      if(!state.current.alive)return false;
      if(!validBatchResult(method,body?.action,result.data,id))throw new Error("İşlem sonucu doğrulanamadı. Yeniden göndermeden önce partiyi yenileyin.");
      setWarnings(w=>[...w,...result.warnings]);
      if(body?.action === "assign")okMessage=`${result.data.assigned} sipariş partiye alındı. Güncel liste yüklendiğinde atanmayanları kontrol edin.`;
      setSuccess(Array.isArray(result.data.skipped)&&result.data.skipped.length?`${okMessage} İşlenemeyen siparişler: ${result.data.skipped.join(", ")}`:okMessage);
      await onChanged();if(!state.current.alive)return false;
      if(method==="DELETE")onDeleted(result.warnings);else await load();return true;
    }catch(e){if(!state.current.alive)return false;setError(e instanceof AdminApiError&&e.details?.applied===true?"İşlem uygulandı ancak güncel kayıt okunamadı. Tekrar göndermeyin; partiyi yenileyin.":errorText(e));setBlocked(!(e instanceof AdminApiError&&["invalid_body","invalid_url","invalid_date"].includes(e.code)));setConfirmRelease(false);setConfirmVideo(false);setConfirmDelete(false);if(e instanceof AdminApiError&&[401,403,404].includes(e.status)&&e.code!=="mfa_required"){setDetail(null);setEdit({title:"",plannedOn:"",notes:"",reportUrl:""});setPicked(new Set());void refresh();}return false;}
    finally{state.current.busy=false;if(state.current.alive)setBusy(false);}
  };
  const caps=detail?.batch.capabilities;
  const totals = useMemo(() => ({ orders: detail?.orders.length ?? 0, quantity: detail?.orders.reduce((s, o) => s + o.quantity, 0) ?? 0 }), [detail]);
  const selectable = detail?.candidates.filter((c) => c.capacityHeld) ?? [];
  const released = Boolean(detail?.batch.releasedOn);
  const dirty = detail
    ? edit.title !== (detail.batch.title ?? "") ||
      edit.plannedOn !== (detail.batch.plannedOn ?? "") ||
      edit.notes !== (detail.batch.notes ?? "") ||
      edit.reportUrl !== (detail.batch.monitoringReportUrl ?? "")
    : false;
  const videoPublished = Boolean(detail?.batch.videoPublishedAt);

  return (
    <dialog ref={dialog} aria-label="Parti ayrıntısı" aria-busy={busy||loading} onKeyDown={containDialogTab} onCancel={e=>{if(state.current.busy)e.preventDefault();else onClose();}} className="m-auto w-[calc(100%-1rem)] max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-[#0b1410] border border-white/15 text-white p-0 backdrop:bg-black/70">
      <header className="sticky top-0 z-10 bg-[#0b1410] p-4 flex flex-wrap gap-3 justify-between border-b border-white/10"><Button variant="secondary" disabled={busy||loading} onClick={()=>void load()}>Partiyi yenile</Button><Button variant="ghost" disabled={busy} onClick={onClose}>Kapat</Button></header>
      <div className="px-4 space-y-3">{error&&<p role="alert" className="text-red-200 py-3">{error}</p>}{success&&<p role="status" className="text-emerald-200 py-3">{success}</p>}{warnings.map((w,i)=><p role="alert" key={i} className="text-amber-100">{w.message} İşlemi tekrar göndermeyin.</p>)}{blocked&&!loading&&<p className="text-sm text-amber-100">Güncel kayıt yüklenene kadar işlem kapalı. Partiyi yenileyin.</p>}{(blocked || !!detail?.mfaRequiredGroups.length || (detail?.mfa.enforced&&!detail.mfa.satisfied&&(caps?.release||caps?.publish)))&&!loading&&<div className="my-3 text-sm text-amber-100"><p>{detail?.mfaRequiredGroups.length?"Bazı özel sipariş alanları yeniden doğrulama bekliyor.":"Bırakma ve yayın işlemlerinde yeniden doğrulama gerekebilir."} Doğrulamadan sonra partiyi yenileyin; hiçbir işlem otomatik tekrarlanmaz.</p><Link href="/admin/guvenlik" target="_blank" rel="noopener noreferrer" className="underline">Hesap güvenliği (yeni sekme)</Link></div>}</div>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : detail ? (
          <>
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4">
              <div>
                <h2 id="parti-baslik" className="font-bold text-white text-lg">{detail.land?.name ?? "Saha"} · {detail.batch.seasonLabel}</h2>
                <p className="text-xs text-slate-400">{released ? `Bırakıldı · ${day(detail.batch.releasedOn)}` : `Planlandı · ${day(detail.batch.plannedOn)}`} · {totals.orders} sipariş · {formatCount(totals.quantity, "tr")} tohum topu</p>
              </div>

            </div>

            <fieldset disabled={busy||blocked} className="p-4 sm:p-6 space-y-6">
              {detail.land?.capacity && (
                <p className="text-xs text-slate-500">
                  Saha kapasitesi: {formatCount(detail.land.capacity.total, "tr")} · bırakılan {formatCount(detail.land.capacity.filled, "tr")} · siparişler için ayrılan {formatCount(detail.land.capacity.reserved, "tr")}
                </p>
              )}

              {(caps?.plan || (caps?.publish && released)) && (
                <section className="space-y-3">
                  <h3 className="text-xs text-slate-500 font-medium uppercase tracking-wider">Parti bilgisi</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input disabled={!caps?.plan} label="Başlık" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={120} />
                    <Input label="Planlanan tarih" type="date" value={edit.plannedOn} disabled={released || !caps?.plan} onChange={(e) => setEdit({ ...edit, plannedOn: e.target.value })} />
                  </div>
                  <Textarea disabled={!caps?.plan} label="Not" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={2} maxLength={2000} />
                  {released && (
                    <Input
                      disabled={!caps?.publish}
                      label="İzleme raporu bağlantısı (https, PDF) — saha sayfasında herkese açık görünür"
                      type="url"
                      value={edit.reportUrl}
                      onChange={(e) => setEdit({ ...edit, reportUrl: e.target.value })}
                      maxLength={500}
                      placeholder="https://…"
                    />
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy}
                    disabled={!dirty}
                    onClick={() =>
                      send(
                        "PATCH",
                        batchPatch(detail.batch, edit),
                        "Parti güncellendi."
                      )
                    }
                  >
                    Kaydet
                  </Button>
                </section>
              )}

              {!caps?.plan && detail.batch.notes && <p className="text-sm whitespace-pre-wrap break-words">Not: {detail.batch.notes}</p>}
              <section className="space-y-3">
                <h3 className="text-xs text-slate-500 font-medium uppercase tracking-wider">Partideki siparişler</h3>
                {detail.orders.length === 0 ? (
                  <p className="text-sm text-slate-500">Bu partide henüz sipariş yok.</p>
                ) : (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.06]">
                    {detail.orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                        <OrderLine o={o} />
                        {caps?.assign && !released && o.status === "scheduled" && (
                          <button disabled={busy} onClick={() => send("POST", { action: "unassign", orderId: o.id }, "Sipariş partiden çıkarıldı.")} className="shrink-0 text-xs text-slate-400 hover:text-red-300 disabled:opacity-50">Partiden çıkar</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {!released && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-xs text-slate-500 font-medium uppercase tracking-wider">Partiye alınabilecek siparişler (kesinleşmiş, aynı saha ve sezon)</h3>
                    {caps?.assign && selectable.length > 0 && (
                      <button className="text-xs text-emerald-300 hover:underline" onClick={() => setPicked(picked.size === selectable.length ? new Set() : new Set(selectable.map((c) => c.id)))}>
                        {picked.size === selectable.length ? "Seçimi kaldır" : "Tümünü seç"}
                      </button>
                    )}
                  </div>
                  {detail.candidatesTruncated && <p role="status" className="text-sm text-amber-100">İlk 500 uygun sipariş gösteriliyor. Atamadan sonra partiyi yenileyerek kalanları görebilirsiniz.</p>}
                  {detail.candidates.length === 0 ? (
                    <p className="text-sm text-slate-500">Bu partiye uygun kesinleşmiş sipariş bulunamadı. Cayma süresi dolan siparişler kesinleştirme işi tamamlanınca burada görünür.</p>
                  ) : (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.06]">
                      {detail.candidates.map((o) => (
                        <label key={o.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${o.capacityHeld ? "cursor-pointer" : "opacity-60"}`}>
                          {caps?.assign && (
                            <input
                              type="checkbox"
                              className="accent-emerald-500"
                              disabled={!o.capacityHeld}
                              checked={picked.has(o.id)}
                              onChange={(e) => {
                                const next = new Set(picked);
                                if (e.target.checked) next.add(o.id);
                                else next.delete(o.id);
                                setPicked(next);
                              }}
                            />
                          )}
                          <OrderLine o={o} />
                          {!o.capacityHeld && <span className="shrink-0 text-xs text-amber-300">kapasitesi ayrılamamış</span>}
                        </label>
                      ))}
                    </div>
                  )}
                  {caps?.assign && detail.candidates.length > 0 && (
                    <Button variant="primary" size="sm" loading={busy} disabled={picked.size === 0} onClick={() => send("POST", { action: "assign", orderIds: [...picked] }, "Siparişler partiye alındı.")}>
                      Seçilenleri partiye al ({picked.size})
                    </Button>
                  )}
                </section>
              )}

              {caps?.release && !released && (
                <section className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5 space-y-3">
                  <h3 className="font-semibold text-white text-sm">Bırakma tamamlandı</h3>
                  <p className="text-xs text-slate-500">
                    Partideki siparişler &quot;Bırakıldı&quot; olur, sahada ayrılan kapasite kalıcıya geçer ve siparişler fatura kuyruğuna girer. <strong className="text-slate-300">Bu işlem geri alınamaz.</strong>
                  </p>
                  <div className="max-w-xs">
                    <Input label="Bırakma tarihi" type="date" max={todayTr()} value={releasedOn} onChange={(e) => setReleasedOn(e.target.value)} />
                  </div>
                  {confirmRelease ? (
                    <div className="flex gap-3 flex-wrap">
                      <Button variant="primary" loading={busy} onClick={async () => { const ok = await send("POST", { action: "release", releasedOn }, "Bırakma işlendi."); if (ok) setConfirmRelease(false); }}>
                        Evet: {totals.orders} sipariş, {formatCount(totals.quantity, "tr")} tohum topu bırakıldı
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => setConfirmRelease(false)}>Vazgeç</Button>
                    </div>
                  ) : (
                    <Button variant="secondary" size="sm" disabled={totals.orders === 0 || !releasedOn} onClick={() => setConfirmRelease(true)}>Bırakmayı işaretle…</Button>
                  )}
                </section>
              )}

              {caps?.publish && released && (
                <section className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5 space-y-3">
                  <h3 className="font-semibold text-white text-sm">Çalışma videosu</h3>
                  <p className="text-xs text-slate-500">
                    Çalışmanın görüntüleri YouTube&apos;a <strong className="text-slate-300">herkese açık</strong> yüklendikten sonra bağlantıyı buraya girin. İlk yayımda partideki müşteriler için e-posta bildirimi başlatılır; teslim durumu ayrıca izlenir,
                    siparişleri &quot;Tamamlandı&quot; olur ve video saha sayfasında görünür. Sonradan yalnız bağlantı düzeltilebilir; yeniden e-posta gitmez.
                  </p>
                  <Input label="YouTube bağlantısı" type="url" value={videoUrl} onChange={(e) => { setVideoUrl(e.target.value); setConfirmVideo(false); }} maxLength={300} placeholder="https://youtu.be/…" />
                  {videoPublished ? (
                    <Button variant="secondary" size="sm" loading={busy} disabled={!videoUrl.trim() || videoUrl.trim() === (detail.batch.videoUrl ?? "")} onClick={() => send("POST", { action: "publish_video", videoUrl: videoUrl.trim() }, "Video bağlantısı güncellendi.")}>
                      Bağlantıyı güncelle
                    </Button>
                  ) : confirmVideo ? (
                    <div className="flex gap-3 flex-wrap">
                      <Button variant="primary" loading={busy} onClick={() => send("POST", { action: "publish_video", videoUrl: videoUrl.trim() }, "Video yayımlandı. Bildirimlerin teslim durumu ayrıca izlenmelidir.")}>
                        Evet: yayımla ve {totals.orders} müşteriye bildir
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => setConfirmVideo(false)}>Vazgeç</Button>
                    </div>
                  ) : (
                    <Button variant="secondary" size="sm" disabled={!videoUrl.trim()} onClick={() => setConfirmVideo(true)}>Videoyu yayımla…</Button>
                  )}
                </section>
              )}

              {caps?.plan && detail.orders.length === 0 && (
                <div>{confirmDelete ? <div className="space-y-3"><p className="text-sm text-red-200">Boş parti kalıcı olarak silinecek.</p><Button variant="danger" onClick={()=>void send("DELETE",null,"Parti silindi.")}>Onayla: boş partiyi sil</Button><Button variant="ghost" onClick={()=>setConfirmDelete(false)}>Vazgeç</Button></div> : <Button variant="ghost" onClick={()=>setConfirmDelete(true)}>Bu boş partiyi sil</Button>}</div>
              )}
            </fieldset>
          </>
        ) : null}
    </dialog>
  );
}

function OrderLine({ o }: { o: OrderRow }) {
  return (
    <span className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
      <a href={`/admin/birakma-siparisleri?no=${o.orderNo}`} target="_blank" rel="noopener noreferrer" className="font-mono text-emerald-300 hover:underline">{o.orderNo}</a>
      {o.isTest && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-amber-500/50 bg-amber-500/10 text-amber-300">DENEME</span>}
      {o.buyer && <span className="text-white break-words">{o.buyer.firstName} {o.buyer.lastName}</span>}
      <span className="text-xs text-slate-500">{formatCount(o.quantity, "tr")} tohum topu{o.finance && ` · ${formatTry(o.finance.totalKurus, "tr")}`}{o.certificateName !== undefined && ` · sertifika: ${o.certificateName}`}</span>
    </span>
  );
}
