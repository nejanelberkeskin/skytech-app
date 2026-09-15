"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { GOOGLE_AUTH_ENABLED } from "@/lib/site-config";
import { claimPendingRequest, isRequestId, savePendingClaim } from "@/lib/requests/client";
import AuthShell, { GoogleIcon, authInputClass, authInputErrorClass } from "@/components/auth/AuthShell";

/**
 * Üye kaydı.
 *
 * - Profil satırı DB tetikleyicisi (handle_new_user) ile açılır; oturum varsa
 *   ad/soyadı garantiye almak için ayrıca upsert edilir (hata yutulur).
 * - E-posta doğrulama açıksa signUp oturum döndürmez → "e-postanı kontrol et".
 * - ?talep=<uuid>: misafir talebi, oturum oluşunca hesaba bağlanır; doğrulama
 *   sonrası /hesabim'da da yeniden denenir (localStorage).
 */
export default function RegisterPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        </div>
      }
    >
      <RegisterPage />
    </Suspense>
  );
}

function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const talepId = searchParams.get("talep");

  const [form, setForm] = useState({ fullName: "", email: "", password: "", passwordConfirm: "" });
  const [terms, setTerms] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (isRequestId(talepId)) savePendingClaim(talepId);
  }, [talepId]);

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const passwordValid = form.password.length >= 8;
  const passwordsMatch = form.password === form.passwordConfirm;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    if (fullName.length < 2 || !email || !form.password) return setError("Tüm alanları doldurun.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Geçerli bir e-posta adresi girin.");
    if (!passwordValid) return setError("Şifre en az 8 karakter olmalı.");
    if (!passwordsMatch) return setError("Şifreler eşleşmiyor.");
    if (!terms) return setError("Devam etmek için kullanım koşullarını ve gizlilik politikasını kabul edin.");

    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        data: { full_name: fullName, account_type: "individual", terms_accepted_at: new Date().toISOString() },
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/hesabim`,
      },
    });

    if (authError) {
      setLoading(false);
      setError(
        /already registered|already exists/i.test(authError.message)
          ? "Bu e-posta zaten kayıtlı. Giriş yapmayı ya da şifrenizi sıfırlamayı deneyin."
          : /rate limit|too many/i.test(authError.message)
            ? "Kısa sürede çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin."
            : /weak|pwned|compromised/i.test(authError.message)
              ? "Bu şifre yeterince güçlü değil ya da sızmış şifre listelerinde yer alıyor. Farklı bir şifre seçin."
              : "Hesap oluşturulamadı. Lütfen tekrar deneyin."
      );
      return;
    }

    if (data.session && data.user) {
      // Oturum var (doğrulama kapalı): profili garantiye al, bekleyen talebi bağla
      await supabase
        .from("profiles")
        .upsert({ id: data.user.id, full_name: fullName, email }, { onConflict: "id" })
        .then(() => undefined, () => undefined);
      await claimPendingRequest(talepId);
      setLoading(false);
      router.push("/hesabim");
      router.refresh();
      return;
    }

    // Oturum yok → e-posta doğrulama açık (ya da e-posta zaten kayıtlı ve
    // Supabase sızdırmamak için sahte kullanıcı döndürdü) → aynı ekran.
    setLoading(false);
    setCheckEmail(email);
  };

  const resend = async () => {
    if (!checkEmail || resent) return;
    await supabase.auth.resend({ type: "signup", email: checkEmail });
    setResent(true);
  };

  if (checkEmail) {
    return (
      <AuthShell title="E-postanızı Doğrulayın" subtitle="Hesabınızı etkinleştirmek için son bir adım kaldı.">
        <div className="liquid-glass relative rounded-3xl p-8 overflow-hidden text-center">
          <div className="relative z-10 space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <polyline points="3 7 12 13 21 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm text-emerald-200/60 leading-relaxed">
              <strong className="text-white">{checkEmail}</strong> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya
              tıkladığınızda hesabınız açılır. E-posta birkaç dakika içinde gelmezse spam klasörünü kontrol edin.
            </p>
            <button
              type="button"
              onClick={resend}
              disabled={resent}
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors disabled:opacity-60"
            >
              {resent ? "Tekrar gönderildi ✓" : "Bağlantıyı tekrar gönder"}
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Aramıza Katılın"
      subtitle="Taleplerinizi tek yerden takip edin."
      footer={
        <>
          Zaten hesabınız var mı?{" "}
          <Link href={talepId ? `/auth/login?talep=${encodeURIComponent(talepId)}` : "/auth/login"} className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            Giriş Yap
          </Link>
        </>
      }
    >
      <form onSubmit={handleRegister} className="liquid-glass relative rounded-3xl p-8 overflow-hidden" noValidate>
        <div className="relative z-10 space-y-5">
          {talepId && (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
              Hesabınız oluşturulunca talebiniz otomatik olarak hesabınıza bağlanır.
            </p>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-emerald-200/50 mb-2">Ad Soyad</label>
            <input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Adınız Soyadınız" autoComplete="name" maxLength={120} className={authInputClass} />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-emerald-200/50 mb-2">E-posta</label>
            <input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="ornek@mail.com" autoComplete="email" className={authInputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-emerald-200/50 mb-2">Şifre</label>
              <input
                id="password"
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="En az 8 karakter"
                autoComplete="new-password"
                className={form.password && !passwordValid ? authInputErrorClass : authInputClass}
              />
            </div>
            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-emerald-200/50 mb-2">Şifre Tekrar</label>
              <input
                id="passwordConfirm"
                type={showPass ? "text" : "password"}
                value={form.passwordConfirm}
                onChange={(e) => set("passwordConfirm", e.target.value)}
                placeholder="Tekrarlayın"
                autoComplete="new-password"
                className={form.passwordConfirm && !passwordsMatch ? authInputErrorClass : authInputClass}
              />
            </div>
          </div>
          {form.passwordConfirm && !passwordsMatch && (
            <p className="text-xs text-rose-400 -mt-3">Şifreler eşleşmiyor.</p>
          )}

          <button type="button" onClick={() => setShowPass(!showPass)} className="text-xs text-emerald-200/30 hover:text-emerald-200/60 transition-colors">
            {showPass ? "Şifreleri Gizle" : "Şifreleri Göster"}
          </button>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              required
              className="mt-0.5 w-4 h-4 shrink-0 accent-emerald-500"
            />
            <span className="text-xs text-emerald-200/40 group-hover:text-emerald-200/60 transition-colors leading-relaxed">
              <Link href="/kullanim-kosullari" target="_blank" className="text-emerald-400/80 hover:text-emerald-300 underline underline-offset-2">Kullanım Koşulları</Link>,{" "}
              <Link href="/gizlilik-politikasi" target="_blank" className="text-emerald-400/80 hover:text-emerald-300 underline underline-offset-2">Gizlilik Politikası</Link> ve{" "}
              <Link href="/kvkk" target="_blank" className="text-emerald-400/80 hover:text-emerald-300 underline underline-offset-2">KVKK Aydınlatma Metni</Link>&apos;ni okudum, kabul ediyorum.
            </span>
          </label>

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
                Hesap oluşturuluyor…
              </span>
            ) : "Üye Ol"}
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
                  if (isRequestId(talepId)) savePendingClaim(talepId);
                  await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/hesabim` },
                  });
                }}
                className="w-full py-3.5 glass-subtle rounded-2xl text-emerald-100/60 hover:text-white hover:bg-white/[0.06] font-medium text-sm transition-all duration-300 flex items-center justify-center gap-3"
              >
                <GoogleIcon />
                Google ile Üye Ol
              </button>
            </>
          )}
        </div>
      </form>
    </AuthShell>
  );
}
