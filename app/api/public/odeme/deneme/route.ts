import { after, NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { completePayment } from "@/lib/orders/payment-flow";
import { sendPaidOrderEmails } from "@/lib/orders/after-payment";
import { orderCookieName, orderCookieOptions, paymentResultPath, signOrderToken } from "@/lib/orders/access";
import { getPaymentProvider } from "@/lib/payments";
import { recordMockOutcome, verifyMockOutcome } from "@/lib/payments/mock";

/**
 * POST /api/public/odeme/deneme — DENEME ödeme sağlayıcısının dönüş ucu.
 * Yalnız `PAYMENT_PROVIDER=mock` iken ve canlı dağıtım DIŞINDA çalışır; aksi hâlde 404.
 * Sonuç, deneme sayfasının ürettiği imzayla doğrulanır; ardından gerçek sağlayıcıda
 * olduğu gibi completePayment() çalışır (tutar karşılaştırması, tek seferlik işleme).
 */
export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (!provider || provider.name !== "mock") return new NextResponse(null, { status: 404 });

  const limited = rateLimit(`odeme-deneme:${getClientIP(req)}`, 30, 10 * 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as { token?: unknown; outcome?: unknown; signature?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const outcome = typeof body?.outcome === "string" ? body.outcome : "";
  const signature = typeof body?.signature === "string" ? body.signature : "";
  if (!token || !verifyMockOutcome(token, outcome, signature)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  recordMockOutcome(token, outcome);
  const result = await completePayment(token, provider);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });

  const order = result.order;
  if (result.outcome === "paid") {
    const origin = req.nextUrl.origin;
    after(() => sendPaidOrderEmails(order, origin));
  }
  const res = NextResponse.json({
    ok: true,
    outcome: result.outcome,
    orderNo: order.order_no,
    redirectUrl: paymentResultPath(order.order_no, order.id, order.locale),
  });
  const accessToken = signOrderToken(order.id);
  if (accessToken) res.cookies.set(orderCookieName(order.order_no), accessToken, orderCookieOptions());
  return res;
}
