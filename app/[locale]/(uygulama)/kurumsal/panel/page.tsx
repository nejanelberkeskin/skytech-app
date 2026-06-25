"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { Button, Card, CardStat } from "@/components/ui";
import type { CorporateQuote } from "@/lib/types";

const STATUS_META: Record<string, { label: string; badge: string; icon: string; desc: string }> = {
  PENDING:  { label: "Onay Bekliyor",   badge: "ring-1 ring-yellow-500/50 bg-yellow-500/10 text-yellow-400",   icon: "⏳", desc: "Ekibimiz teklifinizi değerlendirmektedir." },
  QUOTED:   { label: "Teklif Hazır",     badge: "ring-1 ring-emerald-500/50 bg-emerald-500/10 text-emerald-400 glow-sm", icon: "📋", desc: "Özel fiyatlandırmanız hazır! Onaylayıp ödeme yapabilirsiniz." },
  PAID:     { label: "Ödeme Tamamlandı", badge: "ring-1 ring-emerald-500/50 bg-emerald-500/10 text-emerald-400", icon: "✅", desc: "Ödemeniz alınmıştır. Ekim süreciniz başlatılacaktır." },
  REJECTED: { label: "Reddedildi",       badge: "ring-1 ring-red-500/50 bg-red-500/10 text-red-400",           icon: "❌", desc: "Teklif talebiniz reddedilmiştir." },
  EXPIRED:  { label: "Süresi Doldu",     badge: "ring-1 ring-slate-500/50 bg-slate-500/10 text-slate-400",     icon: "⌛", desc: "Teklif süresi dolmuştur." },
};
const FALLBACK_META = { label: "Bilinmiyor", badge: "ring-1 ring-slate-500/50 bg-slate-500/10 text-slate-400", icon: "❓", desc: "" };
const normalizeStatus = (s: string): string => s?.toUpperCase() ?? "PENDING";
const getMeta = (status: string) => STATUS_META[normalizeStatus(status)] ?? FALLBACK_META;

/** Teklifteki tohum sayısını numerik olarak tahmin eder */
function extractSeedCount(q: CorporateQuote): number {
  if (q.approved_seed_count && q.approved_seed_count > 0) return q.approved_seed_count;
  if (q.seed_count) {
    const c = q.seed_count.replace(/\./g, "").replace(/\s/g, "");
    if (c.includes("–")) {
      const [lo, hi] = c.split("–").map((s) => parseInt(s) || 0);
      return Math.round((lo + hi) / 2);
    }
    if (c.includes("+")) return parseInt(c) || 50000;
    return parseInt(c) || 5000;
  }
  return 5000;
}

// ── Animated Count-Up ─────────────────────────────────────────────────────────
function CountUp({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);
  const DURATION = 1200;

  useEffect(() => {
    startTime.current = null;
    const animate = (ts: number) => {
      if (!startTime.current) startTime.current = ts;
      const p = Math.min((ts - startTime.current) / DURATION, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(parseFloat((to * eased).toFixed(decimals)));
      if (p < 1) raf.current = requestAnimationFrame(animate);
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [to, decimals]);

  return <>{val.toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

// ── Pitch Deck Modal: 3 Slide ─────────────────────────────────────────────────
function PitchDeckModal({
  quote,
  companyName,
  onClose,
  onPay,
}: {
  quote: CorporateQuote;
  companyName: string;
  onClose: () => void;
  onPay: () => void;
}) {
  const [slide, setSlide] = useState(0);
  const TOTAL = 3;
  const seeds = extractSeedCount(quote);
  const co2Tons   = parseFloat((seeds * 0.01).toFixed(1));
  const oxygenTon = parseFloat((seeds * 0.0365).toFixed(1));
  const landHa    = parseFloat((seeds * 0.0005).toFixed(2));

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const prev = useCallback(() => setSlide((s) => Math.max(0, s - 1)), []);
  const next = useCallback(() => setSlide((s) => Math.min(TOTAL - 1, s + 1)), []);

  return (
    <div
      className="fixed inset-0 z-50 animate-fade-in
        flex flex-col justify-end
        md:items-center md:justify-center md:p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-h-[90vh] overflow-hidden flex flex-col
          max-md:rounded-t-3xl max-md:animate-slide-up
          md:max-w-3xl md:rounded-3xl md:animate-scale-in"
        style={{
          background: "linear-gradient(135deg, rgba(6,20,14,0.97) 0%, rgba(6,50,34,0.97) 100%)",
          boxShadow: "0 0 0 1px rgba(16,185,129,0.25), 0 40px 80px -16px rgba(0,0,0,0.9), 0 0 100px rgba(16,185,129,0.05)",
        }}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-10 w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-slate-400 hover:text-white transition-all"
        >
          ✕
        </button>

        {/* Slide counter */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === slide ? "w-8 bg-emerald-400" : "w-2 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>

        {/* Slides wrapper */}
        <div className="flex-1 overflow-hidden relative min-h-[520px]">
          {/* ── Slide 0: Vizyon ── */}
          <div
            className={`absolute inset-0 p-10 flex flex-col justify-center items-center text-center space-y-6 transition-all duration-500 ${
              slide === 0 ? "opacity-100 translate-x-0" : slide > 0 ? "opacity-0 -translate-x-12 pointer-events-none" : "opacity-0 translate-x-12 pointer-events-none"
            }`}
          >
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)" }} />
            </div>

            {/* Logos */}
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">
                🌲
              </div>
              <div className="text-3xl text-white/30 font-light">🤝</div>
              <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-xl font-black text-white">
                {companyName.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="space-y-2 relative z-10">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400/60">Stratejik Ortaklık</p>
              <h2
                className="text-3xl sm:text-4xl font-black text-white leading-tight"
                style={{ textShadow: "0 0 40px rgba(16,185,129,0.2)" }}
              >
                Skytech Green{" "}
                <span className="text-emerald-400" style={{ textShadow: "0 0 20px rgba(16,185,129,0.6)" }}>
                  🤝
                </span>{" "}
                {companyName}
              </h2>
              <p className="text-lg text-slate-300 font-medium">&ldquo;Geleceğe Nefes Oluyoruz&rdquo;</p>
            </div>

            {/* ESG impact list */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl relative z-10">
              {[
                { icon: "📊", title: "ESG Raporlaması", desc: "Kapsam 1-2-3 emisyon giderimi olarak beyan edilebilir" },
                { icon: "🏆", title: "Sertifikasyon", desc: "ISO 14064 uyumlu karbon ofset sertifikaları" },
                { icon: "📣", title: "PR Değeri", desc: "Kamuoyuna açık şirket ormanı sayfanız ve rozet" },
              ].map((item) => (
                <div key={item.title} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-left">
                  <span className="text-xl">{item.icon}</span>
                  <p className="text-xs font-bold text-white mt-1">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 relative z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{seeds.toLocaleString("tr-TR")} tohum · Onaylı proje</span>
            </div>
          </div>

          {/* ── Slide 1: Metrikler ── */}
          <div
            className={`absolute inset-0 p-10 flex flex-col justify-center space-y-6 transition-all duration-500 ${
              slide === 1 ? "opacity-100 translate-x-0" : slide > 1 ? "opacity-0 -translate-x-12 pointer-events-none" : "opacity-0 translate-x-12 pointer-events-none"
            }`}
          >
            <div className="text-center space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400/60">Yıllık Çevresel Etki</p>
              <h2 className="text-2xl font-black text-white">
                {seeds.toLocaleString("tr-TR")} Tohumun Dünyaya Katkısı
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* CO2 */}
              <div
                className="rounded-2xl p-5 text-center space-y-2"
                style={{
                  background: "linear-gradient(135deg, rgba(6,78,59,0.6), rgba(4,120,87,0.4))",
                  boxShadow: "0 0 0 1px rgba(16,185,129,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <span className="text-3xl block">🌍</span>
                <div>
                  <p className="text-3xl font-black text-emerald-400">
                    {slide === 1 ? <CountUp to={co2Tons} decimals={1} /> : co2Tons}
                  </p>
                  <p className="text-xs font-bold text-white mt-0.5">Ton CO₂</p>
                  <p className="text-xs text-slate-500 mt-1">yılda silinen</p>
                </div>
              </div>

              {/* O2 */}
              <div
                className="rounded-2xl p-5 text-center space-y-2"
                style={{
                  background: "linear-gradient(135deg, rgba(3,105,161,0.5), rgba(2,132,199,0.3))",
                  boxShadow: "0 0 0 1px rgba(56,189,248,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <span className="text-3xl block">💨</span>
                <div>
                  <p className="text-3xl font-black text-sky-400">
                    {slide === 1 ? <CountUp to={oxygenTon} decimals={1} /> : oxygenTon}
                  </p>
                  <p className="text-xs font-bold text-white mt-0.5">Ton O₂</p>
                  <p className="text-xs text-slate-500 mt-1">yılda üretilen</p>
                </div>
              </div>

              {/* Land */}
              <div
                className="rounded-2xl p-5 text-center space-y-2"
                style={{
                  background: "linear-gradient(135deg, rgba(69,26,3,0.5), rgba(120,53,15,0.3))",
                  boxShadow: "0 0 0 1px rgba(251,191,36,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <span className="text-3xl block">🏔️</span>
                <div>
                  <p className="text-3xl font-black text-amber-400">
                    {slide === 1 ? <CountUp to={landHa} decimals={2} /> : landHa}
                  </p>
                  <p className="text-xs font-bold text-white mt-0.5">Hektar</p>
                  <p className="text-xs text-slate-500 mt-1">korunan toprak</p>
                </div>
              </div>
            </div>

            {/* Progress bars */}
            <div className="space-y-3">
              {[
                { label: "CO₂ Nötrleme Kapasitesi", pct: Math.min((co2Tons / 500) * 100, 100), color: "#10b981" },
                { label: "Biyoçeşitlilik Katkısı",  pct: Math.min((landHa / 50) * 100, 100),  color: "#f59e0b" },
                { label: "Karbon Muhasebesi Puanı",  pct: 82,                                    color: "#38bdf8" },
              ].map((bar) => (
                <div key={bar.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">{bar.label}</span>
                    <span className="text-white font-medium">{bar.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: slide === 1 ? `${bar.pct}%` : "0%",
                        background: bar.color,
                        boxShadow: `0 0 8px ${bar.color}80`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Slide 2: Yatırım & Onay ── */}
          <div
            className={`absolute inset-0 p-10 flex flex-col justify-center items-center text-center space-y-6 transition-all duration-500 ${
              slide === 2 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12 pointer-events-none"
            }`}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-64"
                style={{ background: "radial-gradient(ellipse at bottom, rgba(16,185,129,0.06) 0%, transparent 70%)" }} />
            </div>

            <div className="space-y-1 relative z-10">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400/60">Yatırım Detayı</p>
              <h2 className="text-xl font-black text-white">{companyName} Projesi</h2>
            </div>

            {/* Price */}
            <div className="relative z-10 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Özel Fiyatlandırma</p>
              <div className="relative">
                <p
                  className="text-7xl font-black text-emerald-400 leading-none"
                  style={{
                    textShadow: "0 0 40px rgba(16,185,129,0.5), 0 0 80px rgba(16,185,129,0.2)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {quote.approved_price
                    ? Number(quote.approved_price).toLocaleString("tr-TR")
                    : "—"}
                </p>
                <p className="text-2xl font-bold text-emerald-400/60 mt-1">TL</p>
              </div>
              {quote.approved_seed_count && (
                <p className="text-sm text-slate-400">
                  {quote.approved_seed_count.toLocaleString("tr-TR")} tohum ·{" "}
                  {(Number(quote.approved_price) / quote.approved_seed_count).toFixed(2)} TL/tohum
                </p>
              )}
            </div>

            {/* Admin note */}
            {quote.admin_note && (
              <div className="relative z-10 bg-white/[0.04] border border-white/[0.08] rounded-xl px-5 py-3 max-w-sm">
                <p className="text-xs text-slate-500">Skytech Notu</p>
                <p className="text-sm text-slate-200 mt-1 italic">&ldquo;{quote.admin_note}&rdquo;</p>
              </div>
            )}

            {/* Pay CTA */}
            <button
              onClick={onPay}
              className="relative z-10 px-10 py-4 rounded-2xl font-black text-lg text-white transition-all duration-200 overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, #059669, #10b981, #34d399)",
                boxShadow: "0 0 0 1px rgba(16,185,129,0.5), 0 0 30px rgba(16,185,129,0.4), 0 8px 24px -4px rgba(0,0,0,0.5)",
                animation: "glowPulse 2s ease-in-out infinite",
              }}
            >
              <span className="relative z-10">Teklifi Onayla ve Iyzico ile Öde →</span>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Trust signals */}
            <div className="flex items-center gap-6 text-xs text-slate-600 relative z-10">
              <span className="flex items-center gap-1">🔒 256-bit SSL</span>
              <span className="flex items-center gap-1">🏦 Iyzico Güvenceli</span>
              <span className="flex items-center gap-1">🧾 e-Fatura</span>
            </div>

            <style>{`
              @keyframes glowPulse {
                0%, 100% { box-shadow: 0 0 0 1px rgba(16,185,129,0.5), 0 0 30px rgba(16,185,129,0.4), 0 8px 24px -4px rgba(0,0,0,0.5); }
                50%       { box-shadow: 0 0 0 1px rgba(16,185,129,0.7), 0 0 60px rgba(16,185,129,0.6), 0 8px 24px -4px rgba(0,0,0,0.5); }
              }
            `}</style>
          </div>
        </div>

        {/* Bottom nav */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-white/[0.06]">
          <button
            onClick={prev}
            disabled={slide === 0}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all px-4 py-2 rounded-xl hover:bg-white/[0.05]"
          >
            ← Önceki
          </button>

          <span className="text-xs text-slate-600">{slide + 1} / {TOTAL}</span>

          {slide < TOTAL - 1 ? (
            <button
              onClick={next}
              className="flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-all px-4 py-2 rounded-xl hover:bg-emerald-500/[0.08]"
            >
              Sonraki →
            </button>
          ) : (
            <button
              onClick={onPay}
              className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-all px-4 py-2 rounded-xl hover:bg-emerald-500/[0.08]"
            >
              Ödemeye Geç →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── QuoteAlert bileşeni ───────────────────────────────────────────────────────
function QuoteAlert({
  quote,
  companyName,
  onPayClick,
  onPitchClick,
}: {
  quote: CorporateQuote;
  companyName: string;
  onPayClick: () => void;
  onPitchClick: () => void;
}) {
  const meta = getMeta(quote.status);
  const isQuoted = normalizeStatus(quote.status) === "QUOTED";

  return (
    <div className={`rounded-2xl p-5 ring-2 ${
      isQuoted ? "ring-emerald-500/40 bg-emerald-500/[0.05]" : "ring-yellow-500/30 bg-yellow-500/[0.05]"
    }`}>
      <div className="flex items-start gap-4">
        <span className="text-3xl">{meta.icon}</span>
        <div className="flex-1">
          <h3 className="font-bold text-white text-lg">
            {isQuoted ? "Teklifiniz Hazır!" : "Teklifiniz Değerlendiriliyor"}
          </h3>
          <p className="text-sm text-slate-300 mt-1">{meta.desc}</p>

          {isQuoted && quote.approved_price && (
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs text-slate-400">Toplam Tutar</p>
                <p className="text-2xl font-bold text-emerald-400" style={{ textShadow: "0 0 20px rgba(16,185,129,0.3)" }}>
                  {Number(quote.approved_price).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tohum Sayısı</p>
                <p className="text-lg font-bold text-white">{quote.approved_seed_count?.toLocaleString("tr-TR")} adet</p>
              </div>
              {quote.admin_note && (
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Yönetici Notu</p>
                  <p className="text-sm text-slate-300">{quote.admin_note}</p>
                </div>
              )}
            </div>
          )}

          {isQuoted && (
            <div className="mt-4 flex flex-wrap gap-3">
              {/* NEW: Pitch Deck button */}
              <button
                onClick={onPitchClick}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white border border-emerald-500/40 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.15] transition-all"
              >
                <span>🎬</span>
                Teklifi İncele
              </button>
              <Button variant="primary" size="lg" onClick={onPayClick}>
                Teklifi Onaylayın ve Ödeme Yapın
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Employee Distribution Section ─────────────────────────────────────────────
interface Allocation {
  id: string;
  recipient_name: string;
  recipient_email: string;
  seeds_allocated: number;
  email_sent: boolean;
  certificate_id: string | null;
  created_at: string;
}
interface PoolInfo {
  id: string;
  company_name: string;
  pool_total: number;
  pool_allocated: number;
  pool_remaining: number;
}

function EmployeeDistributionSection({
  quote,
  userId,
}: {
  quote: CorporateQuote;
  userId: string;
}) {
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", seeds: "1" });
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/kurumsal/employees?quote_id=${quote.id}`);
      if (res.ok) {
        const data = await res.json();
        setPool(data.quote);
        setAllocations(data.allocations ?? []);
      }
    } finally {
      setLoadingData(false);
    }
  }, [quote.id]);

  useEffect(() => { load(); }, [load]);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.seeds) return;
    const seeds = parseInt(form.seeds);
    if (isNaN(seeds) || seeds < 1) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/kurumsal/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: quote.id,
          recipient_name: form.name,
          recipient_email: form.email,
          seeds_allocated: seeds,
          send_email: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata oluştu.");
      showToast("success", `✓ ${form.name} adına ${seeds} tohum tahsis edildi, e-posta gönderildi.`);
      setForm({ name: "", email: "", seeds: "1" });
      load();
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const poolPct = pool ? Math.round((pool.pool_allocated / Math.max(pool.pool_total, 1)) * 100) : 0;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(52,211,153,0.12)" }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "rgba(52,211,153,0.08)" }}
      >
        <div>
          <h2 className="font-bold text-white text-sm flex items-center gap-2">
            👥 Çalışan Ekim Dağıtımı
            <span
              className="text-xs font-normal px-2 py-0.5 rounded-full"
              style={{ background: "rgba(16,185,129,0.12)", color: "rgb(52,211,153)", border: "1px solid rgba(52,211,153,0.2)" }}
            >
              {quote.company_name}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Çalışanlarınıza bireysel ekim sertifikası tahsis edin
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Pool progress */}
        {pool && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-400">Tohum Havuzu Kullanımı</span>
              <span className="text-xs font-bold text-white">
                {pool.pool_allocated.toLocaleString("tr-TR")} / {pool.pool_total.toLocaleString("tr-TR")}
                <span className="text-slate-500 font-normal ml-1">({pool.pool_remaining.toLocaleString("tr-TR")} kalan)</span>
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(30,41,59,0.8)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${poolPct}%`,
                  background: poolPct > 90
                    ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                    : "linear-gradient(90deg, #059669, #10b981)",
                  boxShadow: "0 0 10px rgba(16,185,129,0.4)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: poolPct > 90 ? "#f59e0b" : "rgb(52,211,153)" }}>
                %{poolPct} kullanıldı
              </span>
              {pool.pool_remaining === 0 && (
                <span className="text-xs text-red-400">Havuz dolu</span>
              )}
            </div>
          </div>
        )}

        {/* Add employee form */}
        {pool && pool.pool_remaining > 0 && (
          <form onSubmit={handleAdd} className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Çalışan Ekle</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Ad Soyad"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
                style={{
                  background: "rgba(30,41,59,0.6)",
                  border: "1px solid rgba(51,65,85,0.6)",
                  caretColor: "rgb(52,211,153)",
                }}
              />
              <input
                type="email"
                placeholder="E-posta"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
                style={{
                  background: "rgba(30,41,59,0.6)",
                  border: "1px solid rgba(51,65,85,0.6)",
                  caretColor: "rgb(52,211,153)",
                }}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Tohum"
                  min={1}
                  max={pool.pool_remaining}
                  value={form.seeds}
                  onChange={(e) => setForm((f) => ({ ...f, seeds: e.target.value }))}
                  required
                  className="w-24 px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{
                    background: "rgba(30,41,59,0.6)",
                    border: "1px solid rgba(51,65,85,0.6)",
                    caretColor: "rgb(52,211,153)",
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                  style={{
                    background: submitting ? "rgba(5,150,105,0.4)" : "linear-gradient(135deg, #059669, #0d9488)",
                    boxShadow: "0 2px 12px rgba(5,150,105,0.3)",
                  }}
                >
                  {submitting ? "…" : "Tahsis Et"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Toast */}
        {toast && (
          <div
            className="px-4 py-3 rounded-xl text-sm animate-fade-in"
            style={{
              background: toast.type === "success"
                ? "rgba(16,185,129,0.12)"
                : "rgba(239,68,68,0.12)",
              border: `1px solid ${toast.type === "success" ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.25)"}`,
              color: toast.type === "success" ? "rgb(52,211,153)" : "rgb(252,165,165)",
            }}
          >
            {toast.msg}
          </div>
        )}

        {/* Allocations table */}
        {loadingData ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : allocations.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Dağıtılan Sertifikalar ({allocations.length})
            </p>
            <div className="space-y-2">
              {allocations.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(30,41,59,0.8)" }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: "rgba(16,185,129,0.12)", color: "rgb(52,211,153)" }}
                  >
                    {a.recipient_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{a.recipient_name}</p>
                    <p className="text-xs text-slate-500 truncate">{a.recipient_email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: "rgb(52,211,153)" }}>
                      🌱 {a.seeds_allocated.toLocaleString("tr-TR")}
                    </p>
                    <p className="text-xs" style={{ color: a.email_sent ? "rgb(52,211,153)" : "#94a3b8" }}>
                      {a.email_sent ? "✓ E-posta gönderildi" : "E-posta bekliyor"}
                    </p>
                  </div>
                  {a.certificate_id && (
                    <a
                      href={`/sertifika/${a.certificate_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(52,211,153,0.2)",
                        color: "rgb(52,211,153)",
                      }}
                    >
                      Sertifika →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <span className="text-3xl block mb-2">👥</span>
            <p className="text-sm text-slate-500">Henüz çalışan tahsisi yapılmadı.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ana Sayfa ──────────────────────────────────────────────────────────────────
export default function CorporateDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [quotes, setQuotes] = useState<CorporateQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [pitchQuote, setPitchQuote] = useState<CorporateQuote | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/kurumsal/giris"); return; }
      setUser(session.user);
      try {
        const res = await fetch(`/api/kurumsal/quotes?user_id=${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setQuotes(data);
        }
      } catch (e) {
        console.error("Quotes fetch error:", e);
      }
      setLoading(false);
    };
    load();
  }, [router]);

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const companyName = user.user_metadata?.company_name || "Kurumsal";
  const activeQuote = quotes.find((q) => {
    const s = normalizeStatus(q.status);
    return s === "PENDING" || s === "QUOTED";
  });
  const paidQuotes = quotes.filter((q) => normalizeStatus(q.status) === "PAID");

  const goToPay = (quoteId: string) => router.push(`/kurumsal/panel/odeme?quote_id=${quoteId}`);

  return (
    <>
      {/* ── Pitch Deck Overlay ── */}
      {pitchQuote && (
        <PitchDeckModal
          quote={pitchQuote}
          companyName={companyName}
          onClose={() => setPitchQuote(null)}
          onPay={() => {
            setPitchQuote(null);
            goToPay(pitchQuote.id);
          }}
        />
      )}

      <div className="p-8 space-y-8 animate-fade-in">
        {/* Başlık */}
        <div>
          <h1 className="text-2xl font-bold text-white">Genel Bakış</h1>
          <p className="text-sm text-slate-400 mt-1">{companyName} — kurumsal orman ve sürdürülebilirlik paneliniz</p>
        </div>

        {/* Aktif Teklif Uyarısı */}
        {activeQuote && (
          <QuoteAlert
            quote={activeQuote}
            companyName={companyName}
            onPayClick={() => goToPay(activeQuote.id)}
            onPitchClick={() => setPitchQuote(activeQuote)}
          />
        )}

        {/* Özet kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <CardStat icon="🏢" label="Aktif Teklifler"
            value={quotes.filter(q => { const s = normalizeStatus(q.status); return s === "PENDING" || s === "QUOTED"; }).length.toString()}
            sub="bekleyen" />
          <CardStat icon="✅" label="Ödenen Teklifler" value={paidQuotes.length.toString()} sub="tamamlanan" />
          <CardStat icon="🌳" label="Toplam Tohum"
            value={paidQuotes.reduce((s, q) => s + (q.approved_seed_count || 0), 0).toLocaleString("tr-TR")}
            sub="onaylanmış" />
          <CardStat icon="💰" label="Toplam Yatırım"
            value={`${paidQuotes.reduce((s, q) => s + Number(q.approved_price || 0), 0).toLocaleString("tr-TR")} TL`}
            sub="ödenen" />
        </div>

        {/* Teklif geçmişi */}
        <Card variant="solid" padding="none">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">Teklif Geçmişiniz</h2>
            <span className="text-xs text-slate-500">{quotes.length} teklif</span>
          </div>

          {quotes.length === 0 ? (
            <div className="p-8 text-center">
              <span className="text-4xl block mb-3">📋</span>
              <p className="text-slate-400 mb-4">Henüz bir teklif talebiniz bulunmamaktadır.</p>
              <Button variant="primary" onClick={() => router.push("/kurumsal/teklif-al")}>
                İlk Teklifinizi Alın
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {quotes.map((q) => {
                const meta = getMeta(q.status);
                const isQuoted = normalizeStatus(q.status) === "QUOTED";
                return (
                  <div key={q.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                    <span className="text-xl">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        #{q.id.slice(0, 8)} — {q.seed_count}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(q.created_at).toLocaleDateString("tr-TR")} —{" "}
                        {q.need_types?.map(n =>
                          n === "orman" ? "Orman" : n === "sertifika" ? "Sertifika" : "Karbon"
                        ).join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      {q.approved_price ? (
                        <p className="text-sm font-bold text-white">
                          {Number(q.approved_price).toLocaleString("tr-TR")} TL
                        </p>
                      ) : null}
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>
                    {isQuoted && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => setPitchQuote(q)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-all"
                        >
                          🎬 İncele
                        </button>
                        <Button variant="primary" size="sm" onClick={() => goToPay(q.id)}>
                          Ödeyin
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Employee Distribution — shown for each PAID quote ── */}
        {paidQuotes.map((q) => (
          <EmployeeDistributionSection key={q.id} quote={q} userId={user.id} />
        ))}

        {/* ── AI ESG Copilot ── */}
        <AIESGCopilot
          companyName={companyName}
          totalSeeds={paidQuotes.reduce((s, q) => s + (q.approved_seed_count || 0), 0)}
          totalInvested={paidQuotes.reduce((s, q) => s + Number(q.approved_price || 0), 0)}
        />

        {/* ── Embed Widget & Public Forest Page ── */}
        <EmbedSection companyId={user.id} companyName={companyName} />
      </div>
    </>
  );
}

// ── AI ESG Copilot ─────────────────────────────────────────────────────────

interface CopilotMessage {
  role: "user" | "ai";
  content: string;
  isTyping?: boolean;
}

function generateLinkedInPost(companyName: string, seeds: number, co2: number): string {
  return `🌱 Geleceğe nefes oluyoruz!

${companyName} olarak Skytech Green otonom droneları ile bugüne kadar doğaya ${seeds.toLocaleString("tr-TR")} tohum emanet ettik.

Bu, yılda yaklaşık ${co2.toLocaleString("tr-TR", { minimumFractionDigits: 1 })} ton CO₂'nin atmosferden temizlenmesi demek! 🌍

Sürdürülebilirlik sadece bir hedef değil, kurumsal DNA'mızın bir parçası.

🏆 ISO 14064 uyumlu karbon ofset sertifikalarımız hazır
📊 ESG raporlarımızda Kapsam 1-2-3 emisyon giderimini beyan ediyoruz
🌳 Herkese açık şirket ormanımızı ziyaret edebilirsiniz

${companyName} × Skytech Green — Doğaya Yatırım, Geleceğe Miras 🤝

#ESG #Sürdürülebilirlik #KarbonNötr #YeşilGelecek #${companyName.replace(/\s+/g, "")}`;
}

function generateBoardSummary(companyName: string, seeds: number, co2: number, invested: number): string {
  return `📋 YÖNETİM KURULU ÖZET RAPORU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Konu: ${companyName} Sürdürülebilirlik Programı Durum Raporu

🌱 Toplam Ekim: ${seeds.toLocaleString("tr-TR")} tohum
🌍 Yıllık CO₂ Giderimi: ~${co2.toLocaleString("tr-TR", { minimumFractionDigits: 1 })} ton
💰 Toplam Yatırım: ${invested.toLocaleString("tr-TR")} TL
📊 ROI Etkisi: ESG skorunda tahmini +15-25 puan artış

🎯 Stratejik Değerlendirme:
Şirketimizin karbon ayak izi azaltma hedefleri doğrultusunda Skytech Green iş birliğiyle yürütülen otonom ekim programı başarıyla devam etmektedir. Mevcut ekim hacmi, 2030 karbon nötr hedefimizin %${Math.min(Math.round((co2 / 500) * 100), 100)}'ini karşılamaktadır.

✅ Sonraki Adımlar:
• Çalışan ekim sertifikası programının genişletilmesi
• Q2 ESG raporuna karbon ofset verilerinin dahil edilmesi
• Herkese açık şirket ormanı sayfasının PR kampanyasında kullanılması

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${companyName} × Skytech Green`;
}

function AIESGCopilot({
  companyName,
  totalSeeds,
  totalInvested,
}: {
  companyName: string;
  totalSeeds: number;
  totalInvested: number;
}) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const co2 = totalSeeds * 0.01;

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup typing interval
  useEffect(() => {
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
    };
  }, []);

  const typeText = useCallback((fullText: string) => {
    setIsTyping(true);
    let idx = 0;
    const aiMsg: CopilotMessage = { role: "ai", content: "", isTyping: true };
    setMessages((prev) => [...prev, aiMsg]);

    typingRef.current = setInterval(() => {
      idx++;
      const chunk = fullText.slice(0, idx);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "ai", content: chunk, isTyping: idx < fullText.length };
        return updated;
      });
      if (idx >= fullText.length) {
        if (typingRef.current) clearInterval(typingRef.current);
        typingRef.current = null;
        setIsTyping(false);
      }
    }, 12);
  }, []);

  const handlePrompt = useCallback(
    (prompt: string, generator: () => string) => {
      if (isTyping) return;
      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      setTimeout(() => typeText(generator()), 400);
    },
    [isTyping, typeText]
  );

  const handleLinkedIn = useCallback(() => {
    handlePrompt("LinkedIn PR Metni Yaz", () =>
      generateLinkedInPost(companyName, totalSeeds, co2)
    );
  }, [handlePrompt, companyName, totalSeeds, co2]);

  const handleBoard = useCallback(() => {
    handlePrompt("Yönetim Kurulu Özet Raporu", () =>
      generateBoardSummary(companyName, totalSeeds, co2, totalInvested)
    );
  }, [handlePrompt, companyName, totalSeeds, co2, totalInvested]);

  const handleUserSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!userInput.trim() || isTyping) return;
      const msg = userInput.trim();
      setUserInput("");
      setMessages((prev) => [...prev, { role: "user", content: msg }]);
      setTimeout(() => {
        const response = `${companyName} için analiz yapıyorum... 🔍\n\nMevcut verilerinize göre:\n🌱 ${totalSeeds.toLocaleString("tr-TR")} tohum ekildi\n🌍 ~${co2.toFixed(1)} ton CO₂/yıl giderim\n💰 ${totalInvested.toLocaleString("tr-TR")} TL toplam yatırım\n\n"${msg}" konusunda şunu söyleyebilirim:\n\nSkytech Green platformu üzerinden yürütülen sürdürülebilirlik programınız, sektörünüzdeki benzer ölçekli şirketlerin ortalamasının üzerinde performans göstermektedir. ESG raporlamanız için bu veriler ISO 14064 standardına uygun şekilde beyan edilebilir.\n\nDaha detaylı bir analiz için "LinkedIn PR Metni" veya "Yönetim Kurulu Raporu" butonlarını kullanabilirsiniz. 🚀`;
        typeText(response);
      }, 500);
    },
    [userInput, isTyping, typeText, companyName, totalSeeds, co2, totalInvested]
  );

  const copyLastAI = useCallback(() => {
    const lastAI = [...messages].reverse().find((m) => m.role === "ai");
    if (lastAI) navigator.clipboard.writeText(lastAI.content);
  }, [messages]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(15,23,42,0.7)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(139,92,246,0.15)",
        boxShadow: "0 0 30px rgba(139,92,246,0.05)",
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "rgba(139,92,246,0.1)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
            style={{
              background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(167,139,250,0.1))",
              border: "1px solid rgba(167,139,250,0.3)",
            }}
          >
            ✦
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">AI ESG Copilot</h2>
            <p className="text-xs text-slate-500">Yapay zeka destekli PR & raporlama asistanı</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={copyLastAI}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: "rgba(139,92,246,0.1)",
              border: "1px solid rgba(167,139,250,0.2)",
              color: "rgb(167,139,250)",
            }}
          >
            📋 Son Yanıtı Kopyala
          </button>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="px-6 py-3 flex gap-3 border-b" style={{ borderColor: "rgba(51,65,85,0.3)" }}>
        <button
          onClick={handleLinkedIn}
          disabled={isTyping}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
          style={{
            background: "rgba(10,102,194,0.12)",
            border: "1px solid rgba(96,165,250,0.25)",
            color: "rgb(96,165,250)",
          }}
        >
          <span>💼</span>
          LinkedIn PR Metni Yaz
        </button>
        <button
          onClick={handleBoard}
          disabled={isTyping}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
          style={{
            background: "rgba(139,92,246,0.1)",
            border: "1px solid rgba(167,139,250,0.25)",
            color: "rgb(167,139,250)",
          }}
        >
          <span>📊</span>
          Yönetim Kurulu Özet Raporu
        </button>
      </div>

      {/* Chat Messages */}
      <div
        ref={scrollRef}
        className="px-6 py-4 space-y-4 overflow-y-auto"
        style={{ minHeight: 200, maxHeight: 420 }}
      >
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div
              className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-3"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(16,185,129,0.08))",
                border: "1px solid rgba(167,139,250,0.15)",
              }}
            >
              ✦
            </div>
            <p className="text-sm text-slate-400">
              Merhaba! Ben <strong className="text-violet-400">ESG Copilot</strong>.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {companyName} verilerinizi kullanarak PR metinleri, YK raporları ve ESG analizleri üretebilirim.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed"
                style={
                  msg.role === "user"
                    ? {
                        background: "rgba(16,185,129,0.12)",
                        border: "1px solid rgba(52,211,153,0.2)",
                        color: "#e2e8f0",
                        borderBottomRightRadius: "6px",
                      }
                    : {
                        background: "rgba(139,92,246,0.08)",
                        border: "1px solid rgba(167,139,250,0.12)",
                        color: "#cbd5e1",
                        borderBottomLeftRadius: "6px",
                      }
                }
              >
                {msg.content}
                {msg.isTyping && (
                  <span
                    className="inline-block w-1.5 h-4 ml-0.5 align-middle"
                    style={{
                      background: "rgb(167,139,250)",
                      animation: "blink 0.8s step-end infinite",
                    }}
                  />
                )}
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isTyping && messages.length > 0 && !messages[messages.length - 1]?.isTyping && (
          <div className="flex items-center gap-2 text-xs text-violet-400">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            ESG Copilot yazıyor...
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleUserSubmit}
        className="px-6 py-4 border-t flex gap-3"
        style={{ borderColor: "rgba(51,65,85,0.3)" }}
      >
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="ESG Copilot'a bir şey sorun..."
          disabled={isTyping}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white outline-none transition-all disabled:opacity-50"
          style={{
            background: "rgba(30,41,59,0.6)",
            border: "1px solid rgba(51,65,85,0.6)",
            caretColor: "rgb(167,139,250)",
          }}
        />
        <button
          type="submit"
          disabled={isTyping || !userInput.trim()}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-30"
          style={{
            background: isTyping ? "rgba(139,92,246,0.2)" : "linear-gradient(135deg, #7c3aed, #8b5cf6)",
            boxShadow: isTyping ? "none" : "0 2px 12px rgba(139,92,246,0.3)",
          }}
        >
          Gönder
        </button>
      </form>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Embed + Public Forest Section ────────────────────────────────────────────
function EmbedSection({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [copied, setCopied] = useState<"iframe" | "slug" | null>(null);
  const slug = companyName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://skytechgreen.com";

  const iframeCode = `<iframe
  src="${appUrl}/api/embed/rozet/${slug}"
  width="320"
  height="130"
  frameborder="0"
  scrolling="no"
  style="border:none;overflow:hidden;"
  allowtransparency="true"
></iframe>`;

  const copyText = async (text: string, type: "iframe" | "slug") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.5)" }}
    >
      <div
        className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "rgba(51,65,85,0.4)" }}
      >
        <div>
          <h2 className="font-bold text-white text-sm">🌐 Kurumsal PR Araçları</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Web sitenize ekleyin ve kamuoyuyla paylaşın
          </p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Public forest link */}
        <div
          className="flex items-center justify-between p-4 rounded-xl"
          style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-400 mb-1">Herkese Açık Orman Sayfanız</p>
            <p className="text-sm text-white truncate font-mono">
              {appUrl}/orman/{slug}
            </p>
          </div>
          <div className="flex gap-2 shrink-0 ml-4">
            <button
              onClick={() => copyText(`${appUrl}/orman/${slug}`, "slug")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: copied === "slug" ? "rgba(16,185,129,0.2)" : "rgba(30,41,59,0.8)",
                border: `1px solid ${copied === "slug" ? "rgba(52,211,153,0.4)" : "rgba(51,65,85,0.5)"}`,
                color: copied === "slug" ? "rgb(52,211,153)" : "#94a3b8",
              }}
            >
              {copied === "slug" ? "✓ Kopyalandı" : "🔗 Kopyala"}
            </button>
            <a
              href={`/orman/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(52,211,153,0.2)",
                color: "rgb(52,211,153)",
              }}
            >
              Aç →
            </a>
          </div>
        </div>

        {/* Embed widget */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400">Web Sitesi Rozeti (iframe)</p>
            <div className="flex gap-2">
              <a
                href={`/api/embed/rozet/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: "rgba(30,41,59,0.8)",
                  border: "1px solid rgba(51,65,85,0.5)",
                  color: "#94a3b8",
                }}
              >
                Önizle
              </a>
              <button
                onClick={() => copyText(iframeCode, "iframe")}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: copied === "iframe" ? "rgba(16,185,129,0.15)" : "rgba(30,41,59,0.8)",
                  border: `1px solid ${copied === "iframe" ? "rgba(52,211,153,0.3)" : "rgba(51,65,85,0.5)"}`,
                  color: copied === "iframe" ? "rgb(52,211,153)" : "#94a3b8",
                }}
              >
                {copied === "iframe" ? "✓ Kopyalandı" : "📋 Kodu Kopyala"}
              </button>
            </div>
          </div>
          <pre
            className="text-xs rounded-xl p-4 overflow-x-auto"
            style={{
              background: "rgba(8,12,22,0.9)",
              border: "1px solid rgba(30,41,59,0.8)",
              color: "#7dd3fc",
              lineHeight: 1.6,
            }}
          >
            <code>{iframeCode}</code>
          </pre>
        </div>

        {/* Preview note */}
        <div
          className="flex items-center gap-3 p-3 rounded-xl text-xs"
          style={{ background: "rgba(30,41,59,0.4)", border: "1px solid rgba(51,65,85,0.4)" }}
        >
          <span className="text-lg">💡</span>
          <span className="text-slate-400">
            Rozeti web sitenizin alt bilgisine veya hakkımızda sayfanıza ekleyin.
            Tohum sayısı her 30 dakikada bir güncellenir.
          </span>
        </div>
      </div>
    </div>
  );
}
