import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createSupabaseServer } from "@/lib/supabase/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";

/**
 * POST /api/auth/claim-orders — misafir olarak verilmiş siparişleri, aynı e-postayla açılan
 * (ya da zaten var olan) hesaba bağlar. Gövde yok.
 *
 * Güvenlik:
 *  - Oturum zorunlu; kimlik ve e-posta çerezdeki oturumdan okunur, gövdeden alınmaz.
 *  - Hesabın e-postası DOĞRULANMIŞ olmalı: doğrulanmamış bir adresle açılan hesap, o adrese
 *    ait siparişleri göremez. (Doğrulanmış posta kutusu = sipariş e-postasındaki bağlantıyla
 *    aynı güven düzeyi.)
 *  - Yalnız sahipsiz (user_id NULL) siparişler bağlanır; başka hesaba bağlı sipariş değişmez.
 *  - Yinelenebilir; kişisel veri loglanmaz.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(`claim-orders:${getClientIP(req)}`, 20, 10 * 60_000);
  if (limited) return limited;

  const auth = await createSupabaseServer();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.email_confirmed_at) return NextResponse.json({ ok: true, linked: 0, reason: "email_unverified" });

  const email = user.email.trim().toLowerCase();
  const service = createServiceRoleClient();
  const { data, error: updateError } = await service
    .from("release_orders")
    .update({ user_id: user.id })
    .is("user_id", null)
    // Sipariş e-postası şemada küçük harfe çevrilerek saklanır → birebir eşleşme yeterli ve kesindir.
    .eq("buyer_email", email)
    .select("id");
  if (updateError) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, linked: data?.length ?? 0 });
}
