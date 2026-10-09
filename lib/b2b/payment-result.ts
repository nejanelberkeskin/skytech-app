import { priceToKurus } from "@/lib/payments/iyzico";

/** Only reconciliation fields; never persist the SDK response, token or card details. */
export function b2bPaymentResult(result: Record<string, unknown>) {
  const text = (value: unknown) => typeof value === "string" && value.length <= 200 ? value : null;
  const fraud = result.fraudStatus;
  return {
    status: text(result.status),
    payment_status: text(result.paymentStatus),
    payment_id: text(result.paymentId),
    basket_id: text(result.basketId),
    conversation_id: text(result.conversationId),
    currency: text(result.currency),
    price_kurus: priceToKurus(result.price),
    paid_kurus: priceToKurus(result.paidPrice),
    fraud_status: [1, 0, -1, "1", "0", "-1"].includes(fraud as number | string) ? Number(fraud) : null,
  };
}
