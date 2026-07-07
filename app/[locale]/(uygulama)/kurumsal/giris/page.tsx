"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { BuildingIcon } from "@/components/ui/Icons";

export default function CorporateLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("E-posta ve şifre zorunludur.");
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (authError.message === "Invalid login credentials") {
        setError("E-posta veya şifre hatalı.");
      } else if (authError.message === "Email not confirmed") {
        setError("E-posta adresinizi doğrulamanız gerekiyor. Gelen kutunuzu kontrol edin.");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    router.push("/kurumsal/panel");
    router.refresh();
  };

  const inputClasses = "w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all";

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background */}
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
      </div>

      {/* Top bar — beyazımsı liquid, logo dark zeminde net okunur */}
      <nav
        className="relative z-10 vitrin-navbar-top"
        style={{ backdropFilter: "blur(20px) saturate(1.4)", WebkitBackdropFilter: "blur(20px) saturate(1.4)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/kurumsal" className="flex items-center gap-2.5 shrink-0" aria-label="Skytech Green Kurumsal">
            <Image
              src="/images/brand/logo.webp"
              alt="Skytech Green"
              width={130}
              height={34}
              priority
              className="h-8 w-auto"
            />
          </Link>
          <Link href="/kurumsal/teklif-al" className="text-xs sm:text-sm font-semibold text-[#1a2e1a] hover:text-[#1B6B3A] transition-colors text-right">
            <span className="hidden sm:inline">Henüz hesabınız yok mu? </span>Teklif alın →
          </Link>
        </div>
      </nav>

      {/* Login card */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          <div className="text-center">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.1))", border: "1px solid rgba(52,211,153,0.2)" }}>
              <BuildingIcon className="w-8 h-8 text-emerald-300" strokeWidth={1.6} />
            </div>
            <h1 className="text-2xl font-bold text-white">Kurumsal Giriş</h1>
            <p className="text-emerald-200/40 text-sm mt-2">
              Teklifinizi ve orman panelinizi görüntüleyin.
            </p>
          </div>

          <form onSubmit={handleLogin} className="liquid-glass rounded-3xl p-8 space-y-5 overflow-hidden relative">
            <div className="relative z-10">
              <div>
                <label className="block text-sm font-medium text-emerald-200/50 mb-2">
                  Kurumsal E-posta
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yetkili@sirket.com"
                  autoComplete="email"
                  className={inputClasses}
                />
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-emerald-200/50">Şifre</label>
                  <button type="button" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
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
                    className={`${inputClasses} pr-20`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-200/30 hover:text-white transition-colors"
                  >
                    {showPass ? "Gizle" : "Göster"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-3 rounded-2xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-5 py-3.5 glass-btn rounded-2xl text-white font-medium transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Giriş yapılıyor...
                  </span>
                ) : (
                  "Giriş Yap"
                )}
              </button>

              <div className="flex items-center gap-3 pt-4 mt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <span className="text-xs text-emerald-200/20">veya</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>

              <Link
                href="/kurumsal/teklif-al"
                className="block w-full mt-4 py-3.5 border border-white/[0.08] hover:border-white/[0.15] text-emerald-200/50 hover:text-white font-medium rounded-2xl text-center text-sm transition-all"
              >
                Teklif Al & Hesap Oluştur
              </Link>
            </div>
          </form>

          <p className="text-center text-xs text-emerald-200/20">
            Hesabınızda sorun mu var?{" "}
            <a href="mailto:info@skytechgreen.com" className="text-emerald-400 hover:underline">
              info@skytechgreen.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
