import { after, NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { SALES_ENABLED } from "@/lib/site-config";
import { issuesToFieldErrors, MIN_FILL_MS } from "@/lib/requests/schema";
import { hashIp, sanitizeUserAgent } from "@/lib/requests/server";
import { withdrawalRequestSchema } from "@/lib/orders/schema";
import { ORDER_VIEW_FIXTURES } from "@/lib/orders/view";
import { recordWithdrawal, refundDueDay, sendWithdrawalEmails } from "@/lib/orders/withdrawal";

/**
 * POST /api/public/cayma — cayma bildirimi (sipariş no + siparişte kullanılan e-posta).
 *
 * Yanıt: 200 { ok, orderNo, receivedAt, refundDueOn }
 *        400 { error:"validation", fields } · 404 { error:"not_found" }
 *        409 { error:"not_eligible"|"already_requested"|"already_refunded" } · 429 · 503 { error:"closed" }
 *
 * Bildirim ulaştığı an geçerlidir: sipariş `withdrawal_requested` olur, bekleyen iade kaydı
 * açılır, müşteriye DERHAL teyit e-postası gider (yanıt bekletilmeden, `after()` içinde).
 * Sipariş no ile e-posta eşleşmezse hangisinin yanlış olduğu söylenmez; numara tahmini
 * hız sınırıyla zorlaştırılır.
 *
 * Geliştirmede örnek siparişler (lib/orders/view.ts, e-posta ayse@example.com) arayüz
 * denemesi için yanıt verir ve HİÇBİR ŞEY KAYDETMEZ.
 */
const FIXTURE_EMAIL = "ayse@example.com";

export async function POST(req: NextRequest) {
  if (!SALES_ENABLED) return NextResponse.json({ error: "closed" }, { status: 503 });

  const ip = getClientIP(req);
  const limited = rateLimit(`cayma:${ip}`, 8, 10 * 60_000);
  if (limited) return limited;

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 8_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const probe = raw as { website?: unknown; elapsedMs?: unknown } | null;
  const honeypot = typeof probe?.website === "string" && probe.website.trim().length > 0;
  const tooFast = typeof probe?.elapsedMs === "number" && probe.elapsedMs >= 0 && probe.elapsedMs < MIN_FILL_MS;
  if (honeypot || tooFast) return NextResponse.json({ error: "generic" }, { status: 400 });

  const parsed = withdrawalRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", fields: issuesToFieldErrors(parsed.error.issues) }, { status: 400 });
  }
  const input = parsed.data;

  // Arayüz denemesi için örnek siparişler — yalnız geliştirmede, kayıt yok.
  if (process.env.NODE_ENV !== "production" && input.email === FIXTURE_EMAIL) {
    const fixture = ORDER_VIEW_FIXTURES.find((o) => o.orderNo === input.orderNo);
    if (fixture) {
      if (fixture.status === "refunded") return NextResponse.json({ error: "already_refunded" }, { status: 409 });
      if (fixture.status === "withdrawal_requested") return NextResponse.json({ error: "already_requested" }, { status: 409 });
      if (!fixture.canWithdraw) return NextResponse.json({ error: "not_eligible" }, { status: 409 });
      const now = new Date();
      return NextResponse.json({ ok: true, orderNo: fixture.orderNo, receivedAt: now.toISOString(), refundDueOn: refundDueDay(now) });
    }
  }

  const result = await recordWithdrawal(input.orderNo, input.email, {
    channel: "form",
    note: input.note ?? null,
    ipHash: hashIp(ip),
    userAgent: sanitizeUserAgent(req.headers.get("user-agent")),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
  }

  const { order, receivedAt, refundDueOn } = result;
  after(() => sendWithdrawalEmails(order, receivedAt, refundDueOn));
  return NextResponse.json({ ok: true, orderNo: order.order_no, receivedAt, refundDueOn });
}
