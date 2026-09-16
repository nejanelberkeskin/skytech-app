import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

/** Kayıt / giriş / şifre sayfalarının ortak çerçevesi (koyu uygulama teması). */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
        <div className="nature-orb nature-orb-3" />
      </div>
      <nav
        className="relative z-10 vitrin-navbar-top px-6 py-4"
        style={{ backdropFilter: "blur(16px) saturate(1.25)", WebkitBackdropFilter: "blur(16px) saturate(1.25)" }}
      >
        <Link href="/" className="flex items-center gap-2.5 w-fit group" aria-label="Skytech Green ana sayfa">
          <Image
            src="/images/brand/logo.webp"
            alt="Skytech Green"
            width={288}
            height={36}
            priority
            className="h-9 w-auto transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
      </nav>
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-emerald-200/40 text-sm mt-3">{subtitle}</p>}
          </div>
          {children}
          {footer && <p className="text-center text-sm text-emerald-200/30">{footer}</p>}
        </div>
      </div>
    </div>
  );
}

export const authInputClass =
  "w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-300";

export const authInputErrorClass =
  "w-full px-4 py-3.5 bg-white/[0.03] border border-rose-500/30 rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all duration-300";

export function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
