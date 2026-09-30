"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface BreadCrumbItem {
  label: string;
  href?: string;
}

interface BreadCrumbProps {
  title: string;
  subtitle?: string;
  items?: BreadCrumbItem[];
  /* GORSEL: opsiyonel arka plan görseli (örn: /images/echofy/breadcrumb-bg.jpg) */
  backgroundImage?: string;
}

export default function BreadCrumb({ title, subtitle, items = [], backgroundImage }: BreadCrumbProps) {
  const t = useTranslations("nav");
  return (
    <div className="relative overflow-hidden mesh-dark grain-overlay">
      {/* Aurora */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      {/* Optional background image */}
      {backgroundImage && (
        <div
          className="absolute inset-0 opacity-25 mix-blend-overlay"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="relative vitrin-container py-24 lg:py-32">
        {/* Breadcrumb trail */}
        <nav
          className="flex items-center gap-2 text-xs font-medium text-[#a7d4a7] mb-6 motion-safe:animate-fade-in"
        >
          <Link href="/" className="hover:text-white transition-colors">
            {t("home")}
          </Link>
          {items.map((item, idx) => (
            <span key={idx} className="flex items-center gap-2">
              <span className="text-[#22894a]">/</span>
              {item.href ? (
                <Link href={item.href} className="hover:text-white transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-white">{item.label}</span>
              )}
            </span>
          ))}
        </nav>

        {/* CSS keeps text readable without hydration and honors reduced motion. */}
        <h1 className="display-headline text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 max-w-4xl">
          <WordReveal text={title} className="text-white" />
        </h1>

        {subtitle && (
          <p
            style={{ animationDuration: "0.9s", animationDelay: "0.45s" }}
            className="text-base lg:text-xl text-[#a7d4a7] max-w-2xl leading-relaxed font-light motion-safe:animate-fade-in-up"
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function WordReveal({ text, className = "" }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i}>
          {/* Kırpma kutusu satır kutusundan uzun olmalı; yoksa harflerin üst/alt
              uzantıları kesilir. Padding kutuyu büyütür, negatif margin yerleşimi korur. */}
          <span className="inline-block overflow-hidden align-bottom py-[0.16em] -my-[0.16em]">
            <span
              className="inline-block motion-safe:animate-fade-in-up"
              style={{ animationDuration: "0.85s", animationDelay: `${0.15 + i * 0.07}s` }}
            >
              {word}
            </span>
          </span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}
