"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Select, Textarea } from "@/components/ui";
import { useAdmin } from "@/lib/admin-context";
import { containDialogTab } from "@/lib/hooks/dialog-keyboard";
import type { RequestItem, RequestListDto, RequestStatus } from "@/lib/requests/admin-dto";
import { REQUEST_STATUSES } from "@/lib/requests/schema";
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS, LAND_CONDITION_LABELS, OWNERSHIP_LABELS, TIMING_LABELS } from "@/lib/requests/labels";
import { ilAdi } from "@/lib/tr-iller";
import type { ApiWarning } from "@/lib/api/envelope";
import { accessRequest } from "../access/transport";
import { AdminApiError, errorText } from "../operations/client";
import { date, requestChanges, safeMapLink } from "./view";
export default function RequestDialog({ id, no, onClose, onChanged }: { id: string; no: string; onClose: () => void; onChanged: () => void }) {
  const { refresh } = useAdmin();
  const dialog = useRef<HTMLDialogElement>(null), feedback = useRef<HTMLDivElement>(null);
  const state = useRef({ alive: false, generation: 0, busy: false });
  const [item, setItem] = useState<RequestItem | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("new"), [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const setCurrent = (value: RequestItem) => { setItem(value); setStatus(value.status); setNote(value.adminNote ?? ""); };
  const load = useCallback(async () => {
    const current = ++state.current.generation;
    setLoading(true); setItem(null); setBlocked(true); setProblem(null);
    try {
      const { data } = await accessRequest<RequestListDto>(`/api/admin/requests?${new URLSearchParams({ q: no, pageSize: "25" })}`);
      if (!state.current.alive || current !== state.current.generation) return;
      const found = data.items?.find(r => r.id === id);
      if (!found) throw new AdminApiError("not_found", "Talep bulunamadı veya görüntüleme kapsamınız dışında.", 404);
      setCurrent(found); setBlocked(false);
    } catch (e) {
      if (!state.current.alive || current !== state.current.generation) return;
      setProblem(errorText(e));
      if (e instanceof AdminApiError && [401, 403].includes(e.status)) void refresh();
    } finally { if (state.current.alive && current === state.current.generation) setLoading(false); }
  }, [id, no, refresh]);
  useEffect(() => {
    const token = state.current; token.alive = true;
    const el = dialog.current, previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el?.showModal(); void load();
    return () => { token.alive = false; token.generation++; el?.close(); if (previous?.isConnected) previous.focus(); };
  }, [load]);
  const save = async () => {
    if (!item?.canUpdate || state.current.busy || loading || blocked) return;
    const changes = requestChanges(item, status, note);
    if (Object.keys(changes).length === 1) return;
    state.current.busy = true; setBusy(true); setProblem(null); setSuccess(null);
    try {
      const response = await accessRequest<RequestItem>("/api/admin/requests", "PATCH", changes);
      if (!state.current.alive) return;
      if (response.data?.id !== id || !REQUEST_STATUSES.includes(response.data.status)) throw new Error("Güncelleme sonucu doğrulanamadı. Yeniden göndermeden önce talebi yenileyin.");
      setCurrent(response.data); setSuccess("Talep güncellendi."); setWarnings(previous => [...previous, ...response.warnings]); onChanged();
    } catch (e) {
      if (!state.current.alive) return;
      const code = e instanceof AdminApiError ? e.code : "unknown";
      const applied = e instanceof AdminApiError && e.details?.applied === true;
      setProblem(applied ? "Değişiklik kaydedildi; güncel görünüm alınamadı. Tekrar kaydetmeyin, talebi yenileyin." : errorText(e));
      setBlocked(code !== "invalid_body");
      if (e instanceof AdminApiError && [401, 403, 404].includes(e.status)) { setItem(null); setNote(""); void refresh(); }
    } finally { state.current.busy = false; if (state.current.alive) { setBusy(false); feedback.current?.focus(); } }
  };
  const contact = item?.contact;
  const map = safeMapLink(contact?.mapLink ?? null);
  const unchanged = !!item && status === item.status && note === (item.adminNote ?? "");
  return <dialog ref={dialog} aria-labelledby="talep-detay-baslik" aria-busy={busy || loading} onKeyDown={containDialogTab} onCancel={e => { if (state.current.busy) e.preventDefault(); else onClose(); }} className="m-auto w-[calc(100%-1rem)] max-w-2xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-[#0b1410] border border-white/15 text-white p-0 backdrop:bg-black/70">
    <header className="sticky top-0 bg-[#0b1410] border-b border-white/10 p-4 flex flex-wrap justify-between items-center gap-3"><h2 id="talep-detay-baslik" className="font-mono font-semibold">{no}</h2><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy || loading} onClick={() => void load()}>Talebi yenile</Button><Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>Kapat</Button></div></header>
    <div className="p-4 sm:p-6 space-y-5"><div ref={feedback} tabIndex={-1} className="space-y-3 outline-none">{problem && <p role="alert" className="border border-red-400/40 p-3 rounded-xl text-sm text-red-200">{problem}</p>}{blocked && item && <p className="text-sm text-amber-100">Güncel durum alınana kadar kaydetme kapalı. Talebi yenileyin.</p>}{success && <p role="status" className="text-sm text-emerald-200">{success}</p>}{warnings.map((w,i) => <p role="alert" key={i} className="text-sm text-amber-100">{w.message} Kaydı yeniden göndermeyin.</p>)}</div>
      {loading && <p role="status" className="text-slate-300">Talep yükleniyor…</p>}
      {item && <>
        <section className="space-y-3"><h3 className="font-semibold">Talep bilgileri</h3><dl className="grid sm:grid-cols-2 gap-4"><Info label="Tür" value={REQUEST_TYPE_LABELS.tr[item.type]} /><Info label="Durum" value={REQUEST_STATUS_LABELS.tr[item.status]} /><Info label="Saha" value={item.site?.name ?? "Sahasız başvuru"} /><Info label="Oluşturulma" value={date(item.createdAt)} /><Info label="Dil" value={item.locale.toUpperCase()} />{item.totalSeeds !== null && <Info label="Toplam adet" value={item.totalSeeds.toLocaleString("tr-TR")} />}{item.details.type === "land_application" && <><Info label="İl / ilçe" value={`${ilAdi(item.details.province) ?? item.details.province} / ${item.details.district ?? "—"}`} /><Info label="Alan" value={`${item.details.areaValue.toLocaleString("tr-TR")} ${item.details.areaUnit}`} /><Info label="Arazi koşulları" value={item.details.conditions.map(c => LAND_CONDITION_LABELS.tr[c as keyof typeof LAND_CONDITION_LABELS.tr] ?? c).join(", ")} /><Info label="Mülkiyet" value={OWNERSHIP_LABELS.tr[item.details.ownership as keyof typeof OWNERSHIP_LABELS.tr] ?? item.details.ownership} /><Info label="Zamanlama" value={TIMING_LABELS.tr[item.details.timing as keyof typeof TIMING_LABELS.tr] ?? item.details.timing} /></>}</dl>{item.seedItems.length > 0 && <ul className="text-sm text-slate-300">{item.seedItems.map((s,i) => <li key={`${s.slug}:${i}`}>{s.name} · {s.quantity.toLocaleString("tr-TR")}</li>)}</ul>}</section>
        {contact ? <section className="space-y-3"><h3 className="font-semibold">İletişim ve müşteri mesajı</h3><dl className="grid sm:grid-cols-2 gap-4"><Info label="Ad soyad" value={contact.name} /><Info label="Şirket" value={contact.company} /><Info label="E-posta" value={contact.email && <a className="underline text-emerald-300 break-all" href={`mailto:${contact.email}`}>{contact.email}</a>} /><Info label="Telefon" value={contact.phone && <a className="underline text-emerald-300" href={`tel:${contact.phone}`}>{contact.phone}</a>} /><Info label="Hesap" value={contact.hasAccount ? "Üye hesabıyla" : "Misafir"} /><Info label="Sertifikadaki ad" value={contact.certificateName} /><Info label="Kaynak" value={contact.sourcePath} /><Info label="Aydınlatma kaydı" value={`${date(contact.consent.at)} · ${contact.consent.version ?? "—"}`} /></dl>{contact.message && <Info label="Müşteri mesajı" value={contact.message} />}{contact.accessNotes && <Info label="Erişim / arazi notu" value={contact.accessNotes} />}{map && <a className="inline-flex min-h-11 items-center text-sm text-emerald-300 underline" href={map} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer">Konum bağlantısını aç (yeni sekme)</a>}</section> : <p className="text-sm text-slate-400">Bu kaydın iletişim ve müşteri mesajı bilgilerini görüntüleme yetkiniz yok.</p>}
        <section className="space-y-3"><h3 className="font-semibold">Takip</h3>{item.canUpdate ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void save(); }}><Select label="Yeni durum" value={status} disabled={busy || blocked} onChange={e => setStatus(e.target.value as RequestStatus)}>{REQUEST_STATUSES.map(s => <option key={s} value={s}>{REQUEST_STATUS_LABELS.tr[s]}</option>)}</Select><Textarea label="Yönetici notu (müşteriye gösterilmez)" rows={3} maxLength={4000} value={note} disabled={busy || blocked} onChange={e => setNote(e.target.value)} /><Button type="submit" disabled={busy || blocked || unchanged}>Kaydet</Button></form> : <><p className="text-sm text-slate-400">Bu kaydı güncelleme yetkiniz yok.</p><Info label="Yönetici notu" value={item.adminNote} /></>}{item.lastHandled.at && <p className="text-xs text-slate-400">Son işlem: {date(item.lastHandled.at)}. Bu bilgi personel ataması değildir.</p>}</section>
      </>}
    </div>
  </dialog>;
}
function Info({ label, value }: { label: string; value: ReactNode }) { return <div className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 text-sm text-slate-200 whitespace-pre-wrap [overflow-wrap:anywhere]">{value ?? "—"}</dd></div>; }
