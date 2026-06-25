"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Locale switcher — vitrin navbar'da ve mobil drawer'da kullanılır.
 * Aktif locale segment'i pathname'den okunur; tıklamada aynı path başka
 * locale prefix'iyle replace edilir.
 */
export default function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const t = useTranslations("languageSwitcher");
  const current = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const onChange = (newLocale: Locale) => {
    if (newLocale === current) return;
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={`inline-flex items-center gap-0.5 rounded-full p-0.5 text-[11px] font-semibold ${
        dark
          ? "bg-white/10 border border-white/15"
          : "bg-[#1B6B3A]/8 border border-[#1B6B3A]/15"
      }`}
    >
      {routing.locales.map((loc) => {
        const active = loc === current;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => onChange(loc)}
            disabled={pending}
            aria-pressed={active}
            className={`px-2.5 py-1 rounded-full uppercase tracking-widest transition-colors ${
              active
                ? dark
                  ? "bg-white/20 text-white"
                  : "bg-[#1B6B3A] text-white"
                : dark
                  ? "text-white/70 hover:text-white"
                  : "text-[#1a2e1a] hover:text-[#1B6B3A]"
            } disabled:opacity-50`}
          >
            {loc}
          </button>
        );
      })}
    </div>
  );
}
