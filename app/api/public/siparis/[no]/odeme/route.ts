import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { orderPagePath } from "@/lib/orders/access";
import { ordersClosed } from "@/lib/orders/gate";
import { startPayment } from "@/lib/orders/payment-flow";
import { db } from "@/lib/orders/store";
import { getAuthorizedOrder } from "@/lib/orders/view-data";
import { getPaymentProvider } from "@/lib/payments";

/**
 * POST /api/public/siparis/[no]/odeme — ödemesi tamamlanmamış siparişte ödemeyi YENİDEN başlatır.
 *
 * Gövde: { t?: string }  (e-postadaki / ödeme sonucu sayfasındaki imzalı belirteç; üye oturumu da yeter)
 * Yanıt: 200 { ok, redirectUrl } · 404 · 409 { error:"expired"|"not_payable" } · 429 · 503 { error:"closed"|"unavailable" }
 *
 * Yeni sipariş OLUŞTURMAZ: aynı sipariş, aynı tutar, aynı belgeler. Süresi dolmuş siparişin
 * kapasitesi geri verildiği için o sipariş yeniden ödenemez (müşteri yeni sipariş oluşturur).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const provider = getPaymentProvider();
  if (!provider || ordersClosed(provider)) return NextResponse.json({ error: "closed" }, { status: 503 });

  const ip = getClientIP(req);
  const limited = rateLimit(`siparis-odeme:${ip}`, 10, 10 * 60_000);
  if (limited) return limited;

  const { no } = await params;
  const body = (await req.json().catch(() => null)) as { t?: unknown } | null;
  const token = typeof body?.t === "string" ? body.t : null;

  let userId: string | null = null;
  if (!token) {
    try {
      const auth = await createSupabaseServer();
      userId = (await auth.auth.getUser()).data.user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  const order = await getAuthorizedOrder(no, { token, userId }, db());
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (order.paid_at) {
    return NextResponse.json({ ok: true, redirectUrl: orderPagePath(order.order_no, order.id, order.locale) });
  }
  if (order.status === "expired" || (order.payment_expires_at && new Date(order.payment_expires_at).getTime() <= Date.now())) {
    return NextResponse.json({ error: "expired" }, { status: 409 });
  }
  if (order.status !== "draft" && order.status !== "awaiting_payment" && order.status !== "payment_failed") {
    return NextResponse.json({ error: "not_payable" }, { status: 409 });
  }
  // Sipariş hangi kipte (deneme / gerçek) oluştuysa o kipte ödenir.
  if (order.is_test !== provider.isTest) return NextResponse.json({ error: "not_payable" }, { status: 409 });

  const payment = await startPayment(order, provider, { origin: req.nextUrl.origin, ip: ip === "unknown" ? null : ip });
  if (!payment.ok) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, redirectUrl: payment.redirectUrl });
}
