import { NextRequest, NextResponse } from "next/server";
import Iyzipay from "iyzipay";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import iyzipay from "@/lib/iyzico";
import { formatDateForIyzico } from "@/lib/utils/format";

export async function POST(request: NextRequest) {
  // ── Rate Limit: 10 checkout attempts per IP per minute ────────────
  const rateLimitError = rateLimit(`checkout:${getClientIP(request)}`, 10, 60_000);
  if (rateLimitError) return rateLimitError;

  try {
    const { orderId, userId, amount, email, fullName, ipAddress, description } =
      await request.json();

    if (!orderId || !userId || !amount || !email || !fullName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Ödeme kaydını veritabanına oluştur
    const supabase = createServiceRoleClient();
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert([
        {
          order_id: orderId,
          user_id: userId,
          amount,
          status: "pending",
          description,
          currency: "TRY",
        },
      ])
      .select()
      .single();

    if (paymentError) {
      console.error("Payment record creation error:", paymentError);
      return NextResponse.json(
        { error: "Failed to create payment record" },
        { status: 500 }
      );
    }

    const priceStr = amount.toFixed(2);
    const nameParts = fullName.trim().split(" ");
    const firstName = nameParts[0] || "Kullanici";
    const lastName = nameParts.slice(1).join(" ") || firstName;

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
        id: userId,
        name: firstName,
        surname: lastName,
        gsmNumber: "+905350000000",
        email: email,
        identityNumber: "74300864791",
        lastLoginDate: formatDateForIyzico(new Date()),
        registrationDate: formatDateForIyzico(new Date()),
        registrationAddress: "Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1",
        ip: ipAddress || "85.34.78.112",
        city: "Istanbul",
        country: "Turkey",
        zipCode: "34732",
      },
      shippingAddress: {
        contactName: fullName || "User",
        city: "Istanbul",
        country: "Turkey",
        address: "Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1",
        zipCode: "34732",
      },
      billingAddress: {
        contactName: fullName || "User",
        city: "Istanbul",
        country: "Turkey",
        address: "Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1",
        zipCode: "34732",
      },
      basketItems: [
        {
          id: "BI101",
          name: description.slice(0, 100),
          category1: "Tohum",
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: priceStr,
        },
      ],
    };

    // Resmi Iyzipay SDK ile checkout form oluştur
    return new Promise<NextResponse>((resolve) => {
      iyzipay.checkoutFormInitialize.create(requestData, (err: any, result: any) => {
        if (err) {
          console.error("Iyzico SDK error:", err);
          resolve(
            NextResponse.json(
              { error: "Payment initialization failed" },
              { status: 500 }
            )
          );
          return;
        }

        console.log("Iyzico response status:", result.status);

        if (result.status === "success") {
          resolve(
            NextResponse.json({
              status: "success",
              paymentId: payment.id,
              checkoutFormContent: result.checkoutFormContent,
              tokenId: result.token,
            })
          );
        } else {
          console.error("Iyzico error:", JSON.stringify(result, null, 2));
          resolve(
            NextResponse.json(
              { error: result.errorMessage || "Payment initialization failed", iyzicoError: result },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
