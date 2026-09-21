import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { SALES_ENABLED } from "@/lib/site-config";
import { issuesToFieldErrors } from "@/lib/requests/schema";
import { orderPayloadSchema } from "@/lib/orders/schema";
import { generateOrderNo } from "@/lib/orders/identifiers";
import { SAMPLE_DOCUMENTS_VERSION, checkSite } from "@/lib/orders/preview";

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
 * DURUM: sipariş kaydı, belge üretimi ve ödeme başlatma Faz 3b–4'te gelecek.
 * O zamana kadar bu uç yalnız GELİŞTİRME ortamında doğrulamayı gerçekten yapar
 * ve HİÇBİR ŞEY KAYDETMEDEN örnek bir yanıt döner (arayüz geliştirmesi için);
 * canlıda her koşulda 503 "closed".
 */
const MAX_BODY_BYTES = 24_000;

export async function POST(req: NextRequest) {
  if (!SALES_ENABLED || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "closed" }, { status: 503 });
  }

  const limited = rateLimit(`siparis:${getClientIP(req)}`, 10, 10 * 60_000);
  if (limited) return limited;

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = orderPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", fields: issuesToFieldErrors(parsed.error.issues) }, { status: 400 });
  }
  const payload = parsed.data;

  // Müşterinin onayladığı metinler güncel sürüm mü? Değilse önizleme yeniden alınır.
  if (payload.documentsVersion !== SAMPLE_DOCUMENTS_VERSION) {
    return NextResponse.json({ error: "documents_stale" }, { status: 409 });
  }

  const site = await checkSite(payload.landId, payload.quantity);
  if (!site.ok) {
    return NextResponse.json({ error: site.error }, { status: site.error === "unavailable" ? 503 : 409 });
  }

  // ÖRNEK YANIT — kayıt yok, ödeme yok. Gerçek akışta burası ödeme sağlayıcısının sayfasıdır.
  const orderNo = generateOrderNo();
  const prefix = payload.locale === "tr" ? "" : `/${payload.locale}`;
  return NextResponse.json(
    { ok: true, orderNo, redirectUrl: `${prefix}/yakinda?ornek-siparis=${encodeURIComponent(orderNo)}` },
    { status: 201 }
  );
}
