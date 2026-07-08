"use client";

import { reopenCookiePreferences } from "@/components/analytics/CookieConsentBanner";

export default function CookiePreferencesLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={reopenCookiePreferences}
      className="text-[#6b8f6b] hover:text-white transition-colors"
    >
      {label}
    </button>
  );
}
