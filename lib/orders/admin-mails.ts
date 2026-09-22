/**
 * Yönetim işlemlerinin müşteri bildirimleri — yanıtı bekletmeden (`after()`) çağrılır.
 * Gönderim sonucu siparişin denetim izine yazılır; hata işlemi geri almaz.
 */
import { sendRefundCompleted, sendSellerCancellationNotice } from "@/lib/mail";
import { formatTry } from "@/lib/pricing";
import { recordEmailResults } from "./after-payment";
import { formatLongDay } from "./dates";
import { trToday } from "./schedule";
import { db } from "./store";
import type { ReleaseOrderRow } from "./types";
import { refundDueDay } from "./withdrawal-dates";

function noticeInput(order: ReleaseOrderRow, day: string) {
  const mailLocale = order.locale === "tr" ? "tr" : "en";
  return {
    orderId: order.id,
    orderNo: order.order_no,
    locale: order.locale,
    email: order.buyer_email,
    firstName: order.buyer_first_name,
    totalText: formatTry(order.total_kurus, order.locale),
    dateText: formatLongDay(day, mailLocale),
    isTest: order.is_test,
  };
}

/** Satıcı kaynaklı iptal: iade, bildirimden itibaren en geç 14 gün içinde yapılır. */
export async function sendSellerCancellationEmail(order: ReleaseOrderRow): Promise<void> {
  const due = refundDueDay(new Date(order.cancelled_at ?? Date.now()));
  const results = await Promise.allSettled([sendSellerCancellationNotice(noticeInput(order, due))]);
  await recordEmailResults(db(), order.id, results, [{ template: "release_seller_cancel" }]);
}

export async function sendRefundCompletedEmail(order: ReleaseOrderRow): Promise<void> {
  const day = trToday(new Date(order.refunded_at ?? Date.now()));
  const results = await Promise.allSettled([sendRefundCompleted(noticeInput(order, day))]);
  await recordEmailResults(db(), order.id, results, [{ template: "release_refund_done" }]);
}
