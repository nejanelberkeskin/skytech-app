import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient, createSupabaseServer } from "@/lib/supabase/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  // ── Rate Limit: 20 reserve attempts per IP per minute ─────────────
  const rateLimitError = rateLimit(`reserve:${getClientIP(req)}`, 20, 60_000);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { buyer_email, preferred_land_id, requested_seeds } = body;

    if (!buyer_email || !preferred_land_id || !requested_seeds) {
      return NextResponse.json(
        { error: "buyer_email, preferred_land_id ve requested_seeds zorunludur." },
        { status: 400 }
      );
    }

    if (requested_seeds <= 0 || requested_seeds > 100_000) {
      return NextResponse.json(
        { error: "Tohum adedi 1-100000 aralığında olmalıdır." },
        { status: 400 }
      );
    }

    // ── Auth context: varsa session user'ın org_id'sini ekle.
    // org_id ASLA body'den alınmaz — saldırgan başkasının org'una sipariş
    // ekleyemesin. Login değilse org_id NULL (misafir order'ı).
    let orgId: string | null = null;
    let authUserId: string | null = null;
    try {
      const authClient = await createSupabaseServer();
      const { data: { user } } = await authClient.auth.getUser();
      if (user) {
        authUserId = user.id;
        const svc = createServiceRoleClient();
        const { data: profile } = await svc
          .from("profiles")
          .select("org_id")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.org_id) orgId = profile.org_id;
      }
    } catch {
      // auth okunamadıysa misafir olarak devam
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
        org_id:      orgId,                  // session profile'dan; body'den gelmiyor
        user_id:     authUserId,             // login ise session.user.id; misafir ise NULL
        referred_by: referredBy ?? null,
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