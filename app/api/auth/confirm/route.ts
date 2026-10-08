import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * GET /api/auth/confirm?token_hash=…&type=…&next=/hesabim
 *
 * Supabase e-posta bağlantılarını (kayıt doğrulama, şifre kurtarma, magic
 * link) SUNUCUDA doğrular ve oturum çerezini yazar. Tarayıcıya bağlı PKCE
 * kod doğrulayıcısı gerekmediği için bağlantı başka cihazda / posta
 * uygulamasında açılsa da çalışır.
 *
 * Supabase e-posta şablonlarında bağlantı şu biçimde olmalı:
 *   {{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/sifre-yenile
 *   {{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/hesabim
 *
 * Güvenlik: `type` beyaz liste; `next` yalnız site içi yol; token loglanmaz.
 */
const ALLOWED_TYPES: ReadonlySet<string> = new Set(["signup", "recovery", "invite", "magiclink", "email_change", "email"]);

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"), "/hesabim");
  const prefix = next.match(/^\/(en|ru)(?:\/|$)/)?.[0].replace(/\/$/, "") ?? "";
  const isRecovery = type === "recovery";

  const failTarget = prefix + (isRecovery ? "/auth/sifre-yenile?error=invalid" : "/auth/login?error=confirm");

  if (!tokenHash || !type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.redirect(new URL(failTarget, origin));
  }

  try {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (error) {
      return NextResponse.redirect(new URL(failTarget, origin));
    }
  } catch {
    return NextResponse.redirect(new URL(failTarget, origin));
  }

  return NextResponse.redirect(new URL(isRecovery ? `${prefix}/auth/sifre-yenile` : next, origin));
}
