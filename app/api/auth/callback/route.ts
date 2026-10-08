import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * GET /api/auth/callback?code=…&next=/hesabim
 *
 * OAuth (Google) dönüşü ve varsayılan Supabase şablonlarının `?code=`
 * yönlendirmesi için PKCE kod değişimi. Kod doğrulayıcısı bağlantıyı
 * başlatan tarayıcının çerezinde durur; bu yüzden aynı tarayıcıda çalışır.
 * Cihazdan bağımsız e-posta bağlantıları için /api/auth/confirm kullanılır.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), "/hesabim");

  const prefix = next.match(/^\/(en|ru)(?:\/|$)/)?.[0].replace(/\/$/, "") ?? "";

  // Kod yok ya da değişim başarısız (ör. bağlantı başka cihazda açıldı):
  // hesap Supabase tarafında doğrulanmış olabilir → giriş sayfasına yönlendir.
  const fail = new URL(`${prefix}/auth/login?error=link`, origin);
  if (!code) return NextResponse.redirect(fail);

  try {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(fail);
  } catch {
    return NextResponse.redirect(fail);
  }

  return NextResponse.redirect(new URL(next, origin));
}
