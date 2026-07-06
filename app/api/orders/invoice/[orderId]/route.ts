/**
 * GET /api/orders/invoice/[orderId]
 *
 * Güvenli Fatura Verisi API — sadece sipariş sahibi veya admin erişebilir.
 *
 * Yanıt Shape:
 * {
 *   order:       { id, buyer_email, order_type, status, total_seeds, total_price,
 *                  shipping_address, created_at }
 *   allocations: Array<{ seeds_allocated, lands: { name, region } | null }>
 *   buyerProfile:{ full_name, phone, address, city } | null
 * }
 *
 * Auth:
 *   - Cookie oturumu zorunlu
 *   - Sipariş sahibi VEYA aktif admin_users kaydı erişebilir
 *   - Başka kullanıcılar 403 alır
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  if (!orderId?.trim()) {
    return NextResponse.json({ error: "orderId zorunludur." }, { status: 400 });
  }

  // ── Oturum kontrolü ──────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Server Component context */ }
        },
      },
    }
  );

  const { data: { session } } = await authClient.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Oturum gerekli. Lütfen giriş yapın." },
      { status: 401 }
    );
  }

  const service = createServiceRoleClient();

  // ── Sipariş sorgula ───────────────────────────────────────────────────────
  const { data: order, error: orderError } = await service
    .from("orders")
    .select(
      "id, user_id, buyer_email, order_type, status, total_seeds, total_price, shipping_address, created_at"
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  // ── Yetki kontrolü: sipariş sahibi VEYA admin ────────────────────────────
  const isOwner = order.user_id === session.user.id;

  if (!isOwner) {
    const { data: adminUser } = await service
      .from("admin_users")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .single();

    if (!adminUser) {
      return NextResponse.json(
        { error: "Bu faturaya erişim yetkiniz yok." },
        { status: 403 }
      );
    }
  }

  // ── Arazi tahsisleri (fatura kalemleri) ───────────────────────────────────
  const { data: allocations } = await service
    .from("order_allocations")
    .select("seeds_allocated, lands(name, region)")
    .eq("order_id", orderId);

  // ── Alıcı profil bilgisi ──────────────────────────────────────────────────
  const { data: profile } = order.user_id
    ? await service
        .from("profiles")
        .select("full_name, phone, address, city")
        .eq("id", order.user_id)
        .single()
    : { data: null };

  // ── Kurumsal teklif — şirket adı ve vergi bilgisi ────────────────────────
  const { data: quote } = await service
    .from("corporate_quotes")
    .select("company_name, tax_office, tax_no, contact_person")
    .eq("order_id", orderId)
    .maybeSingle();

  return NextResponse.json({
    order: {
      id:               order.id,
      buyer_email:      order.buyer_email,
      order_type:       order.order_type,
      status:           order.status,
      total_seeds:      order.total_seeds,
      total_price:      order.total_price,
      shipping_address: order.shipping_address,
      created_at:       order.created_at,
    },
    allocations: (allocations ?? []) as unknown as Array<{
      seeds_allocated: number;
      lands: { name: string; region: string | null } | null;
    }>,
    buyerProfile: profile ?? null,
    corporateQuote: quote ?? null,
  });
}
