"use client";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import ApprovalGate from "@/components/kurumsal/ApprovalGate";
import { TRANSACTIONS_ENABLED } from "@/lib/site-config";

// Ödeme ve çalışan sertifikaları kurumsal satış (TRANSACTIONS_ENABLED) açılınca görünür.
const NAV_ITEMS = [
  { href: "/kurumsal/panel", key: "overview" },
  ...(TRANSACTIONS_ENABLED
    ? [
        { href: "/kurumsal/panel/sertifikalar", key: "certificates" },
        { href: "/kurumsal/panel/odeme", key: "payment" },
      ]
    : []),
];

export default function CorporatePanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("corporatePages.panel");
  const tc = useTranslations("corporatePages");
  const [checking, setChecking] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/kurumsal/giris");
      } else {
        setUserEmail(data.session.user.email ?? null);
        setChecking(false);
      }
    });
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/kurumsal/giris");
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f5]" style={{ colorScheme: "light" }}>
        <p role="status" className="text-sm text-slate-500">{tc("loading")}</p>
      </div>
    );
  }

  const nav = (
    <nav aria-label={t("navLabel")} className="flex-1 px-3 py-4">
      <ul className="space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setSidebarOpen(false)}
                className={`flex min-h-10 items-center rounded-lg px-3 text-sm transition-colors ${
                  isActive ? "bg-[#f0f7ec] font-medium text-[#1B6B3A]" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {t(`nav.${item.key}`)}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/kurumsal/teklif-al"
            onClick={() => setSidebarOpen(false)}
            className="flex min-h-10 items-center rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            {t("nav.newQuote")}
          </Link>
        </li>
      </ul>
    </nav>
  );
  const footer = (
    <div className="border-t border-slate-200 px-5 py-4">
      {userEmail && <p className="truncate text-sm text-slate-700">{userEmail}</p>}
      <div className="mt-3 flex items-center justify-between text-sm">
        <Link href="/" className="text-slate-600 hover:text-slate-900" onClick={() => setSidebarOpen(false)}>
          {t("home")}
        </Link>
        <button type="button" onClick={handleLogout} className="min-h-10 text-slate-600 hover:text-red-700">
          {t("logout")}
        </button>
      </div>
    </div>
  );
  const logo = (
    <Link href="/" className="flex flex-col items-start gap-0.5" onClick={() => setSidebarOpen(false)} aria-label={tc("homeAria")}>
      <Image src="/images/brand/logo.webp" alt="Skytech Green" width={256} height={32} priority className="h-5 w-auto" />
      <span className="text-xs text-slate-500">{t("title")}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-slate-900" style={{ colorScheme: "light" }}>
      {/* Mobil: üst çubuk + soldan açılan menü */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
        {logo}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label={t("menuOpen")}
          aria-expanded={sidebarOpen}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {t("menu")}
        </button>
      </div>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[88vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:w-64 lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          {logo}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label={t("menuClose")}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {nav}
        {footer}
      </aside>
      <main className="min-w-0 lg:ml-64">
        <ApprovalGate>{children}</ApprovalGate>
      </main>
    </div>
  );
}
