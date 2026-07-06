"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
      </div>
    }>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/hesabim";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError("E-posta ve şifre zorunludur."); return; }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials" ? "E-posta veya şifre hatalı." :
        authError.message === "Email not confirmed" ? "E-posta adresinizi doğrulamanız gerekiyor." :
        authError.message
      );
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background */}
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
        <div className="nature-orb nature-orb-3" />
      </div>

      {/* Nav — beyazımsı liquid şerit, logo dark hero'da net okunur */}
      <nav
        className="relative z-10 vitrin-navbar-top px-6 py-4"
        style={{ backdropFilter: "blur(16px) saturate(1.25)", WebkitBackdropFilter: "blur(16px) saturate(1.25)" }}
      >
        <Link href="/" className="flex items-center gap-2.5 w-fit group" aria-label="Skytech Green ana sayfa">
          <Image
            src="/images/brand/logo.webp"
            alt="Skytech Green"
            width={140}
            height={36}
            priority
            className="h-9 w-auto transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
      </nav>

      {/* Form */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white">Tekrar Hoş Geldiniz</h1>
            <p className="text-emerald-200/40 text-sm mt-3">Hesabınıza giriş yaparak doğaya katkınızı takip edin.</p>
          </div>

          <form onSubmit={handleLogin} className="liquid-glass relative rounded-3xl p-8 space-y-5 overflow-hidden">
            <div className="relative z-10 space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-emerald-200/50 mb-2">E-posta</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@mail.com"
                  autoComplete="email"
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-300"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-emerald-200/50">Şifre</label>
                  <button type="button" className="text-xs text-emerald-400/60 hover:text-emerald-300 transition-colors">
                    Şifremi unuttum
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-300 pr-16"
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

              {/* Error */}
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-2xl animate-fade-in">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 glass-btn rounded-2xl text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Giriş yapılıyor...
                  </span>
                ) : "Giriş Yap"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-xs text-emerald-200/20">veya</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${window.location.origin}/auth/login?redirect=${encodeURIComponent(redirect)}` },
                  });
                }}
                className="w-full py-3.5 glass-subtle rounded-2xl text-emerald-100/60 hover:text-white hover:bg-white/[0.06] font-medium text-sm transition-all duration-300 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google ile Giriş Yap
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-emerald-200/30">
            Hesabınız yok mu?{" "}
            <Link href="/auth/register" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Üye Ol
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
