/**
 * Admin Audit Logger
 *
 * Kullanım:
 *   await auditLog(supabase, {
 *     admin,
 *     action: "UPDATE",
 *     entity: "order",
 *     entityId: orderId,
 *     details: { status: "shipped", tracking: "TR123" },
 *     ip: getClientIP(request),
 *   });
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminUser } from "@/lib/rbac";

interface AuditEntry {
  admin: AdminUser;
  action: "CREATE" | "UPDATE" | "DELETE";
  entity: string;      // "order" | "land" | "catalog" | "user" | "quote" | "setting" | "shipping"
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

export type AuditWarning = { code: "audit_unavailable"; message: string; entity: string; entityId?: string };

/** Post-commit audit: callers must surface warnings, never pretend the business write failed.
 * Personnel/refund mutations retain mandatory audit in their database transaction. */
export async function auditLog(
  supabase: SupabaseClient,
  entry: AuditEntry
): Promise<AuditWarning[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await supabase.from("admin_audit_logs").insert({
        admin_id: entry.admin.user_id, admin_email: entry.admin.email,
        action: entry.action, entity: entry.entity, entity_id: entry.entityId ?? null,
        details: entry.details ?? {}, ip_address: entry.ip ?? null,
      });
      if (error) throw new Error(error.code ?? "audit_insert_failed");
      return [];
    } catch {
      if (attempt === 0) continue;
      console.error("[audit] persistence_failed", { entity: entry.entity, entityId: entry.entityId, action: entry.action });
      return [{ code: "audit_unavailable", message: "İşlem kaydedildi; denetim kaydı tamamlanamadı. Aynı işlemi yeniden yapmayın.", entity: entry.entity, entityId: entry.entityId }];
    }
  }
  return [];
}
