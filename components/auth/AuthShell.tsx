"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import type { ReactNode } from "react";

/** Kayıt / giriş / şifre sayfalarının ortak çerçevesi: açık zemin, sade üst çubuk (yönetim ve kurumsal panelle aynı dil). */
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
  const t = useTranslations("authPages");
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7f5] text-slate-900" style={{ colorScheme: "light" }}>
      <nav className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <Link href="/" className="flex w-fit items-center" aria-label={t("home")}>
          <Image src="/images/brand/logo.webp" alt="Skytech Green" width={256} height={32} priority className="h-5 w-auto sm:h-6" />
        </Link>
      </nav>
      <div className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
          </div>
          {children}
          {footer && <p className="text-center text-sm text-slate-600">{footer}</p>}
        </div>
      </div>
    </div>
  );
}

export const authInputClass =
  "w-full min-h-[44px] px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none hover:border-slate-400 focus:border-[#1B6B3A] focus:ring-2 focus:ring-[#1B6B3A]/20 transition-colors";

export const authInputErrorClass =
  "w-full min-h-[44px] px-3.5 py-2.5 bg-white border border-red-400 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-colors";

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
