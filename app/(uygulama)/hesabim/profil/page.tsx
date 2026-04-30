"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";

export default function ProfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", address: "", city: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const user = session.session.user;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setForm({
        fullName: profile?.full_name ?? user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
        phone: profile?.phone ?? "",
        address: profile?.address ?? "",
        city: profile?.city ?? "",
      });
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    await supabase.from("profiles").upsert({
      id: session.session.user.id,
      full_name: form.fullName,
      email: form.email,
      phone: form.phone,
      address: form.address,
      city: form.city,
    });

    await supabase.auth.updateUser({ data: { full_name: form.fullName } });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handlePasswordChange = async () => {
    setPasswordMsg(null);
    if (passwordForm.new.length < 8) {
      setPasswordMsg({ ok: false, text: "Yeni şifre en az 8 karakter olmalı." });
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMsg({ ok: false, text: "Şifreler eşleşmiyor." });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
    if (error) {
      setPasswordMsg({ ok: false, text: error.message });
    } else {
      setPasswordMsg({ ok: true, text: "Şifreniz başarıyla güncellendi." });
      setPasswordForm({ current: "", new: "", confirm: "" });
    }
  };

  const inputClasses = "w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all";

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex justify-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-2xl animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Profil & Ayarlar</h1>
        <p className="text-sm text-emerald-200/40 mt-1">Kişisel bilgilerinizi ve adres bilgilerinizi yönetin.</p>
      </div>

      {/* Profile info */}
      <div className="liquid-glass rounded-3xl p-6 space-y-5 overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="font-semibold text-white">Kişisel Bilgiler</h2>

          <div className="grid md:grid-cols-2 gap-4 mt-5">
            <div>
              <label className="block text-sm font-medium text-emerald-200/50 mb-2">Ad Soyad</label>
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className={inputClasses} />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-200/50 mb-2">E-posta</label>
              <input value={form.email} disabled
                className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl text-emerald-200/30 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-200/50 mb-2">Telefon</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+90 5xx xxx xx xx"
                className={inputClasses} />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-200/50 mb-2">Şehir</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Örn: İstanbul"
                className={inputClasses} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-emerald-200/50 mb-2">Adres</label>
              <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2} placeholder="Teslimat adresi..."
                className={`${inputClasses} resize-none`} />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button onClick={handleSave} disabled={saving}
              className="glass-btn px-6 py-3 rounded-2xl text-sm font-medium text-white transition-all disabled:opacity-50">
              {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </button>
            {saved && (
              <span className="text-sm text-emerald-400 font-medium animate-fade-in">Kaydedildi!</span>
            )}
          </div>
        </div>
      </div>

      {/* Password change */}
      <div className="liquid-glass rounded-3xl p-6 space-y-5 overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="font-semibold text-white">Şifre Değiştir</h2>

          <div className="space-y-4 max-w-sm mt-5">
            <div>
              <label className="block text-sm font-medium text-emerald-200/50 mb-2">Yeni Şifre</label>
              <input type="password" value={passwordForm.new}
                onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                placeholder="En az 8 karakter"
                className={inputClasses} />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-200/50 mb-2">Yeni Şifre Tekrar</label>
              <input type="password" value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                placeholder="Tekrarlayın"
                className={inputClasses} />
            </div>
          </div>

          {passwordMsg && (
            <div className={`text-sm px-4 py-3 rounded-2xl mt-4 ${
              passwordMsg.ok
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
            }`}>
              {passwordMsg.text}
            </div>
          )}

          <button onClick={handlePasswordChange}
            className="mt-4 px-6 py-3 rounded-2xl text-sm font-medium transition-all border border-white/[0.08] text-emerald-200/50 hover:text-white hover:border-white/[0.15] hover:bg-white/[0.04]">
            Şifreyi Güncelle
          </button>
        </div>
      </div>
    </div>
  );
}
