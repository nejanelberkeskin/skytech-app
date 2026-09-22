import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { issuesToFieldErrors } from "@/lib/requests/schema";
import { orderPreviewSchema } from "@/lib/orders/schema";
import { buildPreview, checkSite } from "@/lib/orders/preview";
import { getSalesSettings } from "@/lib/orders/settings";
import { quantityRangeError } from "@/lib/pricing";
import { ordersClosed } from "@/lib/orders/gate";
import { getPaymentProvider } from "@/lib/payments";

/**
 * POST /api/public/siparis/onizleme — sipariş sihirbazının 4. adımı için KESİN
 * tutar, takvim ve siparişe özel hukuki metinler. Hiçbir şey kaydetmez.
 *
 * Gövde: { landId, quantity, certificateName?, buyer, invoice, locale }
 * Yanıt: 200 { ok, version, documents[], totals, schedule }
 *        400 { error:"validation", fields } · 409 { error:"site_unavailable"|"capacity" }
 *        429 · 503 { error:"closed"|"unavailable" }
 *
 * Belgeler lib/legal şablonlarından üretilir. Sipariş ucuyla AYNI kapıyı kullanır
 * (lib/orders/gate.ts): şablon sürümü "-taslak" iken canlı sitede 503 "closed" döner —
 * incelenmemiş metin müşteriye gösterilmez, satış bayrağı yanlışlıkla açılsa bile.
 */
const MAX_BODY_BYTES = 20_000;

export async function POST(req: NextRequest) {
  if (ordersClosed(getPaymentProvider())) return NextResponse.json({ error: "closed" }, { status: 503 });

  const limited = rateLimit(`siparis-onizleme:${getClientIP(req)}`, 30, 10 * 60_000);
  if (limited) return limited;

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = orderPreviewSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", fields: issuesToFieldErrors(parsed.error.issues) }, { status: 400 });
  }

  const settings = await getSalesSettings();
  const range = quantityRangeError(parsed.data.quantity, settings);
  if (range) {
    return NextResponse.json({ error: "validation", fields: { quantity: range } }, { status: 400 });
  }

  const site = await checkSite(parsed.data.landId, parsed.data.quantity);
  if (!site.ok) {
    return NextResponse.json({ error: site.error }, { status: site.error === "unavailable" ? 503 : 409 });
  }

  return NextResponse.json({ ok: true, ...buildPreview(parsed.data, site.site, settings) });
}
