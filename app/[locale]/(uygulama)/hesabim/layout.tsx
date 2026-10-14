"use client";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import {
  BarChartIcon, PackageIcon, CertificateIcon,
  SettingsIcon, AlertTriangleIcon, MailIcon,
} from "@/components/ui/Icons";
import { CTA_MODE, SALES_ENABLED, TRANSACTIONS_ENABLED, orderCtaHref } from "@/lib/site-config";

// `transactional: true` → B2B (kurumsal) açıkken listelenir (TRANSACTIONS_ENABLED; middleware de
// kapalıyken bu rotaları /hesabim'a katlar). `sales: true` → yeni satış modeli açıkken.
// Eski bireysel tohum satışının sayfaları (fiziksel siparişler, arazi ekimleri, davet/ödül) Faz 8'de kaldırıldı.
const NAV_ITEMS = [
  { href: "/hesabim", key: "overview", Icon: BarChartIcon, exact: true },
  { href: "/hesabim/taleplerim", key: "requests", Icon: MailIcon },
  // Satış modeli v2: sahaya tohum topu bıraktırma siparişleri (yalnız satış açıkken listelenir)
  { href: "/hesabim/siparisler", key: "orders", Icon: PackageIcon, sales: true },
  // B2B çalışan sertifikaları (şirket hesabı)
  { href: "/hesabim/sertifikalar", key: "certificates", Icon: CertificateIcon, transactional: true },
  { href: "/hesabim/profil", key: "profile", Icon: SettingsIcon },
].filter((item: { transactional?: boolean; sales?: boolean }) => (TRANSACTIONS_ENABLED || !item.transactional) && (SALES_ENABLED || !item.sales));

export default function HesabimLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("accountPages.layout");
  const tPages = useTranslations("accountPages");
  const [loading, setLoading] = useState(true);
  // null: henüz okunmadı; "": kullanıcıda ad yok (ekranda çevrilmiş yedek ad gösterilir).
  const [userName, setUserName] = useState<string | null>(null);
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
        setUserName(meta?.full_name ?? meta?.contact_person ?? "");
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

  const displayName = userName === null ? "" : userName || t("userFallback");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f5]" style={{ colorScheme: "light" }}>
        <p role="status" className="text-sm text-slate-500">{tPages("loading")}</p>
      </div>
    );
  }

  const logo = (
    <Link href="/" className="flex flex-col items-start gap-0.5" onClick={() => setSidebarOpen(false)} aria-label={t("homeAria")}>
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

        <nav aria-label={t("navLabel")} className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                      isActive ? "bg-[#f0f7ec] font-medium text-[#1B6B3A]" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <item.Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-[#1B6B3A]" : "text-slate-400"}`} />
                    <span>{t(`nav.${item.key}`)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href={orderCtaHref("hub")}
            onClick={() => setSidebarOpen(false)}
            className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-[#1B6B3A] px-4 text-sm font-medium text-white hover:bg-[#165c31]"
          >
            {CTA_MODE === "order" ? t("ctaOrder") : t("ctaRequest")}
          </Link>
        </nav>

        <div className="border-t border-slate-200 px-5 py-4">
          <p className="truncate text-sm font-medium text-slate-900">{displayName}</p>
          <p className="truncate text-xs text-slate-500">{userEmail}</p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <Link href="/" className="text-slate-600 hover:text-slate-900" onClick={() => setSidebarOpen(false)}>
              {t("home")}
            </Link>
            <button type="button" onClick={handleLogout} className="min-h-10 text-slate-600 hover:text-red-700">
              {t("logout")}
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 lg:ml-64">
        {!emailConfirmed && (
          <div role="status" className="mx-4 mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:mx-8">
            <div className="flex min-w-0 items-start gap-2.5">
              <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <p className="text-sm text-amber-900">
                <span className="font-semibold">{t("emailBanner.title")}</span>{" "}
                <span>{t("emailBanner.sent", { email: userEmail })}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendLoading || resendSent}
              className="min-h-10 shrink-0 rounded-lg border border-amber-300 bg-white px-4 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendSent ? t("resend.sent") : resendLoading ? t("resend.sending") : t("resend.send")}
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
