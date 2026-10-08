import type { SupabaseClient } from "@supabase/supabase-js";
import { iyzicoConfig } from "@/lib/payments/iyzico-config";
import { callIyzico } from "@/lib/payments/iyzico";
import { b2bPaymentResult } from "./payment-result";

/** Two bounded (15-second) read-only provider queries; no checkout, charge, refund or email. */
export async function reconcileB2bPayments(db: SupabaseClient) {
  const config = iyzicoConfig();
  if (!config) throw new Error("b2b_provider_not_configured");
  const { data: candidates, error } = await db.rpc("claim_b2b_reconciliation", { p_is_test: config.isTest });
  if (error) throw new Error("b2b_reconciliation_unavailable");
  const report = { checked: 0, paid: 0, review: 0, unavailable: 0 };
  for (const candidate of (candidates ?? []).slice(0, 2)) {
    const result = await callIyzico("checkoutForm", "retrieve", { locale: "tr", token: candidate.token });
    let outcome: string;
    if (["timeout", "network", "config"].includes(String(result.errorCode))) {
      outcome = "provider_unavailable";
    } else {
      const { data, error: recordError } = await db.rpc("record_b2b_payment_result", {
        p_payment: candidate.payment_id, p_is_test: config.isTest, p_result: b2bPaymentResult(result),
      });
      outcome = recordError ? "record_unavailable" : data?.status;
      if (!["paid", "already_paid", "closed", "review", "rejected", "record_unavailable"].includes(outcome)) outcome = "record_unavailable";
    }
    const { data: finished, error: finishError } = await db.rpc("finish_b2b_reconciliation", {
      p_payment: candidate.payment_id, p_attempt: candidate.attempt, p_outcome: outcome,
    });
    if (finishError || !finished) throw new Error("b2b_reconciliation_record_failed");
    report.checked++;
    if (outcome === "paid" || outcome === "already_paid") report.paid++;
    else if (outcome === "provider_unavailable" || outcome === "record_unavailable") report.unavailable++;
    else if (outcome !== "closed") report.review++;
  }
  if (report.unavailable) throw new Error("b2b_reconciliation_incomplete");
  const { data: summary, error: summaryError } = await db.rpc("b2b_reconciliation_summary");
  if (summaryError || !summary) throw new Error("b2b_reconciliation_summary_unavailable");
  return { ...report, needsReview: Number(summary.needsReview), unlinked: Number(summary.unlinked) };
}
