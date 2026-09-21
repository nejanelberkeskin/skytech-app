import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { issuesToFieldErrors, MIN_FILL_MS } from "@/lib/requests/schema";
import { hashIp, sanitizeUserAgent } from "@/lib/requests/server";
import { orderPayloadSchema } from "@/lib/orders/schema";
import { createOrder } from "@/lib/orders/create";
import { ordersClosed } from "@/lib/orders/gate";
import { startPayment } from "@/lib/orders/payment-flow";
import { orderPagePath } from "@/lib/orders/access";
import { getSalesSettings, quoteVersion } from "@/lib/orders/settings";
import { getPaymentProvider } from "@/lib/payments";

/**
 * POST /api/public/siparis — tohum topu bıraktırma siparişi oluşturur ve ödeme
 * sayfasının adresini döner.
 *
 * Gövde: lib/orders/schema.ts → orderPayloadSchema (TUTAR YOK; sunucu hesaplar)
 * Yanıt: 201 { ok, orderNo, redirectUrl }
 *        400 { error:"validation", fields }
 *        409 { error:"site_unavailable"|"capacity"|"documents_stale" }
 *        429 · 503 { error:"closed"|"unavailable" }
 *
 * Kapılar (hepsi geçilmeden sipariş oluşmaz):
 *  1. lib/orders/gate.ts → satış bayrağı açık, ödeme sağlayıcısı yapılandırılmış; hukuki
 *     metinler "-taslak" iken yalnız deneme sağlayıcısıyla ve canlı site DIŞINDA.
 *  2. CSRF (middleware), hız sınırı, gövde boyutu, honeypot, doldurma süresi, şema.
 *  3. Müşterinin onayladığı teklif (metin sürümü + fiyat/KDV/takvim) güncel olmalı (documents_stale).
 * Kimlik yalnız oturum çerezinden okunur; gövdeden alınmaz. IP ham saklanmaz (tuzlu özet).
 */
const MAX_BODY_BYTES = 24_000;

export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (!provider || ordersClosed(provider)) return NextResponse.json({ error: "closed" }, { status: 503 });

  const ip = getClientIP(req);
  const limited = rateLimit(`siparis:${ip}`, 10, 10 * 60_000);
  if (limited) return limited;

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Bot sinyalleri: gerçek kullanıcı honeypot'u görmez; dört adımlı form 3 saniyede dolmaz.
  const probe = raw as { website?: unknown; elapsedMs?: unknown } | null;
  const honeypot = typeof probe?.website === "string" && probe.website.trim().length > 0;
  const tooFast = typeof probe?.elapsedMs === "number" && probe.elapsedMs >= 0 && probe.elapsedMs < MIN_FILL_MS;
  if (honeypot || tooFast) return NextResponse.json({ error: "generic" }, { status: 400 });

  const parsed = orderPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", fields: issuesToFieldErrors(parsed.error.issues) }, { status: 400 });
  }
  const payload = parsed.data;

  // Müşterinin onayladığı teklif (metin sürümü + fiyat/KDV/takvim ayarları) hâlâ güncel mi?
  // Değilse sihirbaz önizlemeyi yeniden alır ve müşteri güncel tutarı YENİDEN onaylar.
  const settings = await getSalesSettings();
  if (payload.documentsVersion !== quoteVersion(settings)) {
    return NextResponse.json({ error: "documents_stale" }, { status: 409 });
  }

  let userId: string | null = null;
  try {
    const auth = await createSupabaseServer();
    const { data } = await auth.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // oturum okunamadı → misafir siparişi
  }

  const meta = {
    userId,
    ipHash: hashIp(ip),
    userAgent: sanitizeUserAgent(req.headers.get("user-agent")),
    sourcePath: payload.sourcePath?.startsWith("/") ? payload.sourcePath.split("?")[0].slice(0, 200) : null,
    isTest: provider.isTest,
  };
  const created = await createOrder(payload, meta, settings);
  if (!created.ok) {
    if (created.error === "quantity") {
      return NextResponse.json({ error: "validation", fields: { quantity: "quantityMin" } }, { status: 400 });
    }
    return NextResponse.json({ error: created.error }, { status: created.error === "unavailable" ? 503 : 409 });
  }
  const order = created.order;

  // Aynı istek yeniden geldiyse ve sipariş zaten ödendiyse doğrudan sipariş sayfasına gönder.
  if (order.paid_at) {
    return NextResponse.json(
      { ok: true, orderNo: order.order_no, redirectUrl: orderPagePath(order.order_no, order.id, order.locale) },
      { status: 201 }
    );
  }

  const payment = await startPayment(order, provider, { origin: req.nextUrl.origin, ip: ip === "unknown" ? null : ip });
  if (!payment.ok) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  return NextResponse.json({ ok: true, orderNo: order.order_no, redirectUrl: payment.redirectUrl }, { status: 201 });
}
