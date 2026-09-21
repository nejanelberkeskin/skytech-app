import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { documentFileName, loadStoredDocuments, storedDocumentToPdf } from "@/lib/orders/after-payment";
import { DOCUMENT_KINDS } from "@/lib/orders/types";

/**
 * GET /api/admin/release-orders/[id]/belge/[kind]?bicim=html|pdf — siparişe özel belgenin
 * yönetim kopyası (müşteriye giden ile AYNI saklanan içerik). Roller: SUPER_ADMIN, FINANCE, OPERATIONS.
 */
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } as const;
const notFound = () => new Response(null, { status: 404, headers: HEADERS });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { error: authError } = await requireAdmin(request, ["SUPER_ADMIN", "FINANCE", "OPERATIONS"]);
  if (authError) return authError;
  const { id, kind } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(DOCUMENT_KINDS as readonly string[]).includes(kind)) return notFound();

  const supabase = createServiceRoleClient();
  const { data: order } = await supabase.from("release_orders").select("id, order_no, created_at").eq("id", id).maybeSingle();
  if (!order) return notFound();

  if (new URL(request.url).searchParams.get("bicim") === "pdf") {
    const stored = await loadStoredDocuments(supabase, id);
    const doc = stored?.documents.find((d) => d.kind === kind);
    if (!stored || !doc) return notFound();
    const pdf = storedDocumentToPdf(doc, stored.version, new Date(order.created_at as string));
    return new Response(new Uint8Array(pdf), {
      headers: { ...HEADERS, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${documentFileName(kind, order.order_no as string, "pdf")}"` },
    });
  }

  const { data } = await supabase.from("order_documents").select("html").eq("order_id", id).eq("kind", kind).maybeSingle();
  if (!data) return notFound();
  return new Response(data.html as string, {
    headers: { ...HEADERS, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'" },
  });
}
