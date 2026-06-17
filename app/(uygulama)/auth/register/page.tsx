"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", passwordConfirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const passwordValid = form.password.length >= 8;
  const passwordsMatch = form.password === form.passwordConfirm;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.fullName || !form.email || !form.password) {
      setError("Tüm alanları doldurun."); return;
    }
    if (!passwordValid) { setError("Şifre en az 8 karakter olmalı."); return; }
    if (!passwordsMatch) { setError("Şifreler eşleşmiyor."); return; }

    setLoading(true);

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName, account_type: "individual" },
      },
    });

    if (authError) {
      setError(
        authError.message === "User already registered"
          ? "Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin."
          : authError.message
      );
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        full_name: form.fullName,
        email: form.email,
      });
    }

    setLoading(false);
    router.push("/hesabim");
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

      {/* Nav */}
      <nav className="relative z-10 px-6 py-5">
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
            <h1 className="text-3xl font-bold text-white">Aramıza Katılın</h1>
            <p className="text-emerald-200/40 text-sm mt-3">Doğaya katkınızı takip edin, sertifikalarınızı yönetin.</p>
          </div>

          <form onSubmit={handleRegister} className="liquid-glass relative rounded-3xl p-8 space-y-5 overflow-hidden">
            <div className="relative z-10 space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-emerald-200/50 mb-2">Ad Soyad</label>
                <input
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder="Adınız Soyadınız"
                  autoComplete="name"
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-300"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-emerald-200/50 mb-2">E-posta</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="ornek@mail.com"
                  autoComplete="email"
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-300"
                />
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-emerald-200/50 mb-2">Şifre</label>
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder="En az 8 karakter"
                    autoComplete="new-password"
                    className={`w-full px-4 py-3.5 bg-white/[0.03] border rounded-2xl text-white placeholder:text-emerald-200/20 outline-none transition-all duration-300 ${
                      form.password && !passwordValid
                        ? "border-rose-500/30 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20"
                        : "border-white/[0.08] focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-emerald-200/50 mb-2">Şifre Tekrar</label>
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.passwordConfirm}
                    onChange={(e) => set("passwordConfirm", e.target.value)}
                    placeholder="Tekrarlayın"
                    autoComplete="new-password"
                    className={`w-full px-4 py-3.5 bg-white/[0.03] border rounded-2xl text-white placeholder:text-emerald-200/20 outline-none transition-all duration-300 ${
                      form.passwordConfirm && !passwordsMatch
                        ? "border-rose-500/30 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20"
                        : "border-white/[0.08] focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
                    }`}
                  />
                </div>
              </div>
              {form.passwordConfirm && !passwordsMatch && (
                <p className="text-xs text-rose-400 -mt-3 animate-fade-in">Şifreler eşleşmiyor.</p>
              )}

              {/* Show password toggle */}
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="text-xs text-emerald-200/30 hover:text-emerald-200/60 transition-colors"
              >
                {showPass ? "Şifreleri Gizle" : "Şifreleri Göster"}
              </button>

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="w-5 h-5 rounded-lg border border-white/[0.12] bg-white/[0.03] peer-checked:bg-emerald-500/20 peer-checked:border-emerald-500/40 transition-all" />
                  <svg className="absolute inset-0 w-5 h-5 text-emerald-400 opacity-0 peer-checked:opacity-100 transition-opacity p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xs text-emerald-200/30 group-hover:text-emerald-200/50 transition-colors leading-relaxed">
                  <Link href="#" className="text-emerald-400/60 hover:text-emerald-300 transition-colors">Kullanım koşullarını</Link> ve{" "}
                  <Link href="#" className="text-emerald-400/60 hover:text-emerald-300 transition-colors">gizlilik politikasını</Link> kabul ediyorum.
                </span>
              </label>

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
                    Hesap oluşturuluyor...
                  </span>
                ) : "Üye Ol"}
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
                    options: { redirectTo: `${window.location.origin}/hesabim` },
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
                Google ile Üye Ol
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-emerald-200/30">
            Zaten hesabınız var mı?{" "}
            <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
