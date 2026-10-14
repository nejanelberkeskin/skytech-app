"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase/browser";
import { BuildingIcon } from "@/components/ui/Icons";

export default function CorporateLogin() {
  const router = useRouter();
  const t = useTranslations("corporatePages.login");
  const tc = useTranslations("corporatePages");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError(t("errors.required"));
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (authError.code === "invalid_credentials" || authError.message === "Invalid login credentials") {
        setError(t("errors.invalid"));
      } else if (authError.code === "email_not_confirmed" || authError.message === "Email not confirmed") {
        setError(t("errors.unconfirmed"));
      } else {
        // Ham sağlayıcı iletisi gösterilmez.
        setError(t("errors.generic"));
      }
      setLoading(false);
      return;
    }

    router.push("/kurumsal/panel");
    router.refresh();
  };

  const inputClasses = "w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all";

  return (
    <div className="relative min-h-screen flex flex-col bg-[#f6f7f5] text-slate-900" style={{ colorScheme: "light" }}>

      {/* Top bar — beyazımsı liquid, logo dark zeminde net okunur */}
      <nav
        className="relative z-10 border-b border-slate-200 bg-white"
        
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label={tc("homeAria")}>
            <Image
              src="/images/brand/logo.webp"
              alt="Skytech Green"
              width={256}
              height={32}
              priority
              className="h-5 w-auto sm:h-6"
            />
          </Link>
          <Link href="/kurumsal/basvuru" className="text-xs sm:text-sm font-semibold text-[#1a2e1a] hover:text-[#1B6B3A] transition-colors text-right">
            <span className="hidden sm:inline">{t("noAccount")} </span>{t("getQuote")}
          </Link>
        </div>
      </nav>

      {/* Login card */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0f7ec] text-[#1B6B3A]">
              <BuildingIcon className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
            <p className="text-slate-500 text-sm mt-2">{t("subtitle")}</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5 overflow-hidden relative">
            <div className="relative z-10">
              <div>
                <label htmlFor="kurumsal-eposta" className="block text-sm font-medium text-slate-700 mb-2">{t("email")}</label>
                <input
                  id="kurumsal-eposta"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  autoComplete="email"
                  className={inputClasses}
                />
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="kurumsal-sifre" className="text-sm font-medium text-slate-700">{t("password")}</label>
                  <Link href="/auth/sifremi-unuttum" className="text-xs text-emerald-700 hover:text-emerald-700 transition-colors">
                    {t("forgot")}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="kurumsal-sifre"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`${inputClasses} pr-20`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    {showPass ? t("hide") : t("show")}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="mt-5 bg-rose-500/10 border border-rose-500/20 text-rose-700 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-5 py-3.5 bg-[#1B6B3A] hover:bg-[#165c31] rounded-lg text-white font-medium transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-slate-200 border-t-slate-200 rounded-full animate-spin" />
                    {t("submitting")}
                  </span>
                ) : (
                  t("submit")
                )}
              </button>

              <div className="flex items-center gap-3 pt-4 mt-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-500">{t("or")}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <Link
                href="/kurumsal/basvuru"
                className="block w-full mt-4 py-3.5 border border-slate-200 hover:border-slate-200 text-slate-500 hover:text-slate-900 font-medium rounded-lg text-center text-sm transition-all"
              >
                {t("quoteAndAccount")}
              </Link>
            </div>
          </form>

          <p className="text-center text-xs text-slate-500">
            {t("trouble")}{" "}
            <a href="mailto:info@skytechgreen.com" className="text-emerald-700 hover:underline">
              info@skytechgreen.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
