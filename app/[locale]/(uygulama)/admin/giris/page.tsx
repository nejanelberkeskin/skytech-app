"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError("E-posta ve şifre zorunludur."); return; }

    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("E-posta veya şifre hatalı.");
      setLoading(false);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setError("Oturum oluşturulamadı.");
      setLoading(false);
      return;
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, role, is_active")
      .eq("user_id", session.session.user.id)
      .eq("is_active", true)
      .single();

    if (!adminUser) {
      await supabase.auth.signOut();
      setError("Bu hesap admin paneline erişim yetkisine sahip değil.");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  const inputClasses = "w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all";

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6">
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6 animate-fade-in-up">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.1))", border: "1px solid rgba(52,211,153,0.2)" }}>
            <span className="text-3xl">🛡️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Paneli</h1>
          <p className="text-emerald-200/40 text-sm mt-2">Skytech yönetim paneline giriş yapın.</p>
        </div>

        <form onSubmit={handleLogin} className="liquid-glass rounded-3xl p-8 space-y-5 overflow-hidden relative">
          <div className="relative z-10">
            <div>
              <label className="block text-sm font-medium text-emerald-200/50 mb-2">E-posta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@skytechgreen.com" autoComplete="email"
                className={inputClasses} />
            </div>
            <div className="mt-5">
              <label className="block text-sm font-medium text-emerald-200/50 mb-2">Şifre</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className={inputClasses} />
            </div>

            {error && (
              <div className="mt-5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-3 rounded-2xl">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full mt-5 py-3.5 glass-btn rounded-2xl text-white font-medium transition-all disabled:opacity-50">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Kontrol ediliyor...
                </span>
              ) : "Giriş Yap"}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-emerald-200/20">
          <Link href="/" className="hover:text-white transition-colors">← Ana siteye dön</Link>
        </p>
      </div>
    </div>
  );
}
