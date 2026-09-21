import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { SALES_ENABLED } from "@/lib/site-config";
import { issuesToFieldErrors } from "@/lib/requests/schema";
import { withdrawalRequestSchema } from "@/lib/orders/schema";
import { ORDER_VIEW_FIXTURES } from "@/lib/orders/view";

/**
 * POST /api/public/cayma — cayma bildirimi (sipariş no + e-posta).
 *
 * Yanıt: 200 { ok, orderNo, receivedAt, refundDueOn }
 *        400 { error:"validation", fields } · 404 { error:"not_found" }
 *        409 { error:"not_eligible"|"already_requested" } · 429 · 503 { error:"closed" }
 *
 * Mevzuat gereği bildirim ulaştığında müşteriye DERHAL e-posta ile teyit gider
 * (Faz 3c). Sipariş no ile e-posta eşleşmezse hangisinin yanlış olduğu söylenmez.
 *
 * DURUM: sipariş kaydı bağlanana kadar yalnız GELİŞTİRME ortamında örnek
 * siparişlerle yanıt verir, HİÇBİR ŞEY KAYDETMEZ; canlıda 503 "closed".
 */
export async function POST(req: NextRequest) {
  if (!SALES_ENABLED || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "closed" }, { status: 503 });
  }

  const limited = rateLimit(`cayma:${getClientIP(req)}`, 8, 10 * 60_000);
  if (limited) return limited;

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 8_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = withdrawalRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", fields: issuesToFieldErrors(parsed.error.issues) }, { status: 400 });
  }

  // ÖRNEK DAVRANIŞ — örnek siparişlerin e-postası: ayse@example.com
  const order = ORDER_VIEW_FIXTURES.find((o) => o.orderNo === parsed.data.orderNo);
  if (!order || parsed.data.email !== "ayse@example.com") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.status === "withdrawal_requested" || order.status === "refunded") {
    return NextResponse.json({ error: "already_requested" }, { status: 409 });
  }
  if (!order.canWithdraw) {
    return NextResponse.json({ error: "not_eligible" }, { status: 409 });
  }

  const now = new Date();
  const due = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000);
  return NextResponse.json({
    ok: true,
    orderNo: order.orderNo,
    receivedAt: now.toISOString(),
    refundDueOn: due.toISOString().slice(0, 10),
  });
}
