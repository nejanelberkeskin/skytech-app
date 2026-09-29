import type { AdminMe } from "../access/types";
import type { RequestItem, RequestStatus } from "@/lib/requests/admin-dto";
export const requestAccessKey = (me: AdminMe | null) => JSON.stringify(me && { user: me.admin.userId, active: me.admin.isActive, permissions: me.permissions });
export function requestChanges(item: RequestItem, status: RequestStatus, note: string) {
  return { id: item.id, ...(status !== item.status ? { status } : {}), ...(note !== (item.adminNote ?? "") ? { adminNote: note } : {}) };
}
export function safeMapLink(value: string | null) {
  try { const url = new URL(value ?? ""); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export const date = (value: string | null) => value ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }) : "—";
