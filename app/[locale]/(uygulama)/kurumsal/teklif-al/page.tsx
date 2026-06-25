"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/browser";
import { Button, Input, Textarea, Card } from "@/components/ui";

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

const NEED_OPTIONS: { id: NeedType; label: string; icon: string; desc: string }[] = [
  { id: "orman",     label: "Şirket Ormanı Kurmak",  icon: "🌲", desc: "Markanız adına özel bir orman alanı tahsis edilir." },
  { id: "sertifika", label: "Hediye Sertifikaları",   icon: "🎖️", desc: "Müşterilerinize ve çalışanlarınıza dijital sertifika dağıtılır." },
  { id: "karbon",    label: "Karbon Denkleştirme",    icon: "♻️", desc: "Karbon ayak iziniz ağaçlandırma ile nötrleştirilir." },
];

const SEED_OPTIONS   = ["1.000 – 5.000", "5.000 – 10.000", "10.000 – 25.000", "25.000 – 50.000", "50.000+", "Henüz karar vermedim"];
const BUDGET_OPTIONS = ["₺50.000 altı", "₺50.000 – ₺150.000", "₺150.000 – ₺500.000", "₺500.000+", "Teklif bekliyorum"];
const TIMELINE_OPTIONS = ["1 ay içinde", "3 ay içinde", "6 ay içinde", "Yıl sonuna kadar", "Esnek"];

const STEPS_NEW  = ["Firma Bilgileri", "İhtiyaç Analizi", "Proje Detayları"];
const STEPS_AUTH = ["İhtiyaç Analizi", "Proje Detayları"];

// ── Karbon Ayak İzi Simülatörü ────────────────────────────────────────────────
function bucketFromSeeds(seeds: number): string {
  if (seeds < 5000)  return "1.000 – 5.000";
  if (seeds < 10000) return "5.000 – 10.000";
  if (seeds < 25000) return "10.000 – 25.000";
  if (seeds < 50000) return "25.000 – 50.000";
  return "50.000+";
}

function AnimatedCount({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(value);
  const startTimeRef = useRef<number | null>(null);
  const DURATION = 400;

  useEffect(() => {
    const from = startRef.current;
    const to = value;
    if (from === to) return;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayed(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        startRef.current = to;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <>{displayed.toLocaleString("tr-TR")}</>;
}

function CarbonSimulator({ onApply }: { onApply: (seeds: number, bucket: string) => void }) {
  const [employees, setEmployees] = useState(100);
  const [fleet, setFleet] = useState(5);
  const seeds = employees * 50 + fleet * 200;
  const co2Tons = (seeds * 0.02).toFixed(1);
  const oxygenKg = Math.round(seeds * 0.1);

  return (
    <div className="sticky top-24 space-y-4">
      {/* Main simulator card */}
      <div
        className="rounded-2xl p-6 space-y-6"
        style={{
          background: "linear-gradient(135deg, rgba(5,46,22,0.9) 0%, rgba(6,78,59,0.8) 100%)",
          boxShadow: "0 0 0 1px rgba(16,185,129,0.2), 0 20px 40px -12px rgba(0,0,0,0.5), 0 0 60px rgba(16,185,129,0.04)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400">
            ♻️ Karbon Nötr Hesaplayıcı
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Firmanızın verilerini girerek ihtiyacınızı hesaplayın
          </p>
        </div>

        {/* Slider: Employees */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">👥 Çalışan Sayısı</label>
            <span className="text-sm font-bold text-white bg-white/[0.08] px-3 py-0.5 rounded-full">
              {employees.toLocaleString("tr-TR")}
            </span>
          </div>
          <input
            type="range"
            min={1} max={5000} step={10}
            value={employees}
            onChange={(e) => setEmployees(Number(e.target.value))}
            className="simulator-slider w-full"
          />
          <div className="flex justify-between text-xs text-slate-600">
            <span>1</span><span>1.000</span><span>2.500</span><span>5.000</span>
          </div>
          <p className="text-xs text-emerald-400/60">
            = {(employees * 50).toLocaleString("tr-TR")} tohum katkısı
          </p>
        </div>

        {/* Slider: Fleet */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">🚗 Şirket Araç Filosu</label>
            <span className="text-sm font-bold text-white bg-white/[0.08] px-3 py-0.5 rounded-full">
              {fleet}
            </span>
          </div>
          <input
            type="range"
            min={0} max={500} step={1}
            value={fleet}
            onChange={(e) => setFleet(Number(e.target.value))}
            className="simulator-slider w-full"
          />
          <div className="flex justify-between text-xs text-slate-600">
            <span>0</span><span>125</span><span>250</span><span>500</span>
          </div>
          <p className="text-xs text-emerald-400/60">
            = {(fleet * 200).toLocaleString("tr-TR")} tohum katkısı
          </p>
        </div>

        {/* Formula breakdown */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Çalışan katkısı ({employees} × 50)</span>
            <span className="text-emerald-400">{(employees * 50).toLocaleString("tr-TR")}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Araç katkısı ({fleet} × 200)</span>
            <span className="text-emerald-400">{(fleet * 200).toLocaleString("tr-TR")}</span>
          </div>
          <div className="h-px bg-white/[0.08]" />
          <div className="flex justify-between font-semibold text-slate-200">
            <span>Toplam</span>
            <span>{seeds.toLocaleString("tr-TR")} tohum</span>
          </div>
        </div>

        {/* Big seed counter */}
        <div className="text-center py-2">
          <p className="text-xs uppercase tracking-widest text-emerald-500/60 mb-1">
            Yıllık nötrleme için tahmini
          </p>
          <p
            className="text-5xl font-black text-emerald-400 animate-pulse"
            style={{ textShadow: "0 0 30px rgba(16,185,129,0.5), 0 0 60px rgba(16,185,129,0.2)" }}
          >
            🌱 <AnimatedCount value={seeds} />
          </p>
          <p className="text-sm text-emerald-400/70 mt-1">tohum gerekiyor</p>
        </div>

        {/* Impact preview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.04] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-white">{co2Tons}</p>
            <p className="text-xs text-slate-500 mt-0.5">Ton CO₂ / Yıl</p>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-white">{oxygenKg.toLocaleString("tr-TR")}</p>
            <p className="text-xs text-slate-500 mt-0.5">kg O₂ / Gün</p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => onApply(seeds, bucketFromSeeds(seeds))}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-all relative overflow-hidden group"
          style={{
            background: "linear-gradient(135deg, #059669, #10b981)",
            boxShadow: "0 0 0 1px rgba(16,185,129,0.4), 0 8px 20px -4px rgba(16,185,129,0.3)",
          }}
        >
          <span className="relative z-10 text-white">Bu Hedefi Teklife Çevir →</span>
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* ESG badge */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center space-y-1">
        <p className="text-xs text-slate-500">
          🌍 Bu proje <strong className="text-slate-300">ESG raporlarınızda</strong> Kapsam 1–2–3 emisyon giderimi olarak beyan edilebilir.
        </p>
      </div>

      <style>{`
        .simulator-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          background: rgba(255,255,255,0.08);
          border-radius: 3px;
          outline: none;
          cursor: pointer;
        }
        .simulator-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.25), 0 0 12px rgba(16,185,129,0.4);
          transition: box-shadow 0.2s;
        }
        .simulator-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 0 5px rgba(16,185,129,0.3), 0 0 20px rgba(16,185,129,0.5);
        }
        .simulator-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 12px rgba(16,185,129,0.4);
        }
        .simulator-slider::-moz-range-track {
          height: 6px;
          background: rgba(255,255,255,0.08);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}

// ── Ana Sayfa ──────────────────────────────────────────────────────────────────
export default function CorporateQuoteForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [simulatorApplied, setSimulatorApplied] = useState<{ seeds: number; bucket: string } | null>(null);
  const seedCountRef = useRef<HTMLDivElement>(null);

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

  // ── Simülatörden Aktar ────────────────────────────────────────────────────
  const handleApplySimulator = useCallback((seeds: number, bucket: string) => {
    setSimulatorApplied({ seeds, bucket });
    set("seedCount", bucket);
    // Navigate to last step
    setStep(totalSteps);
    setTimeout(() => {
      seedCountRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [totalSteps]);

  /* ── DB'ye teklif kaydet ── */
  const insertQuote = async (userId: string, retries = 3): Promise<string | null> => {
    for (let i = 0; i < retries; i++) {
      const { error: dbError } = await supabase.from("corporate_quotes").insert({
        user_id: userId,
        company_name: form.companyName,
        tax_office: form.taxOffice,
        tax_no: form.taxNo,
        contact_person: form.contactPerson,
        corporate_email: form.corporateEmail || existingUser?.email,
        phone: form.phone,
        need_types: form.needTypes,
        need_details: form.needDetails,
        seed_count: form.seedCount,
        budget_range: form.budgetRange,
        timeline: form.timeline,
        notes: form.notes,
        status: "PENDING",
      });
      if (!dbError) return null;
      if (dbError.message.includes("foreign key") && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      return dbError.message;
    }
    return "Teklif kaydedilemedi. Lütfen daha sonra tekrar deneyiniz.";
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    let userId: string;

    if (isLoggedIn) {
      userId = existingUser!.id;
    } else {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.corporateEmail,
        password: form.password,
        options: {
          data: {
            company_name: form.companyName,
            contact_person: form.contactPerson,
            phone: form.phone,
            account_type: "corporate",
          },
        },
      });
      if (authError) {
        setSubmitError(authError.message === "User already registered"
          ? "Bu e-posta adresi zaten kayıtlı. Lütfen giriş yaparak tekrar deneyiniz."
          : authError.message);
        setSubmitting(false);
        return;
      }
      if (!authData.user) {
        setSubmitError("Hesap oluşturulamadı. Lütfen tekrar deneyiniz.");
        setSubmitting(false);
        return;
      }
      userId = authData.user.id;
    }

    const dbError = await insertQuote(userId);
    if (dbError) {
      if (!isLoggedIn) {
        console.warn("Hesap oluşturuldu ancak teklif kaydedilemedi:", dbError);
      } else {
        setSubmitError("Teklif kaydedilemedi: " + dbError);
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);
    setSubmitted(true);
  };

  /* ── Yükleniyor ── */
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Başarılı Ekranı ── */
  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] bg-dot-grid flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-5 animate-fade-in-up">
          <div className="w-20 h-20 bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center mx-auto glow-md">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isLoggedIn ? "Teklifiniz Gönderildi!" : "Hesabınız Oluşturuldu!"}
          </h1>
          <p className="text-slate-400">
            <span className="text-white font-medium">{form.companyName || existingUser?.companyName}</span> adına
            {isLoggedIn
              ? " yeni teklif talebiniz başarıyla oluşturuldu. Teklifiniz 24 saat içinde hazırlanacaktır."
              : " kurumsal hesabınız başarıyla oluşturuldu. Teklif detaylarınız ve proje takibiniz için panelinize giriş yapabilirsiniz."
            }
          </p>
          {simulatorApplied && (
            <Card variant="solid" padding="md" className="text-left space-y-1">
              <p className="text-xs text-emerald-500">🧮 Karbon hesabınızdan aktarıldı</p>
              <p className="text-sm text-white font-bold">
                {simulatorApplied.seeds.toLocaleString("tr-TR")} tohum → {simulatorApplied.bucket}
              </p>
            </Card>
          )}
          {!isLoggedIn && (
            <Card variant="solid" padding="md" className="text-left space-y-1">
              <p className="text-xs text-slate-500">Giriş bilgileriniz</p>
              <p className="text-sm text-white">{form.corporateEmail}</p>
              <p className="text-xs text-emerald-400 mt-1">
                ✉️ Onay e-postası gönderildi. Teklifiniz 24 saat içinde hazırlanacaktır.
              </p>
            </Card>
          )}
          <div className="flex flex-col gap-3">
            <Link href={isLoggedIn ? "/kurumsal/panel" : "/kurumsal/giris"}>
              <Button variant="primary" size="lg" fullWidth>
                {isLoggedIn ? "Panelinize Dönün →" : "Panelinize Giriş Yapın →"}
              </Button>
            </Link>
            <Link href="/kurumsal" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              Ana Sayfaya Dönün
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="min-h-screen bg-[var(--bg-base)] bg-dot-grid">
      {/* Üst bar */}
      <div className="glass border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/kurumsal" className="text-slate-500 hover:text-white text-sm transition-colors">
              ← Kurumsal
            </Link>
            <h1 className="text-sm font-semibold text-white">
              {isLoggedIn ? "Yeni Teklif Talebi" : "Teklif Talebi ve Hesap Oluşturma"}
            </h1>
          </div>
          {!isLoggedIn && (
            <Link href="/kurumsal/giris" className="text-xs text-slate-500 hover:text-emerald-400 transition-colors">
              Zaten hesabınız var mı? Giriş yapın
            </Link>
          )}
          {isLoggedIn && (
            <span className="text-xs text-emerald-400">✅ {existingUser!.email}</span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 lg:grid lg:grid-cols-5 lg:gap-12 lg:items-start">
        {/* ── Sol: Form ── */}
        <div className="lg:col-span-3 space-y-8">
          {/* Logged-in company banner */}
          {isLoggedIn && (
            <div className="bg-emerald-500/[0.06] ring-1 ring-emerald-500/20 rounded-xl px-5 py-4 flex items-center gap-4 animate-fade-in">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <span className="text-lg">🏢</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{existingUser!.companyName || "Kurumsal Hesap"}</p>
                <p className="text-xs text-slate-400">{existingUser!.email} — Mevcut hesabınız ile yeni teklif oluşturuyorsunuz.</p>
              </div>
            </div>
          )}

          {/* Adım göstergesi */}
          <div className="flex items-center gap-2">
            {STEPS.map((label, idx) => {
              const s = idx + 1;
              return (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                    s < step  ? "bg-emerald-600 text-white" :
                    s === step ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 glow-sm" :
                    "bg-white/[0.05] border border-white/[0.08] text-slate-500"
                  }`}>
                    {s < step ? "✓" : s}
                  </div>
                  <span className={`text-sm hidden sm:inline ${s === step ? "text-white font-medium" : "text-slate-500"}`}>
                    {label}
                  </span>
                  {s < totalSteps && <div className={`flex-1 h-px ${s < step ? "bg-emerald-600" : "bg-white/[0.08]"}`} />}
                </div>
              );
            })}
          </div>

          {/* ── Adım 1 (yeni kullanıcı): Firma Bilgileri ── */}
          {!isLoggedIn && step === 1 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Firma Bilgileriniz</h2>
                <p className="text-sm text-slate-400">Teklif takibiniz için kurumsal hesabınız otomatik oluşturulacaktır.</p>
              </div>
              <Card variant="glass" padding="lg" className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <Input label="Şirket Adı" required value={form.companyName}
                      onChange={(e) => set("companyName", e.target.value)}
                      placeholder="Lütfen şirket adınızı giriniz" />
                  </div>
                  <Input label="Vergi Dairesi" value={form.taxOffice}
                    onChange={(e) => set("taxOffice", e.target.value)} placeholder="Örn: Kadıköy V.D." />
                  <Input label="Vergi Numarası" value={form.taxNo}
                    onChange={(e) => set("taxNo", e.target.value)} placeholder="10 haneli vergi numaranız" />
                  <Input label="Yetkili Kişi" required value={form.contactPerson}
                    onChange={(e) => set("contactPerson", e.target.value)} placeholder="Adınızı ve soyadınızı giriniz" />
                  <Input label="Telefon Numaranız" value={form.phone}
                    onChange={(e) => set("phone", e.target.value)} placeholder="+90 5xx xxx xx xx" />
                </div>
              </Card>

              <Card variant="solid" padding="lg" className="space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🔐</span>
                  <h3 className="text-sm font-semibold text-white">Hesap Bilgileriniz</h3>
                  <span className="text-xs text-slate-500">— Teklif takibiniz için otomatik oluşturulacaktır</span>
                </div>
                <Input label="Kurumsal E-posta Adresiniz" required type="email" value={form.corporateEmail}
                  onChange={(e) => set("corporateEmail", e.target.value)} placeholder="yetkili@sirket.com" />
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Şifreniz *</label>
                    <div className="relative">
                      <input value={form.password} onChange={(e) => set("password", e.target.value)}
                        type={showPass ? "text" : "password"} placeholder="En az 8 karakter giriniz"
                        className={`w-full px-4 py-2.5 bg-white/[0.03] border rounded-xl text-white placeholder-slate-600 outline-none transition-colors pr-16 focus:ring-1 ${
                          form.password && !passwordValid
                            ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/40"
                            : "border-white/[0.08] focus:border-emerald-500 focus:ring-emerald-500/40"
                        }`} />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors">
                        {showPass ? "Gizle" : "Göster"}
                      </button>
                    </div>
                    {form.password && !passwordValid && <p className="text-xs text-red-400 mt-1">En az 8 karakter girilmelidir.</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Şifre Tekrar *</label>
                    <input value={form.passwordConfirm} onChange={(e) => set("passwordConfirm", e.target.value)}
                      type={showPass ? "text" : "password"} placeholder="Şifrenizi tekrar giriniz"
                      className={`w-full px-4 py-2.5 bg-white/[0.03] border rounded-xl text-white placeholder-slate-600 outline-none transition-colors focus:ring-1 ${
                        form.passwordConfirm && !passwordsMatch
                          ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/40"
                          : "border-white/[0.08] focus:border-emerald-500 focus:ring-emerald-500/40"
                      }`} />
                    {form.passwordConfirm && !passwordsMatch && <p className="text-xs text-red-400 mt-1">Şifreler eşleşmiyor.</p>}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── İhtiyaç Analizi Adımı ── */}
          {((isLoggedIn && step === 1) || (!isLoggedIn && step === 2)) && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">İhtiyaç Analiziniz</h2>
                <p className="text-sm text-slate-400">Birden fazla seçenek işaretleyebilirsiniz.</p>
              </div>
              <div className="grid gap-4">
                {NEED_OPTIONS.map((opt) => {
                  const selected = form.needTypes.includes(opt.id);
                  return (
                    <button key={opt.id} onClick={() => toggleNeed(opt.id)}
                      className={`w-full text-left flex items-start gap-4 p-5 rounded-xl border-2 transition-all ${
                        selected
                          ? "border-emerald-500/50 bg-emerald-500/[0.05] ring-1 ring-emerald-500/20"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                      }`}>
                      <div className={`w-5 h-5 rounded shrink-0 mt-0.5 flex items-center justify-center border-2 transition-all ${
                        selected ? "bg-emerald-500 border-emerald-500" : "border-slate-600"
                      }`}>
                        {selected && <span className="text-white text-xs font-bold">✓</span>}
                      </div>
                      <span className="text-2xl shrink-0">{opt.icon}</span>
                      <div className="flex-1">
                        <p className={`font-semibold ${selected ? "text-emerald-400" : "text-white"}`}>{opt.label}</p>
                        <p className="text-sm text-slate-400 mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {form.needTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-xs text-slate-500">Seçilenler:</span>
                  {form.needTypes.map((id) => {
                    const opt = NEED_OPTIONS.find((o) => o.id === id)!;
                    return (
                      <span key={id} className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 rounded-full">
                        {opt.icon} {opt.label}
                      </span>
                    );
                  })}
                </div>
              )}
              <Card variant="glass" padding="md">
                <Textarea label="Detaylar (isteğe bağlı)" value={form.needDetails}
                  onChange={(e) => set("needDetails", e.target.value)}
                  rows={3} placeholder="Projenizle ilgili eklemek istediğiniz detayları giriniz..." />
              </Card>
            </div>
          )}

          {/* ── Proje Detayları Adımı ── */}
          {((isLoggedIn && step === 2) || (!isLoggedIn && step === 3)) && (
            <div className="space-y-6 animate-fade-in-up" ref={seedCountRef}>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Proje Detaylarınız</h2>
                <p className="text-sm text-slate-400">Ölçek ve bütçe beklentinizi belirtiniz.</p>
              </div>

              {/* Simulator applied banner */}
              {simulatorApplied && (
                <div className="bg-emerald-500/[0.08] border border-emerald-500/25 rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-in">
                  <span className="text-emerald-400 text-lg">🧮</span>
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Karbon hesaplayıcısından otomatik aktarıldı</p>
                    <p className="text-xs text-emerald-400/70 mt-0.5">
                      {simulatorApplied.seeds.toLocaleString("tr-TR")} tohum hesabınıza göre{" "}
                      <strong className="text-emerald-300">{simulatorApplied.bucket}</strong> seçildi.
                    </p>
                  </div>
                  <button onClick={() => setSimulatorApplied(null)}
                    className="ml-auto text-slate-500 hover:text-white text-xs transition-colors">
                    ✕
                  </button>
                </div>
              )}

              <Card variant="glass" padding="lg" className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Hedeflenen Tohum / Ağaç Sayısı *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {SEED_OPTIONS.map((opt) => (
                      <button key={opt} onClick={() => set("seedCount", opt)}
                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          form.seedCount === opt
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30"
                            : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/[0.15] hover:bg-white/[0.05]"
                        }`}>
                        {opt}
                        {simulatorApplied?.bucket === opt && (
                          <span className="block text-xs text-emerald-400/60 mt-0.5">← hesabınız</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bütçe Beklentiniz</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {BUDGET_OPTIONS.map((opt) => (
                      <button key={opt} onClick={() => set("budgetRange", opt)}
                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          form.budgetRange === opt
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30"
                            : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/[0.15] hover:bg-white/[0.05]"
                        }`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Zaman Çizelgeniz</label>
                  <div className="flex flex-wrap gap-3">
                    {TIMELINE_OPTIONS.map((opt) => (
                      <button key={opt} onClick={() => set("timeline", opt)}
                        className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          form.timeline === opt
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30"
                            : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/[0.15] hover:bg-white/[0.05]"
                        }`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <Textarea label="Ek Notlarınız" value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={3} placeholder="Özel talepleriniz veya sorularınızı yazabilirsiniz..." />
              </Card>
            </div>
          )}

          {/* Navigasyon */}
          <div className="space-y-4 pt-6 border-t border-white/[0.06]">
            {submitError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                {submitError}
              </div>
            )}
            <div className="flex items-center justify-between">
              {step > 1 ? (
                <Button variant="secondary" onClick={() => setStep(step - 1)}>← Geri</Button>
              ) : <div />}

              {step < totalSteps ? (
                <Button variant="primary" onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()}>
                  Devam Edin →
                </Button>
              ) : (
                <Button variant="primary" size="lg" onClick={handleSubmit}
                  disabled={!canNext() || submitting} loading={submitting}>
                  {isLoggedIn ? "Teklif Talebinizi Gönderin" : "Hesap Oluşturun ve Teklif Gönderin"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Sağ: Karbon Simülatörü ── */}
        <div className="lg:col-span-2 mt-10 lg:mt-0">
          <CarbonSimulator onApply={handleApplySimulator} />
        </div>
      </div>
    </div>
  );
}
