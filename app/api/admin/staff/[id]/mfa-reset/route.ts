import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { UUID_RE, failFrom, isServiceError, staffService } from "@/lib/admin/staff-http";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/api/envelope";

/**
 * POST /api/admin/staff/{id}/mfa-reset — kişinin iki aşamalı doğrulama aygıtlarını sıfırlar.
 * İzin: staff.manage (+ MFA). Kişi kendi aygıtını sıfırlayamaz (web-brifler/19 §7).
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "staff.manage");
  if (guard.error) return guard.error;
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Personel kaydı bulunamadı.");
  const service = staffService();
  const detail = await service.detail(id);
  if (isServiceError(detail)) return failFrom(detail);
  if (detail.userId === guard.admin.user_id) {
    return fail(403, "self_assignment", "Kendi doğrulama aygıtınızı sıfırlayamazsınız; başka bir yetkili yapmalı.");
  }

  const db = createServiceRoleClient();
  const admin = db.auth.admin as unknown as {
    mfa?: {
      listFactors(args: { userId: string }): Promise<{ data?: { factors?: { id: string }[] } | null; error?: unknown }>;
      deleteFactor(args: { id: string; userId: string }): Promise<{ error?: unknown }>;
    };
  };
  if (!admin.mfa) return fail(503, "unavailable", "Doğrulama aygıtı yönetimi bu ortamda kullanılamıyor.");
  const factors = await admin.mfa.listFactors({ userId: detail.userId });
  if (factors.error) return fail(503, "unavailable", "Doğrulama aygıtları okunamadı.");
  const list = factors.data?.factors ?? [];

  // Harici işlem: PostgreSQL transaction'ına giremez. Üç aşama yazılır, ikinci çalıştırma
  // zaten silinmiş aygıtları atlar (idempotent).
  const audit = (action: string, details: Record<string, unknown>) =>
    db.rpc("admin_audit", { p_actor: guard.admin.user_id, p_action: "UPDATE", p_entity: "admin_user", p_entity_id: id, p_details: { action, ...details } });
  await audit("mfa_reset_started", { factors: list.length });
  let removed = 0;
  for (const factor of list) {
    const result = await admin.mfa.deleteFactor({ id: factor.id, userId: detail.userId });
    if (result.error) {
      await audit("mfa_reset_uncertain", { removed, remaining: list.length - removed });
      return fail(503, "unavailable", "Doğrulama aygıtlarının bir kısmı kaldırılamadı. Aynı işlemi yeniden çalıştırabilirsiniz.", { removed });
    }
    removed++;
  }
  await audit("mfa_reset_completed", { removed });
  return ok({ removedFactors: removed, staffId: id });
}
