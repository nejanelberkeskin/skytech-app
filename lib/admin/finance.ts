/** All arithmetic stays in kuruş; TRY conversion happens only at the UI boundary. */
export interface FinanceOrder {
  id: string; order_no: string; buyer_email: string; quantity: number; total_kurus: number;
  status: string; paid_at: string | null; created_at: string; is_test: boolean;
}
export interface FinanceRefund { order_id: string; amount_kurus: number; completed_at: string; }
export interface B2bPayment {
  id: string; amount: number | string; status: string; updated_at: string; created_at: string;
  orders: { buyer_email: string; total_seeds: number } | null;
}
const istanbulMonth = (date: string | Date) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(date));
export function financeSummary(orders: FinanceOrder[], refunds: FinanceRefund[], b2b: B2bPayment[], now = new Date()) {
  const month = istanbulMonth(now);
  const real = orders.filter((o) => !o.is_test);
  const ids = new Set(real.map((o) => o.id));
  const monthlyGrossKurus = real.filter((o) => o.paid_at && istanbulMonth(o.paid_at) === month).reduce((s,o) => s + Number(o.total_kurus), 0);
  const monthlyRefundKurus = refunds.filter((r) => ids.has(r.order_id) && r.completed_at && istanbulMonth(r.completed_at) === month).reduce((s,r) => s + Number(r.amount_kurus), 0);
  const pendingRefundKurus = real.filter((o) => ["withdrawal_requested","cancelled_by_seller"].includes(o.status)).reduce((s,o) => s + Number(o.total_kurus), 0);
  const pendingKurus = real.filter((o) => ["draft","awaiting_payment","payment_failed"].includes(o.status)).reduce((s,o) => s + Number(o.total_kurus), 0);
  const b2bMonthlyKurus = b2b.filter((p) => p.status === "success" && istanbulMonth(p.updated_at) === month).reduce((s,p) => s + Math.round(Number(p.amount)*100), 0);
  const recentTransactions = [
    ...real.map((o) => ({ id:o.order_no, date:o.paid_at ?? o.created_at, customer:o.buyer_email, seeds:o.quantity, amount:Number(o.total_kurus)/100, type:"Bırakma hizmeti", status:o.status === "refunded" ? "refunded" : o.paid_at ? "success" : o.status === "expired" ? "expired" : "pending" })),
    ...b2b.map((p) => ({ id:p.id, date:p.updated_at ?? p.created_at, customer:p.orders?.buyer_email ?? "—", seeds:p.orders?.total_seeds ?? 0, amount:Number(p.amount), type:"B2B — ayrı kaynak", status:p.status })),
  ].sort((a,b) => b.date.localeCompare(a.date)).slice(0,20);
  return { monthlyRevenue:(monthlyGrossKurus-monthlyRefundKurus)/100, monthlyGross:monthlyGrossKurus/100, monthlyRefunds:monthlyRefundKurus/100, pendingRefundAmount:pendingRefundKurus/100, pendingAmount:pendingKurus/100, b2bMonthlyRevenue:b2bMonthlyKurus/100, recentTransactions };
}
