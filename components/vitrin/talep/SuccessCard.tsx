"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ACCOUNTS_ENABLED, REQUEST_ROUTES } from "@/lib/site-config";
import type { SubmitSuccess } from "./useRequestForm";

/**
 * Başarı ekranı — talep numarası, sonraki adımlar, hesap bağlantısı.
 * Üye değilse kayıt sayfasına talep kimliğiyle gider (kayıt sonrası
 * /api/auth/claim-request ile hesaba bağlanır); üyeyse "Taleplerim".
 */
export default function SuccessCard({
  result,
  email,
  isLoggedIn,
}: {
  result: SubmitSuccess;
  email: string;
  isLoggedIn: boolean;
}) {
  const t = useTranslations("requestForms.common.success");
  const [copied, setCopied] = useState(false);
  const steps = t.raw("next") as string[];

  useEffect(() => {
    // Yeni ekran açılınca başa kaydır (mobilde form uzun)
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.requestNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // pano erişimi yoksa sessiz geç
    }
  };

  const registerHref = { pathname: "/auth/register", query: { talep: result.requestId } } as const;

  return (
    <div className="vitrin-card p-7 lg:p-10 max-w-3xl mx-auto">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#1B6B3A]/10 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-[#1B6B3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-2xl lg:text-3xl font-bold text-[#0e2519] mb-2">{t("title")}</h2>
        <p className="text-sm lg:text-base text-[#3d5a3d]">{t("desc")}</p>
      </div>

      <div className="mt-8 rounded-2xl bg-[#f8faf5] border border-[#1B6B3A]/15 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b8f6b] mb-2">{t("numberLabel")}</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="font-mono text-2xl lg:text-3xl font-bold tracking-wider text-[#1B6B3A]">{result.requestNo}</span>
          <button
            type="button"
            onClick={copy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-black/10 bg-white text-[#1a2e1a] hover:border-[#1B6B3A]/40 transition-colors"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
        {email && <p className="text-xs text-[#6b8f6b] mt-3">{t("emailNote", { email })}</p>}
      </div>

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b8f6b] mb-3">{t("nextTitle")}</p>
        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-[#1a2e1a]">
              <span className="shrink-0 w-6 h-6 rounded-lg bg-[#1B6B3A]/10 text-[#1B6B3A] text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {ACCOUNTS_ENABLED && (
        <div className="mt-8 rounded-2xl border border-black/5 bg-white p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-bold text-[#0e2519]">{t("accountTitle")}</p>
            {!isLoggedIn && <p className="text-sm text-[#3d5a3d] mt-1">{t("accountDesc")}</p>}
          </div>
          {isLoggedIn ? (
            <Link href="/hesabim/taleplerim" className="vitrin-cta-primary !py-2.5 !px-5 !text-sm shrink-0">
              {t("trackCta")}
            </Link>
          ) : (
            <Link href={registerHref} className="vitrin-cta-primary !py-2.5 !px-5 !text-sm shrink-0">
              {t("accountCta")}
            </Link>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center text-sm">
        <Link href={REQUEST_ROUTES.hub} className="vitrin-cta-secondary !py-2.5 !px-5 !text-sm justify-center">
          {t("another")}
        </Link>
        <Link href="/" className="px-5 py-2.5 font-semibold text-[#1B6B3A] hover:text-[#22894a] text-center transition-colors">
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
