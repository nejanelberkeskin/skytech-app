import { NextRequest } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { documentFileName, loadStoredDocuments, storedDocumentToPdf } from "@/lib/orders/after-payment";
import { db } from "@/lib/orders/store";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/orders/types";
import { getAuthorizedOrder } from "@/lib/orders/view-data";

/**
 * GET /api/public/siparis/[no]/belge/[kind]?t=<belirteç>&bicim=html|pdf
 *
 * Siparişe özel hukuki belgenin müşteri kopyası. Yetki: e-postadaki imzalı belirteç ya da
 * oturumdaki sipariş sahibi; yetkisiz istek ile "yok" aynı yanıtı alır (404).
 *
 *  • html → sipariş anında saklanan DEĞİŞMEZ kopya, olduğu gibi (SHA-256 özeti bu metne aittir).
 *  • pdf  → aynı anda saklanan yapısal kaynaktan üretilir; şablonlar sonradan değişse de
 *           içerik müşterinin onayladığı metindir.
 *
 * Belge kişisel veri içerir: önbelleğe alınmaz, dizine eklenmez, başka siteye referans
 * taşımaz. HTML, betik çalıştıramayan bir kum havuzunda (CSP sandbox) sunulur.
 */
export const runtime = "nodejs";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

const notFound = () => new Response(null, { status: 404, headers: PRIVATE_HEADERS });

export async function GET(req: NextRequest, { params }: { params: Promise<{ no: string; kind: string }> }) {
  const { no, kind } = await params;
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) return notFound();

  const limited = rateLimit(`siparis-belge:${getClientIP(req)}`, 60, 10 * 60_000);
  if (limited) return limited;

  const token = req.nextUrl.searchParams.get("t");
  let userId: string | null = null;
  if (!token) {
    try {
      const auth = await createSupabaseServer();
      userId = (await auth.auth.getUser()).data.user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  const supabase = db();
  const order = await getAuthorizedOrder(no, { token, userId }, supabase);
  // Sözleşmesi kurulmamış (ödenmemiş) siparişin belgesi verilmez.
  if (!order || !order.paid_at) return notFound();

  if (req.nextUrl.searchParams.get("bicim") === "pdf") {
    const stored = await loadStoredDocuments(supabase, order.id);
    const doc = stored?.documents.find((d) => d.kind === kind);
    if (!stored || !doc) return notFound();
    const pdf = storedDocumentToPdf(doc, stored.version, new Date(order.created_at));
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${documentFileName(kind, order.order_no, "pdf")}"`,
      },
    });
  }

  const { data, error } = await supabase
    .from("order_documents")
    .select("html")
    .eq("order_id", order.id)
    .eq("kind", kind as DocumentKind)
    .maybeSingle();
  if (error || !data) return notFound();

  return new Response(data.html as string, {
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${documentFileName(kind, order.order_no, "html")}"`,
      "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
    },
  });
}
