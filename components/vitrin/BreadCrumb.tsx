"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface BreadCrumbItem {
  label: string;
  href?: string;
}

interface BreadCrumbProps {
  title: string;
  contentLanguage?: string;
  subtitle?: string;
  items?: BreadCrumbItem[];
  /* GORSEL: opsiyonel arka plan görseli (örn: /images/echofy/breadcrumb-bg.jpg) */
  backgroundImage?: string;
}

export default function BreadCrumb({ title, subtitle, items = [], backgroundImage, contentLanguage }: BreadCrumbProps) {
  const t = useTranslations("nav");
  return (
    <div className="relative overflow-hidden border-b border-[#14261a]/10 bg-[#f6f6f1]">

      {/* Optional background image */}
      {backgroundImage && (
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      <div className="relative vitrin-container py-14 lg:py-20">
        {/* Breadcrumb trail */}
        <nav
          className="flex items-center gap-2 flex-wrap text-xs font-medium text-[#6b8f6b] mb-6"
        >
          <Link href="/" className="hover:text-[#1B6B3A] transition-colors">
            {t("home")}
          </Link>
          {items.map((item, idx) => (
            <span key={idx} className="flex items-center gap-2">
              <span className="text-[#14261a]/25">/</span>
              {item.href ? (
                <Link href={item.href} className="hover:text-[#1B6B3A] transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-[#14261a]">{item.label}</span>
              )}
            </span>
          ))}
        </nav>

        {/* CSS keeps text readable without hydration and honors reduced motion. */}
        <h1 lang={contentLanguage} className="display-headline text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 max-w-4xl wrap-break-word">
          <span className="text-[#14261a]">{title}</span>
        </h1>

        {subtitle && (
          <p
            className="text-base lg:text-xl text-[#3d5a3d] max-w-2xl leading-relaxed"
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
