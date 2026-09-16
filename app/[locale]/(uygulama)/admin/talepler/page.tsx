"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { Button, Select, Textarea } from "@/components/ui";
import type { ServiceRequest, ServiceRequestStatus, ServiceRequestType } from "@/lib/types";
import { REQUEST_STATUSES, REQUEST_TYPES } from "@/lib/requests/schema";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS, requestSummaryRows } from "@/lib/requests/labels";

/* ═══════════════════════════════════════════════════════════════════════
   Admin — Talepler
   ═══════════════════════════════════════════════════════════════════════
   /talep/* formlarından gelen kayıtlar. Liste + filtre + arama, detay
   paneli, durum ve yönetici notu güncelleme (PATCH → audit log).
   E-postadaki "Yönetim panelinde aç" bağlantısı ?no=TLP-… ile gelir.
   ═══════════════════════════════════════════════════════════════════════ */

type Row = ServiceRequest & { land?: { name: string; region: string | null } | null };

interface ListResponse {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<ServiceRequestStatus, number>;
}

const STATUS_BADGE: Record<ServiceRequestStatus, string> = {
  new: "ring-1 ring-yellow-500/50 bg-yellow-500/10 text-yellow-300",
  contacted: "ring-1 ring-sky-500/50 bg-sky-500/10 text-sky-300",
  quoted: "ring-1 ring-blue-500/50 bg-blue-500/10 text-blue-300",
  converted: "ring-1 ring-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  closed: "ring-1 ring-slate-500/50 bg-slate-500/10 text-slate-300",
  spam: "ring-1 ring-red-500/50 bg-red-500/10 text-red-300",
};

const TYPE_ICON: Record<ServiceRequestType, string> = {
  seed_purchase: "🌱",
  land_application: "🗺️",
  open_land_seeding: "🚁",
};

const PAGE_SIZE = 25;

export default function TaleplerPage() {
  return (
    <RoleGuard path="/admin/talepler">
      <Suspense fallback={<div className="p-8 text-slate-400 text-sm">Yükleniyor…</div>}>
        <TaleplerContent />
      </Suspense>
    </RoleGuard>
  );
}

function TaleplerContent() {
  const searchParams = useSearchParams();
  const deepLinkNo = searchParams.get("no");

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [status, setStatus] = useState<ServiceRequestStatus | "">("");
  const [type, setType] = useState<ServiceRequestType | "">("");
  const [q, setQ] = useState(deepLinkNo ?? "");
  const [debouncedQ, setDebouncedQ] = useState(deepLinkNo ?? "");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Row | null>(null);
  const [editStatus, setEditStatus] = useState<ServiceRequestStatus>("new");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const deepLinkHandled = useRef(false);

  // Filtre değişince ilk sayfaya dön (arama debounce'lu)
  const changeStatus = (v: ServiceRequestStatus | "") => { setStatus(v); setPage(1); };
  const changeType = (v: ServiceRequestType | "") => { setType(v); setPage(1); };
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 4000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 5000); return () => clearTimeout(t); }
  }, [error]);

  const openRow = useCallback((row: Row) => {
    setSelected(row);
    setEditStatus(row.status);
    setEditNote(row.admin_note ?? "");
  }, []);

  const load = useCallback(async () => {
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) sp.set("status", status);
      if (type) sp.set("type", type);
      if (debouncedQ) sp.set("q", debouncedQ);
      const res = await fetch(`/api/admin/requests?${sp.toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as ListResponse;
      setData(json);
      // E-postadan gelen ?no= bağlantısı: eşleşen kayıt ilk yüklemede açılır
      if (deepLinkNo && !deepLinkHandled.current) {
        deepLinkHandled.current = true;
        const hit = json.items.find((r) => r.request_no === deepLinkNo.toUpperCase());
        if (hit) openRow(hit);
      }
    } catch {
      setError("Talepler yüklenemedi.");
    }
    setLoading(false);
  }, [page, status, type, debouncedQ, deepLinkNo, openRow]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, status: editStatus, adminNote: editNote }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error === "not_found" ? "Kayıt bulunamadı." : "Güncelleme başarısız oldu.");
      } else {
        setSuccess("Talep güncellendi.");
        setSelected(null);
        load();
      }
    } catch {
      setError("Bağlantı hatası.");
    }
    setSaving(false);
  };

  const counts = data?.counts;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const filterChips = useMemo(
    () => [
      { value: "" as const, label: "Tümü", count: counts ? Object.values(counts).reduce((s, n) => s + n, 0) : 0 },
      ...REQUEST_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABELS.tr[s], count: counts?.[s] ?? 0 })),
    ],
    [counts]
  );

  return (
    <div className="p-8 space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Talepler</h1>
          <p className="text-sm text-slate-400 mt-1">Ödeme öncesi dönemde toplanan tohum, arazi ve ekim talepleri</p>
        </div>
        <div className="bg-white/[0.04] ring-1 ring-yellow-500/30 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-yellow-400 text-lg">📥</span>
          <span className="text-white font-bold">{counts?.new ?? "—"}</span>
          <span className="text-xs text-slate-400">dönüş bekliyor</span>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">✅ {success}</div>
      )}
      {error && (
        <div className="bg-red-500/10 ring-1 ring-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">❌ {error}</div>
      )}

      {/* Filtreler */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {filterChips.map((c) => (
            <button
              key={c.value || "all"}
              onClick={() => changeStatus(c.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                status === c.value
                  ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                  : "bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              {c.label} ({c.count})
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Talep no, ad, e-posta, telefon veya şirket ara…"
              className="w-full min-h-[44px] px-4 py-2.5 text-sm text-white bg-white/[0.03] border border-white/[0.08] rounded-xl placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>
          <Select value={type} onChange={(e) => changeType(e.target.value as ServiceRequestType | "")}>
            <option value="">Tüm türler</option>
            {REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>{REQUEST_TYPE_LABELS.tr[t]}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Liste */}
      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl block mb-3">📭</span>
          <p className="text-slate-400">Bu filtrede talep bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((r) => (
            <button
              key={r.id}
              onClick={() => openRow(r)}
              className={`w-full text-left bg-[var(--bg-surface)] border rounded-2xl p-5 transition-all hover:bg-white/[0.03] ${
                selected?.id === r.id ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : "border-white/[0.06] hover:border-white/[0.1]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <span className="font-mono text-sm font-bold text-emerald-300">{r.request_no}</span>
                    <span className="text-xs text-slate-400">{TYPE_ICON[r.type]} {REQUEST_TYPE_LABELS.tr[r.type]}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>
                      {REQUEST_STATUS_LABELS.tr[r.status]}
                    </span>
                  </div>
                  <p className="font-semibold text-white truncate">{r.contact_name}{r.company ? <span className="text-slate-400 font-normal"> · {r.company}</span> : null}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                    {r.email && <span>{r.email}</span>}
                    {r.phone && <span>{r.phone}</span>}
                    {r.total_seeds ? <span>{r.total_seeds.toLocaleString("tr-TR")} tohum</span> : null}
                    {r.land?.name && <span>{r.land.name}</span>}
                    {r.user_id && <span className="text-emerald-500/70">üye</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 text-xs text-slate-500">
                  {new Date(r.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </div>
            </button>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-sm text-slate-400">
              <span>{(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} / {data.total}</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Önceki</Button>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sonraki →</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detay paneli */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div
            className="glass border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="talep-detay-baslik"
          >
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4">
              <div>
                <h2 id="talep-detay-baslik" className="font-bold text-white text-lg font-mono">{selected.request_no}</h2>
                <p className="text-xs text-slate-400">
                  {TYPE_ICON[selected.type]} {REQUEST_TYPE_LABELS.tr[selected.type]} · {new Date(selected.created_at).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white text-xl transition-colors" aria-label="Kapat">&times;</button>
            </div>

            <div className="p-6 space-y-6">
              {/* İletişim */}
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Ad Soyad" value={selected.contact_name} />
                <InfoField label="Şirket / Kurum" value={selected.company || "—"} />
                <InfoField label="E-posta" value={selected.email ? <a href={`mailto:${selected.email}`} className="text-emerald-300 hover:underline">{selected.email}</a> : "—"} />
                <InfoField label="Telefon" value={selected.phone ? <a href={`tel:${selected.phone}`} className="text-emerald-300 hover:underline">{selected.phone}</a> : "—"} />
                <InfoField label="Dil / Kaynak" value={`${selected.locale.toUpperCase()}${selected.source_path ? ` · ${selected.source_path}` : ""}`} />
                <InfoField label="Hesap" value={selected.user_id ? "Üye hesabıyla" : "Misafir"} />
              </div>

              {/* Talep detayı */}
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Talep detayı</p>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.06]">
                  {requestSummaryRows(selected, "tr", selected.land ? (selected.land.region ? `${selected.land.name} (${selected.land.region})` : selected.land.name) : null).map((row, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                      <span className="text-slate-500 shrink-0">{row.label}</span>
                      {row.href ? (
                        <a href={row.href} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-300 hover:underline break-all text-right">{row.value}</a>
                      ) : (
                        <span className={`text-white text-right ${row.multiline ? "whitespace-pre-wrap" : ""}`}>{row.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selected.message && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Mesaj</p>
                  <p className="text-sm text-slate-300 bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 whitespace-pre-wrap">{selected.message}</p>
                </div>
              )}

              {/* Durum + not */}
              <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-white text-sm">Takip</h3>
                <Select label="Durum" value={editStatus} onChange={(e) => setEditStatus(e.target.value as ServiceRequestStatus)}>
                  {REQUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>{REQUEST_STATUS_LABELS.tr[s]}</option>
                  ))}
                </Select>
                <Textarea
                  label="Yönetici notu (müşteriye gösterilmez)"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder="Görüşme özeti, teklif bilgisi, sonraki adım…"
                />
                {selected.handled_at && (
                  <p className="text-xs text-slate-500">Son işlem: {new Date(selected.handled_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</p>
                )}
                <div className="flex gap-3 pt-1">
                  <Button variant="primary" fullWidth onClick={save} loading={saving}>Kaydet</Button>
                  <Button variant="secondary" onClick={() => setSelected(null)} disabled={saving}>Vazgeç</Button>
                </div>
              </div>

              <p className="text-[11px] text-slate-600">
                KVKK onayı: {selected.consent_version} · {new Date(selected.consent_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })} · Kayıt kimliği: {selected.id}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-white font-medium break-words">{value}</p>
    </div>
  );
}
