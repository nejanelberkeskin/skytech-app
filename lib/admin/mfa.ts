/**
 * Oturumun güvence seviyesi — YALNIZ SUNUCU.
 *
 * Kayıt ve doğrulama arayüzde Supabase istemcisiyle yapılır; sunucu yalnız oturumun `aal2` olup olmadığını
 * ve en son ne zaman doğrulandığını okur. Belirteç Supabase tarafından doğrulanır (`getClaims`).
 */
import { createSupabaseServer } from "@/lib/supabase/server";

export interface Assurance {
  aal: "aal1" | "aal2";
  /** En son kimlik doğrulama adımının zamanı (TOTP varsa onunki). */
  verifiedAt: string | null;
  /** Kişinin doğrulanmış bir MFA aygıtı var mı? */
  enrolled: boolean;
}

export const NO_ASSURANCE: Assurance = { aal: "aal1", verifiedAt: null, enrolled: false };

interface AmrEntry {
  method?: unknown;
  timestamp?: unknown;
}

/** `amr` içindeki en son (ve varsa MFA olan) adımın zamanı. */
export function verifiedAtFrom(amr: unknown, aal: string | undefined): string | null {
  if (!Array.isArray(amr)) return null;
  const entries = (amr as AmrEntry[])
    .filter((e) => typeof e.timestamp === "number")
    .map((e) => ({ method: String(e.method ?? ""), at: (e.timestamp as number) * 1000 }));
  if (!entries.length) return null;
  const mfaMethods = entries.filter((e) => e.method === "totp" || e.method === "mfa" || e.method.startsWith("mfa/"));
  const pool = aal === "aal2" && mfaMethods.length ? mfaMethods : entries;
  return new Date(Math.max(...pool.map((e) => e.at))).toISOString();
}

export async function sessionAssurance(): Promise<Assurance> {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return NO_ASSURANCE;
    const claims = data.claims as Record<string, unknown>;
    const aal = claims.aal === "aal2" ? "aal2" : "aal1";
    const factors = await supabase.auth.mfa.listFactors();
    const enrolled = Boolean(factors.data?.totp?.length) || aal === "aal2";
    return { aal, verifiedAt: verifiedAtFrom(claims.amr, aal), enrolled };
  } catch {
    return NO_ASSURANCE;
  }
}
