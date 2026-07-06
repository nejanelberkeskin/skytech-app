"use client";

import { useAdmin } from "@/lib/admin-context";
import { canAccessPath, ROLE_META } from "@/lib/rbac";
import Link from "next/link";

interface RoleGuardProps {
  children: React.ReactNode;
  moduleId?: string;
  path?: string;
}

export default function RoleGuard({ children, path }: RoleGuardProps) {
  const { admin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Erişim Reddedildi</h2>
          <p className="text-slate-400 text-sm mb-6">
            Bu panele erişmek için admin yetkiniz bulunmuyor.
          </p>
          <Link href="/auth/login"
            className="inline-flex px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors">
            Giriş Yap
          </Link>
        </div>
      </div>
    );
  }

  // Check route permission
  if (path && !canAccessPath(admin.role, path)) {
    const roleMeta = ROLE_META[admin.role];
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl">⛔</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">403 — Yetkisiz Erişim</h2>
          <p className="text-slate-400 text-sm mb-4">
            Bu sayfayı görüntüleme yetkiniz bulunmuyor.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full mb-6">
            <span>{roleMeta.icon}</span>
            <span className="text-sm text-slate-300">{roleMeta.label}</span>
          </div>
          <br />
          <Link href="/admin"
            className="inline-flex px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-colors">
            ← Ana Panele Dön
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
