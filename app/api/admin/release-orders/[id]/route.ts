import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";
import {
  cancelBySeller,
  executeRefund,
  markInvoiceIssued,
  queueInvoice,
  refundDuplicate,
  reserveCapacityNow,
  type AdminActionResult,
} from "@/lib/orders/admin-actions";
import { loadOrderDetail } from "@/lib/orders/admin-detail";
import { sendRefundCompletedEmail, sendSellerCancellationEmail } from "@/lib/orders/admin-mails";
import { addOrderEvent } from "@/lib/orders/store";
import type { ReleaseOrderRow } from "@/lib/orders/types";

/**
 * Admin — Bırakma siparişi (ayrıntı + işlemler)
 *
 * GET  /api/admin/release-orders/[id]
 *      → { order, documents, events, refunds, invoices, duplicates, batch }
 * POST /api/admin/release-orders/[id]  { action, … }
 *      note              { note }                      — yönetici notu (tüm roller)
 *      cancel_by_seller  { reason }                    — ifa edilemeyecek sipariş → iade bekler
 *      refund            {}                            — bekleyen iadeyi sağlayıcıdan yap
 *      refund_duplicate  { paymentId }                 — çift tahsilatı iade et
 *      invoice_now       {}                            — fatura kuyruğuna al
 *      reserve_capacity  {}                            — geç ödemede ayrılamamış kapasiteyi şimdi ayır
 *      invoice_issued    { invoiceId, invoiceNo, ettn?, issuedOn }
 *
 * Görüntüleme: SUPER_ADMIN, FINANCE, OPERATIONS. Para ve fatura işlemleri: SUPER_ADMIN, FINANCE.
 * OPERATIONS rolüne kimlik/vergi numarası maskeli gider. Her işlem admin_audit_logs'a yazılır.
 */
const VIEW_ROLES = ["SUPER_ADMIN", "FINANCE", "OPERATIONS"] as const;
const MONEY_ROLES = ["SUPER_ADMIN", "FINANCE"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// İade eylemleri sağlayıcıyı çağırır (en çok 3 × 15 sn); süre sınırı açık yazılır ki çağrı yarıda kesilmesin.
export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, error: authError } = await requireAdmin(request, [...VIEW_ROLES]);
  if (authError || !admin) return authError ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const result = await loadOrderDetail(createServiceRoleClient(), id, (MONEY_ROLES as readonly string[]).includes(admin.role));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 503 });
  return NextResponse.json(result.detail);
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("note"), note: z.string().max(4000) }),
  z.object({ action: z.literal("cancel_by_seller"), reason: z.string().trim().min(5).max(1000) }),
  z.object({ action: z.literal("refund") }),
  z.object({ action: z.literal("refund_duplicate"), paymentId: z.string().trim().min(1).max(100) }),
  z.object({ action: z.literal("invoice_now") }),
  z.object({ action: z.literal("reserve_capacity") }),
  z.object({
    action: z.literal("invoice_issued"),
    invoiceId: z.uuid(),
    invoiceNo: z.string().trim().min(3).max(40),
    ettn: z.string().trim().max(60).nullable().optional(),
    issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

const STATUS_FOR: Record<string, number> = {
  not_found: 404,
  invalid_state: 409,
  in_progress: 409,
  already_done: 409,
  provider_unavailable: 503,
  provider_error: 502,
  unavailable: 503,
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, error: authError } = await requireAdmin(request, [...VIEW_ROLES]);
  if (authError || !admin) return authError ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const input = parsed.data;

  // Not ve kapasite ayırma para hareketi değildir; görüntüleyebilen her rol yapabilir.
  if (input.action !== "note" && input.action !== "reserve_capacity" && !(MONEY_ROLES as readonly string[]).includes(admin.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createServiceRoleClient();
  const ip = getClientIP(request);
  let result: AdminActionResult;
  let details: Record<string, unknown> = {};

  if (input.action === "note") {
    const note = input.note.trim() || null;
    const { data, error } = await supabase.from("release_orders").update({ admin_note: note }).eq("id", id).select("*").maybeSingle();
    if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await addOrderEvent(supabase, id, "admin_note", `admin:${admin.user_id}`, { note });
    result = { ok: true, order: data as ReleaseOrderRow };
    details = { noteChanged: true };
  } else if (input.action === "cancel_by_seller") {
    result = await cancelBySeller(id, input.reason, admin.user_id, supabase);
    details = { reason: input.reason };
    if (result.ok) {
      const order = result.order;
      after(() => sendSellerCancellationEmail(order));
    }
  } else if (input.action === "refund") {
    result = await executeRefund(id, admin.user_id, ip === "unknown" ? null : ip, supabase);
    if (result.ok) {
      const order = result.order;
      details = { amountKurus: order.total_kurus };
      after(() => sendRefundCompletedEmail(order));
    }
  } else if (input.action === "refund_duplicate") {
    result = await refundDuplicate(id, input.paymentId, admin.user_id, ip === "unknown" ? null : ip, supabase);
    details = { paymentId: input.paymentId };
  } else if (input.action === "invoice_now") {
    result = await queueInvoice(id, admin.user_id, supabase);
  } else if (input.action === "reserve_capacity") {
    result = await reserveCapacityNow(id, admin.user_id, supabase);
  } else {
    result = await markInvoiceIssued(id, { invoiceId: input.invoiceId, invoiceNo: input.invoiceNo, ettn: input.ettn ?? null, issuedOn: input.issuedOn }, admin.user_id, supabase);
    details = { invoiceNo: input.invoiceNo };
  }

  const warnings = await auditLog(supabase, {
    admin,
    action: "UPDATE",
    entity: "release_order",
    entityId: id,
    details: { action: input.action, ok: result.ok, ...(result.ok ? {} : { error: result.error }), ...details },
    ip,
  });

  if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail ?? null }, { status: STATUS_FOR[result.error] ?? 400 });
  return NextResponse.json({ ok: true, status: result.order.status, warnings });
}
