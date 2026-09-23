import { ADMIN_MODULES, type AdminModule, type UserRole } from "@/lib/rbac";
import type { Permission } from "@/lib/admin/permission-keys";
import type { AdminMe } from "./types";
export function hasFullPermission(
  me: AdminMe | null,
  key: Permission,
): boolean {
  return (
    !!me?.admin.isActive &&
    !!me.permissions
      .find((p) => p.key === key)
      ?.scopes.some((s) => s.kind === "all")
  );
}
const migrated: Record<string, Permission | "self"> = {
  dashboard: "self",
  kullanicilar: "staff.manage",
  davetler: "staff.manage",
  roller: "roles.manage",
  "islem-kaydi": "audit.read",
  guvenlik: "self",
  finans: "finance.read",
  iadeler: "finance.read",
};
export function visibleModules(me: AdminMe | null): AdminModule[] {
  if (!me?.admin.isActive) return [];
  return ADMIN_MODULES.filter((mod) => {
    const key = migrated[mod.id];
    if (key === "self") return true;
    if (key) return hasFullPermission(me, key);
    // Henüz izin/kapsam geçişi bitmeyen ekranları eski uçlardan daha geniş açma.
    return mod.allowedRoles.includes(me.admin.legacyRole as UserRole);
  });
}
export function canVisit(me: AdminMe | null, path: string): boolean {
  return visibleModules(me).some((m) =>
    m.href === "/admin"
      ? path === m.href
      : path === m.href || path.startsWith(`${m.href}/`),
  );
}
export const activeAssignment = (
  a: {
    startsAt: string;
    endsAt: string | null;
    revokedAt?: string | null;
  },
  now = Date.now(),
) =>
  !a.revokedAt &&
  Date.parse(a.startsAt) <= now &&
  (!a.endsAt || Date.parse(a.endsAt) > now);
