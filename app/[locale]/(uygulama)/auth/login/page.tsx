"use client";

import { Suspense, useEffect, useState } from "react";
import { Link, getPathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { GOOGLE_AUTH_ENABLED } from "@/lib/site-config";
import { safeNext } from "@/lib/auth/safe-next";
import { claimPendingRequest, isRequestId, savePendingClaim } from "@/lib/requests/client";
import AuthShell, { GoogleIcon, authInputClass } from "@/components/auth/AuthShell";

export default function LoginPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}



function LoginPage() {
  const t = useTranslations("authPages");
  const locale = useLocale();
  const localPath = (href: string) => getPathname({ locale, href });
  const LINK_MESSAGES: Record<string, string> = {
  link: t("linkError"),
  confirm: t("confirmError"),
  oauth: t("oauthError"),
};
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeNext(searchParams.get("redirect"), localPath("/hesabim"));
  const talepId = searchParams.get("talep");
  const linkNotice = LINK_MESSAGES[searchParams.get("error") ?? ""] ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isRequestId(talepId)) savePendingClaim(talepId);
  }, [talepId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return setError(t("required"));

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });

    if (authError) {
      setLoading(false);
      setError(
        /invalid login credentials/i.test(authError.message)
          ? t("credentials")
          : /email not confirmed/i.test(authError.message)
            ? t("verifyRequired")
            : /rate limit|too many/i.test(authError.message)
              ? t("rateLimited")
              : t("loginError")
      );
      return;
    }

    await claimPendingRequest(talepId);
    router.push(redirect);
    router.refresh();
  };

  return (
    <AuthShell
      title={t("welcome")}
      subtitle={t("loginSubtitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href={talepId ? `/auth/register?talep=${encodeURIComponent(talepId)}` : "/auth/register"} className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            {t("register")}</Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="liquid-glass relative rounded-3xl p-8 overflow-hidden" noValidate>
        <div className="relative z-10 space-y-5">
          {linkNotice && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 leading-relaxed">{linkNotice}</p>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-emerald-200/50 mb-2">{t("email")}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@mail.com"
              autoComplete="email"
              className={authInputClass}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="text-sm font-medium text-emerald-200/50">{t("password")}</label>
              <Link href="/auth/sifremi-unuttum" className="text-xs text-emerald-400/60 hover:text-emerald-300 transition-colors">
                {t("forgotLink")}</Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className={`${authInputClass} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-emerald-200/30 hover:text-emerald-200/60 transition-colors"
              >
                {showPass ? t("hide") : t("show")}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-2xl">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 glass-btn rounded-2xl text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                {t("loggingIn")}</span>
            ) : t("login")}
          </button>

          {GOOGLE_AUTH_ENABLED && (
            <>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-xs text-emerald-200/20">{t("or")}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirect)}` },
                  });
                }}
                className="w-full py-3.5 glass-subtle rounded-2xl text-emerald-100/60 hover:text-white hover:bg-white/[0.06] font-medium text-sm transition-all duration-300 flex items-center justify-center gap-3"
              >
                <GoogleIcon />
                {t("googleLogin")}</button>
            </>
          )}
        </div>
      </form>
    </AuthShell>
  );
}
