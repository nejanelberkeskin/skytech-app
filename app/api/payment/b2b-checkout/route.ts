import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, createServiceRoleClient } from "@/lib/supabase/server";
import Iyzipay from "iyzipay";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { iyzicoConfig } from "@/lib/payments/iyzico-config";
import { callIyzicoObserved, priceToKurus } from "@/lib/payments/iyzico";
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

  let claimed = false;
  const pending = () => NextResponse.json({ error: "Ödeme sonucu kontrol ediliyor.", code: "checkout_pending" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────
    const authClient = await createSupabaseServer();
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
    }

    // ── 2. Body: quoteId ve yalnız sunum için locale ──────────────────────────────────────
    const { quoteId, locale: requestedLocale } = await request.json();
    const locale = requestedLocale === "en" || requestedLocale === "ru" ? requestedLocale : "tr";
    if (!quoteId || typeof quoteId !== "string") {
      return NextResponse.json({ error: "quoteId zorunludur." }, { status: 400 });
    }

    const config = iyzicoConfig();
    if (!config) return NextResponse.json({ error: "Ödeme başlatılamadı." }, { status: 503 });
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
    if (!Number.isFinite(amount) || (priceToKurus(quote.approved_price) ?? 0) <= 0 || !Number.isSafeInteger(seedCount) || seedCount <= 0) {
      return NextResponse.json({ error: "Teklif tutarı/adedi geçersiz." }, { status: 400 });
    }

    const buyerEmail = quote.corporate_email ?? user.email ?? "";
    const contactPerson = quote.contact_person ?? "Kurumsal Musteri";
    const companyName = quote.company_name ?? "Kurumsal Musteri";

    const description = `B2B Teklif: ${companyName} — ${seedCount.toLocaleString("tr-TR")} tohum`;

    const priceStr = amount.toFixed(2);
    const nameParts = contactPerson.trim().split(" ");
    const firstName = nameParts[0] || "Kurumsal";
    const lastName = nameParts.slice(1).join(" ") || "Musteri";

    const requestData = {
      locale: locale === "tr" ? Iyzipay.LOCALE.TR : "en",
      conversationId: "",
      price: priceStr,
      paidPrice: priceStr,
      currency: Iyzipay.CURRENCY.TRY,
      basketId: "",
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/payment/callback?locale=${locale}`,
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
          id: "B2B-" + quote.id.slice(0, 6),
          name: description.slice(0, 100),
          category1: "Kurumsal Tohum",
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: priceStr,
        },
      ],
    };

    // One transaction owns the quote before opening a provider session. An uncertain prior
    // session is never replaced automatically, including when its token was not saved.
    const { data: claim, error: claimError } = await supabase.rpc("claim_b2b_checkout", {
      p_quote: quote.id, p_user: user.id, p_amount: amount, p_seeds: seedCount, p_is_test: config.isTest,
    });
    if (claimError) return pending();
    if (claim?.status !== "claimed") {
      return NextResponse.json({ error: "Teklifin ödeme durumu kontrol edilmelidir.", code: claim?.status === "checkout_pending" ? "checkout_pending" : "checkout_unavailable" }, { status: 409 });
    }
    const order = { id: claim.order_id as string };
    const payment = { id: claim.payment_id as string };
    claimed = true;
    const { data: permit, error: permitError } = await supabase.rpc("begin_b2b_checkout_start", {
      p_payment: payment.id, p_user: user.id, p_is_test: config.isTest, p_locale: locale,
    });
    // A lost RPC response or expired permit never authorizes an SDK call.
    if (permitError || permit?.status !== "dispatch") return pending();
    requestData.conversationId = payment.id;
    requestData.basketId = order.id;

    const observed = await callIyzicoObserved("checkoutFormInitialize", "create", requestData);
    const result = observed.result;
    const token = observed.origin === "provider_response" && typeof result.token === "string" && /^[A-Za-z0-9._~-]{8,200}$/.test(result.token) ? result.token : null;
    const formReady = result.status === "success" && token !== null && typeof result.checkoutFormContent === "string" && Boolean(result.checkoutFormContent.trim());
    // Keep a usable token even if the HTML is missing; reconciliation can still find the payment.
    const { data: saved, error: saveError } = await supabase.rpc("finish_b2b_checkout_start", {
      p_payment: payment.id, p_user: user.id, p_is_test: config.isTest,
      p_origin: observed.origin, p_token: token, p_form_ready: formReady,
    });
    if (saveError || saved?.status !== "ready" || !formReady) return pending();
    return NextResponse.json({ status: "success", paymentId: payment.id, orderId: order.id, checkoutFormContent: result.checkoutFormContent }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("B2B checkout failed");
    return claimed ? pending() : NextResponse.json({ error: "Ödeme başlatılamadı." }, { status: 503 });
  }
}
