"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ShippingTimeline from "@/components/ShippingTimeline";
import type { ShippingStatus } from "@/lib/types";

/* ════════════════════════════════════════════════════════════════════════
   /kargo-takip — Misafir Kargo Takip Portalı
   ════════════════════════════════════════════════════════════════════════
   Magic Link desteği:
     ?orderId=...&email=...  → form otomatik dolup direkt sorgular
   Manuel kullanım:
     Form boş → kullanıcı kendi doldurur → Sorgula

   Güvenli tasarım:
     - Yanıtta sadece kargo verileri (hassas alan yok)
     - E-posta masked olarak gösterilir
   ════════════════════════════════════════════════════════════════════════ */

interface TrackResult {
  orderId: string;
  orderType: string;
  shippingStatus: ShippingStatus | null;
  courierCompany: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  maskedEmail: string;
}

// ── İç bileşen: useSearchParams() burada ─────────────────────────────────────
function KargoTakipContent() {
  const searchParams = useSearchParams();

  const [orderId, setOrderId] = useState("");
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<TrackResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [autoFetched, setAutoFetched] = useState(false);

  const track = useCallback(async (oid: string, em: string) => {
    if (!oid.trim() || !em.trim()) {
      setError("Sipariş numarası ve e-posta adresinizi giriniz.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(
        `/api/public/orders/track?orderId=${encodeURIComponent(oid.trim())}&email=${encodeURIComponent(em.trim())}`,
        { cache: "no-store" }
      );
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Sipariş bulunamadı.");
        return;
      }

      setResult(json as TrackResult);
    } catch {
      setError("Sunucuya ulaşılamadı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Magic Link: URL params → otomatik sorgula ────────────────────────────
  useEffect(() => {
    const qOrderId = searchParams.get("orderId") ?? "";
    const qEmail   = searchParams.get("email")   ?? "";

    if (qOrderId && qEmail && !autoFetched) {
      setOrderId(qOrderId);
      setEmail(qEmail);
      setAutoFetched(true);
      track(qOrderId, qEmail);
    }
  }, [searchParams, autoFetched, track]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    track(orderId, email);
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setOrderId("");
    setEmail("");
    setAutoFetched(false);
    // URL temizle
    window.history.replaceState({}, "", "/kargo-takip");
  };

  return (
    <main className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      {/* ── Üst başlık ──────────────────────────────────────────────────── */}
      <header className="border-b border-white/[0.06] bg-black/30 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">🌱</span>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Skytech Green</p>
            <p className="text-xs text-slate-500">Kargo Takip</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-10">
        <div className="w-full max-w-lg space-y-6">

          {/* ── Sayfa başlığı ───────────────────────────────────────────── */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-2">
              <span className="text-2xl">🚀</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Kargo Takip</h1>
            <p className="text-sm text-slate-400">
              Sipariş numaranız ve e-posta adresinizle kargoyu sorgulayın.
            </p>
          </div>

          {/* ── Sonuç ekranı ─────────────────────────────────────────────── */}
          {result && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {/* Üst bilgi şeridi */}
              <div
                className="px-5 py-4 flex items-start justify-between gap-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Sipariş</p>
                  <p className="text-sm font-mono font-bold text-white truncate">#{result.orderId.slice(0, 12)}…</p>
                  <p className="text-xs text-slate-600">{result.maskedEmail}</p>
                </div>
                <button
                  onClick={handleReset}
                  className="shrink-0 text-xs text-slate-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/[0.16]"
                >
                  Yeni Sorgula
                </button>
              </div>

              {/* Fiziksel sipariş → Timeline */}
              {result.orderType === "physical" ? (
                <div className="px-5 py-5">
                  <ShippingTimeline
                    shippingStatus={result.shippingStatus}
                    courierCompany={result.courierCompany}
                    trackingNumber={result.trackingNumber}
                    trackingUrl={result.trackingUrl}
                    createdAt={result.createdAt}
                    shippedAt={result.shippedAt}
                    deliveredAt={result.deliveredAt}
                  />
                </div>
              ) : (
                /* Rezervasyon / dijital sipariş */
                <div className="px-5 py-8 text-center space-y-3">
                  <span className="text-3xl">🌳</span>
                  <p className="text-sm font-semibold text-white">Dijital Rezervasyon</p>
                  <p className="text-xs text-slate-400">
                    Bu sipariş dijital bir arazi rezervasyonudur. Kargo takibi uygulanmaz.
                    Ekim durumunuzu <span className="text-emerald-400">hesabınızdan</span> takip edebilirsiniz.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Hata mesajı ─────────────────────────────────────────────── */}
          {error && (
            <div
              className="rounded-xl px-4 py-3.5 flex items-start gap-3"
              style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* ── Sorgu formu — sonuç yoksa göster ───────────────────────── */}
          {!result && (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl p-5 space-y-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {/* Sipariş Numarası */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Sipariş Numarası <span className="text-emerald-500">*</span>
                </label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required
                  autoComplete="off"
                  className="w-full min-h-[44px] px-4 py-2.5 text-sm text-white font-mono
                    bg-white/[0.03] border border-white/[0.08] rounded-xl
                    placeholder:text-slate-600 placeholder:font-sans
                    transition-all
                    hover:bg-white/[0.05] hover:border-white/[0.12]
                    focus:outline-none focus:bg-white/[0.05] focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/40"
                />
                <p className="text-xs text-slate-600">
                  Sipariş onay e-postanızda yer alır.
                </p>
              </div>

              {/* E-posta */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  E-posta Adresiniz <span className="text-emerald-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  required
                  autoComplete="email"
                  className="w-full min-h-[44px] px-4 py-2.5 text-sm text-white
                    bg-white/[0.03] border border-white/[0.08] rounded-xl
                    placeholder:text-slate-600
                    transition-all
                    hover:bg-white/[0.05] hover:border-white/[0.12]
                    focus:outline-none focus:bg-white/[0.05] focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/40"
                />
                <p className="text-xs text-slate-600">
                  Siparişi verirken kullandığınız e-posta.
                </p>
              </div>

              {/* Sorgula butonu */}
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] flex items-center justify-center gap-2
                  text-sm font-semibold text-white rounded-xl transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: loading
                    ? "rgba(16,185,129,0.3)"
                    : "linear-gradient(135deg, rgb(16,185,129), rgb(5,150,105))",
                  boxShadow: loading ? "none" : "0 4px 16px rgba(16,185,129,0.25)",
                }}
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Sorgulanıyor…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="11" cy="11" r="8" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                    </svg>
                    Kargoyu Sorgula
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── Alt bilgi ───────────────────────────────────────────────── */}
          <p className="text-center text-xs text-slate-600 pb-4">
            Sorun mu yaşıyorsunuz?{" "}
            <a href="mailto:destek@skytech.green" className="text-emerald-500 hover:text-emerald-400 transition-colors">
              destek@skytech.green
            </a>
          </p>

        </div>
      </div>
    </main>
  );
}

// ── Sayfa export — Suspense sınırı (useSearchParams zorunluluğu) ─────────────
export default function KargoTakipPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 text-emerald-400 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm text-slate-400">Yükleniyor…</p>
          </div>
        </div>
      }
    >
      <KargoTakipContent />
    </Suspense>
  );
}
