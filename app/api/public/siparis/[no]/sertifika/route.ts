import { NextRequest } from "next/server";
import { orderCookieName } from "@/lib/orders/access";
import { getAuthorizedOrder } from "@/lib/orders/view-data";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getPublicCertificate } from "@/lib/certificates/data";
import { renderCertificate } from "@/lib/certificates/render";
export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const token = req.cookies.get(orderCookieName(no.trim().toUpperCase()))?.value ?? null;
  let userId: string | null = null;
  if (!token) { const auth = await createSupabaseServer(); userId = (await auth.auth.getUser()).data.user?.id ?? null; }
  const order = await getAuthorizedOrder(no, { token, userId });
  const certificate = order?.paid_at && order.certificate_code ? await getPublicCertificate(order.certificate_code) : null;
  if (!order || !certificate) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
  const lang = req.nextUrl.searchParams.get("dil");
  const response = await renderCertificate({ ...certificate, displayName: order.certificate_name }, lang === "en" || lang === "ru" ? lang : "tr", "dikey");
  response.headers.set("Content-Disposition", 'attachment; filename="katilim-sertifikasi.png"');
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
