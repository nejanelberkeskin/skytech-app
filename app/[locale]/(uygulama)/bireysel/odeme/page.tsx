"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";
import {
  DroneIcon, BarChartIcon, SproutIcon, GiftIcon, ClockIcon, TreesIcon,
} from "@/components/ui/Icons";

/* ═══════════════════════════════════════════════════════════
   Sabitler
   ═══════════════════════════════════════════════════════════ */
const SUBSCRIPTION_AMOUNT = 750;
const SUBSCRIPTION_SEEDS  = 50;

/* ═══════════════════════════════════════════════════════════
   Liquid Glass Giriş Modalı
   ═══════════════════════════════════════════════════════════ */
function LoginModal({
  onSuccess,
  onClose,
}: {
  onSuccess: (user: User) => void;
  onClose: () => void;
}) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.user) {
      setError("E-posta veya şifre hatalı. Lütfen tekrar deneyin.");
      setLoading(false);
      return;
    }

    onSuccess(data.user);
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="liquid-glass relative w-full max-w-sm rounded-3xl overflow-hidden animate-scale-in">
        <div className="relative z-10 px-8 py-8 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Hızlı Giriş</h2>
              <p className="text-xs text-emerald-200/30 mt-0.5">
                Bilgileriniz forma otomatik dolacak, sepet güvendedir.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors shrink-0"
            >
              <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-emerald-200/40 mb-1.5">E-posta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="ornek@mail.com"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-emerald-200/40 mb-1.5">Şifre</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
            </div>
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-3 py-2.5 text-xs text-rose-300">{error}</div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3.5 glass-btn rounded-2xl text-white font-semibold text-sm disabled:opacity-50 transition-all">
              {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
            </button>
          </form>
          <p className="text-center text-[11px] text-emerald-200/20">
            Sepetinizdeki ürünler giriş sonrasında korunur.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Otonom Abonelik Upsell Kartı
   ═══════════════════════════════════════════════════════════ */
function AutopilotCard({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`rounded-3xl overflow-hidden transition-all duration-300 ${
      isActive ? "glass-glow" : "liquid-glass"
    } relative`}>
      <div className="relative z-10 p-5 space-y-3">
        <button type="button" onClick={onToggle}
          className="w-full flex items-center justify-between gap-3 text-left group">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-lg shrink-0 transition-all ${
              isActive ? "bg-emerald-500/15 border border-emerald-500/25" : "bg-white/[0.04] border border-white/[0.08]"
            }`}>
              🤖
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                Otonom Karbon Aboneliği
              </p>
              <p className="text-xs text-emerald-200/30">Aylık +{SUBSCRIPTION_SEEDS} tohum</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className={`text-sm font-black transition-all ${
              isActive ? "text-emerald-300" : "text-emerald-200/30"
            }`}>
              +{SUBSCRIPTION_AMOUNT.toLocaleString("tr-TR")} TL/ay
            </span>
            <div className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
              isActive ? "bg-emerald-500" : "bg-white/[0.1]"
            }`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                isActive ? "translate-x-6" : "translate-x-1"
              }`} />
            </div>
          </div>
        </button>

        <div style={{
          maxHeight: isActive ? "200px" : "0",
          opacity: isActive ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.35s ease, opacity 0.25s ease",
        }}>
          <div className="glass-subtle rounded-2xl p-4 space-y-2.5">
            <p className="text-xs text-emerald-100/40 leading-relaxed">
              Her ay sabit <strong className="text-emerald-300">{SUBSCRIPTION_SEEDS} tohum</strong>,
              algoritmamız tarafından en acil arazilere
              <strong className="text-white"> otonom olarak ekilir.</strong>
            </p>
            <div className="flex items-center gap-3">
              {[
                { Icon: ClockIcon, label: "Aylık Tekrar" },
                { Icon: DroneIcon, label: "Otonom Ekim" },
                { Icon: BarChartIcon, label: "CO₂ Raporu" },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-1 text-[11px] text-emerald-400/70">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="font-medium">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-emerald-200/20">
              İstediğiniz zaman hesabınızdan iptal edebilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Ana Sayfa
   ═══════════════════════════════════════════════════════════ */
export default function GuestCheckoutPage() {
  const router = useRouter();
  const {
    seedItems, reservation, totalPrice, totalItems,
    clearSeedCart, clearReservation, timeLeft,
  } = useCart();

  const isReservationOnly = seedItems.length === 0 && reservation !== null;
  const hasGift           = isReservationOnly && !!reservation?.gift;

  const [user, setUser] = useState<{ email: string; fullName: string } | null>(null);
  const [form, setForm] = useState({
    email: "", fullName: "", phone: "", identityNumber: "11111111111",
    address: "", city: "", zipCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [loginModal, setLoginModal] = useState(false);
  const [isAutopilotActive, setIsAutopilotActive] = useState(false);

  const effectiveTotal = totalPrice + (isAutopilotActive ? SUBSCRIPTION_AMOUNT : 0);

  useEffect(() => {
    const handleFocus = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        setTimeout(() => { target.scrollIntoView({ behavior: "smooth", block: "center" }); }, 300);
      }
    };
    document.addEventListener("focusin", handleFocus, { passive: true });
    return () => document.removeEventListener("focusin", handleFocus);
  }, []);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const isUrgent = timeLeft > 0 && timeLeft < 60;

  const fillFormFromUser = useCallback((u: User) => {
    const meta = u.user_metadata as Record<string, string>;
    const fullName = meta?.full_name ?? meta?.contact_person ?? "";
    setUser({ email: u.email ?? "", fullName });
    setForm((prev) => ({
      ...prev,
      email: u.email ?? prev.email,
      fullName: fullName || prev.fullName,
      phone: meta?.phone ?? prev.phone,
    }));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) fillFormFromUser(u);
    });
  }, [fillFormFromUser]);

  const hasItems = seedItems.length > 0 || reservation !== null;
  useEffect(() => {
    if (!hasItems) router.push("/bireysel/satin-al");
  }, [hasItems, router]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.email || !form.fullName || !form.phone) {
      setError("Lütfen tüm zorunlu alanları doldurunuz."); return;
    }
    if (!isReservationOnly && (!form.address || !form.city)) {
      setError("Lütfen teslimat adresinizi eksiksiz doldurunuz."); return;
    }

    setLoading(true);

    const basketItems: { id: string; name: string; category: string; price: string }[] = [];
    seedItems.forEach((item, i) => {
      basketItems.push({
        id: `SEED-${i}`, name: `${item.seedType?.name ?? "Tohum"} x${item.quantity}`,
        category: "Tohum", price: item.totalPrice.toFixed(2),
      });
    });
    if (reservation) {
      reservation.items.forEach((item, i) => {
        basketItems.push({
          id: `RES-${i}`, name: `${item.landName} - ${item.seedType?.name ?? "Tohum"} x${item.quantity}`,
          category: "Arazi Ekimi", price: item.totalPrice.toFixed(2),
        });
      });
    }
    if (isAutopilotActive) {
      basketItems.push({
        id: "AUTOPILOT-1", name: `Otonom Karbon Aboneliği — ${SUBSCRIPTION_SEEDS} tohum/ay`,
        category: "Abonelik", price: SUBSCRIPTION_AMOUNT.toFixed(2),
      });
    }

    try {
      const res = await fetch("/api/payment/guest-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer: {
            email: form.email, fullName: form.fullName, phone: form.phone,
            identityNumber: form.identityNumber,
            address: isReservationOnly ? "Dijital Hizmet" : form.address,
            city: isReservationOnly ? "İstanbul" : form.city,
            zipCode: isReservationOnly ? "34000" : (form.zipCode || "34000"),
          },
          basketItems, totalPrice: effectiveTotal.toFixed(2),
          orderId: reservation?.orderId ?? null, totalSeeds: totalItems,
          giftInfo: reservation?.gift ?? null,
          is_subscription: isAutopilotActive,
          subscription_amount: isAutopilotActive ? SUBSCRIPTION_AMOUNT : 0,
          subscription_seeds: isAutopilotActive ? SUBSCRIPTION_SEEDS : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ödeme başlatılamadı."); setLoading(false); return; }
      if (data.checkoutFormContent && formRef.current) {
        formRef.current.innerHTML = "";
        const fragment = document.createRange().createContextualFragment(data.checkoutFormContent);
        formRef.current.appendChild(fragment);
      }
    } catch { setError("Bağlantı hatası oluştu."); }
    setLoading(false);
  };

  if (!hasItems) return null;

  return (
    <>
      <div className="relative min-h-screen pb-safe">
        {/* Background */}
        <div className="nature-bg">
          <div className="nature-orb nature-orb-1" />
          <div className="nature-orb nature-orb-2" />
        </div>

        {/* Header */}
        <header className="liquid-glass fixed top-0 left-0 right-0 z-40 border-b border-white/[0.04]">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/bireysel/satin-al" className="text-emerald-200/40 hover:text-white text-sm transition-colors">
                ← Geri
              </Link>
              <h1 className="text-lg font-bold text-white">Ödeme</h1>
            </div>
            {reservation && timeLeft > 0 && (
              <div className={`px-4 py-2 rounded-full text-sm font-mono font-bold ${
                isUrgent
                  ? "bg-rose-500/10 border border-rose-500/20 text-rose-400 animate-pulse"
                  : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              }`}>
                {timerStr}
              </div>
            )}
          </div>
        </header>

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-24 pb-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ══ Sol Sütun: Form ══════════════════════════════════════ */}
          <div className="lg:col-span-3 space-y-5 animate-fade-in-up">
            {/* Auth Banner */}
            {user ? (
              <div className="glass-subtle rounded-2xl px-4 py-3 flex items-center gap-3 border border-emerald-500/15">
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-emerald-300/70 text-xs">
                  Giriş yapılmış: <strong className="text-emerald-300">{user.email}</strong>
                </p>
              </div>
            ) : (
              <div className="glass-subtle rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-emerald-100/30">
                  Zaten üye misiniz? <span className="text-emerald-200/20">Bilgilerinizi otomatik doldurmak için</span>
                </p>
                <button type="button" onClick={() => setLoginModal(true)}
                  className="shrink-0 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                  Giriş Yapın →
                </button>
              </div>
            )}

            {/* Dijital teslimat bilgisi */}
            {isReservationOnly && (
              <div className="glass-subtle rounded-2xl px-4 py-3 flex items-start gap-3 border border-sky-500/15">
                <SproutIcon className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-sky-300">Dijital Arazi Ekimi</p>
                  <p className="text-xs text-sky-200/40 mt-0.5">
                    Fiziksel kargo ürünü bulunmamaktadır. Adres bilgisi gerekmez.
                  </p>
                </div>
              </div>
            )}

            {/* Hediye bilgi banner */}
            {hasGift && reservation?.gift && (
              <div className="glass-subtle rounded-2xl px-4 py-3 flex items-start gap-3 border border-pink-500/15">
                <GiftIcon className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-pink-300">Hediye Arazi Ekimi</p>
                  <p className="text-xs text-pink-200/40 mt-0.5">
                    Alıcı: <strong className="text-pink-300">{reservation.gift.recipientName}</strong>
                    {" · "}{reservation.gift.recipientEmail}
                  </p>
                  {reservation.gift.giftNote && (
                    <p className="text-xs text-pink-200/30 mt-1 italic">&ldquo;{reservation.gift.giftNote}&rdquo;</p>
                  )}
                </div>
              </div>
            )}

            {/* Fatura & İletişim Formu */}
            <form onSubmit={handlePayment}>
              <div className="liquid-glass relative rounded-3xl p-8 overflow-hidden space-y-5">
                <div className="relative z-10 space-y-5">
                  <h2 className="text-lg font-bold text-white">
                    {isReservationOnly ? "İletişim Bilgileriniz" : "Fatura ve İletişim Bilgileriniz"}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-emerald-200/50 mb-2">Adınız Soyadınız *</label>
                      <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required placeholder="Adınızı giriniz"
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-emerald-200/50 mb-2">E-posta *</label>
                      <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required placeholder="ornek@mail.com"
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-emerald-200/50 mb-2">Telefon Numaranız *</label>
                    <input value={form.phone} onChange={(e) => set("phone", e.target.value)} required placeholder="5XX XXX XX XX"
                      className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
                  </div>

                  {!isReservationOnly && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-emerald-200/50 mb-2">Şehir *</label>
                          <input value={form.city} onChange={(e) => set("city", e.target.value)} required placeholder="İstanbul"
                            className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-emerald-200/50 mb-2">Posta Kodu</label>
                          <input value={form.zipCode} onChange={(e) => set("zipCode", e.target.value)} placeholder="34000"
                            className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-emerald-200/50 mb-2">Teslimat Adresiniz *</label>
                        <textarea value={form.address} onChange={(e) => set("address", e.target.value)} required placeholder="Mahalle, sokak, bina numarası..." rows={2}
                          className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none" />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-2xl animate-fade-in">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading}
                    className="w-full py-4 glass-btn rounded-2xl text-white font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Ödeme başlatılıyor...
                      </span>
                    ) : isAutopilotActive
                      ? `🤖 ${effectiveTotal.toLocaleString("tr-TR")} TL Öde + Abonelik Başlat`
                      : `${effectiveTotal.toLocaleString("tr-TR")} TL Öde`}
                  </button>
                </div>
              </div>
            </form>

            <div ref={formRef} id="iyzico-form-container" className="min-h-0" />
          </div>

          {/* ══ Sağ Sütun: Sipariş Özeti ════════════════════════════ */}
          <div className="lg:col-span-2 animate-fade-in">
            <div className="sticky top-24 space-y-4">
              <div className="liquid-glass relative rounded-3xl p-6 overflow-hidden space-y-4">
                <div className="relative z-10 space-y-4">
                  <h3 className="font-bold text-white">Sipariş Özetiniz</h3>

                  {seedItems.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-emerald-200/30 uppercase tracking-wider">Kargo ile Gönderim</p>
                      {seedItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-1.5 text-emerald-100/40"><TreesIcon className="w-3.5 h-3.5" />{item.seedType?.name} x{item.quantity}</span>
                          <span className="font-medium text-white">{item.totalPrice.toLocaleString("tr-TR")} TL</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {reservation && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-emerald-200/30 uppercase tracking-wider">Arazi Ekimi</p>
                      {reservation.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-1.5 text-emerald-100/40"><TreesIcon className="w-3.5 h-3.5" />{item.landName} x{item.quantity}</span>
                          <span className="font-medium text-white">{item.totalPrice.toLocaleString("tr-TR")} TL</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {hasGift && reservation?.gift && (
                    <div className="glass-subtle rounded-2xl px-3 py-2.5 border border-pink-500/15">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-400"><GiftIcon className="w-3.5 h-3.5" />Hediye Arazi Ekimi</p>
                      <p className="text-xs text-pink-200/40">{reservation.gift.recipientName} adına ekilecek</p>
                    </div>
                  )}

                  {isAutopilotActive && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-400 flex items-center gap-1.5">🤖 Otonom Abonelik</span>
                      <span className="font-medium text-emerald-300">+{SUBSCRIPTION_AMOUNT.toLocaleString("tr-TR")} TL/ay</span>
                    </div>
                  )}

                  <div className="pt-3 flex justify-between text-lg font-bold text-white border-t border-white/[0.06]">
                    <span>Genel Toplam</span>
                    <span className={isAutopilotActive ? "text-gradient-eco" : ""}>
                      {effectiveTotal.toLocaleString("tr-TR")} TL
                    </span>
                  </div>

                  <div className="text-xs text-emerald-200/20 space-y-1">
                    <p>Toplam {totalItems} tohum{isAutopilotActive ? " + 50/ay" : ""}</p>
                    {reservation && <p>Arazi rezervasyonunuz ödeme sonrası kesinleşecektir.</p>}
                  </div>
                </div>
              </div>

              <AutopilotCard isActive={isAutopilotActive} onToggle={() => setIsAutopilotActive((v) => !v)} />
            </div>
          </div>
        </div>
      </div>

      {loginModal && (
        <LoginModal
          onSuccess={(u) => { fillFormFromUser(u); setLoginModal(false); }}
          onClose={() => setLoginModal(false)}
        />
      )}
    </>
  );
}
