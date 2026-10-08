import { NextRequest } from "next/server";
import { z } from "zod";
import { failFrom, isServiceError, readJson, staffService } from "@/lib/admin/staff-http";
import { createSupabaseServer } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/api/envelope";

/**
 * POST /api/public/davet/kabul — daveti kabul eder (web-brifler/19 §6.3).
 * Kişi kendi oturumuyla gelir; e-posta davetle eşleşmeli. Şifre oluşturulmaz, mevcut hesabın şifresi değişmez.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().trim().min(20).max(200), fullName: z.string().trim().min(2).max(120).optional() }).strict();

export async function POST(request: NextRequest) {
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return fail(400, "invalid_body", "Geçersiz istek: davet bağlantısı eksik.");
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return fail(401, "unauthenticated", "Daveti kabul etmek için önce kendi hesabınızla giriş yapın.");
  const result = await staffService().acceptInvitation(body.data.token, data.user.id, data.user.email, body.data.fullName ?? "");
  if (isServiceError(result)) return failFrom(result);
  const accepted = result.data as { admin?: { id?: string; full_name?: string; role?: string } };
  return ok({ staffId: accepted.admin?.id ?? null, fullName: accepted.admin?.full_name ?? null, legacyRole: accepted.admin?.role ?? null });
}
