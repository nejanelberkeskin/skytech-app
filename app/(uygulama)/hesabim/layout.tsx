"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import {
  BarChartIcon, PackageIcon, SproutIcon, CertificateIcon,
  GiftIcon, TrophyIcon, SettingsIcon, AlertTriangleIcon,
} from "@/components/ui/Icons";

const NAV_ITEMS = [
  { href: "/hesabim", label: "Genel Bakış", Icon: BarChartIcon, exact: true },
  { href: "/hesabim/siparislerim", label: "Fiziksel Siparişlerim", Icon: PackageIcon },
  { href: "/hesabim/rezervasyonlar", label: "Arazi Ekimlerim", Icon: SproutIcon },
  { href: "/hesabim/sertifikalar", label: "Sertifikalarım", Icon: CertificateIcon },
  { href: "/hesabim/davet-et", label: "Davet Et & Kazan", Icon: GiftIcon },
  { href: "/hesabim/davet-et-kazan", label: "Ödüllerim", Icon: TrophyIcon },
  { href: "/hesabim/profil", label: "Profil & Ayarlar", Icon: SettingsIcon },
];

export default function HesabimLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleResendConfirmation = async () => {
    if (!userEmail || resendLoading || resendSent) return;
    setResendLoading(true);
    await supabase.auth.resend({ type: "signup", email: userEmail });
    setResendLoading(false);
    setResendSent(true);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const meta = user.user_metadata;
        setUserName(meta?.full_name ?? meta?.contact_person ?? "Kullanıcı");
        setUserEmail(user.email ?? "");
        setEmailConfirmed(!!user.email_confirmed_at);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/auth/login");
        router.refresh();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  if (loading) {
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
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
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
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)} aria-label="Skytech Green ana sayfa">
            <Image
              src="/images/brand/logo.webp"
              alt="Skytech Green"
              width={140}
              height={36}
              priority
              className="h-9 w-auto"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </Link>
        </div>

        {/* User info */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.1))", border: "1px solid rgba(52,211,153,0.15)" }}>
              <span className="text-emerald-400 font-bold text-sm">
                {userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-emerald-200/30 truncate">{userEmail}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all duration-300 ${
                  isActive
                    ? "glass-glow text-emerald-300 font-medium"
                    : "text-emerald-200/40 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <item.Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-5 py-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Link
            href="/bireysel/satin-al"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl glass-btn text-sm font-medium text-white transition-all"
          >
            <SproutIcon className="w-4 h-4" />
            Tohum Satın Al
          </Link>
          <button
            onClick={handleLogout}
            className="w-full text-center text-xs text-emerald-200/25 hover:text-rose-400 transition-colors py-2"
          >
            Çıkış Yap
          </button>
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
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-emerald-200/50 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Image
            src="/images/brand/logo.webp"
            alt="Skytech Green"
            width={120}
            height={30}
            className="h-7 w-auto"
            style={{ filter: "brightness(0) invert(1)" }}
          />
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* E-posta onay banner'ı */}
        {!emailConfirmed && (
          <div className="mx-4 mt-4 lg:mx-8 rounded-2xl px-5 py-3 flex items-center justify-between gap-4"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangleIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300">
                <span className="font-semibold">E-postanızı onaylayın.</span>{" "}
                <span className="text-amber-400/60">{userEmail} adresine bir doğrulama bağlantısı gönderdik.</span>
              </p>
            </div>
            <button
              onClick={handleResendConfirmation}
              disabled={resendLoading || resendSent}
              className="shrink-0 text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "rgb(251,191,36)" }}
            >
              {resendSent ? "Gönderildi ✓" : resendLoading ? "Gönderiliyor…" : "Tekrar Gönder"}
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
