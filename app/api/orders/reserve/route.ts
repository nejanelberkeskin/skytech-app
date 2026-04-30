import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  // ── Rate Limit: 20 reserve attempts per IP per minute ─────────────
  const rateLimitError = rateLimit(`reserve:${getClientIP(req)}`, 20, 60_000);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { buyer_email, preferred_land_id, requested_seeds, org_id } = body;

    if (!buyer_email || !preferred_land_id || !requested_seeds) {
      return NextResponse.json(
        { error: "buyer_email, preferred_land_id ve requested_seeds zorunludur." },
        { status: 400 }
      );
    }

    if (requested_seeds <= 0) {
      return NextResponse.json(
        { error: "Tohum adedi 0'dan büyük olmalıdır." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // ── Referral: ref_code cookie'den davet eden kullanıcıyı bul ──────────
    const refCode   = req.cookies.get("ref_code")?.value?.trim().toUpperCase() ?? null;
    let referredBy: string | null = null;

    if (refCode) {
      // Service role — RLS'yi atlayarak profiles tablosunu sorgula
      const service = createServiceRoleClient();
      const { data: referrer } = await service
        .from("profiles")
        .select("id")
        .eq("referral_code", refCode)
        .single();

      if (referrer?.id) {
        referredBy = referrer.id;
      }
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        buyer_email,
        total_seeds: requested_seeds,
        org_id:      org_id      ?? null,
        referred_by: referredBy  ?? null,   // Davet bağlantısı
        status: "pending",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: `Sipariş oluşturulamadı: ${orderError?.message}` },
        { status: 500 }
      );
    }

    const { data: allocations, error: reserveError } = await supabase.rpc(
      "reserve_seeds_for_order",
      {
        p_order_id: order.id,
        p_preferred_land_id: preferred_land_id,
        p_requested_seeds: requested_seeds,
      }
    );

    if (reserveError) {
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      const isCapacity = reserveError.message?.includes("INSUFFICIENT_CAPACITY");
      return NextResponse.json(
        { error: isCapacity ? "Yeterli kapasite yok." : reserveError.message },
        { status: isCapacity ? 409 : 500 }
      );
    }

    const landIds = (allocations as { land_id: string; seeds: number }[]).map((a) => a.land_id);
    const { data: landNames } = await supabase.from("lands").select("id, name").in("id", landIds);
    const nameMap = new Map((landNames ?? []).map((l: { id: string; name: string }) => [l.id, l.name]));

    return NextResponse.json({
      order_id: order.id,
      allocations: (allocations as { land_id: string; seeds: number }[]).map((a) => ({
        land_id: a.land_id,
        land_name: nameMap.get(a.land_id) ?? "Bilinmeyen",
        seeds: a.seeds,
      })),
      total_seeds:   requested_seeds,
      referral_applied: !!referredBy,   // İstemciye davet bağlandı bilgisi
    }, { status: 201 });

  } catch (err) {
    console.error("Reserve error:", err);
    return NextResponse.json({ error: "Beklenmeyen sunucu hatası." }, { status: 500 });
  }
}