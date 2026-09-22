"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { readConsent, subscribeConsent, writeConsent, type CookieConsent as Consent } from "@/lib/analytics";

const REOPEN_EVENT = "open-cookie-preferences";

const CHOICE_BUTTON =
  "flex-1 min-h-11 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0e2519] bg-white border border-[#1B6B3A]/40 hover:bg-[#edf4e9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B6B3A] transition-colors";

/** Footer'daki "Çerez Tercihleri" linkinden banner'ı yeniden açmak için. */
export function reopenCookiePreferences(): void {
  window.dispatchEvent(new Event(REOPEN_EVENT));
}

export default function CookieConsentBanner() {
  const t = useTranslations("cookieConsent");
  // Kayıtlı tercih depodan okunur (sunucuda ve ilk boyamada "bilinmiyor" → bant gösterilmez, titreme olmaz).
  const stored = useSyncExternalStore<Consent | null | "unknown">(subscribeConsent, readConsent, () => "unknown");
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const handleReopen = () => setReopened(true);
    window.addEventListener(REOPEN_EVENT, handleReopen);
    return () => window.removeEventListener(REOPEN_EVENT, handleReopen);
  }, []);

  function choose(consent: Consent) {
    writeConsent(consent);
    setReopened(false);
  }

  // Tercih hiç yapılmadıysa ya da "Çerez Tercihleri"nden yeniden açıldıysa görünür.
  const visible = reopened || stored === null;

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-x-auto sm:left-6 sm:bottom-6 sm:max-w-md animate-fade-in">
      <div className="vitrin-card !rounded-none sm:!rounded-2xl p-5 sm:p-6 !bg-white/95 shadow-2xl shadow-black/15 border-t sm:border border-black/5">
        <p className="text-sm text-[#3d5a3d] leading-relaxed mb-4">
          {t("message")}{" "}
          <Link
            href="/cerez-politikasi"
            className="text-[#1B6B3A] font-semibold underline underline-offset-2 hover:text-[#22894a]"
          >
            {t("policyLink")}
          </Link>
        </p>
        <div className="flex items-center gap-2.5">
          {/* İki seçenek AYNI görünürlüktedir (renk, boyut, punto): ret düğmesi geri plana itilmez. */}
          <button type="button" onClick={() => choose("denied")} className={CHOICE_BUTTON}>
            {t("rejectAll")}
          </button>
          <button type="button" onClick={() => choose("granted")} className={CHOICE_BUTTON}>
            {t("acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}
