"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import ReleaseOrderDetail, { STATUS_BADGE, dt, type Detail } from "@/components/admin/ReleaseOrderDetail";
import { Button, Select } from "@/components/ui";
import { ORDER_STATUS_LABELS } from "@/lib/orders/labels";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/types";
import { formatCount, formatTry } from "@/lib/pricing";

/* ═══════════════════════════════════════════════════════════════════════
   Admin — Siparişler (sahaya tohum topu bıraktırma)
   ═══════════════════════════════════════════════════════════════════════
   Liste + filtre + arama; ayrıntıda alıcı/fatura, takvim, ödeme, belgeler,
   onay kayıtları, olay geçmişi. İşlemler: yönetici notu, satıcı kaynaklı
   iptal, iade, çift tahsilat iadesi, fatura kuyruğu. Para işlemleri
   SUPER_ADMIN + FINANCE; her işlem denetim izine yazılır.
   E-postadaki bağlantı ?no=SG-… ile gelir.
   ═══════════════════════════════════════════════════════════════════════ */

interface Row {
  id: string;
  order_no: string;
  status: OrderStatus;
  is_test: boolean;
  created_at: string;
  paid_at: string | null;
  quantity: number;
  total_kurus: number;
  buyer_type: "individual" | "corporate";
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  season_label: string;
  batch_id: string | null;
  withdrawal_deadline: string | null;
  performance_deadline: string | null;
  payment_provider: string | null;
  certificate_name: string;
  site_name: string | null;
  company_title: string | null;
}

type AlertKey = "refund_pending" | "invoice_pending" | "duplicate" | "capacity";

interface ListResponse {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<OrderStatus, number>;
  alerts: Record<AlertKey, number>;
}



const ALERT_META: Record<AlertKey, { label: string; icon: string }> = {
  refund_pending: { label: "iade bekliyor", icon: "↩️" },
  invoice_pending: { label: "fatura kesilecek", icon: "🧾" },
  duplicate: { label: "çift tahsilat", icon: "⚠️" },
  capacity: { label: "kapasitesiz ödeme", icon: "⚠️" },
};

const ACTION_ERRORS: Record<string, string> = {
  not_found: "Kayıt bulunamadı.",
  invalid_state: "Sipariş bu işlem için uygun durumda değil.",
  in_progress: "Bu iade şu anda işleniyor; birkaç dakika sonra yeniden deneyin.",
  already_done: "Bu işlem daha önce yapılmış.",
  provider_unavailable: "Ödemenin alındığı sağlayıcı bu ortamda yapılandırılmamış.",
  provider_error: "Ödeme sağlayıcısı işlemi reddetti.",
  forbidden: "Bu işlem için yetkiniz yok.",
  invalid_body: "Eksik ya da hatalı bilgi.",
  unavailable: "Şu anda işlenemiyor; yeniden deneyin.",
};

const PAGE_SIZE = 25;

export default function SiparislerPage() {
  return (
    <RoleGuard path="/admin/birakma-siparisleri">
      <Suspense fallback={<div className="p-8 text-slate-400 text-sm">Yükleniyor…</div>}>
        <Content />
      </Suspense>
    </RoleGuard>
  );
}

function Content() {
  const deepLinkNo = useSearchParams().get("no");

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [status, setStatus] = useState<OrderStatus | "">("");
  const [flag, setFlag] = useState<AlertKey | "">("");
  const [test, setTest] = useState<"all" | "hide" | "only">("all");
  const [q, setQ] = useState(deepLinkNo ?? "");
  const [debouncedQ, setDebouncedQ] = useState(deepLinkNo ?? "");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const deepLinkHandled = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 5000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 8000); return () => clearTimeout(t); }
  }, [error]);

  const load = useCallback(async () => {
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), test });
      if (status) sp.set("status", status);
      if (flag) sp.set("flag", flag);
      if (debouncedQ) sp.set("q", debouncedQ);
      const res = await fetch(`/api/admin/release-orders?${sp.toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as ListResponse;
      setData(json);
      if (deepLinkNo && !deepLinkHandled.current) {
        deepLinkHandled.current = true;
        const hit = json.items.find((r) => r.order_no === deepLinkNo.toUpperCase());
        if (hit) setSelectedId(hit.id);
      }
    } catch {
      setError("Siparişler yüklenemedi.");
    }
    setLoading(false);
  }, [page, status, flag, test, debouncedQ, deepLinkNo]);
  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/release-orders/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      setDetail((await res.json()) as Detail);
    } catch {
      setError("Sipariş ayrıntısı yüklenemedi.");
      setSelectedId(null);
    }
    setDetailLoading(false);
  }, []);
  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  /** İşlem gönderir; başarılıysa ayrıntıyı ve listeyi tazeler. */
  const act = useCallback(
    async (body: Record<string, unknown>, okMessage: string): Promise<boolean> => {
      if (!selectedId) return false;
      setError(null);
      try {
        const res = await fetch(`/api/admin/release-orders/${selectedId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string | null };
        if (!res.ok) {
          setError(`${ACTION_ERRORS[json.error ?? ""] ?? "İşlem başarısız oldu."}${json.detail ? ` (${json.detail})` : ""}`);
          await loadDetail(selectedId);
          return false;
        }
        setSuccess(okMessage);
        await Promise.all([loadDetail(selectedId), load()]);
        return true;
      } catch {
        setError("Bağlantı kurulamadı.");
        return false;
      }
    },
    [selectedId, loadDetail, load]
  );

  const counts = data?.counts;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const chips = useMemo(() => {
    const all = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : 0;
    return [
      { value: "" as const, label: "Tümü", count: all },
      // Boş durumlar kalabalık etmesin: yalnız kaydı olanlar (ve seçili olan) gösterilir.
      ...ORDER_STATUSES.filter((s) => (counts?.[s] ?? 0) > 0 || s === status).map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s], count: counts?.[s] ?? 0 })),
    ];
  }, [counts, status]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Siparişler</h1>
          <p className="text-sm text-slate-400 mt-1">Proje Uygulama Sahalarına tohum topu bıraktırma siparişleri</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(ALERT_META) as AlertKey[]).map((k) => {
            const n = data?.alerts?.[k] ?? 0;
            if (n === 0 && flag !== k) return null;
            return (
              <button
                key={k}
                onClick={() => { setFlag(flag === k ? "" : k); setPage(1); }}
                className={`rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm transition-all ${
                  flag === k ? "bg-amber-500/15 ring-1 ring-amber-500/50 text-amber-200" : "bg-white/[0.04] ring-1 ring-amber-500/30 text-slate-300 hover:bg-white/[0.07]"
                }`}
              >
                <span>{ALERT_META[k].icon}</span>
                <span className="text-white font-bold">{n}</span>
                <span className="text-xs">{ALERT_META[k].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {success && <div className="bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">✅ {success}</div>}
      {error && <div className="bg-red-500/10 ring-1 ring-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">❌ {error}</div>}

      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {chips.map((c) => (
            <button
              key={c.value || "all"}
              onClick={() => { setStatus(c.value); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                status === c.value ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06]"
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
              placeholder="Sipariş no, ad, e-posta, telefon veya sertifikadaki ad ara…"
              className="w-full min-h-[44px] px-4 py-2.5 text-sm text-white bg-white/[0.03] border border-white/[0.08] rounded-xl placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>
          <Select value={test} onChange={(e) => { setTest(e.target.value as typeof test); setPage(1); }}>
            <option value="all">Gerçek + deneme siparişleri</option>
            <option value="hide">Yalnız gerçek siparişler</option>
            <option value="only">Yalnız deneme siparişleri</option>
          </Select>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl block mb-3">📭</span>
          <p className="text-slate-400">Bu filtrede sipariş bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`w-full text-left bg-[var(--bg-surface)] border rounded-2xl p-5 transition-all hover:bg-white/[0.03] ${
                selectedId === r.id ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : "border-white/[0.06] hover:border-white/[0.1]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <span className="font-mono text-sm font-bold text-emerald-300">{r.order_no}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>{ORDER_STATUS_LABELS[r.status]}</span>
                    {r.is_test && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-amber-500/50 bg-amber-500/10 text-amber-300">DENEME</span>}
                  </div>
                  <p className="font-semibold text-white truncate">
                    {r.buyer_first_name} {r.buyer_last_name}
                    {r.company_title ? <span className="text-slate-400 font-normal"> · {r.company_title}</span> : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                    <span>{r.site_name ?? "—"}</span>
                    <span>{formatCount(r.quantity, "tr")} tohum topu</span>
                    <span className="text-slate-300">{formatTry(r.total_kurus, "tr")}</span>
                    <span>{r.buyer_email}</span>
                    <span>{r.buyer_type === "corporate" ? "Kurumsal" : "Bireysel"}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 text-xs text-slate-500">{dt(r.created_at)}</div>
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

      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedId(null)}>
          <div
            className="glass border border-white/[0.08] rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="siparis-detay-baslik"
          >
            {!detail || detailLoading && detail.order.id !== selectedId ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : (
              <ReleaseOrderDetail detail={detail} act={act} onClose={() => setSelectedId(null)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
