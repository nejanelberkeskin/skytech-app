"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS: { label: string; href: string; children?: { label: string; href: string }[] }[] = [
  { label: "Ana Sayfa", href: "/" },
  {
    label: "Hizmetler",
    href: "#",
    children: [
      { label: "Tohum Topu", href: "/tohum-topu" },
      { label: "Dron Teknolojisi", href: "/dron-teknolojisi" },
      { label: "Karbon Programı", href: "/karbon-programi" },
    ],
  },
  { label: "Projeler", href: "/projeler" },
  { label: "Kurumsal", href: "/kurumsal-cozumler" },
  { label: "Hakkımızda", href: "/hakkimizda" },
  { label: "İletişim", href: "/iletisim" },
];

export default function VitrinNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "vitrin-navbar-scrolled py-3"
            : "bg-transparent py-5"
        }`}
      >
        <div className="vitrin-container flex items-center justify-between">
          {/* Logo */}
          <Link href="/" aria-label="Skytech Green ana sayfa" className="flex items-center group">
            <Image
              src="/images/brand/logo.webp"
              alt="Skytech Green"
              width={180}
              height={56}
              priority
              className="h-10 lg:h-11 w-auto transition-transform group-hover:scale-[1.03]"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => item.children && setOpenDropdown(item.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                {item.children ? (
                  <button
                    className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-1 transition-colors ${
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
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
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
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm font-semibold text-[#1a2e1a] hover:text-[#1B6B3A] transition-colors"
            >
              Giriş Yap
            </Link>
            <Link href="/bireysel/satin-al" className="vitrin-cta-primary !py-2.5 !px-5 !text-sm">
              Tohum Sipariş Et
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-[#1a2e1a] hover:bg-[#1B6B3A]/8 transition-colors"
            aria-label="Menü"
          >
            {mobileOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer — Premium glass + stagger */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
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
                  Menü
                </p>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-10 h-10 rounded-xl premium-glass-dark flex items-center justify-center"
                  aria-label="Kapat"
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
                <Link
                  href="/auth/login"
                  className="block w-full text-center py-3 rounded-xl premium-glass-dark text-sm font-bold text-white"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/bireysel/satin-al"
                  className="block w-full text-center py-3 rounded-xl bg-gradient-to-br from-[#1B6B3A] via-[#22894a] to-[#1B6B3A] text-white text-sm font-bold shadow-lg shadow-[#1B6B3A]/30"
                >
                  Tohum Sipariş Et →
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

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <path d="M27 5C27 5 22 4 16 6C10 8 6 13 6 19C6 22 8 25 11 26C8 24 7 21 7 19C7 14 11 9 17 8C12 11 9 16 9 20C9 24 11 27 14 27C20 27 26 22 27 5Z" fill="currentColor" />
      <path d="M11 26C9 25 7 22 7 19C7 22 8 25 11 26Z" fill="currentColor" opacity="0.6" />
    </svg>
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
