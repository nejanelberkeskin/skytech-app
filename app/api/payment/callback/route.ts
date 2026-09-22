/**
 * POST /api/payment/callback — B2B (kurumsal teklif) ödemesinin iyzico dönüşü.
 *
 * iyzico, Ödeme Formu tamamlanınca bu adrese form-urlencoded `token` gönderir. Eski bireysel
 * tohum satışı da bu ucu kullanıyordu; o akış Faz 8'de kaldırıldı. Yeni satış modelinin dönüşü
 * ayrı uçtadır (`/api/payment/donus`).
 *
 * Kapı: B2B sayfaları gibi TRANSACTIONS_ENABLED kapalıyken middleware 503 döner
 * (lib/site-config.ts → B2B_API_PATTERNS). CSRF denetiminden muaftır (çağıran iyzico).
 *
 * Akış:
 *   1. token → payments.metadata.iyzico_token ile ödeme kaydı bulunur
 *      (iyzico'nun conversationId alanına güvenilmez; bazen boş döner).
 *   2. Sonuç iyzico'dan SUNUCU tarafında sorgulanır; ödeme kaydı güncellenir.
 *   3. Başarılıysa sipariş "paid/confirmed", kurumsal teklif "PAID" olur.
 *   4. Müşteri /kurumsal/panel/odeme?status=… sayfasına döner. Ödeme bir kayda bağlanamazsa
 *      genel ödeme hatası sayfasına (/odeme/hata) gider.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import iyzipay from "@/lib/iyzico";

// Bu route'un build sırasında değil, isteğe gelince çalışmasını garantile.
export const dynamic = "force-dynamic";

const B2B_RESULT_PATH = "/kurumsal/panel/odeme";
/** Ödeme bir kayda bağlanamadığında: sipariş bilgisi içermeyen genel sayfa. */
const UNLINKED_ERROR_PATH = "/odeme/hata";

export async function POST(request: NextRequest) {
  // Service-role client'ı isteğe gelince oluştur — build sırasında env yokken çökmesin.
  const supabase = createServiceRoleClient();
  const unlinked = () => NextResponse.redirect(new URL(UNLINKED_ERROR_PATH, request.url));

  try {
    /* ── 1. Token ─────────────────────────────────────────────────────── */
    const formData = await request.formData();
    const token = formData.get("token") as string | null;
    if (!token) {
      console.error("[callback] iyzico token eksik");
      return unlinked();
    }

    /* ── 2. Token ile ödeme kaydı ─────────────────────────────────────── */
    const { data: paymentRecord, error: dbLookupErr } = await supabase
      .from("payments")
      .select("id, order_id, status, metadata")
      .eq("metadata->>iyzico_token", token)
      .single();

    if (dbLookupErr || !paymentRecord) {
      console.error("[callback] Token ile ödeme kaydı bulunamadı:", dbLookupErr?.message ?? "kayıt yok");
      return unlinked();
    }

    const paymentId = paymentRecord.id as string;
    const orderId = (paymentRecord.order_id as string | null) ?? null;
    const existingMeta: Record<string, unknown> = (paymentRecord.metadata as Record<string, unknown>) ?? {};
    if (existingMeta.checkout_type !== "b2b") {
      // Eski bireysel akışın kaydı: o akış kapalı, yeni işlem yapılmaz.
      console.error("[callback] B2B olmayan ödeme kaydı (eski akış):", paymentId);
      return unlinked();
    }

    // Idempotency: aynı token ikinci kez gelirse (iyzico yeniden denemesi) yeniden işleme.
    if (paymentRecord.status === "success") {
      const params = new URLSearchParams({ status: "success" });
      if (orderId) params.set("order_id", orderId);
      return NextResponse.redirect(new URL(`${B2B_RESULT_PATH}?${params.toString()}`, request.url));
    }

    /* ── 3. Sonucu iyzico'dan sorgula ─────────────────────────────────── */
    return await new Promise<NextResponse>((resolve) => {
      iyzipay.checkoutForm.retrieve(
        { locale: "tr", token },
        async (err: unknown, result: Record<string, unknown>) => {
          if (err) {
            console.error("[callback] iyzico sorgu hatası:", err);
            resolve(unlinked());
            return;
          }

          const isSuccess = result.status === "success" && result.paymentStatus === "SUCCESS";

          /* ── 4. Ödeme kaydı (metadata birleştirilir, ezilmez) ─────────── */
          const { error: updateErr } = await supabase
            .from("payments")
            .update({
              status: isSuccess ? "success" : "failed",
              iyzico_payment_id: (result.paymentId as string) || null,
              payment_method: "credit_card",
              metadata: {
                ...existingMeta,
                cardType: result.cardType,
                lastFourDigits: result.lastFourDigits,
                installment: result.installment,
                iyziCommissionFee: result.iyziCommissionFee,
                fraudStatus: result.fraudStatus,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", paymentId);
          if (updateErr) console.error("[callback] payments güncellenemedi:", updateErr.message);

          /* ── 5. Başarılı: sipariş ve kurumsal teklif ─────────────────── */
          if (isSuccess && orderId) {
            const { error: orderUpdateErr } = await supabase
              .from("orders")
              .update({ payment_status: "paid", status: "confirmed", updated_at: new Date().toISOString() })
              .eq("id", orderId);
            if (orderUpdateErr) console.error("[callback] orders güncellenemedi:", orderUpdateErr.message);
          }
          if (isSuccess) {
            const quoteId = existingMeta.quote_id as string | undefined;
            if (quoteId) {
              const { error: quoteErr } = await supabase
                .from("corporate_quotes")
                .update({ status: "PAID", paid_at: new Date().toISOString(), payment_id: paymentId })
                .eq("id", quoteId);
              if (quoteErr) console.error("[callback] kurumsal teklif PAID yapılamadı:", quoteErr.message);
            }
          }
          if (isSuccess && !orderId) {
            console.error("[callback] Başarılı ödeme ama sipariş kimliği yok — paymentId:", paymentId);
          }

          /* ── 6. Sonuç sayfası ─────────────────────────────────────────── */
          const params = new URLSearchParams();
          if (isSuccess) {
            params.set("status", "success");
            if (orderId) params.set("order_id", orderId);
          } else {
            params.set("status", "error");
            params.set("message", String(result.errorMessage || "Odeme basarisiz"));
          }
          resolve(NextResponse.redirect(new URL(`${B2B_RESULT_PATH}?${params.toString()}`, request.url)));
        },
      );
    });
  } catch (error) {
    console.error("[callback] Beklenmeyen hata:", error);
    return unlinked();
  }
}
