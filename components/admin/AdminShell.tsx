"use client";

import { visibleModules } from "./access/policy";
import AdminMutationWarnings from "./AdminMutationWarnings";
import { AdminIcon } from "./AdminIcons";
import { containDialogTab } from "@/lib/hooks/dialog-keyboard";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { AdminProvider, useAdmin } from "@/lib/admin-context";
import { ROLE_META, type AdminModule } from "@/lib/rbac";
import { supabase } from "@/lib/supabase/browser";

/* Yönetim paneli çerçevesi: beyaz kenar menü (gruplu, SVG simgeler), açık gri içerik zemini.
   Mobilde üst çubuk + soldan açılan menü (dialog). Cam, parlama ve emoji kullanılmaz. */

const GROUPS: { title: string | null; ids: string[] }[] = [
  { title: null, ids: ["dashboard"] },
  { title: "Satış", ids: ["birakma", "talepler", "araziler", "partiler", "katalog", "satis-ayarlari"] },
  { title: "Finans", ids: ["finans", "iadeler"] },
  { title: "Kurumsal", ids: ["kurumsal-hesaplar", "b2b"] },
  { title: "Ekip", ids: ["kullanicilar", "davetler", "roller", "islem-kaydi"] },
  { title: "Hesap", ids: ["guvenlik"] },
];

function grouped(modules: AdminModule[]) {
  const known = new Set(GROUPS.flatMap((g) => g.ids));
  const out = GROUPS.map((g) => ({ title: g.title, items: g.ids.map((id) => modules.find((m) => m.id === id)).filter((m): m is AdminModule => !!m) }));
  const rest = modules.filter((m) => !known.has(m.id));
  if (rest.length) out.push({ title: "Diğer", items: rest });
  return out.filter((g) => g.items.length);
}

function AdminSidebar({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, me, loading, error, refresh } = useAdmin();
  const frame = mobile ? "flex w-full flex-1 flex-col" : "hidden lg:flex fixed inset-y-0 left-0 z-20 w-64 flex-col border-r border-slate-200 bg-white";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/giris");
  };

  const logo = (
    <Link href="/admin" className="flex flex-col items-start gap-0.5 px-5 py-5" aria-label="Yönetim ana sayfası">
      <Image src="/images/brand/logo.webp" alt="Skytech Green" width={256} height={32} className="h-5 w-auto" priority />
      <span className="text-xs text-slate-500">Yönetim paneli</span>
    </Link>
  );

  if (loading) {
    return (
      <aside className={frame}>
        {!mobile && logo}
        <p role="status" className="px-5 py-4 text-sm text-slate-500">Yükleniyor…</p>
      </aside>
    );
  }

  if (!admin) {
    return (
      <aside className={frame}>
        {!mobile && logo}
        <div className="space-y-3 px-5 py-4 text-sm">
          <p className="text-slate-600">{error ?? "Yönetici yetkisi bulunamadı."}</p>
          <button type="button" onClick={() => void refresh()} className="min-h-11 font-medium text-[#1B6B3A] underline underline-offset-4">Yeniden dene</button>
          <Link href="/admin/giris" className="block min-h-11 font-medium text-[#1B6B3A] underline underline-offset-4">Giriş yapın</Link>
        </div>
      </aside>
    );
  }

  const roleLabel = me?.roles.map((r) => r.label).join(", ") || ROLE_META[admin.role].label;

  return (
    <aside className={frame}>
      {!mobile && logo}
      <nav aria-label="Yönetim" className="flex-1 overflow-y-auto px-3 pb-4">
        {grouped(visibleModules(me)).map((group, gi) => (
          <div key={group.title ?? gi} className={gi ? "mt-5" : "mt-1"}>
            {group.title && <p className="px-3 pb-1.5 text-xs font-medium text-slate-500">{group.title}</p>}
            <ul className="space-y-0.5">
              {group.items.map((mod) => {
                const active = mod.href === "/admin" ? pathname === "/admin" : pathname.startsWith(mod.href);
                return (
                  <li key={mod.id}>
                    <Link
                      href={mod.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                        active ? "bg-[#f0f7ec] font-medium text-[#1B6B3A]" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      }`}
>
                      <AdminIcon name={mod.id} className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[#1B6B3A]" : "text-slate-500"}`} />
                      <span className="truncate">{mod.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 px-5 py-4">
        <p className="truncate text-sm font-medium text-slate-900">{admin.full_name}</p>
        <p className="truncate text-xs text-slate-500">{roleLabel}</p>
        <p className="truncate text-xs text-slate-500">{admin.email}</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <Link href="/" className="text-slate-600 hover:text-slate-900">Siteye dön</Link>
          <button type="button" onClick={handleLogout} className="min-h-10 text-slate-600 hover:text-red-700">Çıkış yap</button>
        </div>
      </div>
    </aside>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const open = menuPath === pathname;
  useEffect(() => {
    const node = dialog.current;
    if (open) node?.showModal(); else node?.close();
    const wide = window.matchMedia("(min-width: 1024px)");
    const close = () => { if (wide.matches) setMenuPath(null); };
    wide.addEventListener("change", close);
    return () => { wide.removeEventListener("change", close); node?.close(); };
  }, [open]);
  if (pathname === "/admin/giris") return <>{children}</>;
  return (
    <AdminProvider>
      <div className="admin-panel min-h-screen bg-[#f6f7f5] text-slate-900" style={{ colorScheme: "light" }}>
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          <Link href="/admin" aria-label="Yönetim ana sayfası" className="flex items-center gap-2">
            <Image src="/images/brand/logo.webp" alt="Skytech Green" width={256} height={32} className="h-5 w-auto" />
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="admin-menu"
            onClick={() => setMenuPath(pathname)}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800"
>
            <AdminIcon name="menu" className="h-5 w-5" />
            Menü
          </button>
        </div>
        <AdminSidebar />
        <dialog
          onKeyDown={containDialogTab}
          id="admin-menu"
          ref={dialog}
          onCancel={() => setMenuPath(null)}
          aria-label="Yönetim menüsü"
          className="m-0 h-dvh max-h-none w-80 max-w-[88vw] bg-white p-0 text-slate-900 backdrop:bg-slate-900/40"
          style={{ colorScheme: "light" }}
>
          <div className="flex h-full flex-col" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setMenuPath(null); }}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
              <span className="text-sm font-semibold">Yönetim menüsü</span>
              <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" onClick={() => setMenuPath(null)} aria-label="Menüyü kapat">
                <AdminIcon name="close" />
              </button>
            </div>
            <AdminSidebar mobile />
          </div>
        </dialog>
        <main className="min-w-0 lg:ml-64">
          <AdminMutationWarnings />
          {children}
        </main>
      </div>
    </AdminProvider>
  );
}
