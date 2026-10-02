/** Owner-facing order summary. Staff access uses the same three permissions as stored documents. */
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createSupabaseServer } from "@/lib/supabase/server";
import { hasFullScope, hasPermission, requirePermission } from "@/lib/admin/permissions";
import { DOCUMENT_PERMISSIONS } from "@/lib/orders/admin-access";

export const dynamic = "force-dynamic";
const HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS });
const unavailable = () => reply({ error: "Belge bilgileri alınamadı. Daha sonra yeniden deneyin." }, 503);

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    if (!orderId?.trim()) return reply({ error: "orderId zorunludur." }, 400);
    const auth = await createSupabaseServer();
    // Verify with Auth; an unverified cookie session is not proof of ownership.
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return reply({ error: "Oturum gerekli. Lütfen giriş yapın." }, 401);

    const db = createServiceRoleClient();
    // Only ownership metadata is read before the document permission gate.
    const { data: owner, error: ownerError } = await db.from("orders").select("id, user_id").eq("id", orderId).maybeSingle();
    if (ownerError) return unavailable();
    if (!owner) return reply({ error: "Sipariş bulunamadı." }, 404);
    if (owner.user_id !== user.id) {
      const guard = await requirePermission(request, "orders.documents.read");
      if (guard.error) {
        // Preserve this legacy page's {error: string} contract; never render an error object.
        const denied = await guard.error.json().catch(() => null);
        const mfa = denied?.error?.code === "mfa_required";
        return reply({
          error: mfa ? "Bu belgeyi görüntülemek için iki aşamalı doğrulamanızı yenileyin." : "Bu belgeyi görüntüleme yetkiniz yok veya kimliğiniz doğrulanamadı.",
          code: mfa ? "mfa_required" : "document_access_denied",
        }, guard.error.status);
      }
      if (guard.admin.user_id !== user.id || DOCUMENT_PERMISSIONS.some(permission =>
        !hasPermission(guard.access, permission) || !hasFullScope(guard.access, permission))) {
        return reply({ error: "Bu belgeyi görüntüleme yetkiniz yok." }, 403);
      }
    }

    let orderQuery = db.from("orders").select("id, user_id, buyer_email, order_type, status, total_seeds, total_price, shipping_address, created_at").eq("id", orderId);
    // A reassignment between reads must not expose another customer's document to the old owner.
    orderQuery = owner.user_id === null ? orderQuery.is("user_id", null) : orderQuery.eq("user_id", owner.user_id);
    const { data: order, error: orderError } = await orderQuery.maybeSingle();
    if (orderError) return unavailable();
    if (!order) return reply({ error: "Sipariş bulunamadı." }, 404);
    const [allocations, profile, quote] = await Promise.all([
      db.from("order_allocations").select("seeds_allocated, lands(name, region)").eq("order_id", orderId),
      order.user_id ? db.from("profiles").select("full_name, phone, address, city").eq("id", order.user_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      db.from("corporate_quotes").select("company_name, tax_office, tax_no, contact_person").eq("order_id", orderId).maybeSingle(),
    ]);
    if (allocations.error || profile.error || quote.error) return unavailable();
    return reply({
      order: { id: order.id, buyer_email: order.buyer_email, order_type: order.order_type, status: order.status,
        total_seeds: order.total_seeds, total_price: order.total_price, shipping_address: order.shipping_address, created_at: order.created_at },
      allocations: allocations.data ?? [], buyerProfile: profile.data ?? null, corporateQuote: quote.data ?? null,
    });
  } catch { return unavailable(); }
}
