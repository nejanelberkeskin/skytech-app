import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, createServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";

/**
 * POST /api/orders/release — rezervasyonu serbest bırak.
 *
 * Güvenlik:
 *  • Authenticated kullanıcı için: order.user_id === session.user.id zorunlu.
 *  • Misafir akış için: body'de `buyer_email` zorunlu ve order.buyer_email
 *    ile (case-insensitive) eşleşmeli — sadece order_id biliyor olmak yetmez.
 *  • Yalnızca status='pending' / payment_status NULL veya 'pending' kayıtlar
 *    bırakılabilir; tamamlanmış sipariş release edilemez.
 */
export async function POST(req: NextRequest) {
  const rateLimitError = rateLimit(`release:${getClientIP(req)}`, 20, 60_000);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.order_id === "string" ? body.order_id : null;
    const buyerEmail = typeof body?.buyer_email === "string" ? body.buyer_email.trim().toLowerCase() : null;

    if (!orderId) {
      return NextResponse.json({ error: "order_id zorunludur." }, { status: 400 });
    }

    // ── Owner check ──────────────────────────────────────────────────
    const authClient = await createSupabaseServer();
    const { data: { user } } = await authClient.auth.getUser();

    const supabase = createServiceRoleClient();
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, user_id, buyer_email, status, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    }
    if (order.payment_status === "paid" || order.status === "confirmed") {
      return NextResponse.json({ error: "Tamamlanmış sipariş serbest bırakılamaz." }, { status: 409 });
    }

    if (order.user_id) {
      if (!user || user.id !== order.user_id) {
        return NextResponse.json({ error: "Bu siparişe yetkiniz yok." }, { status: 403 });
      }
    } else {
      // Misafir order: buyer_email match zorunlu
      if (!buyerEmail || !order.buyer_email || order.buyer_email.toLowerCase() !== buyerEmail) {
        return NextResponse.json({ error: "Bu siparişe yetkiniz yok." }, { status: 403 });
      }
    }

    const { error } = await supabase.rpc("release_order_reservation", {
      p_order_id: orderId,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Release error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
