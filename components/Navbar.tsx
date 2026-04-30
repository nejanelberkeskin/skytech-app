"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "liquid-glass py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow duration-300">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21C12 21 4 14 4 8.5C4 5.5 7 3 9.5 3C11 3 12 4 12 4C12 4 13 3 14.5 3C17 3 20 5.5 20 8.5C20 14 12 21 12 21Z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-white">Skytech</span>
            <span className="text-gradient-eco">Green</span>
          </span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/lands">Araziler</NavLink>
          <NavLink href="/kurumsal">Kurumsal</NavLink>
          <NavLink href="/kargo-takip">Kargo Takip</NavLink>
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm text-emerald-200/80 hover:text-white transition-colors duration-300 hidden sm:block"
          >
            Giriş Yap
          </Link>
          <Link
            href="/auth/register"
            className="glass-btn px-5 py-2.5 rounded-2xl text-sm font-medium text-white"
          >
            Hemen Başla
          </Link>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 text-sm text-emerald-100/60 hover:text-white rounded-xl hover:bg-white/[0.05] transition-all duration-300"
    >
      {children}
    </Link>
  );
}
