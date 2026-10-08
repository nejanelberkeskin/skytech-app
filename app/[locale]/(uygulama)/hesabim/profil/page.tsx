"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase/browser";

export default function ProfilPage() {
  const t = useTranslations("accountPages.profile");
  const tPages = useTranslations("accountPages");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
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
    setSaveError(false);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      // Oturum düşmüşse düğme "kaydediliyor"da kalmaz; kaydedilemedi bildirimi gösterilir.
      setSaving(false);
      setSaveError(true);
      return;
    }

    // Aynı iki yazım, aynı sırayla; yalnız sonuç ekrana doğru yansıtılır (önceden hata da "Kaydedildi" gösteriyordu).
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: session.session.user.id,
      full_name: form.fullName,
      email: form.email,
      phone: form.phone,
      address: form.address,
      city: form.city,
    });

    const { error: metaError } = await supabase.auth.updateUser({ data: { full_name: form.fullName } });

    setSaving(false);
    if (profileError || metaError) {
      setSaveError(true);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handlePasswordChange = async () => {
    setPasswordMsg(null);
    if (passwordForm.new.length < 8) {
      setPasswordMsg({ ok: false, text: t("passwordMin") });
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMsg({ ok: false, text: t("passwordMismatch") });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
    if (error) {
      // Ham sağlayıcı iletisi gösterilmez; bilinen durumlar (önce hata kodu, sonra ileti deseni) çevrilmiş iletiyle,
      // diğerleri genel iletiyle.
      const raw = error.message ?? "";
      const same = error.code === "same_password" || /same password|different from the old/i.test(raw);
      const weak = error.code === "weak_password" || /weak|pwned|compromised/i.test(raw);
      setPasswordMsg({ ok: false, text: same ? t("passwordSame") : weak ? t("passwordWeak") : t("passwordError") });
    } else {
      setPasswordMsg({ ok: true, text: t("passwordUpdated") });
      setPasswordForm({ current: "", new: "", confirm: "" });
    }
  };

  const inputClasses = "w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all";

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex justify-center py-16">
        <div role="status" aria-label={tPages("loading")} className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-2xl animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
        <p className="text-sm text-emerald-200/40 mt-1">{t("subtitle")}</p>
      </div>

      {/* Profile info */}
      <div className="liquid-glass rounded-3xl p-6 space-y-5 overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="font-semibold text-white">{t("personal")}</h2>

          <div className="grid md:grid-cols-2 gap-4 mt-5">
            <div>
              <label htmlFor="profil-ad" className="block text-sm font-medium text-emerald-200/50 mb-2">{t("fullName")}</label>
              <input id="profil-ad" autoComplete="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className={inputClasses} />
            </div>
            <div>
              <label htmlFor="profil-eposta" className="block text-sm font-medium text-emerald-200/50 mb-2">{t("email")}</label>
              <input id="profil-eposta" value={form.email} disabled
                className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl text-emerald-200/30 cursor-not-allowed" />
            </div>
            <div>
              <label htmlFor="profil-telefon" className="block text-sm font-medium text-emerald-200/50 mb-2">{t("phone")}</label>
              <input id="profil-telefon" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+90 5xx xxx xx xx"
                className={inputClasses} />
            </div>
            <div>
              <label htmlFor="profil-sehir" className="block text-sm font-medium text-emerald-200/50 mb-2">{t("city")}</label>
              <input id="profil-sehir" autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder={t("cityPlaceholder")}
                className={inputClasses} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="profil-adres" className="block text-sm font-medium text-emerald-200/50 mb-2">{t("address")}</label>
              <textarea id="profil-adres" autoComplete="street-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2} placeholder={t("addressPlaceholder")}
                className={`${inputClasses} resize-none`} />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button type="button" onClick={handleSave} disabled={saving}
              className="glass-btn px-6 py-3 rounded-2xl text-sm font-medium text-white transition-all disabled:opacity-50">
              {saving ? t("saving") : t("save")}
            </button>
            {saved && (
              <span role="status" className="text-sm text-emerald-400 font-medium animate-fade-in">{t("saved")}</span>
            )}
            {saveError && (
              <span role="alert" className="text-sm text-rose-400 font-medium">{t("saveError")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Password change */}
      <div className="liquid-glass rounded-3xl p-6 space-y-5 overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="font-semibold text-white">{t("passwordTitle")}</h2>

          <div className="space-y-4 max-w-sm mt-5">
            <div>
              <label htmlFor="profil-yeni-sifre" className="block text-sm font-medium text-emerald-200/50 mb-2">{t("newPassword")}</label>
              <input id="profil-yeni-sifre" type="password" autoComplete="new-password" value={passwordForm.new}
                onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                placeholder={t("passwordPlaceholder")}
                className={inputClasses} />
            </div>
            <div>
              <label htmlFor="profil-yeni-sifre-tekrar" className="block text-sm font-medium text-emerald-200/50 mb-2">{t("confirmPassword")}</label>
              <input id="profil-yeni-sifre-tekrar" type="password" autoComplete="new-password" value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                placeholder={t("repeatPlaceholder")}
                className={inputClasses} />
            </div>
          </div>

          {passwordMsg && (
            <div role={passwordMsg.ok ? "status" : "alert"} className={`text-sm px-4 py-3 rounded-2xl mt-4 ${
              passwordMsg.ok
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
            }`}>
              {passwordMsg.text}
            </div>
          )}

          <button type="button" onClick={handlePasswordChange}
            className="mt-4 px-6 py-3 rounded-2xl text-sm font-medium transition-all border border-white/[0.08] text-emerald-200/50 hover:text-white hover:border-white/[0.15] hover:bg-white/[0.04]">
            {t("updatePassword")}
          </button>
        </div>
      </div>
    </div>
  );
}
