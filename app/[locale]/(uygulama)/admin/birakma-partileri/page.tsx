"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
   Yönetim: SUPER_ADMIN + OPERATIONS; FINANCE yalnız görüntüler.
   ═══════════════════════════════════════════════════════════════════════ */

interface Batch {
  id: string;
  land_id: string;
  land_name: string;
  season_label: string;
  title: string | null;
  planned_on: string | null;
  released_on: string | null;
  notes: string | null;
  orders: number;
  quantity: number;
  created_at: string;
}

interface ListResponse {
  batches: Batch[];
  lands: { id: string; name: string; status: string; is_public: boolean }[];
  seasons: string[];
  waiting: { landId: string; landName: string; seasonLabel: string; orders: number; quantity: number }[];
  canManage: boolean;
}

interface OrderRow {
  id: string;
  order_no: string;
  status: string;
  is_test: boolean;
  quantity: number;
  total_kurus: number;
  buyer_first_name: string;
  buyer_last_name: string;
  certificate_name: string;
  confirmed_at: string | null;
  capacity_held: boolean;
}

interface DetailResponse {
  batch: Batch & { video_url: string | null };
  land: { name: string; capacity_seeds: number; filled_seeds: number; reserved_seeds: number } | null;
  orders: OrderRow[];
  candidates: OrderRow[];
}

const ERRORS: Record<string, string> = {
  not_found: "Kayıt bulunamadı.",
  invalid_state: "Bu işlem için uygun durumda değil.",
  mismatch: "Sipariş başka bir sahaya ya da sezona ait.",
  capacity_not_held: "Bu siparişin kapasitesi ayrılamamış; önce sipariş ekranından çözülmeli.",
  invalid_date: "Tarih geçersiz: bırakma tarihi bugünden ileri olamaz ve cayma süresi dolmuş olmalıdır.",
  empty: "Partide bırakılacak sipariş yok.",
  invalid_body: "Eksik ya da hatalı bilgi.",
  unavailable: "Şu anda işlenemiyor; yeniden deneyin.",
};

const day = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("tr-TR", { dateStyle: "long" }) : "—");
const todayTr = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

export default function PartilerPage() {
  return (
    <RoleGuard path="/admin/birakma-partileri">
      <Content />
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

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 5000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 8000); return () => clearTimeout(t); }
  }, [error]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/release-batches");
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as ListResponse;
      setData(json);
      setForm((f) => ({ ...f, seasonLabel: f.seasonLabel || json.seasons[0] || "" }));
    } catch {
      setError("Partiler yüklenemedi.");
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/release-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landId: form.landId, seasonLabel: form.seasonLabel, title: form.title.trim() || null, plannedOn: form.plannedOn || null, notes: form.notes.trim() || null }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; batch?: { id: string } };
      if (!res.ok) setError(ERRORS[json.error ?? ""] ?? "Parti oluşturulamadı.");
      else {
        setSuccess("Parti oluşturuldu.");
        setCreating(false);
        setForm((f) => ({ ...f, title: "", plannedOn: "", notes: "" }));
        await load();
        if (json.batch?.id) setSelectedId(json.batch.id);
      }
    } catch {
      setError("Bağlantı kurulamadı.");
    }
    setSaving(false);
  };

  const canManage = data?.canManage ?? false;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Bırakma Partileri</h1>
          <p className="text-sm text-slate-400 mt-1">Kesinleşmiş siparişleri bırakma çalışmalarına atayın; bırakma yapılınca partiyi işaretleyin.</p>
        </div>
        {canManage && <Button variant="primary" onClick={() => setCreating((v) => !v)}>{creating ? "Vazgeç" : "+ Yeni parti"}</Button>}
      </div>

      {success && <div className="bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">✅ {success}</div>}
      {error && <div className="bg-red-500/10 ring-1 ring-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">❌ {error}</div>}

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Proje Uygulama Sahası" value={form.landId} onChange={(e) => setForm({ ...form, landId: e.target.value })}>
              <option value="">Saha seçin</option>
              {data.lands.map((l) => (
                <option key={l.id} value={l.id}>{l.name}{l.is_public ? "" : " (yayında değil)"}</option>
              ))}
            </Select>
            <Select label="Sezon" value={form.seasonLabel} onChange={(e) => setForm({ ...form, seasonLabel: e.target.value })}>
              {data.seasons.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input label="Başlık (isteğe bağlı)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} placeholder="Kasım 1. çalışma" />
            <Input label="Planlanan tarih (isteğe bağlı)" type="date" value={form.plannedOn} onChange={(e) => setForm({ ...form, plannedOn: e.target.value })} />
          </div>
          <Textarea label="Not" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} maxLength={2000} />
          <Button variant="primary" loading={saving} disabled={!form.landId || !form.seasonLabel} onClick={create}>Partiyi oluştur</Button>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : !data || data.batches.length === 0 ? (
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
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{b.land_name} <span className="text-slate-400 font-normal">· {b.season_label}{b.title ? ` · ${b.title}` : ""}</span></p>
                  <p className="text-xs text-slate-500 mt-1">{b.orders} sipariş · {formatCount(b.quantity, "tr")} tohum topu · plan {day(b.planned_on)}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${b.released_on ? "ring-1 ring-green-500/50 bg-green-500/10 text-green-300" : "ring-1 ring-teal-500/50 bg-teal-500/10 text-teal-300"}`}>
                  {b.released_on ? `Bırakıldı · ${day(b.released_on)}` : "Planlandı"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <BatchDetail
          id={selectedId}
          canManage={canManage}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          notify={(ok, message) => (ok ? setSuccess(message) : setError(message))}
        />
      )}
    </div>
  );
}

function BatchDetail({ id, canManage, onClose, onChanged, notify }: { id: string; canManage: boolean; onClose: () => void; onChanged: () => Promise<void>; notify: (ok: boolean, message: string) => void }) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [releasedOn, setReleasedOn] = useState(todayTr);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [edit, setEdit] = useState({ title: "", plannedOn: "", notes: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/release-batches/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as DetailResponse;
      setDetail(json);
      setEdit({ title: json.batch.title ?? "", plannedOn: json.batch.planned_on ?? "", notes: json.batch.notes ?? "" });
      setPicked(new Set());
    } catch {
      notify(false, "Parti yüklenemedi.");
      onClose();
    }
  }, [id, notify, onClose]);
  useEffect(() => { load(); }, [load]);

  const send = async (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown> | null, okMessage: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/release-batches/${id}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string | null; skipped?: string[] };
      if (!res.ok) {
        notify(false, `${ERRORS[json.error ?? ""] ?? "İşlem başarısız oldu."}${json.detail ? ` (${json.detail})` : ""}`);
        await load();
      } else {
        notify(true, json.skipped?.length ? `${okMessage} İşlenemeyen siparişler: ${json.skipped.join(", ")}` : okMessage);
        await onChanged();
        if (method === "DELETE") onClose();
        else await load();
      }
      setBusy(false);
      return res.ok;
    } catch {
      notify(false, "Bağlantı kurulamadı.");
      setBusy(false);
      return false;
    }
  };

  const totals = useMemo(() => ({ orders: detail?.orders.length ?? 0, quantity: detail?.orders.reduce((s, o) => s + o.quantity, 0) ?? 0 }), [detail]);
  const selectable = detail?.candidates.filter((c) => c.capacity_held) ?? [];
  const released = Boolean(detail?.batch.released_on);
  const dirty = detail ? edit.title !== (detail.batch.title ?? "") || edit.plannedOn !== (detail.batch.planned_on ?? "") || edit.notes !== (detail.batch.notes ?? "") : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="glass border border-white/[0.08] rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="parti-baslik">
        {!detail ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4">
              <div>
                <h2 id="parti-baslik" className="font-bold text-white text-lg">{detail.land?.name ?? "Saha"} · {detail.batch.season_label}</h2>
                <p className="text-xs text-slate-400">{released ? `Bırakıldı · ${day(detail.batch.released_on)}` : `Planlandı · ${day(detail.batch.planned_on)}`} · {totals.orders} sipariş · {formatCount(totals.quantity, "tr")} tohum topu</p>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-white text-xl transition-colors" aria-label="Kapat">&times;</button>
            </div>

            <div className="p-6 space-y-6">
              {detail.land && (
                <p className="text-xs text-slate-500">
                  Saha kapasitesi: {formatCount(detail.land.capacity_seeds, "tr")} · bırakılan {formatCount(detail.land.filled_seeds, "tr")} · siparişler için ayrılan {formatCount(detail.land.reserved_seeds, "tr")}
                </p>
              )}

              {canManage && (
                <section className="space-y-3">
                  <h3 className="text-xs text-slate-500 font-medium uppercase tracking-wider">Parti bilgisi</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input label="Başlık" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={120} />
                    <Input label="Planlanan tarih" type="date" value={edit.plannedOn} disabled={released} onChange={(e) => setEdit({ ...edit, plannedOn: e.target.value })} />
                  </div>
                  <Textarea label="Not" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={2} maxLength={2000} />
                  <Button variant="secondary" size="sm" loading={busy} disabled={!dirty} onClick={() => send("PATCH", { title: edit.title.trim() || null, plannedOn: edit.plannedOn || null, notes: edit.notes.trim() || null }, "Parti güncellendi.")}>Kaydet</Button>
                </section>
              )}

              <section className="space-y-3">
                <h3 className="text-xs text-slate-500 font-medium uppercase tracking-wider">Partideki siparişler</h3>
                {detail.orders.length === 0 ? (
                  <p className="text-sm text-slate-500">Bu partide henüz sipariş yok.</p>
                ) : (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.06]">
                    {detail.orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                        <OrderLine o={o} />
                        {canManage && !released && o.status === "scheduled" && (
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
                    {canManage && selectable.length > 0 && (
                      <button className="text-xs text-emerald-300 hover:underline" onClick={() => setPicked(picked.size === selectable.length ? new Set() : new Set(selectable.map((c) => c.id)))}>
                        {picked.size === selectable.length ? "Seçimi kaldır" : "Tümünü seç"}
                      </button>
                    )}
                  </div>
                  {detail.candidates.length === 0 ? (
                    <p className="text-sm text-slate-500">Bekleyen sipariş yok. Siparişler, cayma süresi (14 gün) dolunca burada görünür.</p>
                  ) : (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.06]">
                      {detail.candidates.map((o) => (
                        <label key={o.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${o.capacity_held ? "cursor-pointer" : "opacity-60"}`}>
                          {canManage && (
                            <input
                              type="checkbox"
                              className="accent-emerald-500"
                              disabled={!o.capacity_held}
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
                          {!o.capacity_held && <span className="shrink-0 text-xs text-amber-300">kapasitesi ayrılamamış</span>}
                        </label>
                      ))}
                    </div>
                  )}
                  {canManage && detail.candidates.length > 0 && (
                    <Button variant="primary" size="sm" loading={busy} disabled={picked.size === 0} onClick={() => send("POST", { action: "assign", orderIds: [...picked] }, "Siparişler partiye alındı.")}>
                      Seçilenleri partiye al ({picked.size})
                    </Button>
                  )}
                </section>
              )}

              {canManage && !released && (
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

              {canManage && detail.orders.length === 0 && (
                <button disabled={busy} onClick={() => send("DELETE", null, "Parti silindi.")} className="text-xs text-slate-500 hover:text-red-300 disabled:opacity-50">Bu boş partiyi sil</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OrderLine({ o }: { o: OrderRow }) {
  return (
    <span className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
      <a href={`/admin/birakma-siparisleri?no=${o.order_no}`} target="_blank" rel="noopener noreferrer" className="font-mono text-emerald-300 hover:underline">{o.order_no}</a>
      {o.is_test && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-amber-500/50 bg-amber-500/10 text-amber-300">DENEME</span>}
      <span className="text-white truncate">{o.buyer_first_name} {o.buyer_last_name}</span>
      <span className="text-xs text-slate-500">{formatCount(o.quantity, "tr")} tohum topu · {formatTry(o.total_kurus, "tr")} · sertifika: {o.certificate_name}</span>
    </span>
  );
}
