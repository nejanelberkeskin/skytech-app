/**
 * İşlem izinleri — brif 12 §6 adlarıyla, bugünkü dört role eşlenmiş TEK kaynak.
 *
 * Yeni uçlar rol listesi yerine izin adı ister (`requirePermission`). Yetki çekirdeği (sözleşme 19)
 * geldiğinde izin adları ve uçlar değişmez; yalnız "kimde hangi izin var" bilgisinin kaynağı
 * (bugün aşağıdaki sabit eşleme) veritabanına taşınır. `lib/rbac.ts` modül menüsü bundan bağımsızdır.
 */
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { fail } from "@/lib/api/envelope";
import type { AdminUser, UserRole } from "@/lib/rbac";

/** Şu an sunucuda kullanılan izinler. Yeni izin eklenirken brif 12 §6'daki ad kullanılır. */
export const PERMISSIONS = ["finance.read", "refunds.execute", "system.readiness.read", "system.jobs.run"] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  FINANCE: ["finance.read", "refunds.execute"],
  OPERATIONS: ["system.readiness.read"],
  ENGINEER: [],
};

export function can(admin: Pick<AdminUser, "role" | "is_active"> | null | undefined, permission: Permission): boolean {
  if (!admin || admin.is_active !== true) return false;
  return (ROLE_PERMISSIONS[admin.role] ?? []).includes(permission);
}

export function permissionsOf(admin: Pick<AdminUser, "role" | "is_active"> | null | undefined): Permission[] {
  return PERMISSIONS.filter((p) => can(admin, p));
}

type Guard = { admin: AdminUser; error: null } | { admin: null; error: ReturnType<typeof fail> };

/** Oturum + aktif yönetici + izin. Hata yanıtı ortak zarf biçimindedir. */
export async function requirePermission(request: NextRequest, permission: Permission): Promise<Guard> {
  const { admin, error } = await requireAdmin(request);
  if (error || !admin) {
    const status = error?.status ?? 401;
    if (status === 401) return { admin: null, error: fail(401, "unauthenticated", "Oturum bulunamadı. Lütfen giriş yapın.") };
    if (status === 403) return { admin: null, error: fail(403, "forbidden", "Bu işlem için yetkiniz yok.") };
    return { admin: null, error: fail(503, "unavailable", "Kimlik doğrulanamadı. Lütfen yeniden deneyin.") };
  }
  if (!can(admin, permission)) return { admin: null, error: fail(403, "forbidden", "Bu işlem için yetkiniz yok.") };
  return { admin, error: null };
}
