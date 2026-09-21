/** Çift tahsilat tespiti — saf (olay listesinden hesaplanır; yönetim listesi, ayrıntı ve testler kullanır). */

export interface DuplicateCharge {
  paymentId: string;
  paidKurus: number;
  provider: string;
  refunded: boolean;
}

/** Olaylardan çift tahsilatları çıkarır (`payment_succeeded {duplicate:true}` − iade edilenler). */
export function duplicateChargesFrom(events: { type: string; data: Record<string, unknown> | null }[]): DuplicateCharge[] {
  const refunded = new Set(
    events.filter((e) => e.type === "refund_succeeded" && e.data?.duplicate === true).map((e) => String(e.data?.paymentId ?? ""))
  );
  return events
    .filter((e) => e.type === "payment_succeeded" && e.data?.duplicate === true && e.data?.paymentId)
    .map((e) => ({
      paymentId: String(e.data!.paymentId),
      paidKurus: Number(e.data!.paidKurus ?? 0),
      provider: String(e.data!.provider ?? ""),
      refunded: refunded.has(String(e.data!.paymentId)),
    }));
}
