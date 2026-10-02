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
import { iyzicoConfig } from "@/lib/payments/iyzico-config";
import { b2bPaymentResult } from "@/lib/b2b/payment-result";
import { callIyzico } from "@/lib/payments/iyzico";

// Bu route'un build sırasında değil, isteğe gelince çalışmasını garantile.
export const dynamic = "force-dynamic";

const B2B_RESULT_PATH = "/kurumsal/panel/odeme";
/** Ödeme bir kayda bağlanamadığında: sipariş bilgisi içermeyen genel sayfa. */
const UNLINKED_ERROR_PATH = "/odeme/hata";

export async function POST(request: NextRequest) {
  // Service-role client'ı isteğe gelince oluştur — build sırasında env yokken çökmesin.
  const supabase = createServiceRoleClient();
  const hint = new URL(request.url).searchParams.get("locale");
  let locale = hint === "en" || hint === "ru" ? hint : "tr";
  const redirect = (path: string) => NextResponse.redirect(new URL(`${locale === "tr" ? "" : `/${locale}`}${path}`, request.url), { status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  const unlinked = () => redirect(UNLINKED_ERROR_PATH);

  try {
    /* ── 1. Token ─────────────────────────────────────────────────────── */
    const formData = await request.formData();
    const rawToken = formData.get("token");
    const token = typeof rawToken === "string" ? rawToken.trim() : "";
    if (!/^[A-Za-z0-9._~-]{8,200}$/.test(token)) {
      console.error("[callback] iyzico token eksik");
      return unlinked();
    }

    /* ── 2. Token ile ödeme kaydı ─────────────────────────────────────── */
    const { data: paymentRecord, error: dbLookupErr } = await supabase
      .from("payments")
      .select("id, order_id, status, provider, metadata")
      .eq("metadata->>iyzico_token", token)
      .single();

    if (dbLookupErr || !paymentRecord) {
      console.error("[callback] Ödeme kaydı bulunamadı");
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

    // Kayıtlı dil, callback sorgusundan önceliklidir. Yalnız üç sabit dil kabul edilir.
    if (existingMeta.ui_locale !== undefined) {
      locale = existingMeta.ui_locale === "en" || existingMeta.ui_locale === "ru" ? existingMeta.ui_locale : "tr";
    }
    const config = iyzicoConfig();
    if (!config || paymentRecord.provider !== "iyzico" || existingMeta.is_test !== config.isTest) return unlinked();
    // Missing environment snapshots are legacy records for manual reconciliation, never inferred.

    /* ── 3. Sonucu iyzico'dan sorgula ─────────────────────────────────── */
    const result = ["pending", "failed", "cancelled"].includes(paymentRecord.status)
      ? await callIyzico("checkoutForm", "retrieve", { locale: "tr", token }) : {};
    // Ağ/SDK belirsizliği bir ödeme reddi değildir. Geç SDK yanıtı artık bu rotada yazma yapamaz.
    if (["timeout", "network", "config"].includes(String(result.errorCode))) return unlinked();

    const { data: recorded, error: recordError } = await supabase.rpc("record_b2b_payment_result", {
      p_payment: paymentId,
      p_is_test: config.isTest,
      p_result: b2bPaymentResult(result),
    });
    if (recordError) {
      console.error("[callback] Ödeme sonucu atomik kaydedilemedi");
      return unlinked();
    }
    const isSuccess = recorded?.status === "paid" || recorded?.status === "already_paid";

    /* ── 6. Sonuç sayfası ─────────────────────────────────────────── */
    const params = new URLSearchParams();
    if (isSuccess) {
      params.set("status", "success");
      if (orderId) params.set("order_id", orderId);
    } else {
      params.set("status", "error");
    }
    return redirect(`${B2B_RESULT_PATH}?${params.toString()}`);
  } catch {
    console.error("[callback] Beklenmeyen dönüş hatası");
    return unlinked();
  }
}
