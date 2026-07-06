import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { maskEmail } from "@/lib/utils/format";

/**
 * Public Kargo Takip API — Kimlik doğrulama gerektirmez.
 *
 * GET /api/public/orders/track?orderId=...&email=...
 *
 * Güvenlik:
 *  - orderId + buyer_email çifti eşleşmeli (IDOR koruması)
 *  - Yanıtta hassas alanlar (user_id, total_price, vb.) dönmez
 *  - 404, "bulunamadı" mesajıyla döner — e-posta enumeration'ı engeller
 *  - Yalnızca fiziksel sipariş kargo verilerini açar
 *
 * Response shape:
 * {
 *   orderId:        string
 *   orderType:      "physical" | "reservation"
 *   shippingStatus: ShippingStatus | null
 *   courierCompany: string | null
 *   trackingNumber: string | null
 *   trackingUrl:    string | null
 *   createdAt:      string
 *   shippedAt:      string | null
 *   deliveredAt:    string | null
 *   maskedEmail:    string        — "n***@kenxmedia.com"
 * }
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId")?.trim();
  const email   = searchParams.get("email")?.trim().toLowerCase();

  // ── Parametre doğrulama ────────────────────────────────────────────────────
  if (!orderId || !email) {
    return NextResponse.json(
      { error: "orderId ve email parametreleri zorunludur." },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();

  // ── Sipariş sorgula — ID + e-posta çifti zorunlu (IDOR koruması) ──────────
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_type, shipping_status, courier_company, tracking_number, tracking_url, created_at, shipped_at, delivered_at, buyer_email"
    )
    .eq("id", orderId)
    .ilike("buyer_email", email)   // case-insensitive e-posta karşılaştırması
    .single();

  if (error || !order) {
    // Kasıtlı olarak belirsiz mesaj — e-posta enumeration'ını engeller
    return NextResponse.json(
      { error: "Sipariş bulunamadı. Lütfen sipariş numaranızı ve e-posta adresinizi kontrol edin." },
      { status: 404 }
    );
  }

  // ── Güvenli yanıt — hassas alanlar hariç ──────────────────────────────────
  return NextResponse.json({
    orderId:        order.id,
    orderType:      order.order_type,
    shippingStatus: order.shipping_status ?? null,
    courierCompany: order.courier_company ?? null,
    trackingNumber: order.tracking_number ?? null,
    trackingUrl:    order.tracking_url    ?? null,
    createdAt:      order.created_at,
    shippedAt:      order.shipped_at      ?? null,
    deliveredAt:    order.delivered_at    ?? null,
    maskedEmail:    maskEmail(order.buyer_email),
  });
}
