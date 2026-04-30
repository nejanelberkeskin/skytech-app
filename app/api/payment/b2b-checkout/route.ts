import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import Iyzipay from "iyzipay";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import iyzipay from "@/lib/iyzico";
import { formatDateForIyzico } from "@/lib/utils/format";

/**
 * B2B Quote Payment — Kurumsal müşteri teklifi onaylayıp Iyzico ile öder.
 * Quote ID ile çalışır. Teklif QUOTED statüsünde olmalı.
 */
export async function POST(request: NextRequest) {
  // ── Rate Limit: 5 B2B checkout attempts per IP per minute ─────────
  const rateLimitError = rateLimit(`b2b-checkout:${getClientIP(request)}`, 5, 60_000);
  if (rateLimitError) return rateLimitError;

  try {
    const supabase = createServiceRoleClient();
    const { quoteId, userId, email, companyName, contactPerson } = await request.json();

    if (!quoteId || !userId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Teklifi getir
    const { data: quote, error: quoteError } = await supabase
      .from("corporate_quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.status !== "QUOTED") {
      return NextResponse.json(
        { error: `Teklif durumu ödeme için uygun değil: ${quote.status}` },
        { status: 400 }
      );
    }

    const amount = Number(quote.approved_price);
    const seedCount = Number(quote.approved_seed_count);

    // Order oluştur
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        buyer_email: email,
        order_type: "reservation",
        status: "pending",
        total_seeds: seedCount,
        total_price: amount,
        shipping_address: null,
      })
      .select()
      .single();

    if (orderError) {
      console.error("B2B order error:", orderError.message);
      return NextResponse.json({ error: "Order creation failed" }, { status: 500 });
    }

    // Quote'a order_id bağla
    await supabase
      .from("corporate_quotes")
      .update({ order_id: order.id })
      .eq("id", quoteId);

    // Payment kaydı oluştur
    const description = `B2B Teklif: ${companyName || quote.company_name} — ${seedCount.toLocaleString("tr-TR")} tohum`;

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        user_id: userId,
        amount,
        status: "pending",
        description,
        currency: "TRY",
        metadata: { checkout_type: "b2b", quote_id: quoteId },
      })
      .select()
      .single();

    if (paymentError) {
      console.error("B2B payment record error:", paymentError.message);
      return NextResponse.json({ error: "Payment record creation failed" }, { status: 500 });
    }

    // Iyzico checkout form
    const priceStr = amount.toFixed(2);
    const nameParts = (contactPerson || quote.contact_person || "Kurumsal Musteri").trim().split(" ");
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
        id: userId,
        name: firstName,
        surname: lastName,
        gsmNumber: quote.phone || "+905350000000",
        email: email,
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
        contactName: contactPerson || quote.contact_person,
        city: "Istanbul",
        country: "Turkey",
        address: "Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1",
        zipCode: "34732",
      },
      billingAddress: {
        contactName: companyName || quote.company_name,
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
      iyzipay.checkoutFormInitialize.create(requestData, (err: any, result: any) => {
        if (err) {
          console.error("B2B Iyzico error:", err);
          resolve(NextResponse.json({ error: "Payment initialization failed" }, { status: 500 }));
          return;
        }

        if (result.status === "success") {
          // Callback'in token bazlı DB lookup'ı yapabilmesi için token'ı metadata'ya yaz
          // (guest-checkout ile aynı strateji — conversationId'ye güvenmiyoruz)
          void supabase
            .from("payments")
            .update({
              metadata: {
                checkout_type: "b2b",
                quote_id: quoteId,
                iyzico_token: result.token as string,
              },
            })
            .eq("id", payment.id);

          resolve(
            NextResponse.json({
              status: "success",
              paymentId: payment.id,
              orderId: order.id,
              checkoutFormContent: result.checkoutFormContent,
            })
          );
        } else {
          resolve(
            NextResponse.json(
              { error: result.errorMessage || "Payment initialization failed" },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (error: any) {
    console.error("B2B checkout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
