import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { orderCookieName, orderCookieOptions } from "@/lib/orders/access";
import { getAuthorizedOrder } from "@/lib/orders/view-data";

/**
 * POST /api/public/siparis/[no]/erisim — e-postadaki bağlantının belirtecini erişim çerezine çevirir.
 *
 * Gövde: { t }  ·  Yanıt: 200 { ok } (Set-Cookie) · 404
 *
 * Sipariş sayfası belirteci adres çubuğundan siler; bu uç sayesinde sayfa yenilendiğinde ya da
 * dil değiştirildiğinde müşteri "sipariş bulunamadı" görmez. Belirteç doğrulanmadan çerez
 * yazılmaz; yanlış belirteç ile olmayan sipariş aynı yanıtı alır.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const limited = rateLimit(`siparis-erisim:${getClientIP(req)}`, 30, 10 * 60_000);
  if (limited) return limited;

  const { no } = await params;
  const body = (await req.json().catch(() => null)) as { t?: unknown } | null;
  const token = typeof body?.t === "string" ? body.t : null;

  const order = token ? await getAuthorizedOrder(no, { token }) : null;
  if (!order || !token) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(orderCookieName(order.order_no), token, orderCookieOptions());
  return res;
}
