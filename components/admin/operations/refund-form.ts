import { REFUND_ID_PATTERN, EVIDENCE_SOURCES, type EvidenceSource, type RefundAction, type RefundOperationView } from "@/lib/refunds/model";
export type ResolutionDraft = { refundId: string; source: EvidenceSource | ""; reference: string; note: string };
export const EMPTY_RESOLUTION: ResolutionDraft = { refundId: "", source: "", reference: "", note: "" };
export function resolutionErrors(action: RefundAction, draft: ResolutionDraft): Record<string, string> {
  if (action !== "resolve_succeeded" && action !== "resolve_failed") return {};
  const errors: Record<string, string> = {};
  if (action === "resolve_succeeded" && !REFUND_ID_PATTERN.test(draft.refundId.trim())) errors.refundId = "1–100 karakterlik iade kimliğini girin. Harf, sayı, nokta, alt çizgi, iki nokta ve tire kullanılabilir.";
  if (!EVIDENCE_SOURCES.includes(draft.source as EvidenceSource)) errors.source = "Kontrol ettiğiniz kanıt kaynağını seçin.";
  if (draft.note.trim().length < 10 || draft.note.trim().length > 1000) errors.note = "Kontrol sonucunu 10–1000 karakterle açıklayın.";
  return errors;
}
export function refundRequest(orderId: string, operation: RefundOperationView, action: RefundAction, draft: ResolutionDraft) {
  if (!operation.allowedActions.includes(action)) throw new Error("Bu işlem artık kullanılamıyor; görünümü yenileyin.");
  if (Object.keys(resolutionErrors(action, draft)).length) throw new Error("İşaretli alanları düzeltin.");
  if (action === "execute") return { url: `/api/admin/refunds/orders/${encodeURIComponent(orderId)}/execute`, body: operation.kind === "duplicate" ? { kind: "duplicate", paymentId: operation.paymentId } : { kind: "order" } };
  if (!operation.id) throw new Error("İade kaydı bulunamadı; görünümü yenileyin.");
  const root = `/api/admin/refunds/operations/${encodeURIComponent(operation.id)}`;
  if (action === "finalize") return { url: `${root}/finalize`, body: {} };
  if (action === "retry") return { url: `${root}/retry`, body: { expectedAttempt: operation.attempt } };
  return { url: `${root}/resolve`, body: { expectedAttempt: operation.attempt,
    outcome: action === "resolve_succeeded" ? "provider_succeeded" : "failed",
    ...(action === "resolve_succeeded" ? { refundId: draft.refundId.trim() } : {}),
    evidence: { source: draft.source, ...(draft.reference.trim() ? { reference: draft.reference.trim() } : {}) }, note: draft.note.trim() } };
}
