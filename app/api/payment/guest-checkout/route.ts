import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import Iyzipay from "iyzipay";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import iyzipay from "@/lib/iyzico";

export async function POST(req: NextRequest) {
  // ── Rate Limit: 10 checkout attempts per IP per minute ────────────
  const rateLimitError = rateLimit(`guest-checkout:${getClientIP(req)}`, 10, 60_000);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { buyer, basketItems, totalPrice, orderId, totalSeeds, giftInfo } = body;

    if (!buyer?.email || !buyer?.fullName || !basketItems?.length || !totalPrice) {
      return NextResponse.json({ error: "Eksik bilgi." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // If no orderId provided (seed-only cart, no reservation), create an order
    let finalOrderId = orderId;
    if (!finalOrderId) {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          buyer_email: buyer.email,
          total_seeds: totalSeeds || 0,
          status: "pending",
          type: "individual",
          order_type: giftInfo ? "gift" : "physical",
          gift_info: giftInfo || null,
          description: giftInfo
            ? `Hediye sipariş - ${buyer.fullName} → ${giftInfo.recipientName}`
            : `Bireysel sipariş - ${buyer.fullName}`,
          total_amount: parseFloat(totalPrice),
        })
        .select("id")
        .single();

      if (orderErr || !order) {
        return NextResponse.json(
          { error: `Sipariş oluşturulamadı: ${orderErr?.message}` },
          { status: 500 }
        );
      }
      finalOrderId = order.id;
    } else {
      // Update existing order (from reservation) with buyer info and amount
      await supabase
        .from("orders")
        .update({
          buyer_email: buyer.email,
          total_amount: parseFloat(totalPrice),
          description: giftInfo
            ? `Hediye arazi ekimi - ${buyer.fullName} → ${giftInfo.recipientName}`
            : `Arazi ekimi - ${buyer.fullName}`,
          type: "individual",
          order_type: giftInfo ? "gift" : "reservation",
          gift_info: giftInfo || null,
        })
        .eq("id", finalOrderId);
    }

    // Create payment record
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        order_id: finalOrderId,
        amount: parseFloat(totalPrice),
        currency: "TRY",
        provider: "iyzico",
        status: "pending",
        metadata: { buyer_email: buyer.email, buyer_name: buyer.fullName },
      })
      .select("id")
      .single();

    if (payErr || !payment) {
      return NextResponse.json(
        { error: `Ödeme kaydı oluşturulamadı: ${payErr?.message}` },
        { status: 500 }
      );
    }

    // Split buyer name
    const nameParts = buyer.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "Misafir";
    const lastName = nameParts.slice(1).join(" ") || "Kullanıcı";

    // Iyzico checkout form request
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: payment.id,
      price: totalPrice,
      paidPrice: totalPrice,
      currency: Iyzipay.CURRENCY.TRY,
      basketId: `B-${finalOrderId.slice(0, 8)}`,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/payment/callback`,
      enabledInstallments: [1, 2, 3, 6, 9, 12],
      buyer: {
        id: `GUEST-${finalOrderId.slice(0, 8)}`,
        name: firstName,
        surname: lastName,
        gsmNumber: buyer.phone || "+905000000000",
        email: buyer.email,
        identityNumber: buyer.identityNumber || "11111111111",
        lastLoginDate: new Date().toISOString().split("T")[0] + " 00:00:00",
        registrationDate: new Date().toISOString().split("T")[0] + " 00:00:00",
        registrationAddress: buyer.address || "Adres belirtilmedi",
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
        city: buyer.city || "Istanbul",
        country: "Turkey",
        zipCode: buyer.zipCode || "34000",
      },
      shippingAddress: {
        contactName: buyer.fullName,
        city: buyer.city || "Istanbul",
        country: "Turkey",
        address: buyer.address || "Adres belirtilmedi",
        zipCode: buyer.zipCode || "34000",
      },
      billingAddress: {
        contactName: buyer.fullName,
        city: buyer.city || "Istanbul",
        country: "Turkey",
        address: buyer.address || "Adres belirtilmedi",
        zipCode: buyer.zipCode || "34000",
      },
      basketItems: basketItems.map((item: { id: string; name: string; category: string; price: string }) => ({
        id: item.id,
        name: item.name,
        category1: item.category,
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price: item.price,
      })),
    };

    // Create checkout form
    const result: any = await new Promise((resolve, reject) => {
      iyzipay.checkoutFormInitialize.create(request, (err: any, res: any) => {
        if (err) reject(err);
        else resolve(res);
      });
    });

    if (result.status !== "success") {
      return NextResponse.json(
        { error: `Iyzico hatası: ${result.errorMessage || "Bilinmeyen hata"}` },
        { status: 500 }
      );
    }

    // Save token to payment metadata for callback matching
    await supabase
      .from("payments")
      .update({
        metadata: {
          buyer_email:  buyer.email,
          buyer_name:   buyer.fullName,
          buyer_phone:  buyer.phone || null,
          iyzico_token: result.token,
          checkout_type: "guest",
          ...(giftInfo ? {
            gift_recipient_name:  giftInfo.recipientName,
            gift_recipient_email: giftInfo.recipientEmail,
            gift_note:            giftInfo.giftNote || null,
          } : {}),
        },
      })
      .eq("id", payment.id);

    return NextResponse.json({
      checkoutFormContent: result.checkoutFormContent,
      token: result.token,
    });
  } catch (err) {
    console.error("Guest checkout error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
