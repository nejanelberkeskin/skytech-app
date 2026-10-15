"use client";

import { containDialogTab } from "@/lib/hooks/dialog-keyboard";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import { ACCOUNTS_ENABLED, CTA_MODE, REQUESTS_ENABLED, orderCtaHref } from "@/lib/site-config";
import { OWN_LAND_HREF } from "@/lib/sites/links";

/**
 * Oturum var mı? Supabase'in auth çerezi ("sb-<ref>-auth-token[.N]")
 * tarayıcıda okunabilir; supabase-js'i vitrin paketine eklemeden yalnız
 * "Giriş Yap" / "Hesabım" etiketini seçmek için yeterli. Yetki kararı
 * middleware'de verilir, bu yalnız görsel ipucu.
 */
const SESSION_COOKIE_RE = /^sb-[a-z0-9]+-auth-token(\.\d+)?=/;

function readSessionCookie(): boolean {
  if (!ACCOUNTS_ENABLED || typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => SESSION_COOKIE_RE.test(c));
}

function subscribeSessionCookie(onChange: () => void): () => void {
  window.addEventListener("focus", onChange);
  window.addEventListener("pageshow", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    window.removeEventListener("pageshow", onChange);
  };
}

function useHasSessionCookie(): boolean {
  // Sunucu ve ilk hidrasyonda false; istemcide çerez okunur, odak değişince yenilenir.
  return useSyncExternalStore(subscribeSessionCookie, readSessionCookie, () => false);
}

function useNavItems() {
  const t = useTranslations("nav");
  // "Ana Sayfa" bilinçli olarak yok: logo zaten ana sayfaya gider ve geniş (8:1)
  // logo kilidiyle birlikte menü satıra sığmıyordu.
  return [
    {
      label: t("services"),
      href: "#",
      children: [
        { label: t("seedBall"), href: "/tohum-topu" },
        { label: t("ourSeeds"), href: "/tohumlarimiz" },
        { label: t("droneTech"), href: "/dron-teknolojisi" },
        { label: t("carbonProgram"), href: "/karbon-programi" },
        // Kendi arazi başvurusu: talep akışı kapalıyken sayfa /yakinda'ya gittiği için menüde de yok.
        ...(REQUESTS_ENABLED ? [{ label: t("ownLand"), href: OWN_LAND_HREF }] : []),
      ],
    },
    { label: t("projects"), href: "/projeler" },
    { label: t("corporate"), href: "/kurumsal-cozumler" },
    { label: t("about"), href: "/hakkimizda" },
    { label: t("contact"), href: "/iletisim" },
  ];
}

export default function VitrinNavbar() {
  const NAV_ITEMS = useNavItems();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  // Menü durumu açıldığı sayfaya bağlı tutulur: rota değişince kendiliğinden kapanır
  // (effect içinde setState gerekmez).
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const mobileOpen = mobileOpenPath === pathname;
  const setMobileOpen = (open: boolean) => setMobileOpenPath(open ? pathname : null);
  const [dropdown, setDropdown] = useState<{ label: string; path: string } | null>(null);
  const openDropdown = dropdown?.path === pathname ? dropdown.label : null;
  const setOpenDropdown = (label: string | null) => setDropdown(label ? { label, path: pathname } : null);
  const signedIn = useHasSessionCookie();
  const menuRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = menuRef.current;
    if (mobileOpen) dialog?.showModal(); else dialog?.close();
    const previous = document.body.style.overflow;
    if (mobileOpen) document.body.style.overflow = "hidden";
    const wide = window.matchMedia("(min-width: 1280px)");
    const close = () => { if (wide.matches) setMobileOpenPath(null); };
    wide.addEventListener("change", close);
    return () => { dialog?.close(); document.body.style.overflow = previous; wide.removeEventListener("change", close); };
  }, [mobileOpen]);

  const ctaHref = orderCtaHref("hub");
  const ctaLabel =
    CTA_MODE === "order" ? tNav("orderSeeds") : CTA_MODE === "request" ? tNav("requests") : tNav("comingSoon");
  const accountHref = signedIn ? "/hesabim" : "/auth/login";
  const accountLabel = signedIn ? tNav("account") : tNav("login");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-[padding,background-color,box-shadow] duration-300 ${
          scrolled
            ? "vitrin-navbar-scrolled py-3"
            : "vitrin-navbar-top py-5"
        }`}
        style={{
          backdropFilter: scrolled ? "blur(20px) saturate(1.3)" : "blur(16px) saturate(1.25)",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(1.3)" : "blur(16px) saturate(1.25)",
        }}
      >
        <div className="vitrin-container flex items-center justify-between">
          {/* Logo */}
          <Link href="/" aria-label="Skytech Green ana sayfa" className="flex items-center group min-w-0 mr-4">
            <Image
              src="/images/brand/logo.webp"
              alt="Skytech Green"
              width={320}
              height={40}
              priority
              /* Logo kilidi 8:1. Esnek satırda daralınca w-auto tek başına görseli eziyordu;
                 object-contain oranı korur, max-w-full dar ekranda taşmayı önler. */
              className="h-8 sm:h-9 xl:h-11 w-auto max-w-full object-contain object-left transition-transform group-hover:scale-[1.03]"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => item.children && setOpenDropdown(item.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                {item.children ? (
                  <button
                    aria-expanded={openDropdown === item.label}
                    onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                    onKeyDown={(e) => { if (e.key === "Escape") setOpenDropdown(null); }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-1 whitespace-nowrap transition-colors ${
                      item.children.some((child) => isActive(child.href))
                        ? "text-[#1B6B3A]"
                        : "text-[#1a2e1a] hover:text-[#1B6B3A]"
                    }`}
                  >
                    {item.label}
                    <ChevronDownIcon className="w-4 h-4" />
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                      isActive(item.href)
                        ? "text-[#1B6B3A]"
                        : "text-[#1a2e1a] hover:text-[#1B6B3A]"
                    }`}
                  >
                    {item.label}
                  </Link>
                )}

                <AnimatePresence>
                  {item.children && openDropdown === item.label && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute top-full left-0 pt-3 min-w-[240px]"
                    >
                      {/* Opak zemin: animasyonlu kapsayıcı backdrop-filter bulanıklığını geçersiz kıldığı için yarı saydam cam
                          zemin arkadaki başlık metnini okunur bırakıyordu. */}
                      <div className="rounded-2xl border border-black/5 bg-white p-2 shadow-2xl">
                        {item.children.map((child, i) => (
                          <motion.div
                            key={child.href}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                          >
                            <Link
                              href={child.href}
                              className="block px-4 py-2.5 text-sm font-semibold text-[#1a2e1a] rounded-lg hover:bg-[#1B6B3A]/8 hover:text-[#1B6B3A] transition-colors"
                            >
                              {child.label}
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </nav>

          {/* CTAs */}
          <div className="hidden xl:flex items-center gap-3 shrink-0">
            <LanguageSwitcher />
            {ACCOUNTS_ENABLED && (
              <Link
                href={accountHref}
                className="px-4 py-2 text-sm font-semibold text-[#1a2e1a] hover:text-[#1B6B3A] whitespace-nowrap transition-colors"
              >
                {accountLabel}
              </Link>
            )}
            <Link href={ctaHref} className="vitrin-cta-primary !py-2.5 !px-5 !text-sm whitespace-nowrap">
              {ctaLabel}
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="xl:hidden shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-[#1a2e1a] hover:bg-[#1B6B3A]/8 transition-colors"
            aria-label={tNav("menu")}
            aria-expanded={mobileOpen}
            aria-controls="vitrin-mobile-menu"
          >
            {mobileOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobil menü: sağdan açılan beyaz panel. Liste kendi içinde kayar, giriş ve Satın Al altta sabit. */}
      {mobileOpen && (
        <dialog
          onKeyDown={containDialogTab}
          ref={menuRef}
          id="vitrin-mobile-menu"
          aria-label={tNav("menu")}
          onCancel={() => setMobileOpenPath(null)}
          className="fixed inset-0 z-[60] m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-transparent"
          style={{ colorScheme: "light" }}
        >
          <div onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-[#0e2519]/40" />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white text-[#0e2519] shadow-xl animate-[menu-in_180ms_ease-out]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <Link href="/" aria-label="Skytech Green ana sayfa" onClick={() => setMobileOpen(false)}>
                <Image src="/images/brand/logo.webp" alt="Skytech Green" width={256} height={32} className="h-5 w-auto" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
                aria-label={tCommon("close")}
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <nav aria-label={tNav("menu")} className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
              <ul className="space-y-0.5">
                {NAV_ITEMS.map((item) =>
                  item.children ? (
                    <li key={item.label} className="pb-2">
                      <p className="px-3 pb-1 pt-2 text-xs font-semibold text-slate-500">{item.label}</p>
                      <ul className="space-y-0.5">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={() => setMobileOpen(false)}
                              aria-current={isActive(child.href) ? "page" : undefined}
                              className={`flex min-h-12 items-center rounded-lg px-3 text-[15px] ${
                                isActive(child.href) ? "bg-[#f0f7ec] font-semibold text-[#1B6B3A]" : "text-[#0e2519] hover:bg-slate-50"
                              }`}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ) : (
                    <li key={item.href} className="border-t border-slate-100 first:border-t-0">
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        className={`flex min-h-12 items-center rounded-lg px-3 text-base font-semibold ${
                          isActive(item.href) ? "bg-[#f0f7ec] text-[#1B6B3A]" : "text-[#0e2519] hover:bg-slate-50"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </nav>

            <div className="space-y-3 border-t border-slate-200 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <div className="flex justify-center">
                <LanguageSwitcher large />
              </div>
              <div className="flex gap-3">
                {ACCOUNTS_ENABLED && (
                  <Link
                    href={accountHref}
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-[#0e2519]"
                  >
                    {accountLabel}
                  </Link>
                )}
                <Link
                  href={ctaHref}
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-12 flex-1 items-center justify-center rounded-lg bg-[#1B6B3A] text-sm font-semibold text-white"
                >
                  {ctaLabel}
                </Link>
              </div>
            </div>
          </div>
        </dialog>
      )}

      {/* Spacer for fixed nav */}
      <div className="h-20" />
    </>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
      <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
      <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
    </svg>
  );
}
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
      <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
    </svg>
  );
}
