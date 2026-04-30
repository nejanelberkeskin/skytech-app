"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/browser";

// ── Drone SVG component ───────────────────────────────────────────────────────
function DroneSVG() {
  return (
    <g>
      <rect x="-32" y="-3" width="64" height="6" rx="3" fill="#047857" />
      <rect x="-3" y="-32" width="6" height="64" rx="3" fill="#047857" />
      <rect x="-14" y="-14" width="28" height="28" rx="6" fill="#10b981" />
      <rect x="-8" y="-8" width="16" height="16" rx="3" fill="#065f46" />
      <ellipse cx="-32" cy="0" rx="14" ry="4" fill="rgba(110,231,183,0.5)">
        <animateTransform attributeName="transform" type="rotate" values="0 -32 0;360 -32 0" dur="0.15s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="32" cy="0" rx="14" ry="4" fill="rgba(110,231,183,0.5)">
        <animateTransform attributeName="transform" type="rotate" values="0 32 0;360 32 0" dur="0.15s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="0" cy="-32" rx="4" ry="14" fill="rgba(110,231,183,0.5)">
        <animateTransform attributeName="transform" type="rotate" values="0 0 -32;360 0 -32" dur="0.15s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="0" cy="32" rx="4" ry="14" fill="rgba(110,231,183,0.5)">
        <animateTransform attributeName="transform" type="rotate" values="0 0 32;360 0 32" dur="0.15s" repeatCount="indefinite" />
      </ellipse>
      <circle cx="0" cy="20" r="6" fill="#064e3b" />
      <circle cx="0" cy="20" r="3" fill="#0d9488" opacity="0.7" />
      <circle cx="10" cy="-10" r="3" fill="#f87171">
        <animate attributeName="opacity" values="1;0.2;1" dur="0.7s" repeatCount="indefinite" />
      </circle>
      <circle cx="-10" cy="-10" r="3" fill="#34d399">
        <animate attributeName="opacity" values="0.2;1;0.2" dur="0.7s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

// ── Seed particle ─────────────────────────────────────────────────────────────
interface Particle { id: number; x: number; y: number; delay: number; emoji: string }
const SEED_EMOJIS = ["🌱", "🌿", "🍀", "🌳"];

function DroneScene({ onDone }: { onDone: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [phase, setPhase] = useState<"flying" | "done">("flying");
  const idRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      idRef.current += 1;
      setParticles((prev) => [
        ...prev.slice(-18),
        {
          id: idRef.current,
          x: Math.random() * 60 + 20,
          y: Math.random() * 20 + 50,
          delay: Math.random() * 0.3,
          emoji: SEED_EMOJIS[Math.floor(Math.random() * SEED_EMOJIS.length)],
        },
      ]);
    }, 180);

    const timer = setTimeout(() => {
      clearInterval(interval);
      setPhase("done");
      setTimeout(onDone, 600);
    }, 3200);

    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [onDone]);

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 160 }}>
      <svg width="80" height="80" viewBox="-50 -50 100 100" className="absolute top-8"
        style={{ animation: phase === "flying" ? "dronefly 3.2s cubic-bezier(0.4,0,0.2,1) forwards" : "none" }}>
        <DroneSVG />
      </svg>
      {particles.map((p) => (
        <div key={p.id} className="absolute text-lg pointer-events-none"
          style={{ left: `${p.x}%`, top: `${p.y}%`, animation: `seedfall 1.2s ease-in forwards`, animationDelay: `${p.delay}s` }}>
          {p.emoji}
        </div>
      ))}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-8" style={{ background: "linear-gradient(to top, rgba(16,185,129,0.05), transparent)" }} />
      <style>{`
        @keyframes dronefly {
          0%   { left: -80px; transform: translateY(0px); }
          15%  { transform: translateY(-8px); }
          40%  { transform: translateY(4px); }
          65%  { transform: translateY(-6px); }
          85%  { transform: translateY(2px); }
          100% { left: calc(100% + 80px); transform: translateY(0px); }
        }
        @keyframes seedfall {
          0%   { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
          100% { opacity: 0; transform: translateY(60px) scale(0.6) rotate(25deg); }
        }
      `}</style>
    </div>
  );
}

// ── Counter animation ─────────────────────────────────────────────────────────
function CountUp({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const steps = 40;
    const inc = target / steps;
    let current = 0;
    const t = setInterval(() => {
      current += inc;
      if (current >= target) { setCount(target); clearInterval(t); return; }
      setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(t);
  }, [target, duration]);
  return <>{count.toLocaleString("tr-TR")}</>;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CheckoutSuccessPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
      </div>
    }>
      <CheckoutSuccessPage />
    </Suspense>
  );
}

function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const status    = searchParams.get("status") ?? "success";
  const orderId   = searchParams.get("order_id");
  const siparisNo = searchParams.get("siparis_no");

  const [showContent, setShowContent] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [password, setPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderEmail, setOrderEmail] = useState("");
  const [buyerName, setBuyerName] = useState<string | null>(null);
  const [totalSeeds, setTotalSeeds] = useState(0);

  const isError = status === "error";

  useEffect(() => {
    if (isError) setShowContent(true);
  }, [isError]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
  }, []);

  useEffect(() => {
    if (orderId && isLoggedIn === false) {
      fetch(`/api/payment/status?order_id=${orderId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.buyer_email) setOrderEmail(data.buyer_email);
          if (data.buyer_name)  setBuyerName(data.buyer_name);
          if (data.total_seeds) setTotalSeeds(data.total_seeds);
        })
        .catch(() => {});
    }
  }, [orderId, isLoggedIn]);

  const handleGuestRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) { setErrorMessage("Şifre en az 8 karakter olmalı."); return; }
    if (!orderEmail) { setErrorMessage("Sipariş e-postası bulunamadı. Lütfen sayfayı yenileyin."); return; }
    if (!orderId) { setErrorMessage("Sipariş numarası bulunamadı. Lütfen sayfayı yenileyin."); return; }

    setRegLoading(true);

    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: orderEmail,
        password,
        options: {
          data: {
            account_type: "individual",
            ...(buyerName ? { full_name: buyerName } : {}),
          },
        },
      });

      if (authErr) {
        throw new Error(
          authErr.message.includes("already registered")
            ? "Bu e-posta zaten kayıtlı. Giriş yaparak siparişlerinizi görebilirsiniz."
            : authErr.message
        );
      }
      if (!authData.user) throw new Error("Hesap oluşturulamadı. Lütfen tekrar deneyin.");

      const newUserId = authData.user.id;

      const claimRes = await fetch("/api/auth/claim-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, userId: newUserId }),
      });

      if (!claimRes.ok) {
        const claimBody = await claimRes.json().catch(() => ({})) as { error?: string };
        throw new Error(claimBody.error ?? "Sipariş bağlanamadı.");
      }

      router.push("/hesabim");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
      setErrorMessage(msg);
      setRegLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6">
      {/* Background */}
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
        <div className="nature-orb nature-orb-3" />
      </div>

      {/* ── Drone animation phase ── */}
      {!isError && !showContent && (
        <div className="relative z-10 w-full max-w-lg space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70">
              Ödeme Alındı
            </p>
            <h1 className="text-2xl font-bold text-white">Tohumlar Yola Çıkıyor...</h1>
            <p className="text-emerald-200/30 text-sm">Drone&apos;larımız tarlanıza ekim için hazırlanıyor</p>
          </div>

          <div className="liquid-glass relative rounded-3xl p-6 overflow-hidden">
            <div className="relative z-10">
              <DroneScene onDone={() => setShowContent(true)} />
            </div>
          </div>

          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full bg-emerald-500/60"
                style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.3); }
            }
          `}</style>
        </div>
      )}

      {/* ── Main content (after animation or on error) ── */}
      {(showContent || isError) && (
        <div className="relative z-10 w-full max-w-lg space-y-5 animate-fade-in">
          {/* Status card */}
          <div className={`liquid-glass relative rounded-3xl p-8 text-center overflow-hidden ${
            isError ? "border-rose-500/20" : ""
          }`}>
            <div className="relative z-10 space-y-5">
              {isError ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-4xl">
                    ❌
                  </div>
                  <h1 className="text-2xl font-bold text-white">Ödeme Başarısız</h1>
                  <p className="text-sm text-emerald-100/40">
                    Ödemeniz işlenemedi. Lütfen tekrar deneyin veya farklı bir kart kullanın.
                  </p>
                </>
              ) : (
                <>
                  {/* Animated success circle */}
                  <div className="relative w-24 h-24 mx-auto">
                    <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
                      <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(16,185,129,0.1)" strokeWidth="6" />
                      <circle cx="48" cy="48" r="42" fill="none" stroke="#10b981" strokeWidth="6"
                        strokeDasharray="264" strokeDashoffset="264" strokeLinecap="round">
                        <animate attributeName="stroke-dashoffset" from="264" to="0" dur="0.8s" fill="freeze" />
                      </circle>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-3xl">✅</span>
                  </div>

                  <div>
                    <h1 className="text-2xl font-bold text-white">Ödeme Başarılı!</h1>
                    <p className="text-sm text-emerald-100/40 mt-1">
                      Siparişiniz alındı. Tohumlarınız en kısa sürede ekilecektir.
                    </p>
                  </div>

                  {/* Seed counter */}
                  {totalSeeds > 0 && (
                    <div className="glass-glow rounded-2xl py-5">
                      <p className="text-xs text-emerald-400/50 uppercase tracking-widest mb-1">Ekilen Tohum</p>
                      <p className="text-4xl font-black text-emerald-300">
                        🌱 <CountUp target={totalSeeds} />
                      </p>
                    </div>
                  )}

                  {(siparisNo || orderId) && (
                    <div className="glass-subtle rounded-2xl px-4 py-3">
                      <p className="text-xs text-emerald-200/30">Sipariş Takip Numarası</p>
                      <p className="font-mono text-sm font-bold text-white mt-0.5">
                        {siparisNo ?? `#${orderId!.slice(0, 8).toUpperCase()}`}
                      </p>
                    </div>
                  )}

                  {/* CO₂ fun fact */}
                  <div className="glass-subtle rounded-2xl px-4 py-3 text-xs text-sky-300/60 text-left border border-sky-500/10">
                    <span className="font-semibold text-sky-300">🌍 Etki: </span>
                    Her 100 tohum, yılda ortalama 1-2 ton CO₂ emer.
                    Katkınız için teşekkürler!
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Guest Registration ── */}
          {!isError && isLoggedIn === false && (
            <div className="liquid-glass relative rounded-3xl overflow-hidden">
              <div className="relative z-10 p-6 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-white">Hesabınızı Kalıcı Yapın</h2>
                  <p className="text-xs text-emerald-200/30 mt-1 leading-relaxed">
                    Siparişlerinizi takip edin, sertifikalarınıza erişin.
                  </p>
                </div>

                {orderEmail && (
                  <div className="glass-subtle rounded-2xl px-4 py-3 flex items-center gap-2.5 border border-emerald-500/15">
                    <span className="text-emerald-400 text-base">✉️</span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-emerald-400/50 uppercase tracking-wider leading-none mb-0.5">Sipariş E-postası</p>
                      <p className="text-sm font-medium text-white truncate">{orderEmail}</p>
                    </div>
                  </div>
                )}

                {!showRegister ? (
                  <button onClick={() => setShowRegister(true)}
                    className="w-full py-3.5 glass-btn rounded-2xl text-white font-semibold text-sm">
                    Şifre Belirle &amp; Panele Gir →
                  </button>
                ) : (
                  <form onSubmit={handleGuestRegister} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-emerald-200/50 mb-2">Şifrenizi Belirleyin</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="En az 8 karakter" autoFocus
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm" />
                    </div>
                    {errorMessage && (
                      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs px-4 py-3 rounded-2xl animate-fade-in">
                        {errorMessage}
                      </div>
                    )}
                    <button type="submit" disabled={regLoading}
                      className="w-full py-3.5 glass-btn rounded-2xl text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {regLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Hesap oluşturuluyor...
                        </>
                      ) : "Hesabı Oluştur →"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Logged in CTA */}
          {!isError && isLoggedIn === true && (
            <div className="flex gap-3">
              <Link href="/hesabim/sertifikalar"
                className="flex-1 py-3.5 text-center glass-glow rounded-2xl text-emerald-300 font-medium text-sm transition-all">
                📜 Sertifikalarım
              </Link>
              <Link href="/hesabim"
                className="flex-1 py-3.5 text-center glass-subtle rounded-2xl text-white font-medium text-sm hover:bg-white/[0.06] transition-all">
                Hesabıma Git
              </Link>
            </div>
          )}

          {/* Error retry */}
          {isError && (
            <div className="text-center space-y-3">
              <Link href="/bireysel/odeme"
                className="inline-block px-8 py-3.5 glass-btn rounded-2xl text-white font-medium transition-all">
                Tekrar Dene
              </Link>
              <p className="text-xs text-emerald-200/20">
                Sorun devam ederse{" "}
                <a href="mailto:destek@skytechgreen.com" className="text-emerald-400/60 hover:text-emerald-300 transition-colors">
                  destek@skytechgreen.com
                </a>
              </p>
            </div>
          )}

          <p className="text-center text-sm text-emerald-200/20">
            <Link href="/" className="hover:text-emerald-300 transition-colors">← Ana Sayfaya Dön</Link>
          </p>
        </div>
      )}
    </div>
  );
}
