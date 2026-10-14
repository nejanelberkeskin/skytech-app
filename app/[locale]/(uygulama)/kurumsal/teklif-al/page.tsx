"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase/browser";
import { Button, Input, Textarea, Card } from "@/components/ui";
import { createQuoteSubmitter, type QuoteFields } from "@/lib/corporate/quote-submission";
import { BUDGET_OPTIONS, SEED_OPTIONS, TIMELINE_OPTIONS } from "@/lib/corporate/quote-options";
import ApprovalGate from "@/components/kurumsal/ApprovalGate";

type NeedType = "orman" | "sertifika" | "karbon";

interface FormData {
  companyName: string;
  taxOffice: string;
  taxNo: string;
  contactPerson: string;
  corporateEmail: string;
  password: string;
  passwordConfirm: string;
  phone: string;
  needTypes: NeedType[];
  needDetails: string;
  seedCount: string;
  budgetRange: string;
  timeline: string;
  notes: string;
}

const INITIAL: FormData = {
  companyName: "", taxOffice: "", taxNo: "", contactPerson: "",
  corporateEmail: "", password: "", passwordConfirm: "", phone: "",
  needTypes: [], needDetails: "",
  seedCount: "", budgetRange: "", timeline: "", notes: "",
};

// Ad ve açıklama çeviriden (corporatePages.quote.need.<id>); `id` veritabanına yazılır, değişmez.
const NEED_OPTIONS: { id: NeedType }[] = [
  { id: "orman" },
  { id: "sertifika" },
  { id: "karbon" },
];

// Seçenek değerleri (veritabanına yazılan Türkçe metin) ve etiket anahtarları: lib/corporate/quote-options.ts.

const STEPS_NEW  = ["company", "needs", "project"] as const;
const STEPS_AUTH = ["needs", "project"] as const;

/** Teklif yalnız onaylı kurumsal hesaptan istenir (043); hesap açma bu formda değil, /kurumsal/basvuru'da. */
export default function CorporateQuotePage() {
  return (
    <ApprovalGate>
      <CorporateQuoteForm />
    </ApprovalGate>
  );
}

function CorporateQuoteForm() {
  const t = useTranslations("corporatePages.quote");
  const tc = useTranslations("corporatePages");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Hesap bu sayfada oluşturulup teklif kaydedilemediyse: hesabın e-postası. Yeniden denemede hesap
  // tekrar oluşturulmaz; hesap alanları kilitlenir.
  const [createdAccountEmail, setCreatedAccountEmail] = useState<string | null>(null);
  // Teklifin kaydı belirsiz (yanıt gelmedi): içerik sabitlendi, alanlar kilitli; yeniden kayıt aynı içeriği gönderir.
  const [quoteUncertain, setQuoteUncertain] = useState(false);
  // Bu teklif numarasında bir kayıt var ama içeriğine kefil olunamıyor: yeniden gönderilmez.
  const [quoteUnverifiable, setQuoteUnverifiable] = useState(false);
  // Başarıda gerçekten kaydedilen içerik (düzenlenmiş form değil).
  const [savedQuote, setSavedQuote] = useState<{ companyName: string; editsDiscarded: boolean } | null>(null);
  const contentLocked = quoteUncertain || quoteUnverifiable;
  // Gönderim durumu sayfa ömrü boyunca tek nesnede: oluşturulan hesap, tek teklif kimliği, tek gönderim kilidi.
  const [submitter] = useState(() =>
    createQuoteSubmitter({
      signUp: async ({ email, password, metadata }) => {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
        return { userId: data.user?.id ?? null, error: error?.message ?? null };
      },
      insertQuote: async (row) => {
        const { error } = await supabase.from("corporate_quotes").insert(row);
        return { error: error ? { code: error.code, message: error.message } : null };
      },
      newId: () => crypto.randomUUID(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }),
  );

  const [existingUser, setExistingUser] = useState<{ id: string; email: string; companyName: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const meta = user.user_metadata;
        setExistingUser({ id: user.id, email: user.email ?? "", companyName: meta?.company_name ?? "" });
        setForm((prev) => ({
          ...prev,
          companyName: meta?.company_name ?? prev.companyName,
          contactPerson: meta?.contact_person ?? meta?.full_name ?? prev.contactPerson,
          corporateEmail: user.email ?? prev.corporateEmail,
          phone: meta?.phone ?? prev.phone,
        }));
      }
      setAuthChecked(true);
    });
  }, []);

  const isLoggedIn = !!existingUser;
  const STEPS = isLoggedIn ? STEPS_AUTH : STEPS_NEW;
  const totalSteps = STEPS.length;

  const set = (field: keyof FormData, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleNeed = (id: NeedType) => {
    setForm((prev) => ({
      ...prev,
      needTypes: prev.needTypes.includes(id)
        ? prev.needTypes.filter((n) => n !== id)
        : [...prev.needTypes, id],
    }));
  };

  const passwordsMatch = form.password === form.passwordConfirm;
  const passwordValid  = form.password.length >= 8;

  const canNext = () => {
    if (!isLoggedIn && step === 1) {
      return !!(form.companyName && form.contactPerson && form.corporateEmail && form.password && passwordValid && passwordsMatch);
    }
    const needStep = isLoggedIn ? 1 : 2;
    if (step === needStep) return form.needTypes.length > 0;
    return !!form.seedCount;
  };


  /* ── Hesap + teklif gönderimi: iki ayrı sonuç (lib/corporate/quote-submission.ts) ── */
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const quote: QuoteFields = {
      company_name: form.companyName,
      tax_office: form.taxOffice,
      tax_no: form.taxNo,
      contact_person: form.contactPerson,
      corporate_email: form.corporateEmail || existingUser?.email || "",
      phone: form.phone,
      need_types: form.needTypes,
      need_details: form.needDetails,
      seed_count: form.seedCount,
      budget_range: form.budgetRange,
      timeline: form.timeline,
      notes: form.notes,
    };
    const outcome = await submitter.submit({
      existingUserId: existingUser?.id ?? null,
      signUp: {
        email: form.corporateEmail,
        password: form.password,
        metadata: {
          company_name: form.companyName,
          contact_person: form.contactPerson,
          phone: form.phone,
          account_type: "corporate",
        },
      },
      quote,
    });
    // Süren gönderim varken gelen ikinci tıklama: hiçbir istek yapılmadı, durum ilk gönderimde.
    if (outcome.status === "busy") return;
    setSubmitting(false);
    if (outcome.status === "saved") {
      setSavedQuote({ companyName: outcome.quote.company_name, editsDiscarded: outcome.editsDiscarded });
      setSubmitted(true);
    } else if (outcome.status === "account_created_quote_failed") {
      setCreatedAccountEmail(outcome.email);
      setQuoteUncertain(outcome.uncertain);
      // Ham veritabanı iletisi gösterilmez; durum kutusu ne olduğunu çeviriden anlatır.
      setSubmitError(null);
    } else if (outcome.status === "quote_failed") {
      setQuoteUncertain(outcome.uncertain);
      setSubmitError(outcome.uncertain ? null : t("errors.quoteNotSaved"));
    } else if (outcome.status === "quote_unverifiable") {
      setQuoteUnverifiable(true);
      setSubmitError(null);
    } else {
      // Bilinen durumlar çevrilmiş iletiyle; sağlayıcının diğer iletileri genel iletiyle (ham ayrıntı gösterilmez).
      setSubmitError(outcome.error === "User already registered"
        ? t("errors.alreadyRegistered")
        : outcome.error === "account_not_created"
          ? t("errors.accountNotCreated")
          : t("errors.generic"));
    }
  };

  /* ── Yükleniyor ── */
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#f6f7f5] flex items-center justify-center">
        <div role="status" aria-label={tc("loading")} className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Başarılı Ekranı ── */
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f6f7f5] bg-dot-grid flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-5">
          <div className="w-20 h-20 bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isLoggedIn ? t("success.titleLoggedIn") : t("success.titleNew")}
          </h1>
          <p className="text-slate-600">
            {t.rich(isLoggedIn ? "success.textLoggedIn" : "success.textNew", {
              company: savedQuote?.companyName || existingUser?.companyName || "",
              b: (chunks) => <span className="text-slate-900 font-medium">{chunks}</span>,
            })}
          </p>
          {savedQuote?.editsDiscarded && (
            <p className="text-sm text-amber-800">{t("success.editsDiscarded")}</p>
          )}
          {!isLoggedIn && (
            <Card variant="solid" padding="md" className="text-left space-y-1">
              <p className="text-xs text-slate-500">{t("success.loginInfo")}</p>
              <p className="text-sm text-slate-900">{form.corporateEmail}</p>
              <p className="text-xs text-emerald-700 mt-1">{t("success.verifyHint")}</p>
            </Card>
          )}
          <div className="flex flex-col gap-3">
            <Link href={isLoggedIn ? "/kurumsal/panel" : "/kurumsal/giris"}>
              <Button variant="primary" size="lg" fullWidth>
                {isLoggedIn ? t("success.toPanel") : t("success.loginToPanel")}
              </Button>
            </Link>
            <Link href="/kurumsal/panel" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
              {t("success.home")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="min-h-screen bg-[#f6f7f5] bg-dot-grid">
      {/* Üst bar */}
      <div className="glass border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/kurumsal/panel" className="text-slate-500 hover:text-slate-900 text-sm transition-colors">
              {t("header.back")}
            </Link>
            <h1 className="text-sm font-semibold text-slate-900">
              {isLoggedIn ? t("header.titleLoggedIn") : t("header.titleNew")}
            </h1>
          </div>
          {!isLoggedIn && (
            <Link href="/kurumsal/giris" className="text-xs text-slate-500 hover:text-emerald-700 transition-colors">
              {t("header.haveAccount")}
            </Link>
          )}
          {isLoggedIn && (
            <span className="text-xs text-emerald-700">{existingUser!.email}</span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* ── Sol: Form ── */}
        <div className="space-y-8">
          {/* Logged-in company banner */}
          {isLoggedIn && (
            <div className="bg-emerald-500/[0.06] ring-1 ring-emerald-500/20 rounded-xl px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-900 font-medium">{existingUser!.companyName || t("banner.accountFallback")}</p>
                <p className="text-xs text-slate-600">{t("banner.existing", { email: existingUser!.email })}</p>
              </div>
            </div>
          )}

          {/* Adım göstergesi */}
          <div className="flex items-center gap-2">
            {STEPS.map((stepKey, idx) => {
              const s = idx + 1;
              return (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                    s < step  ? "bg-emerald-600 text-white" :
                    s === step ? "bg-emerald-500 text-white" :
                    "bg-white border border-slate-200 text-slate-500"
                  }`}>
                    {s < step ? "✓" : s}
                  </div>
                  <span className={`text-sm hidden sm:inline ${s === step ? "text-slate-900 font-medium" : "text-slate-500"}`}>
                    {t(`steps.${stepKey}`)}
                  </span>
                  {s < totalSteps && <div className={`flex-1 h-px ${s < step ? "bg-emerald-600" : "bg-white"}`} />}
                </div>
              );
            })}
          </div>

          {/* Kaydı belirsiz teklifin içeriği sabit (lib/corporate/quote-submission.ts): bütün adım alanları kilitli. */}
          <fieldset disabled={contentLocked} aria-describedby={contentLocked ? "teklif-kayit-durumu" : undefined}
            className="min-w-0 m-0 border-0 p-0">
          {/* ── Adım 1 (yeni kullanıcı): Firma Bilgileri ── */}
          {!isLoggedIn && step === 1 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">{t("company.title")}</h2>
                <p className="text-sm text-slate-600">{t("company.subtitle")}</p>
              </div>
              <Card variant="glass" padding="lg" className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <Input label={t("company.name")} required value={form.companyName}
                      onChange={(e) => set("companyName", e.target.value)}
                      placeholder={t("company.namePlaceholder")} />
                  </div>
                  <Input label={t("company.taxOffice")} value={form.taxOffice}
                    onChange={(e) => set("taxOffice", e.target.value)} placeholder={t("company.taxOfficePlaceholder")} />
                  <Input label={t("company.taxNo")} value={form.taxNo}
                    onChange={(e) => set("taxNo", e.target.value)} placeholder={t("company.taxNoPlaceholder")} />
                  <Input label={t("company.contact")} required value={form.contactPerson}
                    onChange={(e) => set("contactPerson", e.target.value)} placeholder={t("company.contactPlaceholder")} />
                  <Input label={t("company.phone")} value={form.phone}
                    onChange={(e) => set("phone", e.target.value)} placeholder="+90 5xx xxx xx xx" />
                </div>
              </Card>

              <Card variant="solid" padding="lg" className="space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-slate-900">{t("account.title")}</h3>
                  <span className="text-xs text-slate-500">
                    {createdAccountEmail ? t("account.locked") : t("account.auto")}
                  </span>
                </div>
                <Input label={t("account.email")} required type="email" value={form.corporateEmail}
                  disabled={!!createdAccountEmail}
                  onChange={(e) => set("corporateEmail", e.target.value)} placeholder={t("account.emailPlaceholder")} />
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="teklif-sifre" className="block text-sm font-medium text-slate-700 mb-1.5">{t("account.password")}</label>
                    <div className="relative">
                      <input id="teklif-sifre" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)}
                        disabled={!!createdAccountEmail}
                        type={showPass ? "text" : "password"} placeholder={t("account.passwordPlaceholder")}
                        className={`w-full px-4 py-2.5 bg-white border rounded-xl text-slate-900 placeholder:text-slate-400 outline-none transition-colors pr-16 focus:ring-1 ${
                          form.password && !passwordValid
                            ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/40"
                            : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/40"
                        }`} />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-xs font-medium transition-colors">
                        {showPass ? t("account.hide") : t("account.show")}
                      </button>
                    </div>
                    {form.password && !passwordValid && <p className="text-xs text-red-700 mt-1">{t("account.passwordShort")}</p>}
                  </div>
                  <div>
                    <label htmlFor="teklif-sifre-tekrar" className="block text-sm font-medium text-slate-700 mb-1.5">{t("account.confirm")}</label>
                    <input id="teklif-sifre-tekrar" autoComplete="new-password" value={form.passwordConfirm} onChange={(e) => set("passwordConfirm", e.target.value)}
                      disabled={!!createdAccountEmail}
                      type={showPass ? "text" : "password"} placeholder={t("account.confirmPlaceholder")}
                      className={`w-full px-4 py-2.5 bg-white border rounded-xl text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:ring-1 ${
                        form.passwordConfirm && !passwordsMatch
                          ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/40"
                          : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/40"
                      }`} />
                    {form.passwordConfirm && !passwordsMatch && <p className="text-xs text-red-700 mt-1">{t("account.mismatch")}</p>}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── İhtiyaç Analizi Adımı ── */}
          {((isLoggedIn && step === 1) || (!isLoggedIn && step === 2)) && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">{t("needs.title")}</h2>
                <p className="text-sm text-slate-600">{t("needs.subtitle")}</p>
              </div>
              <div className="grid gap-4">
                {NEED_OPTIONS.map((opt) => {
                  const selected = form.needTypes.includes(opt.id);
                  return (
                    <button type="button" aria-pressed={selected} key={opt.id} onClick={() => toggleNeed(opt.id)}
                      className={`w-full text-left flex items-start gap-4 p-5 rounded-xl border-2 transition-all ${
                        selected
                          ? "border-emerald-500/50 bg-emerald-500/[0.05] ring-1 ring-emerald-500/20"
                          : "border-slate-200 bg-white hover:border-slate-200 hover:bg-slate-50"
                      }`}>
                      <div className={`w-5 h-5 rounded shrink-0 mt-0.5 flex items-center justify-center border-2 transition-all ${
                        selected ? "bg-emerald-500 border-emerald-500" : "border-slate-200"
                      }`}>
                        {selected && <span className="text-slate-900 text-xs font-bold">✓</span>}
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold ${selected ? "text-emerald-700" : "text-slate-900"}`}>{t(`need.${opt.id}.label`)}</p>
                        <p className="text-sm text-slate-600 mt-0.5">{t(`need.${opt.id}.desc`)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {form.needTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-xs text-slate-500">{t("needs.selected")}</span>
                  {form.needTypes.map((id) => {
                    return (
                      <span key={id} className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 rounded-full">
                        {t(`need.${id}.label`)}
                      </span>
                    );
                  })}
                </div>
              )}
              <Card variant="glass" padding="md">
                <Textarea label={t("needs.details")} value={form.needDetails}
                  onChange={(e) => set("needDetails", e.target.value)}
                  rows={3} placeholder={t("needs.detailsPlaceholder")} />
              </Card>
            </div>
          )}

          {/* ── Proje Detayları Adımı ── */}
          {((isLoggedIn && step === 2) || (!isLoggedIn && step === 3)) && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">{t("project.title")}</h2>
                <p className="text-sm text-slate-600">{t("project.subtitle")}</p>
              </div>

              <Card variant="glass" padding="lg" className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {t("project.seedCount")}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {SEED_OPTIONS.map((opt) => (
                      <button type="button" aria-pressed={form.seedCount === opt.value} key={opt.value} onClick={() => set("seedCount", opt.value)}
                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          form.seedCount === opt.value
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                        }`}>
                        {tc(`quoteOptions.seed.${opt.key}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t("project.budget")}</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {BUDGET_OPTIONS.map((opt) => (
                      <button type="button" aria-pressed={form.budgetRange === opt.value} key={opt.value} onClick={() => set("budgetRange", opt.value)}
                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          form.budgetRange === opt.value
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                        }`}>
                        {tc(`quoteOptions.budget.${opt.key}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t("project.timeline")}</label>
                  <div className="flex flex-wrap gap-3">
                    {TIMELINE_OPTIONS.map((opt) => (
                      <button type="button" aria-pressed={form.timeline === opt.value} key={opt.value} onClick={() => set("timeline", opt.value)}
                        className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          form.timeline === opt.value
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                        }`}>
                        {tc(`quoteOptions.timeline.${opt.key}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <Textarea label={t("project.notes")} value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={3} placeholder={t("project.notesPlaceholder")} />
              </Card>
            </div>
          )}

          </fieldset>

          {/* Navigasyon */}
          <div className="space-y-4 pt-6 border-t border-slate-200">
            {quoteUnverifiable ? (
              <div id="teklif-kayit-durumu" role="alert" className="bg-amber-500/10 border border-amber-500/25 text-sm px-4 py-3 rounded-xl space-y-2">
                <p className="font-semibold text-amber-800">{t("status.unverifiableTitle")}</p>
                <p className="text-slate-700">
                  {t.rich("status.unverifiableText", {
                    login: (chunks) => <Link href="/kurumsal/giris" className="text-emerald-700 underline underline-offset-2">{chunks}</Link>,
                  })}
                </p>
              </div>
            ) : createdAccountEmail || quoteUncertain ? (
              <div id="teklif-kayit-durumu" role="alert" className="bg-amber-500/10 border border-amber-500/25 text-sm px-4 py-3 rounded-xl space-y-2">
                <p className="font-semibold text-amber-800">
                  {quoteUncertain ? t("status.unverifiableTitle") : t("status.failedTitle")}
                </p>
                <ul className="space-y-1 text-slate-700">
                  {createdAccountEmail && (
                    <li>{t.rich("status.accountCreated", { email: createdAccountEmail, mail: (chunks) => <span className="text-slate-900">{chunks}</span> })}</li>
                  )}
                  <li>
                    {quoteUncertain ? t("status.maybeSaved") : t("status.notSaved")}
                  </li>
                </ul>
                {quoteUncertain ? (
                  <p className="text-slate-600">
                    {t.rich("status.uncertainHelp", {
                      login: (chunks) => <Link href="/kurumsal/giris" className="text-emerald-700 underline underline-offset-2">{chunks}</Link>,
                    })}
                  </p>
                ) : (
                  <p className="text-slate-600">
                    {t.rich("status.failedHelp", {
                      login: (chunks) => <Link href="/kurumsal/giris" className="text-emerald-700 underline underline-offset-2">{chunks}</Link>,
                    })}
                  </p>
                )}
              </div>
            ) : submitError && (
              <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-700 text-sm px-4 py-3 rounded-xl">
                {submitError}
              </div>
            )}
            <div className="flex items-center justify-between">
              {step > 1 ? (
                <Button variant="secondary" onClick={() => setStep(step - 1)}>{t("nav.back")}</Button>
              ) : <div />}

              {step < totalSteps ? (
                <Button variant="primary" onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()}>
                  {t("nav.next")}
                </Button>
              ) : quoteUnverifiable ? <div /> : (
                <Button variant="primary" size="lg" onClick={handleSubmit}
                  disabled={!canNext() || submitting} loading={submitting}>
                  {createdAccountEmail || quoteUncertain
                    ? t("submit.resave")
                    : isLoggedIn ? t("submit.loggedIn") : t("submit.new")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
