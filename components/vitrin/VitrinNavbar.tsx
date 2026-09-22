"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import { ACCOUNTS_ENABLED, CTA_MODE, orderCtaHref } from "@/lib/site-config";

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
                    className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-1 whitespace-nowrap transition-colors ${
                      isActive("/tohum-topu") || isActive("/dron-teknolojisi") || isActive("/karbon-programi")
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
                      <div className="premium-glass rounded-2xl p-2 shadow-2xl">
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
          >
            {mobileOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer — Premium glass + stagger */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="xl:hidden fixed inset-0 z-40">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 280, mass: 0.7 }}
              className="absolute right-0 top-0 bottom-0 w-[88%] max-w-sm overflow-hidden mesh-dark grain-overlay"
            >
              {/* Aurora background */}
              <div className="aurora-bg">
                <div className="aurora-blob aurora-blob-1" />
                <div className="aurora-blob aurora-blob-2" />
              </div>

              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="relative flex items-center justify-between p-5 border-b border-white/8"
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a7d4a7]">
                  {tNav("menu")}
                </p>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-10 h-10 rounded-xl premium-glass-dark flex items-center justify-center"
                  aria-label={tCommon("back")}
                >
                  <CloseIcon className="w-4 h-4 text-white" />
                </button>
              </motion.div>

              {/* Nav with stagger */}
              <motion.nav
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } },
                }}
                className="relative p-5 space-y-1.5 overflow-y-auto max-h-[calc(100vh-80px-180px)]"
              >
                {NAV_ITEMS.map((item) =>
                  item.children ? (
                    <motion.div
                      key={item.label}
                      variants={drawerItemVariants}
                      className="space-y-1 pt-2"
                    >
                      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#22894a]">
                        {item.label}
                      </p>
                      {item.children.map((child, ci) => (
                        <motion.div
                          key={child.href}
                          variants={drawerItemVariants}
                          custom={ci}
                        >
                          <Link
                            href={child.href}
                            className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                              isActive(child.href)
                                ? "bg-[#22894a]/15 text-white border border-[#22894a]/25"
                                : "text-[#a7d4a7] hover:bg-white/5 hover:text-white border border-transparent"
                            }`}
                          >
                            {child.label}
                          </Link>
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div key={item.href} variants={drawerItemVariants}>
                      <Link
                        href={item.href}
                        className={`block px-4 py-3 rounded-xl text-base font-bold transition-colors ${
                          isActive(item.href)
                            ? "bg-[#22894a]/15 text-white border border-[#22894a]/25"
                            : "text-white hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </motion.div>
                  )
                )}
              </motion.nav>

              {/* Bottom CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-0 left-0 right-0 p-5 border-t border-white/8 space-y-3 mesh-dark"
              >
                <div className="flex justify-center pb-1">
                  <LanguageSwitcher dark />
                </div>
                {ACCOUNTS_ENABLED && (
                  <Link
                    href={accountHref}
                    className="block w-full text-center py-3 rounded-xl premium-glass-dark text-sm font-bold text-white"
                  >
                    {accountLabel}
                  </Link>
                )}
                <Link
                  href={ctaHref}
                  className="block w-full text-center py-3 rounded-xl bg-gradient-to-br from-[#1B6B3A] via-[#22894a] to-[#1B6B3A] text-white text-sm font-bold shadow-lg shadow-[#1B6B3A]/30"
                >
                  {CTA_MODE === "soon" ? ctaLabel : `${ctaLabel} →`}
                </Link>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Spacer for fixed nav */}
      <div className="h-20" />
    </>
  );
}

const drawerItemVariants = {
  hidden: { opacity: 0, x: 24 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

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
