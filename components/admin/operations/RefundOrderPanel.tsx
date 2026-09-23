"use client";
import { useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import type { ApiWarning } from "@/lib/api/envelope";
import type { RefundAction, RefundActionResult, RefundOperationView, RefundOrderView } from "@/lib/refunds/model";
import { formatTry } from "@/lib/pricing";
import { ORDER_STATUS_LABELS } from "@/lib/orders/labels";
import { AdminApiError, adminRequest, errorText, istanbulDate } from "./client";
import { RefundDeadline, RefundStatus, REFUND_ACTIONS } from "./RefundStatus";
import { EMPTY_RESOLUTION, refundRequest, resolutionErrors, type ResolutionDraft } from "./refund-form";

const SOURCE_LABELS = { provider_panel: "Sağlayıcı paneli", provider_query: "Sağlayıcı sorgusu (elle doğrulandı)", bank_statement: "Banka ekstresi" };
const RESULT_LABELS: Record<RefundActionResult["outcome"], string> = {
  completed: "İade tamamlandı.", noop: "Bu iade zaten tamamlanmış; yeni para işlemi yapılmadı.",
  provider_succeeded: "Sağlayıcı iadeyi onayladı; yerel kaydın tamamlanması gerekiyor.",
  failed: "İade yapılmadı. Yeniden denemeden önce aşağıdaki sonucu inceleyin.",
  needs_review: "İadenin sonucu belirsiz; mutabakat gerekiyor.",
};
const keyOf = (operation: RefundOperationView) => `${operation.kind}:${operation.paymentId}`;
type Selection = { key: string; action: RefundAction; attempt: number };

export default function RefundOrderPanel({ orderId, onChanged, onBusyChange }: { orderId: string; onChanged?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const router = useRouter();
  const [view, setView] = useState<RefundOrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [stale, setStale] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ResolutionDraft>>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const [blockedUntil, setBlockedUntil] = useState<Record<string, string>>({});
  const latest = useRef({ value: 0 });
  const feedback = useRef<HTMLDivElement>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const refresh = useCallback(async (keepError = false) => {
    const generation = ++latest.current.value;
    try {
      const response = await adminRequest<RefundOrderView>(`/api/admin/refunds/orders/${encodeURIComponent(orderId)}`);
      if (generation !== latest.current.value) return;
      setView(response.data); setBlockedUntil(prev => Object.fromEntries(Object.entries(prev).filter(([, until]) => Date.parse(until) > Date.now()))); setStale(false); setDenied(false); setLoading(false);
      if (!keepError) setError(null);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) router.replace("/admin/giris");
      if (generation !== latest.current.value) return;
      setError(errorText(e)); setStale(true); setLoading(false);
      if (e instanceof AdminApiError && [401, 403, 404].includes(e.status)) { setView(null); setDenied(true); }
    }
  }, [orderId, router]);
  useEffect(() => { const token = latest.current; void refresh(); return () => { token.value++; }; }, [refresh]);
  useEffect(() => { if (selection) formHeading.current?.focus(); }, [selection]);

  const cancel = () => {
    const old = selection;
    setSelection(null); setFields({});
    if (old) actionButtons.current[`${old.key}:${old.action}`]?.focus();
  };
  const submit = async () => {
    if (lock.current || !view || !selection || stale || denied) return;
    const operation = view.operations.find(op => keyOf(op) === selection.key);
    if (!operation || operation.attempt !== selection.attempt || !operation.allowedActions.includes(selection.action)) { setSelection(null); setError("İşlem durumu değişti. Görünümü yenileyin."); return; }
    const draft = drafts[selection.key] ?? EMPTY_RESOLUTION;
    const errors = resolutionErrors(selection.action, draft);
    setFields(errors);
    if (Object.keys(errors).length) { setError("İşaretli alanları düzeltin."); return; }
    lock.current = true; setBusy(true); onBusyChange?.(true); setError(null); setResult(null);
    try {
      const request = refundRequest(orderId, operation, selection.action, draft);
      const response = await adminRequest<{ view: RefundOrderView | null; result: RefundActionResult }>(request.url, request.body);
      setWarnings(prev => [...prev, ...response.warnings.filter(w => !prev.some(p => p.code === w.code && p.message === w.message))]);
      setResult(RESULT_LABELS[response.data.result.outcome]);
      setSelection(null);
      if (response.data.view) { setView(response.data.view); setStale(false); }
      else { setStale(true); setError("İşlem yanıtı alındı; güncel görünüm alınamadı. Aynı işlemi yeniden göndermeden görünümü yenileyin."); }
      onChanged?.();
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) router.replace("/admin/giris");
      const code = e instanceof AdminApiError ? e.code : "network";
      setError(code === "attempt_changed" ? "Başka biri bu işlemde değişiklik yaptı. Güncel durum yüklendi; notunuz korundu. İşlemi yeniden seçip kontrol edin." : errorText(e));
      if (e instanceof AdminApiError && e.status === 403) { setDenied(true); setSelection(null); }
      else if (["invalid_refund_id", "note_required", "evidence_required"].includes(code)) {
        setFields({ [code === "invalid_refund_id" ? "refundId" : code === "note_required" ? "note" : "source"]: errorText(e) });
      } else {
        if (code === "too_early" && e instanceof AdminApiError && typeof e.details?.availableAt === "string") setBlockedUntil(prev => ({ ...prev, [selection.key]: e.details!.availableAt as string }));
        setSelection(null); setStale(true);
        if (["attempt_changed", "invalid_state", "in_progress", "already_done", "too_early"].includes(code)) await refresh(true);
      }
    } finally { lock.current = false; setBusy(false); onBusyChange?.(false); feedback.current?.focus(); }
  };

  return <section aria-label="İade ve mutabakat" className="space-y-4 min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">İade ve mutabakat</h2>{view && <p className="mt-1 text-sm text-slate-300 break-all">{view.order.orderNo} · {ORDER_STATUS_LABELS[view.order.status as keyof typeof ORDER_STATUS_LABELS] ?? view.order.status}{view.order.isTest && <strong className="ml-2 text-amber-200">Deneme</strong>}</p>}</div><Button variant="secondary" disabled={busy || loading} onClick={() => { setLoading(true); setSelection(null); void refresh(); }}>Görünümü yenile</Button></div>
    <div ref={feedback} tabIndex={-1} className="space-y-2 outline-none">
      {error && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {result && <p role="status" className="rounded-xl border border-white/15 p-4 text-sm text-white">{result}</p>}
      {warnings.map((w, i) => <p key={`${w.code}:${i}`} role="alert" className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100 break-words">{w.message}</p>)}
    </div>
    {loading && <p role="status" className="text-sm text-slate-300">İade görünümü yükleniyor…</p>}
    {view && <>
      <RefundDeadline due={view.due} />
      {stale && <p className="text-sm text-amber-200">Son görülen kayıt aşağıda. Güncel durum alınana kadar işlem düğmeleri kapalı.</p>}
      {!view.operations.length && <p className="text-sm text-slate-300">Bu sipariş için iade işlemi bulunmuyor.</p>}
      {view.operations.map(operation => {
        const key = keyOf(operation);
        const selected = selection?.key === key ? selection : null;
        const draft = drafts[key] ?? EMPTY_RESOLUTION;
        const resolving = selected?.action === "resolve_succeeded" || selected?.action === "resolve_failed";
        const change = (field: keyof ResolutionDraft, value: string) => { setDrafts(prev => ({ ...prev, [key]: { ...draft, [field]: value } })); setFields(prev => ({ ...prev, [field]: "" })); };
        const until = blockedUntil[key];
        return <article key={key} className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-white">{operation.kind === "duplicate" ? "Çift tahsilat iadesi" : "Sipariş iadesi"}</h3><p className="mt-1 text-xl font-bold text-white">{formatTry(operation.amountKurus, "tr")}</p></div><div><RefundStatus state={operation.state} stale={operation.stale} /></div></div>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-400">Ödeme kimliği</dt><dd className="font-mono break-all text-slate-100">{operation.paymentId}</dd></div><div><dt className="text-slate-400">Sağlayıcı</dt><dd className="text-slate-100">{operation.provider}</dd></div><div><dt className="text-slate-400">Deneme</dt><dd className="text-slate-100">{operation.attempt} · {istanbulDate(operation.attemptStartedAt)}</dd></div>{operation.completedAt && <div><dt className="text-slate-400">Tamamlandı</dt><dd className="text-slate-100">{istanbulDate(operation.completedAt)}</dd></div>}</dl>
          {operation.attention && operation.state !== "completed" && <p role="alert" className="rounded-xl border border-amber-400/50 p-3 text-sm text-amber-100">Bu işlem için geç ya da çelişen bir sağlayıcı sonucu geldi; mutabakat gerekli.</p>}
          {operation.lastResult && <div className="text-sm text-slate-300 break-words"><p>Son sonuç: {({ succeeded: "Sağlayıcı onayladı", rejected: "Kesin ret", unknown: "Belirsiz", not_sent: "Sağlayıcıya gönderilmedi" })[operation.lastResult.outcome]}</p>{operation.lastResult.error && <p>{operation.lastResult.error}</p>}{operation.lastResult.errorCode && <p>Hata kodu: {operation.lastResult.errorCode}</p>}{operation.lastResult.refundId && <p className="break-all">İade kimliği: {operation.lastResult.refundId}</p>}</div>}
          {operation.resolution && <details className="text-sm text-slate-300"><summary className="min-h-11 cursor-pointer">Son mutabakat kararı</summary><p>{operation.resolution.outcome === "failed" ? "İade yapılmadı" : "İade yapıldı"} · {istanbulDate(operation.resolution.at)} · {operation.resolution.by.label}</p><p>{SOURCE_LABELS[operation.resolution.source]} · {operation.resolution.reference}</p><p className="whitespace-pre-wrap break-words">{operation.resolution.note}</p></details>}
          {operation.blockedActions.map(blocked => <p key={blocked.action} className="text-xs text-slate-300">{REFUND_ACTIONS[blocked.action]}: {blocked.reason === "too_early" ? `Henüz kullanılamaz. ${istanbulDate(blocked.availableAt)} sonrasında görünümü yenileyin.` : blocked.reason === "forbidden" ? "Bu işlem için yetkiniz yok." : "Sipariş bu işlem için uygun değil."}</p>)}
          {until && <p className="text-xs text-amber-200">İade yapılmadı kararı için {istanbulDate(until)} sonrasında görünümü yenileyin.</p>}
          {!selected ? <div className="flex flex-wrap gap-2">{!denied && operation.allowedActions.map(action => <Button ref={node => { actionButtons.current[`${key}:${action}`] = node; }} key={action} variant="secondary" disabled={busy || stale || loading || (action === "resolve_failed" && !!until)} onClick={() => { setSelection({ key, action, attempt: operation.attempt }); setFields({}); setError(null); }}>{REFUND_ACTIONS[action]}</Button>)}</div> : <form onSubmit={e => { e.preventDefault(); void submit(); }} className="rounded-xl border border-amber-300/30 p-4 space-y-4">
            <h4 tabIndex={-1} ref={formHeading} className="text-base font-semibold text-white outline-none">{REFUND_ACTIONS[selected.action]}</h4>
            <p className="text-sm text-slate-200 break-words"><strong>{formatTry(operation.amountKurus, "tr")}</strong> · {operation.kind === "duplicate" ? "Çift tahsilat" : "Sipariş"} · Ödeme kimliği: <span className="font-mono break-all">{operation.paymentId}</span></p>
            <p className="text-sm text-slate-300">{selected.action === "finalize" ? "Sağlayıcıya yeni iade gönderilmez. Başarılı iadenin yerel kaydı tamamlanır." : resolving ? "Sağlayıcıdaki kontrolünüzün sonucunu kaydedin. Bu karar denetim geçmişinde saklanır." : "Tutarın tamamı ödemenin alındığı araca iade edilmek üzere sağlayıcıya gönderilecek."}{operation.kind === "order" && selected.action !== "resolve_failed" ? " İade tamamlanınca müşteriye bildirim e-postası gönderilebilir." : ""}</p>
            {resolving && <>
              {selected.action === "resolve_succeeded" && <Input label="Sağlayıcıdaki iade kimliği" value={draft.refundId} maxLength={100} onChange={e => change("refundId", e.target.value)} error={fields.refundId} disabled={busy} />}
              <Select label="Kanıt kaynağı" value={draft.source} onChange={e => change("source", e.target.value)} error={fields.source} disabled={busy}><option value="">Kaynak seçin</option>{Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
              <Input label="Kanıt referansı (isteğe bağlı)" value={draft.reference} maxLength={200} onChange={e => change("reference", e.target.value)} disabled={busy} helperText="İşlem numarası veya ekstre satırı. Kart ya da kişisel bilgi yazmayın." />
              <Textarea label="Kontrol sonucu ve gerekçe" value={draft.note} maxLength={1000} onChange={e => change("note", e.target.value)} error={fields.note} disabled={busy} helperText="10–1000 karakter. Nereden, ne zaman, hangi sonucu doğruladığınızı yazın." />
            </>}
            <div className="flex flex-wrap gap-2"><Button type="submit" loading={busy} disabled={stale || denied || loading}>{resolving ? "Onayla ve kararı kaydet" : selected.action === "finalize" ? "Onayla ve kaydı tamamla" : "Onayla ve iadeyi gönder"}</Button><Button type="button" variant="ghost" disabled={busy} onClick={cancel}>Vazgeç</Button></div>
          </form>}
        </article>;
      })}
      <div className="border-t border-white/10 pt-4"><h3 className="font-semibold text-white">Deneme ve mutabakat geçmişi</h3>{view.history.length ? <ol className="mt-3 space-y-3">{view.history.map((entry, i) => <li key={`${entry.at}:${i}`} className="border-l-2 border-white/15 pl-4 text-sm"><p className="text-slate-200 break-words">{entry.summary}</p><p className="mt-1 text-xs text-slate-400">{istanbulDate(entry.at)} · {entry.actor.label ?? (entry.actor.kind === "system" ? "Sistem" : entry.actor.kind === "customer" ? "Müşteri" : "Yönetici")}{entry.attempt ? ` · Deneme ${entry.attempt}` : ""}</p></li>)}</ol> : <p className="mt-2 text-sm text-slate-400">Henüz iade geçmişi yok.</p>}</div>
    </>}
  </section>;
}
