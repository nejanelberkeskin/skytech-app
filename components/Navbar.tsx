"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-[padding,background-color,box-shadow] duration-300 ${
        scrolled ? "vitrin-navbar-scrolled py-3" : "vitrin-navbar-top py-5"
      }`}
      style={{
        backdropFilter: scrolled ? "blur(20px) saturate(1.3)" : "blur(16px) saturate(1.25)",
        WebkitBackdropFilter: scrolled ? "blur(20px) saturate(1.3)" : "blur(16px) saturate(1.25)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
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

        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/lands">Araziler</NavLink>
          <NavLink href="/kurumsal">Kurumsal</NavLink>
          <NavLink href="/kargo-takip">Kargo Takip</NavLink>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="hidden sm:block px-4 py-2 text-sm font-semibold text-[#1a2e1a] hover:text-[#1B6B3A] transition-colors"
          >
            Giriş Yap
          </Link>
          <Link
            href="/auth/register"
            className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white bg-gradient-to-br from-[#1B6B3A] via-[#22894a] to-[#1B6B3A] shadow-lg shadow-[#1B6B3A]/25 hover:shadow-[#1B6B3A]/40 transition-shadow"
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
      className="px-4 py-2 text-sm font-semibold text-[#1a2e1a] hover:text-[#1B6B3A] rounded-lg transition-colors"
    >
      {children}
    </Link>
  );
}
