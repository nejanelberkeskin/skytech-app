import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, createServiceRoleClient } from "@/lib/supabase/server";
import Iyzipay from "iyzipay";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import iyzipay from "@/lib/iyzico";
import { formatDateForIyzico } from "@/lib/utils/format";

/**
 * POST /api/payment/b2b-checkout — Kurumsal teklif sahibi quote'unu öder.
 *
 * Güvenlik kuralları:
 *  • Authenticated zorunlu (cookie session).
 *  • Body'den userId/email ALINMAZ — session.user.id ve corporate_quotes.user_id
 *    ile cross-check. Quote başkasının ise 403.
 *  • Amount, seedCount, company bilgileri quote DB satırından gelir; body'deki
 *    değerler yalnızca display için kullanılır (ödeme tutarına etki etmez).
 *  • Quote status sadece 'QUOTED' olmalı. PAID veya farklı bir state → reject.
 */
export async function POST(request: NextRequest) {
  const rateLimitError = rateLimit(`b2b-checkout:${getClientIP(request)}`, 5, 60_000);
  if (rateLimitError) return rateLimitError;

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────
    const authClient = await createSupabaseServer();
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
    }

    // ── 2. Body: yalnız quoteId ──────────────────────────────────────
    const { quoteId } = await request.json();
    if (!quoteId || typeof quoteId !== "string") {
      return NextResponse.json({ error: "quoteId zorunludur." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // ── 3. Quote ownership + state + amount (DB'den) ─────────────────
    const { data: quote, error: quoteError } = await supabase
      .from("corporate_quotes")
      .select("id, user_id, status, approved_price, approved_seed_count, company_name, contact_person, phone, corporate_email")
      .eq("id", quoteId)
      .maybeSingle();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
    }
    if (quote.user_id !== user.id) {
      return NextResponse.json({ error: "Bu teklife yetkiniz yok." }, { status: 403 });
    }
    if (quote.status !== "QUOTED") {
      return NextResponse.json({ error: `Teklif durumu ödeme için uygun değil: ${quote.status}` }, { status: 400 });
    }

    const amount = Number(quote.approved_price);
    const seedCount = Number(quote.approved_seed_count);
    if (!amount || amount <= 0 || !seedCount || seedCount <= 0) {
      return NextResponse.json({ error: "Teklif tutarı/adedi geçersiz." }, { status: 400 });
    }

    const buyerEmail = quote.corporate_email ?? user.email ?? "";
    const contactPerson = quote.contact_person ?? "Kurumsal Musteri";
    const companyName = quote.company_name ?? "Kurumsal Musteri";

    // ── 4. Order oluştur (user_id = auth.user.id) ────────────────────
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        buyer_email: buyerEmail,
        order_type: "reservation",
        status: "pending",
        total_seeds: seedCount,
        total_price: amount,
        shipping_address: null,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("B2B order error:", orderError?.message);
      return NextResponse.json({ error: "Sipariş oluşturulamadı." }, { status: 500 });
    }

    await supabase
      .from("corporate_quotes")
      .update({ order_id: order.id })
      .eq("id", quoteId);

    const description = `B2B Teklif: ${companyName} — ${seedCount.toLocaleString("tr-TR")} tohum`;

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        user_id: user.id,
        amount,
        status: "pending",
        description,
        currency: "TRY",
        metadata: { checkout_type: "b2b", quote_id: quoteId },
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error("B2B payment record error:", paymentError?.message);
      return NextResponse.json({ error: "Ödeme kaydı oluşturulamadı." }, { status: 500 });
    }

    const priceStr = amount.toFixed(2);
    const nameParts = contactPerson.trim().split(" ");
    const firstName = nameParts[0] || "Kurumsal";
    const lastName = nameParts.slice(1).join(" ") || "Musteri";

    const requestData = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: payment.id,
      price: priceStr,
      paidPrice: priceStr,
      currency: Iyzipay.CURRENCY.TRY,
      basketId: order.id,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/payment/callback`,
      enabledInstallments: [2, 3, 6, 9, 12],
      buyer: {
        id: user.id,
        name: firstName,
        surname: lastName,
        gsmNumber: quote.phone || "+905350000000",
        email: buyerEmail,
        identityNumber: "74300864791",
        lastLoginDate: formatDateForIyzico(new Date()),
        registrationDate: formatDateForIyzico(new Date()),
        registrationAddress: "Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1",
        ip: "85.34.78.112",
        city: "Istanbul",
        country: "Turkey",
        zipCode: "34732",
      },
      shippingAddress: {
        contactName: contactPerson,
        city: "Istanbul",
        country: "Turkey",
        address: "Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1",
        zipCode: "34732",
      },
      billingAddress: {
        contactName: companyName,
        city: "Istanbul",
        country: "Turkey",
        address: "Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1",
        zipCode: "34732",
      },
      basketItems: [
        {
          id: "B2B-" + quoteId.slice(0, 6),
          name: description.slice(0, 100),
          category1: "Kurumsal Tohum",
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: priceStr,
        },
      ],
    };

    return new Promise<NextResponse>((resolve) => {
      iyzipay.checkoutFormInitialize.create(requestData, (err: unknown, result: { status?: string; checkoutFormContent?: string; token?: string; errorMessage?: string }) => {
        if (err) {
          console.error("B2B Iyzico error:", err);
          resolve(NextResponse.json({ error: "Ödeme başlatılamadı." }, { status: 500 }));
          return;
        }

        if (result.status === "success") {
          void supabase
            .from("payments")
            .update({
              metadata: { checkout_type: "b2b", quote_id: quoteId, iyzico_token: result.token as string },
            })
            .eq("id", payment.id);

          resolve(NextResponse.json({
            status: "success",
            paymentId: payment.id,
            orderId: order.id,
            checkoutFormContent: result.checkoutFormContent,
          }));
        } else {
          resolve(NextResponse.json({ error: result.errorMessage || "Ödeme başlatılamadı." }, { status: 500 }));
        }
      });
    });
  } catch (error) {
    console.error("B2B checkout error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
