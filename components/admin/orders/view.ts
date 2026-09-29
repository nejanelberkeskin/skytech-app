import type { AdminMe } from "../access/types";
import type { OrderCapabilities, OrderDetailDto, OrderListDto } from "@/lib/orders/admin-dto";
import { ORDER_STATUSES } from "@/lib/orders/types";

/** Do not key on checkedAt: unchanged permission refreshes must preserve drafts. */
export const orderAccessKey = (me: AdminMe | null) => JSON.stringify(me && {
  user: me.admin.userId, active: me.admin.isActive, role: me.admin.legacyRole,
  permissions: me.permissions, mfa: me.mfa,
});
export const ACTION_CAPABILITY: Record<string, keyof OrderCapabilities> = {
  note: "note", cancel_by_seller: "cancel", reserve_capacity: "reserveCapacity",
  invoice_now: "invoiceQueue", invoice_issued: "invoiceIssue",
};
export const canAct = (detail: OrderDetailDto, action: unknown) =>
  typeof action === "string" && !!ACTION_CAPABILITY[action] && detail.capabilities[ACTION_CAPABILITY[action]] === true;
export const validActionResult = (value: unknown): boolean =>
  !!value && typeof value === "object" && "status" in value && ORDER_STATUSES.includes(value.status as typeof ORDER_STATUSES[number]);
export const ALERTS = [
  { key: "capacity", flag: "capacity", label: "Kapasite ayrılmamış" },
  { key: "refundPending", flag: "refund_pending", label: "İade bekliyor" },
  { key: "invoicePending", flag: "invoice_pending", label: "Fatura bekliyor" },
  { key: "duplicate", flag: "duplicate", label: "Çift tahsilat" },
] as const;
export const availableAlerts = (data: OrderListDto) => ALERTS.filter(a => typeof data.alerts[a.key] === "number");
export const GROUP_LABELS = { contact: "İletişim", tax: "Vergi bilgileri", finance: "Finans", invoices: "Faturalar", legal: "Belgeler ve onaylar", certificate: "Özel sertifika" };
