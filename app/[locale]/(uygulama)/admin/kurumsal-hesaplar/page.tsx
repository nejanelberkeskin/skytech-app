"use client";

import { useCallback, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import AccessDenialNotice from "@/components/admin/access/AccessDenialNotice";
import { accessRequest } from "@/components/admin/access/transport";
import { errorText } from "@/components/admin/operations/client";
import { Button, Textarea } from "@/components/ui";
import type { CorporateAccountItem, CorporateStatus } from "@/lib/corporate/accounts";

/**
 * Yönetim — Kurumsal hesap başvuruları (043). Bekleyen başvuru onaylanır ya da gerekçeyle reddedilir; başvuru sahibine
 * e-posta gider, karar işlem geçmişine yazılır. Onaylı hesap kurumsal panelde teklif isteyebilir.
 */
const SCOPE = "/admin/kurumsal-hesaplar";
const LABELS: Record<CorporateStatus, string> = { pending: "Onay bekliyor", approved: "Onaylandı", rejected: "Reddedildi" };
const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso)) : "—";

function Accounts() {
  const [status, setStatus] = useState<CorporateStatus>("pending");
  const [items, setItems] = useState<CorporateAccountItem[]>([]);
  const [counts, setCounts] = useState<Record<CorporateStatus, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<CorporateAccountItem | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await accessRequest<{ items: CorporateAccountItem[]; counts: Record<CorporateStatus, number> }>(
        `/api/admin/corporate-accounts?status=${status}`,
      );
      setItems(data.items);
      setCounts(data.counts);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (decision: "approve" | "reject") => {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      await accessRequest(`/api/admin/corporate-accounts`, "PATCH", { userId: open.userId, decision, ...(note.trim() ? { note: note.trim() } : {}) });
      setOpen(null);
      setNote("");
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Kurumsal Başvurular</h1>
        <p className="text-sm text-slate-600 mt-1">Onaylanan kurum kurumsal panele girip teklif isteyebilir. Ret gerekçesi başvuru sahibine e-postayla gider.</p>
      </div>
      <div role="tablist" className="flex flex-wrap gap-2">
        {(Object.keys(LABELS) as CorporateStatus[]).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`rounded-xl px-4 py-2 text-sm ${status === s ? "bg-emerald-500/20 text-emerald-700" : "bg-white text-slate-600 hover:text-slate-900"}`}
          >
            {LABELS[s]} ({counts[s]})
          </button>
        ))}
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <p role="status" className="text-sm text-slate-600">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">Bu durumda başvuru yok.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.userId} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{item.companyTitle}</p>
                <p className="text-xs text-slate-600">{item.authorizedPerson} · {item.email} · {day(item.createdAt)}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setOpen(item); setNote(""); }}>İncele</Button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Başvuru ayrıntısı" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">{open.companyTitle}</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["VKN / TCKN", open.taxId],
                ["Vergi dairesi", open.taxOffice],
                ["Yetkili", open.authorizedPerson],
                ["Telefon", open.phone],
                ["E-posta", open.email],
                ["Başvuru", day(open.createdAt)],
                ["Durum", LABELS[open.status]],
                ["Karar tarihi", day(open.reviewedAt)],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-slate-600">{k}</dt><dd className="text-slate-900 break-words">{v || "—"}</dd></div>
              ))}
              <div className="sm:col-span-2"><dt className="text-slate-600">Adres</dt><dd className="text-slate-900 whitespace-pre-wrap">{open.address}</dd></div>
              {open.reviewNote && <div className="sm:col-span-2"><dt className="text-slate-600">Karar notu</dt><dd className="text-slate-900">{open.reviewNote}</dd></div>}
            </dl>
            {open.status === "pending" && (
              <Textarea label="Not (ret için zorunlu; başvuru sahibine iletilir)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" disabled={busy} onClick={() => setOpen(null)}>Kapat</Button>
              {open.status === "pending" && (
                <>
                  <Button variant="secondary" loading={busy} disabled={!note.trim()} onClick={() => decide("reject")}>Reddet</Button>
                  <Button variant="primary" loading={busy} onClick={() => decide("approve")}>Onayla</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KurumsalHesaplarPage() {
  return (
    <>
      <AccessDenialNotice scope={SCOPE} />
      <RoleGuard path={SCOPE}>
        <Accounts />
      </RoleGuard>
    </>
  );
}
