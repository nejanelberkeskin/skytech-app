"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";

const NAV_ITEMS = [
  { href: "/kurumsal/panel", label: "Genel Bakış", icon: "📊" },
  { href: "/kurumsal/panel/sertifikalar", label: "Sertifika Merkezi", icon: "🎖️" },
  { href: "/kurumsal/panel/odeme", label: "Ödeme & Fatura", icon: "💳" },
];

export default function CorporatePanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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
      <div className="relative min-h-screen">
        <div className="nature-bg">
          <div className="nature-orb nature-orb-1" />
          <div className="nature-orb nature-orb-2" />
        </div>
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-300 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{
          background: "rgba(4, 11, 6, 0.85)",
          backdropFilter: "blur(24px) saturate(1.6)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo */}
        <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/kurumsal" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)} aria-label="Skytech Green Kurumsal">
            <Image
              src="/images/brand/logo.webp"
              alt="Skytech Green"
              width={130}
              height={34}
              priority
              className="h-8 w-auto"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </Link>
          <p className="text-xs text-emerald-200/25 mt-1.5">Kurumsal Panel</p>
        </div>

        {/* Company info */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.1))", border: "1px solid rgba(52,211,153,0.15)" }}>
              <span className="text-emerald-400 font-bold text-sm">TB</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Kurumsal Hesap</p>
              <p className="text-xs text-emerald-200/25">Aktif</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all duration-300 ${
                  isActive
                    ? "glass-glow text-emerald-300 font-medium"
                    : "text-emerald-200/40 hover:text-white hover:bg-white/[0.04]"
                }`}>
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {userEmail && (
            <p className="text-xs text-emerald-200/20 truncate">{userEmail}</p>
          )}
          <div className="flex items-center justify-between">
            <Link href="/kurumsal" className="text-xs text-emerald-200/30 hover:text-white transition-colors"
              onClick={() => setSidebarOpen(false)}>
              ← Ana Sayfa
            </Link>
            <button onClick={handleLogout}
              className="text-xs text-emerald-200/25 hover:text-rose-400 transition-colors">
              Çıkış Yap
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="relative z-10 lg:ml-72 min-h-screen">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
          style={{
            background: "rgba(4,11,6,0.8)",
            backdropFilter: "blur(20px) saturate(1.4)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
          <button onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-emerald-200/50 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-bold text-white">Kurumsal Panel</span>
          <div className="w-10" />
        </div>
        {children}
      </main>
    </div>
  );
}
