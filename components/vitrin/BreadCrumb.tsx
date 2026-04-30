"use client";

import Link from "next/link";
import { motion } from "framer-motion";

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
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2 text-xs font-medium text-[#a7d4a7] mb-6"
        >
          <Link href="/" className="hover:text-white transition-colors">
            Ana Sayfa
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
        </motion.nav>

        {/* Title — word-by-word reveal */}
        <h1 className="display-headline text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 max-w-4xl">
          <WordReveal text={title} className="text-white" />
        </h1>

        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="text-base lg:text-xl text-[#a7d4a7] max-w-2xl leading-relaxed font-light"
          >
            {subtitle}
          </motion.p>
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
          <span className="inline-block overflow-hidden align-bottom">
            <motion.span
              className="inline-block"
              initial={{ y: "110%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              transition={{
                duration: 0.85,
                delay: 0.15 + i * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}
