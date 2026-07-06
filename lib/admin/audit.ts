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

export async function auditLog(
  supabase: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  try {
    await supabase.from("admin_audit_logs").insert({
      admin_id:    entry.admin.user_id,
      admin_email: entry.admin.email,
      action:      entry.action,
      entity:      entry.entity,
      entity_id:   entry.entityId ?? null,
      details:     entry.details ?? {},
      ip_address:  entry.ip ?? null,
    });
  } catch (err) {
    // Audit log yazılamasa bile işlem akışı kesilmemeli
    console.error("[audit] Log yazılamadı:", err);
  }
}
