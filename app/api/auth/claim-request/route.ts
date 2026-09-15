import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createSupabaseServer } from "@/lib/supabase/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";

/**
 * POST /api/auth/claim-request — misafir olarak oluşturulan talebi, sonradan
 * açılan hesaba bağlar.
 *
 * Gövde: { requestId }   (talebin UUID'si — yalnız talep sahibine gösterilir,
 *                          tahmin edilemez)
 *
 * Güvenlik:
 *  - Oturum zorunlu; kullanıcı kimliği çerezden okunur, gövdeden alınmaz.
 *  - Talep e-postası ile hesap e-postası (küçük harf) eşleşmeli.
 *  - Talep zaten başka bir hesaba bağlıysa 409; aynı hesaba bağlıysa idempotent.
 *  - PII loglanmaz.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(`claim-request:${getClientIP(req)}`, 20, 10 * 60_000);
  if (limited) return limited;

  let body: { requestId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
    return NextResponse.json({ error: "invalid_request_id" }, { status: 400 });
  }

  const auth = await createSupabaseServer();
  const { data: { user }, error: userErr } = await auth.auth.getUser();
  if (userErr || !user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userEmail = user.email.toLowerCase().trim();

  const service = createServiceRoleClient();
  const { data: request, error } = await service
    .from("service_requests")
    .select("id, email, user_id")
    .eq("id", requestId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (!request) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (request.user_id) {
    if (request.user_id === user.id) return NextResponse.json({ ok: true, already: true });
    return NextResponse.json({ error: "conflict" }, { status: 409 });
  }

  const requestEmail = (request.email as string | null)?.toLowerCase().trim() ?? "";
  if (!requestEmail || requestEmail !== userEmail) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error: updErr } = await service
    .from("service_requests")
    .update({ user_id: user.id })
    .eq("id", requestId)
    .is("user_id", null);

  if (updErr) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
