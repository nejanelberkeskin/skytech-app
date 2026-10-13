import type { NextRequest } from "next/server";
import { after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getClientIP } from "@/lib/admin-auth";
import { requirePermission } from "@/lib/admin/permissions";
import { auditLog } from "@/lib/admin/audit";
import { fail, ok, unavailable } from "@/lib/api/envelope";
import {
  CORPORATE_ACCOUNT_COLUMNS,
  CORPORATE_STATUSES,
  corporateAccountOf,
  corporateDecisionSchema,
  type CorporateStatus,
} from "@/lib/corporate/accounts";
import { sendCorporateDecision } from "@/lib/mail";

/**
 * Yönetim — Kurumsal hesap başvuruları (043). İzin: corporate.review (tüm kayıtlar).
 *
 * GET   /api/admin/corporate-accounts?status=pending|approved|rejected → Ok<{ items, counts }>
 * PATCH /api/admin/corporate-accounts { userId, decision: approve|reject, note? } → Ok<item>
 *       Yalnız bekleyen başvuru karara bağlanır (yarış: koşullu güncelleme, 409). Her karar işlem geçmişine yazılır,
 *       başvuru sahibine e-posta gider.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "corporate.review");
  if (guard.error) return guard.error;
  const status = new URL(request.url).searchParams.get("status");
  if (status && !(CORPORATE_STATUSES as readonly string[]).includes(status)) {
    return fail(400, "invalid_query", "Geçersiz durum.", { param: "status" });
  }
  const db = createServiceRoleClient();
  let query = db.from("corporate_accounts").select(CORPORATE_ACCOUNT_COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (status) query = query.eq("status", status);
  const [{ data, error }, all] = await Promise.all([query, db.from("corporate_accounts").select("status")]);
  if (error || all.error) return unavailable();
  const counts = Object.fromEntries(CORPORATE_STATUSES.map((s) => [s, 0])) as Record<CorporateStatus, number>;
  for (const row of all.data ?? []) {
    const s = row.status as CorporateStatus;
    if (s in counts) counts[s]++;
  }
  return ok({ items: (data ?? []).map((row) => corporateAccountOf(row)), counts });
}

export async function PATCH(request: NextRequest) {
  const guard = await requirePermission(request, "corporate.review");
  if (guard.error) return guard.error;
  const body = corporateDecisionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "invalid_body", "Geçersiz istek: başvuru ve karar gerekli.");
  const { userId, decision, note } = body.data;
  if (decision === "reject" && !note) return fail(400, "note_required", "Ret için kısa bir açıklama yazın; başvuru sahibine iletilir.");

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("corporate_accounts")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      review_note: note || null,
      reviewed_by: guard.admin.user_id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "pending")
    .select(CORPORATE_ACCOUNT_COLUMNS)
    .maybeSingle();
  if (error) return unavailable();
  if (!data) return fail(409, "not_pending", "Başvuru bulunamadı ya da zaten karara bağlanmış. Listeyi yenileyin.");

  const item = corporateAccountOf(data);
  const warnings = await auditLog(db, {
    admin: guard.admin,
    action: "UPDATE",
    entity: "corporate_account",
    entityId: userId,
    details: { decision, noted: !!note },
    ip: getClientIP(request),
  });
  after(async () => {
    await sendCorporateDecision({
      userId,
      companyTitle: item.companyTitle,
      authorizedPerson: item.authorizedPerson,
      email: item.email,
      approved: decision === "approve",
      note: note ?? null,
    }).catch(() => undefined);
  });
  return ok(item, warnings);
}
