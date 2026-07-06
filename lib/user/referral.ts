/**
 * Referral kod üretimi helper'ı — callback ve claim-order'da ortak kullanılır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kullanıcının referral kodu yoksa DB fonksiyonuyla üretir ve kaydeder.
 * Hata durumunda null döner, caller'ı asla patlatmaz.
 */
export async function ensureReferralCode(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();

  if (profile?.referral_code) return profile.referral_code;

  const { data: codeResult } = await supabase.rpc("generate_referral_code");

  if (codeResult) {
    await supabase
      .from("profiles")
      .update({ referral_code: codeResult })
      .eq("id", userId);
    return codeResult as string;
  }

  return null;
}
