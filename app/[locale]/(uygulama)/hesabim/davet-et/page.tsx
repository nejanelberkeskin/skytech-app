"use client";

/**
 * /hesabim/davet-et — Davet Et & Kazan Merkezi (Liquid Glass)
 *
 * Oyunlaştırılmış referral dashboard:
 *   - Benzersiz davet linki + Kopyala + sosyal paylaşım
 *   - Bento Grid: Tıklanma / Başarılı Davet / Kazanılan Tohum
 *   - "Nasıl Çalışır?" 3 adımlı infografik timeline
 *
 * Veri: profiles tablosundan referral_code + earned_seeds çekilir.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/browser";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://skytech.green";

/* ═══════════════════════════════════════════════════════════
   Alt bileşenler
   ═══════════════════════════════════════════════════════════ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 min-h-[44px] px-5 flex items-center gap-2 text-sm font-semibold rounded-2xl transition-all duration-300 ${
        copied
          ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
          : "glass-btn text-emerald-400"
      }`}
      style={copied ? { boxShadow: "0 0 16px rgba(16,185,129,0.25)" } : undefined}
    >
      {copied ? (
        <>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Kopyalandı!
        </>
      ) : (
        <>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Kopyala
        </>
      )}
    </button>
  );
}

function SeedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    let start = 0;
    const step = Math.max(1, Math.floor(value / 40));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 24);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className="text-5xl font-black tabular-nums text-gradient-eco"
      style={{ filter: "drop-shadow(0 0 16px rgba(52,211,153,0.5))" }}>
      {display.toLocaleString("tr-TR")}
    </span>
  );
}

function TimelineStep({
  step, icon, title, desc, isLast,
}: {
  step: number;
  icon: string;
  title: string;
  desc: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black"
          style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
          {icon}
        </div>
        {!isLast && (
          <div className="w-px flex-1 mt-2"
            style={{ background: "linear-gradient(to bottom, rgba(52,211,153,0.25), transparent)", minHeight: "32px" }} />
        )}
      </div>
      <div className="pb-8 pt-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.15)" }}>
            Adım {step}
          </span>
        </div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-emerald-200/30 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Ana sayfa
   ═══════════════════════════════════════════════════════════ */
export default function DavetEtPage() {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [earnedSeeds,  setEarnedSeeds]  = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [successCount, setSuccessCount] = useState(0);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [profileRes, rewardsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("referral_code, earned_seeds")
        .eq("id", user.id)
        .single(),
      supabase
        .from("user_rewards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("reward_type", ["referral_signup", "referral_gift"]),
    ]);

    if (profileRes.data) {
      setReferralCode((profileRes.data.referral_code as string | null) ?? null);
      setEarnedSeeds((profileRes.data.earned_seeds as number | null) ?? 0);
    }
    setSuccessCount(rewardsRes.count ?? 0);

    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const referralLink = referralCode
    ? `${APP_URL}/davet/${referralCode.toLowerCase()}`
    : null;

  const waLink = referralLink
    ? `https://wa.me/?text=${encodeURIComponent(`Skytech Green ile geleceği inşa ediyorum! Bu davet linkimle katılırsan ikimiz de +5 tohum kazanacağız 🌱 ${referralLink}`)}`
    : "#";

  const xLink = referralLink
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Skytech Green ile drone teknolojisiyle orman kuruyorum 🌳\n\nBu linkimle katılırsan ikimiz de +5 tohum bonus kazanırız:\n${referralLink}`)}`
    : "#";

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex justify-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-3xl animate-fade-in-up">

      {/* ── Başlık ────────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
            style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.1))", border: "1px solid rgba(52,211,153,0.2)" }}>
            🎁
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Davet Et & Kazan</h1>
            <p className="text-sm text-emerald-200/40">Arkadaşlarını davet et, birlikte tohum kazan.</p>
          </div>
        </div>
      </div>

      {/* ── Davet Linki Kartı ─────────────────────────────────────────────── */}
      <div className="liquid-glass rounded-3xl p-6 space-y-4 relative overflow-hidden"
        style={{ boxShadow: "0 0 40px rgba(16,185,129,0.06)" }}>
        {/* Arka plan ışık efekti */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.1), transparent 70%)" }} />

        <div className="relative z-10">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
            Senin Özel Davet Linkin
          </p>

          {referralLink ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-h-[44px] flex items-center px-4 rounded-2xl font-mono text-sm text-white overflow-hidden"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(52,211,153,0.15)" }}>
                  <span className="truncate">{referralLink}</span>
                </div>
                <CopyButton text={referralLink} />
              </div>

              <div className="flex items-center gap-2 mt-3">
                <p className="text-xs text-emerald-200/25 mr-1">Paylaş:</p>

                <a href={waLink} target="_blank" rel="noopener noreferrer"
                  className="min-h-[36px] flex items-center gap-1.5 px-3.5 text-xs font-semibold rounded-xl transition-all"
                  style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "rgb(74,222,128)" }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.099.546 4.07 1.5 5.785L0 24l6.335-1.652A11.956 11.956 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.818 0-3.521-.497-4.98-1.359L4 21.5l.876-3.01A10.017 10.017 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                  WhatsApp
                </a>

                <a href={xLink} target="_blank" rel="noopener noreferrer"
                  className="min-h-[36px] flex items-center gap-1.5 px-3.5 text-xs font-semibold rounded-xl transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgb(203,213,225)" }}>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
                  </svg>
                  X (Twitter)
                </a>
              </div>
            </>
          ) : (
            <div className="rounded-2xl px-4 py-3.5 flex items-start gap-3"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <span className="text-amber-400 text-lg shrink-0">ℹ️</span>
              <div>
                <p className="text-sm font-semibold text-amber-300">Davet kodun henüz oluşturulmamış</p>
                <p className="text-xs text-amber-500/60 mt-0.5">
                  İlk siparişini tamamladıktan sonra benzersiz davet kodun otomatik oluşturulacak.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bento Grid: İstatistikler ─────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-emerald-200/40 uppercase tracking-wider mb-4">
          Davet İstatistiklerin
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Başarılı Davet */}
          <div className="liquid-glass rounded-3xl p-5 overflow-hidden relative">
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-emerald-200/40 uppercase tracking-wider">Başarılı Davet</p>
                <span className="text-xl">🤝</span>
              </div>
              <p className="text-4xl font-black text-violet-400 mt-1">
                {successCount.toLocaleString("tr-TR")}
              </p>
            </div>
          </div>

          {/* Kazanılan Tohum — öne çıkan kart */}
          <div className="liquid-glass rounded-3xl p-5 overflow-hidden relative sm:col-span-1"
            style={{ boxShadow: "0 0 30px rgba(16,185,129,0.08)" }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(16,185,129,0.06), transparent 70%)" }} />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Kazanılan Tohum</p>
                <span className="text-xl">🌱</span>
              </div>
              <div className="flex items-end gap-2 mt-1">
                <SeedCounter value={earnedSeeds} />
                <span className="text-sm text-emerald-200/30 mb-2">adet</span>
              </div>
              <p className="text-xs text-emerald-500/60">Her başarılı davet +5 tohum</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Nasıl Çalışır? ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-sm font-semibold text-emerald-200/40 uppercase tracking-wider">
            Nasıl Çalışır?
          </h2>
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, rgba(255,255,255,0.06), transparent)" }} />
        </div>

        <div className="liquid-glass rounded-3xl p-6 overflow-hidden relative">
          <div className="relative z-10">
            <TimelineStep
              step={1} icon="🔗"
              title="Davet Linkini Paylaş"
              desc="Yukarıdaki kişisel davet linkini WhatsApp, X veya dilediğin platformda arkadaşlarınla paylaş."
            />
            <TimelineStep
              step={2} icon="🌱"
              title="Arkadaşın Tohum Eksin"
              desc="Arkadaşın davet linkine tıklayıp Skytech Green'e kayıt olduktan sonra ilk tohum satın alımını tamamlar."
            />
            <TimelineStep
              step={3} icon="🎉"
              title="İkiniz de +5 Tohum Kazanın!"
              desc="Arkadaşın ilk siparişini tamamladığı anda, hem arkadaşın hem de sen otomatik olarak +5 tohum bonus kazanırsınız."
              isLast
            />
          </div>
        </div>

        {/* Bilgi notu */}
        <div className="mt-4 rounded-2xl px-4 py-3 flex items-start gap-3"
          style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(129,140,248,0.1)" }}>
          <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01"/>
          </svg>
          <p className="text-xs text-indigo-400/60 leading-relaxed">
            Başarılı davet sayısı ve kazanılan tohumlar gerçek zamanlı olarak güncellenmektedir.
            Detaylı ödül geçmişini &ldquo;Ödüllerim&rdquo; sayfasından inceleyebilirsin.
          </p>
        </div>
      </div>

      {/* ── Ödüllerim CTA ────────────────────────────────────────────────── */}
      <Link
        href="/hesabim/davet-et-kazan"
        className="block liquid-glass liquid-glass-hover rounded-3xl p-5 transition-all overflow-hidden relative"
      >
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-sm font-bold text-white">Hediye & Davet Ödüllerim</p>
              <p className="text-xs text-emerald-200/30 mt-0.5">
                Gönderdiğin hediyelerin seni kazandıranları gör, ödül geçmişini takip et.
              </p>
            </div>
          </div>
          <svg className="w-5 h-5 text-emerald-200/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </Link>

    </div>
  );
}
