import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";
import { runPostPaymentChain } from "@/lib/order/post-payment";

/**
 * Admin Orders API
 *
 * GET  — Siparişleri listele (filtreler: ?status=, ?type=, ?page=, ?q=)
 * GET  — Tek sipariş detayı (?id=xxx)
 */

export async function GET(req: NextRequest) {
  const { error: authError } = await requireAdmin(req, ["SUPER_ADMIN", "FINANCE", "OPERATIONS"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const { searchParams } = new URL(req.url);

  const id     = searchParams.get("id");
  const status = searchParams.get("status");
  const type   = searchParams.get("type");    // "physical" | "reservation"
  const q      = searchParams.get("q");        // e-posta araması
  const page   = parseInt(searchParams.get("page") ?? "1", 10);
  const limit  = parseInt(searchParams.get("limit") ?? "30", 10);
  const offset = (page - 1) * limit;

  // ── Tek sipariş detayı ────────────────────────────────────────────────────
  if (id) {
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    }

    // Allocations (hangi araziye atandı)
    const { data: allocations } = await supabase
      .from("order_allocations")
      .select(`
        id,
        land_id,
        seeds_allocated,
        status,
        created_at,
        lands ( name, region )
      `)
      .eq("order_id", id);

    // Kullanıcı bilgisi (varsa)
    let profile = null;
    if (order.user_id) {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, phone, city, address")
        .eq("id", order.user_id)
        .maybeSingle();
      profile = data;
    }

    return NextResponse.json({ order, allocations: allocations ?? [], profile });
  }

  // ── Sipariş listesi ───────────────────────────────────────────────────────
  let query = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (type)   query = query.eq("order_type", type);
  if (q)      query = query.ilike("buyer_email", `%${q}%`);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    orders: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}

// ── PUT — Sipariş durumu güncelle (kargo kodu ekle vb.) ───────────────────────
//
// Admin sipariş durumunu değiştirdiğinde:
//   - "confirmed" yapıldığında → Veri bütünlüğü zinciri tetiklenir
//     (allocations confirmed, profil sayaçları, sertifika, arazi kontrolü)
//   - payment_status da güncellenebilir
//
export async function PUT(req: NextRequest) {
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN", "FINANCE", "OPERATIONS"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const body = await req.json();
  const { id, status, tracking_code, payment_status } = body;

  if (!id) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  }

  // ── Mevcut siparişi oku (zincir çalıştırmak için gerekli) ─────────────────
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("status, payment_status, user_id, total_seeds, order_type, buyer_email")
    .eq("id", id)
    .single();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (status != null)         updates.status = status;
  if (tracking_code != null)  updates.tracking_code = tracking_code;
  if (payment_status != null) updates.payment_status = payment_status;

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(supabase, {
    admin: admin!,
    action: "UPDATE",
    entity: "order",
    entityId: id,
    details: updates,
    ip: getClientIP(req),
  });

  /* ── VERİ BÜTÜNLÜĞÜ: Status "confirmed" yapıldığında zinciri çalıştır ──
     Admin panelden sipariş onaylandığında:
     1. order_allocations: "reserved" → "confirmed"
     2. profiles: tohum + karbon sayacı güncelle
     3. certificates: otomatik oluştur
     4. lands: kapasite kontrol
     Sadece status GERÇEKTEN değiştiyse ve user_id varsa çalışır.
  ─────────────────────────────────────────────────────────────────────────── */
  const wasConfirmed =
    status === "confirmed" &&
    existingOrder?.status !== "confirmed" &&
    existingOrder?.user_id;

  const wasPaid =
    payment_status === "paid" &&
    existingOrder?.payment_status !== "paid" &&
    existingOrder?.user_id;

  if ((wasConfirmed || wasPaid) && existingOrder?.user_id) {
    void (async () => {
      try {
        const chainResult = await runPostPaymentChain({
          supabase,
          orderId: id,
          userId: existingOrder.user_id,
          totalSeeds: existingOrder.total_seeds ?? 0,
          orderType: existingOrder.order_type || "physical",
          buyerEmail: existingOrder.buyer_email ?? "",
          metadata: {},
        });
        console.log("[admin/orders] 🔗 Veri zinciri sonucu:", JSON.stringify(chainResult));
      } catch (chainErr) {
        console.error("[admin/orders] ⚠️ Veri zinciri hatası:", chainErr);
      }
    })();
  }

  return NextResponse.json(data);
}
