"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase/browser";
import { BuildingIcon } from "@/components/ui/Icons";
import { PASSWORD_MIN } from "@/lib/corporate/accounts";

/**
 * Kurumsal hesap başvurusu (043). Oturum yoksa hesap da açılır (e-posta doğrulaması); varsa başvuru o hesaba bağlanır.
 * Hesap yönetici onayından sonra kurumsal panelde teklif isteyebilir.
 */
type Fields = {
  companyTitle: string;
  taxId: string;
  taxOffice: string;
  address: string;
  authorizedPerson: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
};
const EMPTY: Fields = { companyTitle: "", taxId: "", taxOffice: "", address: "", authorizedPerson: "", email: "", phone: "", password: "", passwordConfirm: "" };

export default function CorporateApplication() {
  const t = useTranslations("corporatePages.apply");
  const tc = useTranslations("corporatePages");
  const [form, setForm] = useState<Fields>(EMPTY);
  const [authority, setAuthority] = useState(false);
  const [website, setWebsite] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ confirm: boolean } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setSignedInEmail(data.user.email);
        setForm((f) => ({ ...f, email: data.user!.email ?? "" }));
      }
    });
  }, []);

  const set = (key: keyof Fields, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };
  const errText = (key: string) => {
    const code = errors[key];
    if (!code) return null;
    return t.has(`errors.${code}`) ? t(`errors.${code}`, { min: PASSWORD_MIN }) : t("errors.invalid");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const local: Record<string, string> = {};
    if (!signedInEmail) {
      if (form.password.length < PASSWORD_MIN) local.password = "passwordShort";
      else if (form.password !== form.passwordConfirm) local.passwordConfirm = "passwordMismatch";
    }
    if (!authority) local.authority = "authorityRequired";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/kurumsal/basvuru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyTitle: form.companyTitle,
          taxId: form.taxId,
          taxOffice: form.taxOffice,
          address: form.address,
          authorizedPerson: form.authorizedPerson,
          email: form.email,
          phone: form.phone,
          ...(signedInEmail ? {} : { password: form.password }),
          authority: true,
          website,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone({ confirm: !!body.needsEmailConfirmation });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (body.error === "validation" && body.fields) {
        setErrors(body.fields);
      } else if (body.error === "email_exists") {
        setFormError(t("errors.emailExists"));
      } else if (body.error === "already_applied") {
        setFormError(t("errors.alreadyApplied"));
      } else if (res.status === 429) {
        setFormError(t("errors.rateLimited"));
      } else {
        setFormError(t("errors.generic"));
      }
    } catch {
      setFormError(t("errors.generic"));
    } finally {
      setSending(false);
    }
  };

  const input = "w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all";
  const field = (key: keyof Fields, opts: { type?: string; autoComplete?: string; textarea?: boolean; inputMode?: "numeric" | "tel" | "email" } = {}) => {
    const id = `kb-${key}`;
    const err = errText(key);
    return (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-emerald-200/60 mb-2">{t(`fields.${key}`)}</label>
        {opts.textarea ? (
          <textarea id={id} rows={3} value={form[key]} onChange={(e) => set(key, e.target.value)} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} className={input} />
        ) : (
          <input
            id={id}
            type={opts.type ?? "text"}
            inputMode={opts.inputMode}
            autoComplete={opts.autoComplete}
            value={form[key]}
            readOnly={key === "email" && !!signedInEmail}
            onChange={(e) => set(key, e.target.value)}
            aria-invalid={!!err}
            aria-describedby={err ? `${id}-err` : undefined}
            className={input}
          />
        )}
        {err && <p id={`${id}-err`} className="mt-1.5 text-xs text-rose-400">{err}</p>}
      </div>
    );
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
      </div>
      <nav className="relative z-10 vitrin-navbar-top" style={{ backdropFilter: "blur(20px) saturate(1.4)", WebkitBackdropFilter: "blur(20px) saturate(1.4)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label={tc("homeAria")}>
            <Image src="/images/brand/logo.webp" alt="Skytech Green" width={256} height={32} priority className="h-8 w-auto" />
          </Link>
          <Link href="/kurumsal/giris" className="text-xs sm:text-sm font-semibold text-[#1a2e1a] hover:text-[#1B6B3A] transition-colors text-right">
            <span className="hidden sm:inline">{t("haveAccount")} </span>{t("login")}
          </Link>
        </div>
      </nav>

      <div className="relative z-10 flex-1 flex items-start justify-center p-6">
        <div className="w-full max-w-2xl space-y-8 animate-fade-in-up py-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.1))", border: "1px solid rgba(52,211,153,0.2)" }}>
              <BuildingIcon className="w-8 h-8 text-emerald-300" strokeWidth={1.6} />
            </div>
            <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
            <p className="text-emerald-200/50 text-sm mt-2 max-w-lg mx-auto">{t("subtitle")}</p>
          </div>

          {done ? (
            <div role="status" className="liquid-glass rounded-3xl p-8 text-center space-y-3">
              <h2 className="text-xl font-semibold text-white">{t("done.title")}</h2>
              <p className="text-emerald-100/70 text-sm leading-relaxed">{t("done.body")}</p>
              {done.confirm && <p className="text-emerald-300 text-sm leading-relaxed">{t("done.confirmEmail")}</p>}
              <Link href="/" className="inline-block mt-4 text-sm text-emerald-400 underline">{t("done.home")}</Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="liquid-glass rounded-3xl p-8 overflow-hidden relative">
              <div className="relative z-10 space-y-5">
                {signedInEmail && <p className="text-sm text-emerald-200/70">{t("signedIn", { email: signedInEmail })}</p>}
                {field("companyTitle", { autoComplete: "organization" })}
                <div className="grid gap-5 sm:grid-cols-2">
                  {field("taxId", { inputMode: "numeric" })}
                  {field("taxOffice")}
                </div>
                {field("address", { textarea: true })}
                {field("authorizedPerson", { autoComplete: "name" })}
                <div className="grid gap-5 sm:grid-cols-2">
                  {field("email", { type: "email", autoComplete: "email", inputMode: "email" })}
                  {field("phone", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
                </div>
                {!signedInEmail && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {field("password", { type: "password", autoComplete: "new-password" })}
                    {field("passwordConfirm", { type: "password", autoComplete: "new-password" })}
                  </div>
                )}
                <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
                </div>
                <label className="flex items-start gap-3 text-sm text-emerald-100/70">
                  <input type="checkbox" checked={authority} onChange={(e) => { setAuthority(e.target.checked); setErrors((x) => { const n = { ...x }; delete n.authority; return n; }); }} aria-invalid={!!errors.authority} className="mt-1 h-4 w-4 accent-emerald-500" />
                  <span>{t("authority")}</span>
                </label>
                {errText("authority") && <p className="-mt-3 text-xs text-rose-400">{errText("authority")}</p>}
                <p className="text-xs text-emerald-200/40 leading-relaxed">
                  {t.rich("privacy", { kvkk: (c) => <Link href="/kvkk" target="_blank" className="text-emerald-400 underline">{c}</Link> })}
                </p>
                {formError && <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-2xl">{formError}</div>}
                <button type="submit" disabled={sending} className="w-full py-3.5 glass-btn rounded-2xl text-white font-medium transition-all disabled:opacity-50">
                  {sending ? t("sending") : t("submit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
