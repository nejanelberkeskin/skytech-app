"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type Language,
} from "@/lib/i18n";

const COOKIE_NAME = "skytech_lang";

function readCookie(): Language {
  if (typeof document === "undefined") return DEFAULT_LANGUAGE;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const v = match?.[2];
  if (v === "tr" || v === "en") return v;
  return DEFAULT_LANGUAGE;
}

function writeCookie(lang: Language) {
  if (typeof document === "undefined") return;
  // 1 yıl
  document.cookie = `${COOKIE_NAME}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

interface Props {
  variant?: "light" | "dark";
}

export default function LanguageSwitcher({ variant = "dark" }: Props) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Language>(DEFAULT_LANGUAGE);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLang(readCookie());
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  const select = (next: Language) => {
    setLang(next);
    writeCookie(next);
    setOpen(false);
    // İleride app/[lang]/ routing'e geçince burada router.push("/" + next + ...) yapılacak.
    // Şu an sadece tercih cookie'ye yazılıyor, vitrin metinleri ileride dictionary'den çekilecek.
  };

  const triggerClasses =
    variant === "dark"
      ? "bg-white/5 border border-white/10 text-[#a7d4a7] hover:bg-white/10 hover:text-white"
      : "bg-white border border-black/8 text-[#3d5a3d] hover:border-[#1B6B3A]/20 hover:text-[#1B6B3A]";

  const menuClasses =
    variant === "dark" ? "premium-glass-dark" : "premium-glass";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-[0.14em] transition-colors ${triggerClasses}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{LANGUAGE_LABELS[lang].flag}</span>
        <span>{lang.toUpperCase()}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute right-0 bottom-full mb-2 min-w-[180px] rounded-2xl p-2 shadow-2xl ${menuClasses}`}
            role="listbox"
          >
            {SUPPORTED_LANGUAGES.map((opt) => {
              const isActive = opt === lang;
              const txt =
                variant === "dark"
                  ? isActive
                    ? "text-white bg-[#22894a]/15"
                    : "text-[#a7d4a7] hover:bg-white/5 hover:text-white"
                  : isActive
                  ? "text-[#1B6B3A] bg-[#1B6B3A]/8"
                  : "text-[#3d5a3d] hover:bg-black/5 hover:text-[#1B6B3A]";
              return (
                <button
                  key={opt}
                  onClick={() => select(opt)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-semibold ${txt}`}
                  role="option"
                  aria-selected={isActive}
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{LANGUAGE_LABELS[opt].flag}</span>
                    <span>{LANGUAGE_LABELS[opt].native}</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] opacity-60">
                    {opt}
                  </span>
                </button>
              );
            })}
            <div className="px-3 py-2 mt-1 border-t border-white/5">
              <p className="text-[10px] text-[#6b8f6b] leading-relaxed">
                {variant === "dark"
                  ? "İngilizce çeviri yakında — tercihiniz kaydedildi."
                  : "English translation coming soon — preference saved."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
