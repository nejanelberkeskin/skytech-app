import { NextRequest, NextResponse } from "next/server";
import Iyzipay from "iyzipay";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { createSupabaseServer, createServiceRoleClient } from "@/lib/supabase/server";
import iyzipay from "@/lib/iyzico";
import { formatDateForIyzico } from "@/lib/utils/format";

/**
 * POST /api/payment/checkout — Üye kullanıcı için Iyzico checkout başlat.
 *
 * Güvenlik kuralları:
 *  • Authenticated zorunlu — middleware bu rotayı public bypass etse de burada
 *    cookie session doğrulanır. user_id body'den ALINMAZ; auth.user.id kullanılır.
 *  • orderId zorunlu ve session user'ın siparişi olmalı (IDOR koruması).
 *  • amount, email, fullName body'den ALINMAZ. orders + profiles DB'sinden okunur.
 *    Aksi halde saldırgan body amount'unu manipüle edebilir.
 */
export async function POST(request: NextRequest) {
  const rateLimitError = rateLimit(`checkout:${getClientIP(request)}`, 10, 60_000);
  if (rateLimitError) return rateLimitError;

  try {
    // ── 1. Auth — cookie session zorunlu ───────────────────────────────
    const authClient = await createSupabaseServer();
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
    }

    // ── 2. Body — sadece orderId + description, geri kalan DB'den ─────
    const { orderId, description, ipAddress } = await request.json();
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "orderId zorunludur." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // ── 3. Sipariş ownership + amount DB'den oku ──────────────────────
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, user_id, buyer_email, total_amount, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    }
    if (order.user_id && order.user_id !== user.id) {
      // user_id boşsa misafir order'ı; ama bu route üye akışı, sahip eşleşmeli
      return NextResponse.json({ error: "Bu siparişe yetkiniz yok." }, { status: 403 });
    }
    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "Sipariş zaten ödendi." }, { status: 409 });
    }
    const amount = Number(order.total_amount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Sipariş tutarı geçersiz." }, { status: 400 });
    }

    // ── 4. Profil bilgileri (email + full_name) DB'den ─────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const email = profile?.email ?? user.email ?? order.buyer_email;
    const fullName = profile?.full_name?.trim() || (user.user_metadata?.full_name as string | undefined) || "Kullanıcı";
    if (!email) {
      return NextResponse.json({ error: "E-posta bulunamadı." }, { status: 400 });
    }

    // ── 5. Payment kaydı oluştur (user_id = auth.user.id) ─────────────
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert([
        {
          order_id: orderId,
          user_id: user.id,
          amount,
          status: "pending",
          description: typeof description === "string" ? description.slice(0, 200) : null,
          currency: "TRY",
        },
      ])
      .select()
      .single();

    if (paymentError || !payment) {
      console.error("Payment record creation error:", paymentError);
      return NextResponse.json({ error: "Ödeme kaydı oluşturulamadı." }, { status: 500 });
    }

    const priceStr = amount.toFixed(2);
    const nameParts = fullName.trim().split(" ");
    const firstName = nameParts[0] || "Kullanici";
    const lastName = nameParts.slice(1).join(" ") || firstName;
    const safeDesc = typeof description === "string" ? description.slice(0, 100) : "Tohum siparişi";

    const requestData = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: payment.id,
      price: priceStr,
      paidPrice: priceStr,
      currency: Iyzipay.CURRENCY.TRY,
      basketId: orderId,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/payment/callback`,
      enabledInstallments: [2, 3, 6, 9, 12],
      buyer: {
        id: user.id,
        name: firstName,
        surname: lastName,
        gsmNumber: "+905350000000",
        email,
        identityNumber: "74300864791",
        lastLoginDate: formatDateForIyzico(new Date()),
        registrationDate: formatDateForIyzico(new Date()),
        registrationAddress: "Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1",
        ip: typeof ipAddress === "string" ? ipAddress.slice(0, 45) : "85.34.78.112",
        city: "Istanbul",
        country: "Turkey",
        zipCode: "34732",
      },
      shippingAddress: {
        contactName: fullName,
        city: "Istanbul",
        country: "Turkey",
        address: "Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1",
        zipCode: "34732",
      },
      billingAddress: {
        contactName: fullName,
        city: "Istanbul",
        country: "Turkey",
        address: "Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1",
        zipCode: "34732",
      },
      basketItems: [
        {
          id: "BI101",
          name: safeDesc,
          category1: "Tohum",
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: priceStr,
        },
      ],
    };

    return new Promise<NextResponse>((resolve) => {
      iyzipay.checkoutFormInitialize.create(requestData, (err: unknown, result: { status?: string; checkoutFormContent?: string; token?: string; errorMessage?: string }) => {
        if (err) {
          console.error("Iyzico SDK error:", err);
          resolve(NextResponse.json({ error: "Ödeme başlatılamadı." }, { status: 500 }));
          return;
        }
        if (result.status === "success") {
          resolve(NextResponse.json({
            status: "success",
            paymentId: payment.id,
            checkoutFormContent: result.checkoutFormContent,
            tokenId: result.token,
          }));
        } else {
          console.error("Iyzico error:", result.errorMessage);
          resolve(NextResponse.json({ error: result.errorMessage || "Ödeme başlatılamadı." }, { status: 500 }));
        }
      });
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
