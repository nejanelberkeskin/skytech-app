/**
 * GET /api/public/referral/[code]
 *
 * Herkese açık referral kodu sorgulama.
 * Davet linki açıldığında landing page'e referrer adını göstermek için kullanılır.
 *
 * Güvenlik:
 *   - Kimlik doğrulama gerektirmez (public)
 *   - Sadece first_name + display_name döner — hassas alan yok
 *   - 404 vague mesajla döner
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code?.trim() || code.length < 4) {
    return NextResponse.json({ error: "Geçersiz davet kodu." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, earned_seeds")
    .eq("referral_code", code.toUpperCase())
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Davet kodu bulunamadı." }, { status: 404 });
  }

  // Sadece gösterim için güvenli alanlar
  const firstName = profile.full_name?.split(" ")[0] ?? "Bir üye";

  return NextResponse.json({
    referrerFirstName: firstName,
    referrerDisplayName: profile.full_name ?? "Bir üye",
  });
}
