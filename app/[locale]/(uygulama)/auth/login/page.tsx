"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
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

const LINK_MESSAGES: Record<string, string> = {
  link: "Bağlantı bu tarayıcıda doğrulanamadı. Hesabınız onaylandıysa giriş yapabilirsiniz; şifrenizi unuttuysanız yeni bağlantı isteyin.",
  confirm: "Doğrulama bağlantısı geçersiz ya da süresi dolmuş. Giriş yapmayı deneyin; gerekiyorsa yeni bağlantı isteyin.",
  oauth: "Google ile giriş tamamlanamadı. Lütfen tekrar deneyin.",
};

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeNext(searchParams.get("redirect"), "/hesabim");
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
    if (!email.trim() || !password) return setError("E-posta ve şifre zorunludur.");

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });

    if (authError) {
      setLoading(false);
      setError(
        /invalid login credentials/i.test(authError.message)
          ? "E-posta veya şifre hatalı."
          : /email not confirmed/i.test(authError.message)
            ? "E-posta adresinizi doğrulamanız gerekiyor. Gelen kutunuzdaki bağlantıya tıklayın."
            : /rate limit|too many/i.test(authError.message)
              ? "Kısa sürede çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin."
              : "Giriş yapılamadı. Lütfen tekrar deneyin."
      );
      return;
    }

    await claimPendingRequest(talepId);
    router.push(redirect);
    router.refresh();
  };

  return (
    <AuthShell
      title="Tekrar Hoş Geldiniz"
      subtitle="Hesabınıza giriş yaparak taleplerinizi takip edin."
      footer={
        <>
          Hesabınız yok mu?{" "}
          <Link href={talepId ? `/auth/register?talep=${encodeURIComponent(talepId)}` : "/auth/register"} className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            Üye Ol
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="liquid-glass relative rounded-3xl p-8 overflow-hidden" noValidate>
        <div className="relative z-10 space-y-5">
          {linkNotice && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 leading-relaxed">{linkNotice}</p>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-emerald-200/50 mb-2">E-posta</label>
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
              <label htmlFor="password" className="text-sm font-medium text-emerald-200/50">Şifre</label>
              <Link href="/auth/sifremi-unuttum" className="text-xs text-emerald-400/60 hover:text-emerald-300 transition-colors">
                Şifremi unuttum
              </Link>
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
                {showPass ? "Gizle" : "Göster"}
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
                Giriş yapılıyor…
              </span>
            ) : "Giriş Yap"}
          </button>

          {GOOGLE_AUTH_ENABLED && (
            <>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-xs text-emerald-200/20">veya</span>
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
                Google ile Giriş Yap
              </button>
            </>
          )}
        </div>
      </form>
    </AuthShell>
  );
}
