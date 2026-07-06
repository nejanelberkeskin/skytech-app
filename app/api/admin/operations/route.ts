import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendSeedPlantedEmail } from "@/lib/mail";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * Admin Operations (Drone Ekim) API
 *
 * GET — Ekim kuyruğunu getir (confirmed ama henüz planted olmayan allocations)
 * PUT — Seçili allocation'ları PLANTED olarak işaretle + e-posta gönder
 */

// ── GET — Drone kuyruğu ───────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request, ["SUPER_ADMIN", "OPERATIONS"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();

  // order_allocations where status = 'confirmed' → planted değil, ekim bekliyor
  // Birlikte: orders ve lands bilgileri
  const { data, error } = await supabase
    .from("order_allocations")
    .select(`
      id,
      order_id,
      land_id,
      seeds,
      state,
      created_at,
      orders (
        id,
        buyer_email,
        order_type,
        total_seeds,
        total_price,
        status,
        shipping_address,
        user_id,
        created_at
      ),
      lands (
        id,
        name,
        region,
        filled_seeds,
        reserved_seeds,
        capacity_seeds
      )
    `)
    .eq("state", "confirmed")
    .order("created_at", { ascending: true }); // FIFO kuyruğu

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Kullanıcı adlarını profiles'dan çek (user_id varsa)
  const userIds = [
    ...new Set(
      (data ?? [])
        .map((row) => {
          const order = row.orders as { user_id?: string } | null;
          return order?.user_id;
        })
        .filter(Boolean) as string[]
    ),
  ];

  let profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.full_name])
    );
  }

  // Veriyi düz nesneye dönüştür
  const queue = (data ?? []).map((row) => {
    const order = (row.orders as unknown) as {
      id: string;
      buyer_email: string;
      order_type: string;
      total_seeds: number;
      total_price: number;
      status: string;
      shipping_address: string | null;
      user_id: string | null;
      created_at: string;
    } | null;

    const land = (row.lands as unknown) as {
      id: string;
      name: string;
      region: string | null;
      filled_seeds: number;
      reserved_seeds: number;
      capacity_seeds: number;
    } | null;

    return {
      allocation_id: row.id,
      order_id: row.order_id,
      land_id: row.land_id,
      seeds: row.seeds,
      allocation_status: row.state,
      queued_at: row.created_at,
      // Order bilgileri
      buyer_email: order?.buyer_email ?? "",
      buyer_name: order?.user_id ? profileMap[order.user_id] : undefined,
      order_type: order?.order_type ?? "",
      order_created_at: order?.created_at ?? "",
      // Arazi bilgileri
      land_name: land?.name ?? "",
      land_region: land?.region ?? "",
    };
  });

  return NextResponse.json(queue);
}

// ── PUT — Seçili tohumları PLANTED olarak işaretle ────────────────────────────
export async function PUT(req: NextRequest) {
  const { error: authError } = await requireAdmin(req, ["SUPER_ADMIN", "OPERATIONS"]);
  if (authError) return authError;
  const supabase = createServiceRoleClient();
  const body = await req.json();
  const { allocation_ids } = body as { allocation_ids: string[] };

  if (!allocation_ids || allocation_ids.length === 0) {
    return NextResponse.json(
      { error: "En az bir allocation_id gereklidir." },
      { status: 400 }
    );
  }

  // ── 1. Allocation detaylarını çek ─────────────────────────────────────────
  const { data: allocations, error: fetchErr } = await supabase
    .from("order_allocations")
    .select(`
      id,
      order_id,
      land_id,
      seeds,
      state,
      orders ( buyer_email, user_id, total_seeds ),
      lands ( name, region, filled_seeds, reserved_seeds )
    `)
    .in("id", allocation_ids)
    .eq("state", "confirmed");

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!allocations || allocations.length === 0) {
    return NextResponse.json(
      { error: "Belirtilen allocation'lar bulunamadı veya zaten işlendi." },
      { status: 404 }
    );
  }

  const plantedAt = new Date().toISOString();
  const errors: string[] = [];

  // ── 2. Her allocation için land güncelle ──────────────────────────────────
  for (const alloc of allocations) {
    const land = (alloc.lands as unknown) as {
      name: string;
      region: string | null;
      filled_seeds: number;
      reserved_seeds: number;
    } | null;

    if (!land) continue;

    const newFilled   = (land.filled_seeds   || 0) + alloc.seeds;
    const newReserved = Math.max((land.reserved_seeds || 0) - alloc.seeds, 0);

    const { error: landErr } = await supabase
      .from("lands")
      .update({ filled_seeds: newFilled, reserved_seeds: newReserved })
      .eq("id", alloc.land_id);

    if (landErr) {
      errors.push(`Arazi güncelleme hatası (${alloc.land_id}): ${landErr.message}`);
    }
  }

  // ── 3. Allocation'ları "planted" yap ──────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("order_allocations")
    .update({ state: "planted" })
    .in("id", allocation_ids);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // ── 4. E-posta gönder (her unique sipariş için bir kez) ───────────────────
  const processedOrderIds = new Set<string>();
  const emailResults: { order_id: string; success: boolean; error?: string }[] = [];

  // Kullanıcı adlarını çek
  const userIds = [
    ...new Set(
      allocations
        .map((a) => {
          const order = (a.orders as unknown) as { buyer_email: string; user_id?: string | null; total_seeds: number } | null;
          return order?.user_id;
        })
        .filter(Boolean) as string[]
    ),
  ];

  let profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.full_name])
    );
  }

  for (const alloc of allocations) {
    if (processedOrderIds.has(alloc.order_id)) continue;
    processedOrderIds.add(alloc.order_id);

    const order = (alloc.orders as unknown) as {
      buyer_email: string;
      user_id?: string | null;
      total_seeds: number;
    } | null;

    const land = (alloc.lands as unknown) as {
      name: string;
      region: string | null;
    } | null;

    if (!order || !land) continue;

    try {
      await sendSeedPlantedEmail({
        email: order.buyer_email,
        buyerName: order.user_id ? profileMap[order.user_id] : undefined,
        orderId: alloc.order_id,
        totalSeeds: alloc.seeds,
        landName: land.name,
        region: land.region || "Türkiye",
        plantedDate: plantedAt,
      });
      emailResults.push({ order_id: alloc.order_id, success: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
      emailResults.push({ order_id: alloc.order_id, success: false, error: msg });
    }
  }

  return NextResponse.json({
    success: true,
    planted_count: allocations.length,
    email_results: emailResults,
    warnings: errors,
  });
}
