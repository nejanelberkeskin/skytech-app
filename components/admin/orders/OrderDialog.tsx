"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import VerifyNotice from "./VerifyNotice";
import { useAdmin } from "@/lib/admin-context";
import { containDialogTab } from "@/lib/hooks/dialog-keyboard";
import type { OrderDetailDto } from "@/lib/orders/admin-dto";
import type { ApiWarning } from "@/lib/api/envelope";
import { Button } from "@/components/ui";
import ReleaseOrderDetail from "../ReleaseOrderDetail";
import { AdminApiError, adminRequest, errorText } from "../operations/client";
import { hasFullPermission } from "../access/policy";
import { ORDERS_SCOPE, canAct, orderAccessKey, validActionResult } from "./view";
import { isAccessDenial } from "../access/AccessDenialNotice";

export default function OrderDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { me, refresh, reportDenial } = useAdmin();
  const dialog = useRef<HTMLDialogElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const alive = useRef(false);
  const generation = useRef({ value: 0 });
  const mutationLock = useRef(false);
  const [detail, setDetail] = useState<OrderDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const [version, setVersion] = useState(0);
  const onBusyChange = (value: boolean) => { mutationLock.current = value; setBusy(value); };
  const load = useCallback(async (keepFeedback = false) => {
    const current = ++generation.current.value;
    setLoading(true); setDetail(null); setBlocked(true);
    if (!keepFeedback) setProblem(null);
    try {
      const response = await adminRequest<OrderDetailDto>(`/api/admin/release-orders/${encodeURIComponent(id)}`);
      if (!alive.current || current !== generation.current.value) return;
      if (response.data?.order?.id !== id || !response.data.capabilities || !Array.isArray(response.data.groups) || !Array.isArray(response.data.events) || !Array.isArray(response.data.mfaRequiredGroups)) throw new Error("Sipariş ayrıntısı okunamadı.");
      setDetail(response.data); setBlocked(false); setVersion(n => n + 1);
    } catch (e) {
      if (!alive.current || current !== generation.current.value) return;
      const code = e instanceof AdminApiError ? e.code : "unavailable";
      setProblem({ code, message: errorText(e) }); setDetail(null);
      if (e instanceof AdminApiError && [401, 403].includes(e.status)) {
        if (isAccessDenial(e)) reportDenial({ scope: ORDERS_SCOPE, message: errorText(e), keyOf: orderAccessKey });
        void refresh();
      }
    } finally {
      if (alive.current && current === generation.current.value) setLoading(false);
    }
  }, [id, refresh, reportDenial]);
  useEffect(() => {
    const token = generation.current;
    alive.current = true;
    const el = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el?.showModal();
    void load();
    return () => { alive.current = false; token.value++; el?.close(); if (previous?.isConnected) previous.focus(); };
  }, [load]);
  const act = async (body: Record<string, unknown>, message: string) => {
    if (mutationLock.current || loading || blocked || !detail || !canAct(detail, body.action)) return false;
    mutationLock.current = true; setBusy(true); setProblem(null); setSuccess(null);
    try {
      const response = await adminRequest<{ status: string }>(`/api/admin/release-orders/${encodeURIComponent(id)}`, body);
      if (!alive.current) return false;
      if (!validActionResult(response.data)) throw new AdminApiError("unknown_result", "İşlem sonucu doğrulanamadı. Tekrar göndermeden önce ayrıntıyı yenileyip kayıtları kontrol edin.");
      setSuccess(message); setWarnings(previous => [...previous, ...response.warnings.filter(w => !previous.some(p => p.code === w.code && p.message === w.message))]);
      onChanged(); await load(true);
      return true;
    } catch (e) {
      if (!alive.current) return false;
      const code = e instanceof AdminApiError ? e.code : "network";
      const extra = e instanceof AdminApiError && typeof e.details?.detail === "string" ? ` ${e.details.detail}` : "";
      setProblem({ code, message: errorText(e) + extra });
      // No automatic replay, including malformed 2xx and lost mutation responses.
      setBlocked(code !== "invalid_body");
      if (code === "mfa_required") { setDetail(null); }
      else if (e instanceof AdminApiError && [401, 403, 404].includes(e.status)) {
        if (isAccessDenial(e)) reportDenial({ scope: ORDERS_SCOPE, message: errorText(e) + extra, keyOf: orderAccessKey });
        setDetail(null); void refresh();
      }
      return false;
    } finally {
      mutationLock.current = false;
      if (alive.current) { setBusy(false); feedback.current?.focus(); }
    }
  };
  return <dialog ref={dialog} aria-labelledby="siparis-detay-baslik" aria-busy={loading || busy} onKeyDown={containDialogTab} onCancel={e => { if (mutationLock.current) e.preventDefault(); else onClose(); }} className="m-auto w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-[#0b1410] text-white border border-white/15 p-0 backdrop:bg-black/70">
    <header className="sticky top-0 z-10 bg-[#0b1410] border-b border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
      <h2 id="siparis-detay-baslik" className="font-semibold break-all">{detail?.order.orderNo ?? "Sipariş ayrıntısı"}</h2>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy || loading} onClick={() => void load()}>Ayrıntıyı yenile</Button><Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>Kapat</Button></div>
    </header>
    <div className="p-4 sm:p-6 space-y-5">
      <div ref={feedback} tabIndex={-1} className="space-y-3 outline-none">
        {problem && <p role="alert" className="rounded-xl border border-red-400/40 p-4 text-sm text-red-200 break-words">{problem.message}</p>}
        {blocked && detail && <p className="text-sm text-amber-100">İşlem düğmeleri kapalı. Tekrar işlem yapmadan önce ayrıntıyı yenileyip güncel kayıtları kontrol edin.</p>}
        {success && <p role="status" className="rounded-xl border border-emerald-400/40 p-4 text-sm text-emerald-200">{success}</p>}
        {warnings.map((w, i) => <p role="alert" key={`${w.code}:${i}`} className="rounded-xl border border-amber-400/40 p-4 text-sm text-amber-100">{w.message} İşlem yeniden gönderilmedi.</p>)}
        {problem?.code === "mfa_required" && <VerifyNotice />}
      </div>
      {loading && <p role="status" className="text-slate-300">Sipariş ayrıntısı yükleniyor…</p>}
      {detail && <ReleaseOrderDetail key={version} detail={detail} act={act} disabled={blocked || busy || loading} canUseRefundPanel={hasFullPermission(me, "finance.read")} onRefundBusy={onBusyChange} onRefundChanged={() => { onChanged(); void load(true); }} />}
    </div>
  </dialog>;
}
