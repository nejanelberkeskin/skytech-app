import { after, NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { mfaEnforced, mfaSatisfied, requirePermission } from "@/lib/admin/permissions";
import { auditLog } from "@/lib/admin/audit";
import { fail, ok, unavailable } from "@/lib/api/envelope";
import {
  cancelBySeller,
  executeRefund,
  markInvoiceIssued,
  queueInvoice,
  refundDuplicate,
  reserveCapacityNow,
  type AdminActionResult,
} from "@/lib/orders/admin-actions";
import { ACTION_PERMISSION, LEGACY_REFUND_ROLES, isRefundAction, orderReadScope, readMfaState } from "@/lib/orders/admin-access";
import { loadOrderDetail } from "@/lib/orders/admin-detail";
import { sendRefundCompletedEmail, sendSellerCancellationEmail } from "@/lib/orders/admin-mails";
import { addOrderEvent } from "@/lib/orders/store";
import type { ReleaseOrderRow } from "@/lib/orders/types";

/**
 * Admin — Bırakma siparişi (ayrıntı + işlemler). Sözleşme: web-brifler/27.
 *
 * GET  /api/admin/release-orders/[id] → Ok<OrderDetailDto>
 *      İzin: orders.read (all ya da sites). Hassas gruplar (iletişim, vergi, finans, fatura, hukuki kayıt,
 *      özel sertifika) kendi izinleriyle ve bu siparişin sahasını kapsıyorsa eklenir. Kapsam dışı → 404.
 *      Mevcut MFA kuralı okumada da geçerli: zorlama açıkken oturum tazelenmemişse vergi, hukuki kayıt ve
 *      özel sertifika grupları sorgulanmaz, dönmez; `mfaRequiredGroups` ve `mfa` arayüze bildirir (27 §4.5).
 * POST /api/admin/release-orders/[id]  { action, … } → Ok<{ status }>
 *      note              { note }                      — orders.note
 *      cancel_by_seller  { reason }                    — orders.cancel (+MFA)
 *      refund            {}                            — refunds.execute (+MFA) + eski SUPER_ADMIN/FINANCE
 *      refund_duplicate  { paymentId }                 — aynı
 *      invoice_now       {}                            — invoices.manage
 *      reserve_capacity  {}                            — sites.capacity.manage (+MFA)
 *      invoice_issued    { invoiceId, invoiceNo, ettn?, issuedOn } — invoices.manage
 *      Eylemler yalnız tam kapsam. Reddedilen istekte iş servisi, sağlayıcı, e-posta ve audit çağrılmaz.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// İade eylemleri sağlayıcıyı çağırır (en çok 3 × 15 sn); süre sınırı açık yazılır ki çağrı yarıda kesilmesin.
export const maxDuration = 60;

const invalidId = () => fail(400, "invalid_id", "Geçersiz sipariş kimliği.");
const readScopeUnsupported = () =>
  fail(403, "scope_unsupported", "Sipariş okuma yetkiniz yalnız kişiye atanmış işleri kapsıyor; bu ekran henüz atanmış işleri desteklemiyor.", {
    permission: "orders.read",
    permissions: ["orders.read"],
  });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "orders.read", { scope: "any" });
  if (guard.error) return guard.error;
  const read = orderReadScope(guard.access);
  if (!read) return readScopeUnsupported();
  const { id } = await params;
  if (!UUID_RE.test(id)) return invalidId();

  const mfa = readMfaState(mfaEnforced(), guard.assurance, (permission) => mfaSatisfied(permission, guard.assurance));
  const result = await loadOrderDetail(createServiceRoleClient(), id, guard.access, read, guard.admin.role, mfa);
  if (!result.ok) return result.error === "not_found" ? fail(404, "not_found", "Sipariş bulunamadı.") : unavailable();
  return ok(result.detail);
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

/** İş hataları (değişmedi) → HTTP ve kullanıcıya gösterilebilir mesaj. */
const ACTION_ERRORS: Record<string, [number, string]> = {
  not_found: [404, "Kayıt bulunamadı."],
  invalid_state: [409, "Sipariş bu işlem için uygun durumda değil."],
  in_progress: [409, "Bu iade şu anda işleniyor; birkaç dakika sonra yeniden deneyin."],
  already_done: [409, "Bu işlem daha önce yapılmış."],
  provider_unavailable: [503, "Ödemenin alındığı sağlayıcı bu ortamda yapılandırılmamış."],
  provider_error: [502, "Ödeme sağlayıcısı işlemi reddetti."],
  unavailable: [503, "Şu anda işlenemiyor; yeniden deneyin."],
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Önce oturum ve aktif personel (izin sorgusu yok); eylemin izni gövde okunduktan sonra (27 §2).
  const session = await requireAdmin(request);
  if (session.error || !session.admin) {
    const status = session.error?.status ?? 401;
    if (status === 401) return fail(401, "unauthenticated", "Oturum bulunamadı. Lütfen giriş yapın.");
    if (status === 403) return fail(403, "forbidden", "Bu işlem için yetkiniz yok.");
    return fail(503, "unavailable", "Kimlik doğrulanamadı. Lütfen yeniden deneyin.");
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) return invalidId();

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(400, "invalid_body", "Eksik ya da hatalı bilgi.", {
      fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "body"))],
    });
  }
  const input = parsed.data;

  // İade talebi SQL 019'da eski rolü denetler; API aynı sınırı izin sorgusundan önce korur (rol yükseltmesi yok).
  if (isRefundAction(input.action) && !LEGACY_REFUND_ROLES.includes(session.admin.role)) {
    return fail(403, "forbidden", "İade bu yoldan yalnız finans ya da sistem sahibi rolüyle yapılabilir.", { reason: "legacy_role" });
  }
  // Eylemin izni: tam kapsam + (hassas izinde) yeniden doğrulanmış oturum. Eski rol listesi kapı değildir.
  const guard = await requirePermission(request, ACTION_PERMISSION[input.action]);
  if (guard.error) return guard.error;
  const admin = guard.admin;

  const supabase = createServiceRoleClient();
  const ip = getClientIP(request);
  let result: AdminActionResult;
  let details: Record<string, unknown> = {};

  if (input.action === "note") {
    const note = input.note.trim() || null;
    const { data, error } = await supabase.from("release_orders").update({ admin_note: note }).eq("id", id).select("*").maybeSingle();
    if (error) return unavailable();
    if (!data) return fail(404, "not_found", "Kayıt bulunamadı.");
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

  if (!result.ok) {
    const [status, message] = ACTION_ERRORS[result.error] ?? [400, "İşlem tamamlanamadı."];
    return fail(status, result.error, message, result.detail ? { detail: result.detail } : undefined);
  }
  return ok({ status: result.order.status }, warnings);
}
