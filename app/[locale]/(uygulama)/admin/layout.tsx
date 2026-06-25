"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminProvider, useAdmin } from "@/lib/admin-context";
import { getModulesForRole, ROLE_META } from "@/lib/rbac";
import { supabase } from "@/lib/supabase/browser";

function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, loading } = useAdmin();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/giris");
  };

  if (loading) {
    return (
      <aside className="w-64 flex items-center justify-center fixed inset-y-0 left-0 z-20"
        style={{ background: "rgba(4,11,6,0.85)", backdropFilter: "blur(24px) saturate(1.6)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
      </aside>
    );
  }

  if (!admin) {
    return (
      <aside className="w-64 flex items-center justify-center fixed inset-y-0 left-0 z-20"
        style={{ background: "rgba(4,11,6,0.85)", backdropFilter: "blur(24px) saturate(1.6)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-center px-4">
          <p className="text-emerald-200/40 text-sm mb-3">Yönetici yetkisi bulunamadı.</p>
          <Link href="/admin/giris" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
            Giriş Yapın
          </Link>
        </div>
      </aside>
    );
  }

  const modules = getModulesForRole(admin.role);
  const roleMeta = ROLE_META[admin.role];

  return (
    <aside className="w-64 flex flex-col fixed inset-y-0 left-0 z-20"
      style={{ background: "rgba(4,11,6,0.85)", backdropFilter: "blur(24px) saturate(1.6)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/admin" className="flex items-center gap-2">
          <span className="text-xl">🌱</span>
          <span className="text-base font-bold text-white">
            Skytech<span className="text-emerald-400">Admin</span>
          </span>
        </Link>
      </div>

      {/* Yönetici bilgisi */}
      <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.1))", border: "1px solid rgba(52,211,153,0.15)" }}>
            <span className="text-base">{roleMeta.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{admin.full_name}</p>
            <p className="text-xs text-emerald-200/25 truncate">{roleMeta.label}</p>
          </div>
        </div>
      </div>

      {/* Dinamik menü — rol tabanlı filtreleme */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {modules.map((mod) => {
          const isActive = mod.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(mod.href);

          return (
            <Link key={mod.id} href={mod.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all duration-300 ${
                isActive
                  ? "glass-glow text-emerald-300 font-medium"
                  : "text-emerald-200/40 hover:text-white hover:bg-white/[0.04]"
              }`}>
              <span className="text-base">{mod.icon}</span>
              <span>{mod.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Alt bölüm */}
      <div className="px-5 py-4 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs text-emerald-200/20 truncate">{admin.email}</p>
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs text-emerald-200/30 hover:text-white transition-colors">
            ← Ana Siteye Dönün
          </Link>
          <button onClick={handleLogout}
            className="text-xs text-emerald-200/25 hover:text-rose-400 transition-colors">
            Çıkış Yapın
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <div className="relative min-h-screen">
        <div className="nature-bg">
          <div className="nature-orb nature-orb-1" />
          <div className="nature-orb nature-orb-2" />
        </div>
        <div className="relative z-10 flex min-h-screen">
          <AdminSidebar />
          <main className="flex-1 ml-64 min-h-screen">
            {children}
          </main>
        </div>
      </div>
    </AdminProvider>
  );
}
