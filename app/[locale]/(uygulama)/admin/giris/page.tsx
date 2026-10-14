"use client";

import { useState } from "react";
import Image from "next/image";
import { Link, useRouter } from "@/i18n/navigation";
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

  const inputClasses = "w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all";

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#f6f7f5] p-6 text-slate-900" style={{ colorScheme: "light" }}>

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center">
          <Image src="/images/brand/logo.webp" alt="Skytech Green" width={256} height={32} priority className="mx-auto mb-6 h-6 w-auto" />
          <h1 className="text-2xl font-semibold text-slate-900">Yönetim paneli</h1>
          <p className="text-slate-600 text-sm mt-2">Ekip hesabınızla giriş yapın.</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5 overflow-hidden relative">
          <div className="relative z-10">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-slate-700 mb-2">E-posta</label>
              <input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@skytechgreen.com" autoComplete="email"
                className={inputClasses} />
            </div>
            <div className="mt-5">
              <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700 mb-2">Şifre</label>
              <input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className={inputClasses} />
            </div>

            {error && (
              <div role="alert" className="mt-5 bg-rose-500/10 border border-rose-500/20 text-rose-700 text-sm px-4 py-3 rounded-lg">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full mt-5 py-3.5 bg-[#1B6B3A] hover:bg-[#165c31] rounded-lg text-white font-medium transition-all disabled:opacity-50">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-200 border-t-slate-200 rounded-full animate-spin" />
                  Kontrol ediliyor...
                </span>
              ) : "Giriş Yap"}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-900 transition-colors">← Ana siteye dön</Link>
        </p>
      </div>
    </div>
  );
}
