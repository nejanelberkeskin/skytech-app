import type { RefundAction, RefundDue, RefundState } from "@/lib/refunds/model";

export const REFUND_STATES: Record<RefundState, string> = {
  none: "İade başlamadı", started: "Sağlayıcı yanıtı bekleniyor", needs_review: "Mutabakat gerekli",
  failed: "İade yapılmadı", provider_succeeded: "Yerel kayıt tamamlanmalı", completed: "İade tamamlandı",
};
export const REFUND_ACTIONS: Record<RefundAction, string> = {
  execute: "İadeyi başlat", retry: "İadeyi yeniden dene", resolve_succeeded: "İade yapıldığını kaydet",
  resolve_failed: "İade yapılmadığını kaydet", finalize: "Yerel kaydı tamamla",
};
export function RefundStatus({ state, stale }: { state: RefundState; stale?: boolean }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${state === "completed" ? "border-emerald-500/40 text-emerald-200" : state === "none" ? "border-white/20 text-slate-200" : "border-amber-400/40 text-amber-200"}`}>{stale ? "Yanıt gecikti · mutabakat gerekli" : REFUND_STATES[state]}</span>;
}
export function RefundDeadline({ due }: { due: RefundDue | null }) {
  if (!due) return null;
  return <div className={`rounded-xl border p-3 text-sm ${due.overdue ? "border-red-400/50 bg-red-500/10 text-red-200" : "border-amber-300/20 bg-amber-400/5 text-amber-100"}`}>
    <p className="font-semibold">İade son tarihi: <time dateTime={due.dueAt}>{new Date(due.dueAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" })}</time></p>
    <p className="mt-1 text-xs">{due.basis === "withdrawal_notice" ? "Cayma bildirimi" : "Satıcı iptali"} esas alınır · Türkiye saati{due.overdue ? " · Süresi geçti" : ""}. İç onay ve mutabakat bu tarihi değiştirmez.</p>
  </div>;
}
