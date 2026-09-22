import { NextRequest, NextResponse } from "next/server";
import { orderCookieName } from "@/lib/orders/access";
import { getAuthorizedOrder } from "@/lib/orders/view-data";
import { createSupabaseServer } from "@/lib/supabase/server";
import { db } from "@/lib/orders/store";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
/** Yalnız geri alma: URL belirteci, yeni yayın izni veya üçüncü kişi adına izin kabul etmez. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return new NextResponse(null, { status: 403, headers });
  const { no } = await params;
  const token = req.cookies.get(orderCookieName(no.trim().toUpperCase()))?.value ?? null;
  let userId: string | null = null;
  if (!token) {
    const auth = await createSupabaseServer();
    userId = (await auth.auth.getUser()).data.user?.id ?? null;
  }
  const supabase = db();
  const order = await getAuthorizedOrder(no, { token, userId }, supabase);
  if (!order || !order.paid_at) return new NextResponse(null, { status: 404, headers });
  const consent = order.consents.certificatePublication;
  if (consent?.granted && !consent.revokedAt) {
    const { error } = await supabase.from("release_orders").update({
      consents: { ...order.consents, certificatePublication: { ...consent, revokedAt: new Date().toISOString() } },
    }).eq("id", order.id);
    if (error) return new NextResponse(null, { status: 503, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
