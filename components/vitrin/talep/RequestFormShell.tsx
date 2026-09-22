"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ErrorBanner, SummaryRowItem } from "./FormPrimitives";

/**
 * Talep formlarının ortak iskeleti: solda bölümler + gönder düğmesi,
 * sağda (masaüstü) yapışkan özet kartı ve "ödeme alınmaz" notu.
 * `top`: formun üstündeki şerit (diğer akışa geçiş bağlantısı vb.).
 */
export default function RequestFormShell({
  onSubmit,
  submitting,
  formError,
  summary,
  top,
  children,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  formError: string | null;
  summary: { label: string; value: ReactNode }[];
  top?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("requestForms.common");

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10 max-w-6xl mx-auto">
      <div className="lg:col-span-2 space-y-6">
        {top}

        {children}

        <div className="space-y-4">
          <ErrorBanner message={formError} />
          <button
            type="submit"
            disabled={submitting}
            className="vitrin-cta-primary w-full justify-center disabled:opacity-70"
          >
            {submitting ? t("submitting") : t("submit")}
            {!submitting && (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <p className="text-xs text-[#6b8f6b] text-center leading-relaxed">{t("noPayment")}</p>
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-28 space-y-5">
          <div className="vitrin-card p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1B6B3A] mb-3">{t("summary.title")}</p>
            {summary.length === 0 ? (
              <p className="text-sm text-[#6b8f6b] leading-relaxed">{t("summary.empty")}</p>
            ) : (
              <div>
                {summary.map((row, i) => (
                  <SummaryRowItem key={i} label={row.label} value={row.value} />
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl bg-[#f8faf5] border border-[#1B6B3A]/10 p-5">
            <p className="text-xs text-[#3d5a3d] leading-relaxed">{t("noPayment")}</p>
          </div>
        </div>
      </aside>
    </form>
  );
}
