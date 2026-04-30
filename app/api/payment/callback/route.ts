/**
 * POST /api/payment/callback
 *
 * Iyzico 3D Secure + Checkout Form callback endpoint.
 * Iyzico form-urlencoded olarak "token" parametresiyle bu URL'i çağırır.
 *
 * ════════════════════════════════════════════════════════════════════
 * ÖNEMLİ: Bu route kesinlikle auth middleware'e takılmamalı.
 * middleware.ts içindeki PUBLIC_API_PREFIXES listesi bu rotayı korur.
 * ════════════════════════════════════════════════════════════════════
 *
 * Lookup stratejisi (v2 — token bazlı):
 *   Iyzico'nun result.conversationId alanı zaman zaman undefined
 *   döndüğü için buna GÜVENME. Bunun yerine:
 *     1. POST body'deki token, checkout başlatılırken bizim tarafımızdan
 *        payments.metadata.iyzico_token olarak kaydedildi.
 *     2. Callback geldiğinde aynı token'la DB'yi sorgulayarak
 *        paymentRecord'u (id, order_id, metadata) biz buluyoruz.
 *     3. Tüm UPDATE işlemleri paymentRecord.id üzerinden yapılır.
 *     4. Redirect URL'ine paymentRecord.order_id eklenir.
 *
 * Redirect mantığı:
 *   checkout_type === "guest" → /checkout/success
 *   checkout_type === "b2b"   → /kurumsal/panel/odeme
 *   Bilinmeyen / undefined    → /checkout/success (güvenli varsayılan)
 */

import { NextRequest, NextResponse } from "next/server";
import { sendOrderConfirmationEmail } from "@/lib/mail";
import { createServiceRoleClient } from "@/lib/supabase/server";
import iyzipay from "@/lib/iyzico";
import { createCertificate } from "@/lib/order/certificate";
import { runPostPaymentChain } from "@/lib/order/post-payment";
import { ensureReferralCode } from "@/lib/user/referral";

// Bu route'un build sırasında değil, isteğe gelince çalışmasını garantile.
export const dynamic = "force-dynamic";

const FALLBACK_SUCCESS = "/checkout/success";
const FALLBACK_ERROR   = "/checkout/success";

function buildBasePath(checkoutType: string | undefined | null): string {
  if (checkoutType === "b2b") return "/kurumsal/panel/odeme";
  return FALLBACK_SUCCESS;
}

export async function POST(request: NextRequest) {
  // Service-role client'ı isteğe gelince oluştur — build sırasında env yokken çökmesin.
  const supabase = createServiceRoleClient();

  try {
    /* ── 1. Token al ──────────────────────────────────────────────────── */
    const formData = await request.formData();
    const token    = formData.get("token") as string | null;

    if (!token) {
      console.error("[callback] ❌ Iyzico token eksik");
      return NextResponse.redirect(
        new URL(`${FALLBACK_ERROR}?status=error&message=Token+bulunamadi`, request.url)
      );
    }

    console.log("[callback] 🔑 Token alındı:", token);

    /* ── 2. Token ile DB'den ödeme kaydını bul ────────────────────────────
       conversationId'ye GÜVENME — Iyzico zaman zaman undefined döner.
       Token checkout başlatılırken payments.metadata.iyzico_token olarak
       bizim tarafımızdan kaydedildi; bu bizim kontrolümüzdeki identifier.
       Supabase JSONB text extraction: metadata->>'iyzico_token'
    ────────────────────────────────────────────────────────────────────── */
    const { data: paymentRecord, error: dbLookupErr } = await supabase
      .from("payments")
      .select("id, order_id, metadata")
      .eq("metadata->>iyzico_token", token)
      .single();

    if (dbLookupErr || !paymentRecord) {
      console.error("[callback] ❌ Token ile ödeme kaydı bulunamadı:", {
        token,
        dbError: dbLookupErr?.message ?? "kayıt yok",
      });
      return NextResponse.redirect(
        new URL(`${FALLBACK_ERROR}?status=error&message=Odeme+kaydi+bulunamadi`, request.url)
      );
    }

    const paymentId = paymentRecord.id as string;
    const orderId   = (paymentRecord.order_id as string | null) ?? null;
    const existingMeta: Record<string, unknown> =
      (paymentRecord.metadata as Record<string, unknown>) ?? {};
    const checkoutType = existingMeta.checkout_type as string | undefined;
    const basePath     = buildBasePath(checkoutType);

    console.log("[callback] ✅ DB'den ödeme kaydı bulundu:", {
      paymentId,
      orderId:     orderId     ?? "NULL",
      checkoutType: checkoutType ?? "(yok)",
      basePath,
    });

    /* ── 3. Iyzico sonucunu sorgula ──────────────────────────────────── */
    return new Promise<NextResponse>((resolve) => {
      iyzipay.checkoutForm.retrieve(
        { locale: "tr", token },
        async (err: unknown, result: Record<string, unknown>) => {

          /* ── 3a. Iyzico bağlantı hatası ────────────────────────────── */
          if (err) {
            console.error("[callback] ❌ Iyzico retrieve hatası:", err);
            resolve(
              NextResponse.redirect(
                new URL(`${FALLBACK_ERROR}?status=error&message=Odeme+sorgulanamadi`, request.url)
              )
            );
            return;
          }

          const isSuccess = result.status === "success" && result.paymentStatus === "SUCCESS";

          console.log("[callback] Iyzico sonucu:", {
            status:         result.status,
            paymentStatus:  result.paymentStatus,
            isSuccess,
            // conversationId güvenilmez — sadece bilgi amaçlı logla
            conversationId: result.conversationId ?? "(undefined — beklenen durum)",
          });

          /* ── 4. Ödeme kaydını güncelle (metadata MERGE) ──────────────
             paymentId artık kendi DB'mizden geldi — conversationId'ye
             hiçbir bağımlılık yok.
             Spread ile mevcut meta korunuyor (checkout_type, buyer_email
             buyer_name, iyzico_token, quote_id vb. ezilmiyor).
          ─────────────────────────────────────────────────────────────── */
          const { error: updateErr } = await supabase
            .from("payments")
            .update({
              status:            isSuccess ? "success" : "failed",
              iyzico_payment_id: (result.paymentId as string) || null,
              payment_method:    "credit_card",
              metadata: {
                ...existingMeta,
                cardType:          result.cardType,
                lastFourDigits:    result.lastFourDigits,
                installment:       result.installment,
                iyziCommissionFee: result.iyziCommissionFee,
                fraudStatus:       result.fraudStatus,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", paymentId);

          if (updateErr) {
            console.error("[callback] ❌ payments güncelleme hatası:", updateErr.message);
          } else {
            console.log("[callback] ✅ payments güncellendi — status:", isSuccess ? "success" : "failed");
          }

          /* ── 5. Başarılı ödeme: sipariş durumunu güncelle + siparis_no ──── */
          let siparisNo: string | null = null;

          if (isSuccess && orderId) {
            /* 5a. Mevcut orders.metadata'yı oku (merge için) */
            const { data: orderRow } = await supabase
              .from("orders")
              .select("metadata")
              .eq("id", orderId)
              .single();

            const existingOrderMeta: Record<string, unknown> =
              (orderRow?.metadata as Record<string, unknown>) ?? {};

            /* 5b. Benzersiz sipariş takip numarası üret: STG-XXXXXX */
            siparisNo = existingOrderMeta.siparis_no as string
              ?? "STG-" + Math.random().toString(36).substring(2, 8).toUpperCase();

            const { error: orderUpdateErr } = await supabase
              .from("orders")
              .update({
                payment_status: "paid",
                status:         "confirmed",
                updated_at:     new Date().toISOString(),
                metadata: { ...existingOrderMeta, siparis_no: siparisNo },
              })
              .eq("id", orderId);

            if (orderUpdateErr) {
              console.error("[callback] ❌ orders güncelleme hatası:", orderUpdateErr.message);
            } else {
              console.log("[callback] ✅ orders güncellendi — orderId:", orderId, "siparis_no:", siparisNo);
            }
          }

          /* ── 6. B2B: kurumsal teklifi PAID yap ────────────────────── */
          if (isSuccess && checkoutType === "b2b") {
            const quoteId = existingMeta.quote_id as string | undefined;
            if (quoteId) {
              await supabase
                .from("corporate_quotes")
                .update({
                  status:     "PAID",
                  paid_at:    new Date().toISOString(),
                  payment_id: paymentId,
                })
                .eq("id", quoteId);
            }
          }

          /* ── 7. Kullanıcıyı sonuç sayfasına yönlendir ───────────────
             resolve() ÖNCE çağrılır — e-posta veya başka herhangi bir
             async işlem redirect'i asla bloke edemez.
          ─────────────────────────────────────────────────────────────── */
          if (isSuccess && !orderId) {
            console.error("[callback] ❌ CRITICAL: isSuccess=true ama orderId NULL! paymentId:", paymentId);
          }

          const redirectParams = new URLSearchParams();
          if (isSuccess) {
            redirectParams.set("status", "success");
            if (orderId)    redirectParams.set("order_id",   orderId);
            if (siparisNo)  redirectParams.set("siparis_no", siparisNo);
          } else {
            redirectParams.set("status", "error");
            redirectParams.set("message", String(result.errorMessage || "Odeme basarisiz"));
          }

          const redirectUrl = `${basePath}?${redirectParams.toString()}`;
          console.log(`[callback] 🚀 Yönlendirme → ${redirectUrl}`);
          resolve(NextResponse.redirect(new URL(redirectUrl, request.url)));

          /* ── 8. Sipariş onay e-postası (fire-and-forget, resolve'dan SONRA)
             resolve() zaten çağrıldı — bu blok redirect'i hiçbir şekilde
             etkileyemez. Resend hatası, ağ hatası, onaysız domain hatası
             vb. tüm throw'lar catch'te yutulur.
          ─────────────────────────────────────────────────────────────── */
          if (isSuccess && orderId) {
            void (async () => {
              try {
                const { data: orderData } = await supabase
                  .from("orders")
                  .select("buyer_email, total_seeds, total_price, order_type, user_id, referred_by")
                  .eq("id", orderId)
                  .single();

                if (orderData) {
                  /* ── Sipariş onay e-postası ── */
                  await sendOrderConfirmationEmail({
                    email:      orderData.buyer_email,
                    orderId,
                    totalSeeds: orderData.total_seeds,
                    totalPrice: orderData.total_price,
                    orderType:  orderData.order_type || "reservation",
                  });
                  console.log("[callback] ✅ Onay e-postası gönderildi:", orderData.buyer_email);

                  /* ── VERİ BÜTÜNLÜĞÜ ZİNCİRİ ──────────────────────────────────
                     1. order_allocations: "reserved" → "confirmed"
                     2. profiles: total_seeds + carbon_offset_kg güncelle
                     3. certificates: otomatik oluştur (idempotent)
                     4. lands: kapasite kontrol + status güncelle
                  ──────────────────────────────────────────────────────────── */
                  if (orderData.user_id) {
                    const chainResult = await runPostPaymentChain({
                      supabase,
                      orderId,
                      userId: orderData.user_id,
                      totalSeeds: orderData.total_seeds ?? 0,
                      orderType: orderData.order_type || "physical",
                      buyerEmail: orderData.buyer_email,
                      metadata: existingMeta,
                    });
                    console.log("[callback] 🔗 Veri zinciri sonucu:", JSON.stringify(chainResult));

                    // Referral kodu oluştur
                    const code = await ensureReferralCode(supabase, orderData.user_id);
                    if (code) console.log("[callback] ✅ Referral kodu:", code);
                  } else {
                    /* ── Misafir kullanıcı: sadece allocation'ları confirm et ── */
                    const { error: allocErr } = await supabase
                      .from("order_allocations")
                      .update({ state: "confirmed" })
                      .eq("order_id", orderId)
                      .eq("state", "reserved");
                    if (allocErr) {
                      console.warn("[callback] ⚠️ Misafir allocation güncelleme:", allocErr.message);
                    } else {
                      console.log("[callback] ✅ Misafir allocation'lar confirmed yapıldı");
                    }
                  }

                  /* ── Referral Reward: referred_by varsa her iki tarafa +5 tohum ──
                     Sipariş referred_by ile geliyorsa:
                       - Davet eden (referred_by) → +5 earned_seeds + user_rewards
                       - Davet edilen (user_id)   → +5 earned_seeds + user_rewards
                     Mükerrer kontrol: source_order_id UNIQUE index sayesinde
                     aynı sipariş için iki kez ödül verilmez.
                  ─────────────────────────────────────────────────────────────── */
                  if (orderData.referred_by && orderData.user_id) {
                    const REFERRAL_BONUS = 5;

                    // Mükerrer kontrol — bu sipariş için zaten ödül var mı?
                    const { data: existingReward } = await supabase
                      .from("user_rewards")
                      .select("id")
                      .eq("source_order_id", orderId)
                      .eq("reward_type", "referral_signup")
                      .limit(1);

                    if (!existingReward || existingReward.length === 0) {
                      // Davet edene +5
                      await supabase.from("user_rewards").insert({
                        user_id:         orderData.referred_by,
                        reward_type:     "referral_signup",
                        amount:          REFERRAL_BONUS,
                        source_order_id: orderId,
                        description:     `Davet ettiğin kullanıcı ilk siparişini tamamladı (+${REFERRAL_BONUS} tohum)`,
                      });
                      await supabase.rpc("increment_earned_seeds", {
                        p_user_id: orderData.referred_by,
                        p_amount: REFERRAL_BONUS,
                      });

                      // Davet edilene +5
                      await supabase.from("user_rewards").insert({
                        user_id:         orderData.user_id,
                        reward_type:     "welcome_bonus",
                        amount:          REFERRAL_BONUS,
                        source_order_id: orderId,
                        description:     `Davet linki ile katıldın — hoş geldin bonusu (+${REFERRAL_BONUS} tohum)`,
                      });
                      await supabase.rpc("increment_earned_seeds", {
                        p_user_id: orderData.user_id,
                        p_amount: REFERRAL_BONUS,
                      });

                      console.log(
                        "[callback] ✅ Referral ödülü dağıtıldı — davet eden:",
                        orderData.referred_by, "davet edilen:", orderData.user_id,
                        `(+${REFERRAL_BONUS} tohum her biri)`
                      );
                    }
                  }
                }
              } catch (emailErr) {
                // Bu blokta herhangi bir hata callback'i asla patlatmaz
                console.error("[callback] ⚠️ Fire-and-forget hatası (işlem etkilenmedi):", emailErr);
              }
            })();
          }
        }
      );
    });

  } catch (error) {
    console.error("[callback] ❌ Beklenmeyen hata:", error);
    return NextResponse.redirect(
      new URL(`${FALLBACK_ERROR}?status=error&message=Bir+hata+olustu`, request.url)
    );
  }
}
