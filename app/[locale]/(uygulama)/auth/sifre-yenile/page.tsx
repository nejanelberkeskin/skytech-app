"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import AuthShell, { authInputClass, authInputErrorClass } from "@/components/auth/AuthShell";

/**
 * Yeni şifre belirleme. Sayfaya kurtarma bağlantısıyla gelen kullanıcıda
 * oturum vardır (/api/auth/confirm ya da /api/auth/callback çerezi yazar;
 * `?code=` ile gelinirse tarayıcı istemcisi kendisi değiştirir). Oturum
 * yoksa bağlantı geçersiz/süresi dolmuş kabul edilir.
 */
export default function SifreYenilePageWrapper() {
  return (
    <Suspense fallback={<Spinner />}>
      <SifreYenilePage />
    </Suspense>
  );
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
    </div>
  );
}

function SifreYenilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error");

  const [ready, setReady] = useState<"checking" | "ok" | "invalid">(linkError ? "invalid" : "checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (linkError) return;
    let alive = true;
    // `?code=` varsa istemci değişimi biraz sürebilir; auth olayını da dinle.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (session && (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
        setReady("ok");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) setReady("ok");
    });
    const timer = setTimeout(() => {
      if (alive) setReady((r) => (r === "checking" ? "invalid" : r));
    }, 4000);
    return () => {
      alive = false;
      clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [linkError]);

  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passwordValid) return setError("Şifre en az 8 karakter olmalı.");
    if (!passwordsMatch) return setError("Şifreler eşleşmiyor.");
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(
        /same password/i.test(err.message)
          ? "Yeni şifre eskisiyle aynı olamaz."
          : /weak|pwned|compromised/i.test(err.message)
            ? "Bu şifre yeterince güçlü değil ya da sızmış şifre listelerinde yer alıyor. Farklı bir şifre seçin."
            : "Şifre güncellenemedi. Bağlantının süresi dolmuş olabilir; yeni bir bağlantı isteyin."
      );
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/hesabim");
      router.refresh();
    }, 1500);
  };

  if (ready === "checking") return <Spinner />;

  if (ready === "invalid") {
    return (
      <AuthShell title="Bağlantı Geçersiz" subtitle="Şifre yenileme bağlantısı geçersiz ya da süresi dolmuş.">
        <div className="liquid-glass relative rounded-3xl p-8 overflow-hidden text-center">
          <div className="relative z-10 space-y-4">
            <p className="text-sm text-emerald-200/50 leading-relaxed">
              Bağlantılar tek kullanımlıktır ve kısa süre geçerlidir. Bağlantıyı, talebi yaptığınız tarayıcıda açtığınızdan
              emin olun ya da yeni bir bağlantı isteyin.
            </p>
            <Link href="/auth/sifremi-unuttum" className="inline-block w-full py-3.5 glass-btn rounded-2xl text-white font-medium transition-all">
              Yeni Bağlantı İste
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Yeni Şifre Belirleyin" subtitle="Hesabınız için yeni bir şifre seçin.">
      {done ? (
        <div className="liquid-glass relative rounded-3xl p-8 overflow-hidden text-center">
          <div className="relative z-10">
            <p className="text-lg font-bold text-white">Şifreniz güncellendi</p>
            <p className="text-sm text-emerald-200/50 mt-2">Hesabınıza yönlendiriliyorsunuz…</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="liquid-glass relative rounded-3xl p-8 overflow-hidden" noValidate>
          <div className="relative z-10 space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-emerald-200/50 mb-2">Yeni Şifre</label>
              <input
                id="password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 8 karakter"
                autoComplete="new-password"
                className={password && !passwordValid ? authInputErrorClass : authInputClass}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-emerald-200/50 mb-2">Yeni Şifre Tekrar</label>
              <input
                id="confirm"
                type={showPass ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Tekrarlayın"
                autoComplete="new-password"
                className={confirm && !passwordsMatch ? authInputErrorClass : authInputClass}
              />
            </div>
            <button type="button" onClick={() => setShowPass(!showPass)} className="text-xs text-emerald-200/30 hover:text-emerald-200/60 transition-colors">
              {showPass ? "Şifreleri Gizle" : "Şifreleri Göster"}
            </button>
            {error && (
              <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-2xl">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 glass-btn rounded-2xl text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Kaydediliyor…" : "Şifreyi Güncelle"}
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
