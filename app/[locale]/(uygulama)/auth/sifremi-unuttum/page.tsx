"use client";

import { useState } from "react";
import { Link, getPathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase/browser";
import AuthShell, { authInputClass } from "@/components/auth/AuthShell";

/**
 * Şifre sıfırlama bağlantısı talebi.
 *
 * Yanıt her durumda aynı "gönderildi" ekranıdır — e-postanın kayıtlı olup
 * olmadığı dışarı sızmaz. Bağlantı /api/auth/callback (aynı tarayıcı) ya da
 * Supabase şablonu token_hash'e çevrildiyse /api/auth/confirm (her cihaz)
 * üzerinden /auth/sifre-yenile'ye düşer.
 */
export default function SifremiUnuttumPage() {
  const t = useTranslations("authPages");
  const locale = useLocale();
  const localPath = (href: string) => getPathname({ locale, href });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError(t("validEmail"));
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(value, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(localPath("/auth/sifre-yenile"))}`,
    });
    setLoading(false);
    // Hız sınırı dışındaki hatalarda da "gönderildi" gösterilir (enumeration önlemi)
    if (err && /rate limit|too many/i.test(err.message)) {
      setError(t("rateLimited"));
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell
      title={t("forgotTitle")}
      subtitle={t("forgotSubtitle")}
      footer={
        <>
          <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            {t("backLogin")}</Link>
        </>
      }
    >
      {sent ? (
        <div className="liquid-glass relative rounded-3xl p-8 overflow-hidden text-center">
          <div className="relative z-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <polyline points="3 7 12 13 21 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white">{t("sentTitle")}</h2>
            <p className="text-sm text-emerald-200/50 mt-2 leading-relaxed">
              {t("sentMessage")}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="liquid-glass relative rounded-3xl p-8 overflow-hidden" noValidate>
          <div className="relative z-10 space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-emerald-200/50 mb-2">{t("email")}</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@mail.com"
                autoComplete="email"
                required
                className={authInputClass}
              />
            </div>
            {error && (
              <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-2xl">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 glass-btn rounded-2xl text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? t("sending") : t("sendLink")}
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
