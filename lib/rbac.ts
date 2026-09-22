// ── Role-Based Access Control (RBAC) System ─────────────────────────────────

export type UserRole = "SUPER_ADMIN" | "FINANCE" | "OPERATIONS" | "ENGINEER";

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// ── Role Metadata ────────────────────────────────────────────────────────────
export const ROLE_META: Record<UserRole, { label: string; icon: string; color: string; desc: string }> = {
  SUPER_ADMIN: { label: "Super Admin", icon: "👑", color: "text-amber-400 bg-amber-400/10", desc: "Tüm modüllere tam erişim" },
  FINANCE:     { label: "Muhasebe & Finans", icon: "💰", color: "text-blue-400 bg-blue-400/10", desc: "Ciro, faturalar, ödemeler" },
  OPERATIONS:  { label: "Operasyon", icon: "🚁", color: "text-orange-400 bg-orange-400/10", desc: "Bırakma partileri, saha çalışmaları" },
  ENGINEER:    { label: "Orman Mühendisi", icon: "🌲", color: "text-emerald-400 bg-emerald-400/10", desc: "Proje Uygulama Sahaları, kapasite" },
};

// ── Admin Modules (used for sidebar + permissions) ───────────────────────────
export interface AdminModule {
  id: string;
  href: string;
  label: string;
  icon: string;
  allowedRoles: UserRole[];
}

export const ADMIN_MODULES: AdminModule[] = [
  {
    id: "dashboard",
    href: "/admin",
    label: "Genel Bakış",
    icon: "📊",
    allowedRoles: ["SUPER_ADMIN", "FINANCE", "OPERATIONS", "ENGINEER"],
  },
  {
    id: "finans",
    href: "/admin/finans",
    label: "Finans & Faturalar",
    icon: "💰",
    allowedRoles: ["SUPER_ADMIN", "FINANCE"],
  },
  {
    id: "araziler",
    href: "/admin/araziler",
    label: "Sahalar & Kapasite",
    icon: "🌲",
    allowedRoles: ["SUPER_ADMIN", "ENGINEER"],
  },
  {
    id: "katalog",
    href: "/admin/katalog",
    label: "Tohum Kataloğu",
    icon: "🌿",
    allowedRoles: ["SUPER_ADMIN", "OPERATIONS"],
  },
  {
    id: "talepler",
    href: "/admin/talepler",
    label: "Talepler",
    icon: "📥",
    allowedRoles: ["SUPER_ADMIN", "FINANCE", "OPERATIONS"],
  },
  {
    // Satış modeli v2: sahaya tohum topu bıraktırma siparişleri (release_orders)
    id: "birakma",
    href: "/admin/birakma-siparisleri",
    label: "Siparişler",
    icon: "🌱",
    allowedRoles: ["SUPER_ADMIN", "FINANCE", "OPERATIONS"],
  },
  {
    // Bırakma partileri: kesinleşmiş siparişler partiye alınır, bırakma tamamlanınca işaretlenir
    id: "partiler",
    href: "/admin/birakma-partileri",
    label: "Bırakma Partileri",
    icon: "🚁",
    allowedRoles: ["SUPER_ADMIN", "OPERATIONS", "FINANCE"],
  },
  {
    // Satış ayarları: birim bedel, adet sınırları, hazır seçenekler, KDV, fatura zamanı, süreler
    id: "satis-ayarlari",
    href: "/admin/satis-ayarlari",
    label: "Satış Ayarları",
    icon: "🏷️",
    allowedRoles: ["SUPER_ADMIN"],
  },
  {
    id: "b2b",
    href: "/admin/b2b",
    label: "B2B Teklifler",
    icon: "🏢",
    allowedRoles: ["SUPER_ADMIN", "FINANCE"],
  },
  {
    id: "kullanicilar",
    href: "/admin/kullanicilar",
    label: "Personel Yönetimi",
    icon: "👥",
    allowedRoles: ["SUPER_ADMIN"],
  },
];

// ── Permission Helpers ───────────────────────────────────────────────────────

/** Check if a role can access a specific module */
export function canAccessModule(role: UserRole, moduleId: string): boolean {
  const mod = ADMIN_MODULES.find((m) => m.id === moduleId);
  if (!mod) return false;
  return mod.allowedRoles.includes(role);
}

/** Check if a role can access a specific href */
export function canAccessPath(role: UserRole, path: string): boolean {
  // Super admin can access everything
  if (role === "SUPER_ADMIN") return true;

  // Exact match on base admin route
  if (path === "/admin") return true;

  // Check modules
  const mod = ADMIN_MODULES.find((m) => path.startsWith(m.href) && m.href !== "/admin");
  if (!mod) return false;
  return mod.allowedRoles.includes(role);
}

/** Get sidebar modules for a given role */
export function getModulesForRole(role: UserRole): AdminModule[] {
  return ADMIN_MODULES.filter((m) => m.allowedRoles.includes(role));
}
