"use client";

import { reopenCookiePreferences } from "@/components/analytics/CookieConsentBanner";

/** Çerez bandını yeniden açar. Varsayılan görünüm alt bilgi içindir; `className` ile değiştirilebilir. */
export default function CookiePreferencesLink({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={reopenCookiePreferences} className={className ?? "text-[#6b8f6b] hover:text-white transition-colors"}>
      {label}
    </button>
  );
}
