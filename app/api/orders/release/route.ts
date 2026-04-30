import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  // ── Rate Limit: 20 release attempts per IP per minute ─────────────
  const rateLimitError = rateLimit(`release:${getClientIP(req)}`, 20, 60_000);
  if (rateLimitError) return rateLimitError;

  try {
    const { order_id } = await req.json();

    if (!order_id) {
      return NextResponse.json({ error: "order_id zorunludur." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { error } = await supabase.rpc("release_order_reservation", {
      p_order_id: order_id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Release error:", err);
    return NextResponse.json({ error: "Sunucu hatasi." }, { status: 500 });
  }
}
