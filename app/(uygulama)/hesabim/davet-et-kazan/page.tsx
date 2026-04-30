"use client";

/**
 * /hesabim/davet-et-kazan — Hediye & Davet Ödülleri (Liquid Glass)
 *
 * user_rewards tablosundan gerçek verileri çeker ve listeler.
 * Viral loop: Kullanıcı A hediye gönderir → B kayıt olur → A ödül kazanır.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/browser";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════
   Tipler
   ═══════════════════════════════════════════════════════════ */

interface Reward {
  id: string;
  reward_type: string;
  amount: number;
  source_order_id: string | null;
  description: string | null;
  created_at: string;
}

interface RewardStats {
  totalRewards: number;
  totalAmount: number;
  giftRewards: number;
}

/* ═══════════════════════════════════════════════════════════
   Yardımcılar
   ═══════════════════════════════════════════════════════════ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rewardTypeLabel(type: string): { label: string; accent: string; icon: string } {
  switch (type) {
    case "referral_gift":
      return { label: "Hediye Daveti", accent: "text-pink-400", icon: "🎁" };
    case "referral_signup":
      return { label: "Davet Bonusu", accent: "text-emerald-400", icon: "🤝" };
    case "welcome_bonus":
      return { label: "Hoşgeldin Bonusu", accent: "text-sky-400", icon: "👋" };
    default:
      return { label: "Bonus", accent: "text-emerald-200/50", icon: "🌟" };
  }
}

/* ═══════════════════════════════════════════════════════════
   Ana Sayfa
   ═══════════════════════════════════════════════════════════ */

export default function DavetEtKazanPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [stats, setStats] = useState<RewardStats>({ totalRewards: 0, totalAmount: 0, giftRewards: 0 });
  const [earnedSeeds, setEarnedSeeds] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [rewardsRes, profileRes] = await Promise.all([
      supabase
        .from("user_rewards")
        .select("id, reward_type, amount, source_order_id, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("earned_seeds")
        .eq("id", user.id)
        .single(),
    ]);

    const rewardsList = (rewardsRes.data ?? []) as Reward[];
    setRewards(rewardsList);

    const totalAmount = rewardsList.reduce((sum, r) => sum + r.amount, 0);
    const giftRewards = rewardsList.filter((r) => r.reward_type === "referral_gift").length;
    setStats({
      totalRewards: rewardsList.length,
      totalAmount,
      giftRewards,
    });

    setEarnedSeeds((profileRes.data?.earned_seeds as number) ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex justify-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl space-y-8 animate-fade-in-up">

      {/* ── Başlık ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
            style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.1))", border: "1px solid rgba(52,211,153,0.2)" }}>
            🏆
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Hediye & Davet Ödülleri</h1>
            <p className="text-sm text-emerald-200/40">
              Gönderdiğin hediyelerin seni kazandıranlar burada.
            </p>
          </div>
        </div>
        <Link
          href="/hesabim/davet-et"
          className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Davet Linkine Git →
        </Link>
      </div>

      {/* ── Özet Kartları ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Toplam Kazanılan Tohum */}
        <div className="liquid-glass rounded-3xl p-5 space-y-2 overflow-hidden relative">
          <div className="absolute inset-0 rounded-3xl" style={{ boxShadow: "inset 0 0 40px rgba(16,185,129,0.08)" }} />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-emerald-200/40 uppercase tracking-wider">Toplam Kazanılan</p>
              <span className="text-lg">🌱</span>
            </div>
            <p className="text-3xl font-black text-emerald-400 mt-1">
              {earnedSeeds.toLocaleString("tr-TR")}
            </p>
            <p className="text-xs text-emerald-200/25">tohum</p>
          </div>
        </div>

        {/* Hediye Daveti */}
        <div className="liquid-glass rounded-3xl p-5 space-y-2 overflow-hidden relative">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-emerald-200/40 uppercase tracking-wider">Hediye Daveti</p>
              <span className="text-lg">🎁</span>
            </div>
            <p className="text-3xl font-black text-pink-400 mt-1">
              {stats.giftRewards.toLocaleString("tr-TR")}
            </p>
            <p className="text-xs text-emerald-200/25">başarılı katılım</p>
          </div>
        </div>

        {/* Toplam Ödül */}
        <div className="liquid-glass rounded-3xl p-5 space-y-2 overflow-hidden relative">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-emerald-200/40 uppercase tracking-wider">Toplam Ödül</p>
              <span className="text-lg">🏆</span>
            </div>
            <p className="text-3xl font-black text-amber-400 mt-1">
              {stats.totalRewards.toLocaleString("tr-TR")}
            </p>
            <p className="text-xs text-emerald-200/25">işlem</p>
          </div>
        </div>
      </div>

      {/* ── Nasıl Çalışır İnfografik ────────────────────────── */}
      <div className="liquid-glass rounded-3xl p-6 overflow-hidden relative"
        style={{ boxShadow: "0 0 30px rgba(16,185,129,0.06)" }}>
        <div className="relative z-10">
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-5">
            Hediye Göndererek Nasıl Kazanırsın?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: 1,
                icon: "🎁",
                title: "Hediye Gönder",
                desc: "Arazi ekiminde 'Hediye olarak gönder' seçeneğini seç ve arkadaşının e-postasını gir.",
              },
              {
                step: 2,
                icon: "📧",
                title: "Arkadaşın Katılsın",
                desc: "Arkadaşın bu e-posta ile platforma kayıt olduğunda sistem otomatik eşleştirir.",
              },
              {
                step: 3,
                icon: "🌱",
                title: "Ödül Kazan!",
                desc: "Her başarılı katılım için otomatik olarak tohum ödülü kazanırsın.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(52,211,153,0.15)" }}>
                  {item.icon}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(16,185,129,0.15)", color: "rgb(52,211,153)", border: "1px solid rgba(52,211,153,0.2)" }}>
                    {item.step}
                  </span>
                  <p className="text-sm font-bold text-white">{item.title}</p>
                </div>
                <p className="text-xs text-emerald-200/30 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Ödül Geçmişi ────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-emerald-200/40 uppercase tracking-wider">
            Ödül Geçmişi
          </h2>
          <span className="text-xs text-emerald-200/25">
            {rewards.length} kayıt
          </span>
        </div>

        {rewards.length === 0 ? (
          <div className="liquid-glass rounded-3xl p-10 text-center">
            <div className="text-5xl mb-4 animate-float">🌿</div>
            <p className="text-sm font-semibold text-white">Henüz ödül yok</p>
            <p className="text-xs text-emerald-200/30 mt-1 max-w-xs mx-auto">
              Bir arkadaşına hediye arazi ekimi gönder, arkadaşın kayıt olunca
              ilk ödülün burada görünecek!
            </p>
            <Link
              href="/bireysel/satin-al/arazi"
              className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              🎁 Hediye Ekimi Yap →
            </Link>
          </div>
        ) : (
          <div className="liquid-glass rounded-3xl overflow-hidden">
            <div>
              {rewards.map((reward, i) => {
                const typeInfo = rewardTypeLabel(reward.reward_type);
                return (
                  <div
                    key={reward.id}
                    className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: i < rewards.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl glass-subtle flex items-center justify-center text-lg shrink-0">
                        {typeInfo.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold ${typeInfo.accent}`}>
                            {typeInfo.label}
                          </p>
                          <span className="text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(52,211,153,0.15)" }}>
                            +{reward.amount} tohum
                          </span>
                        </div>
                        {reward.description && (
                          <p className="text-xs text-emerald-200/25 mt-0.5 truncate">
                            {reward.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-emerald-200/25 shrink-0 whitespace-nowrap">
                      {formatDate(reward.created_at)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── CTA Banner ──────────────────────────────────────── */}
      <div className="liquid-glass rounded-3xl p-5 flex items-center justify-between gap-4 overflow-hidden relative"
        style={{ boxShadow: "0 0 30px rgba(16,185,129,0.06)" }}>
        <div className="relative z-10 flex items-center gap-3">
          <span className="text-2xl">💚</span>
          <div>
            <p className="text-sm font-semibold text-white">Daha fazla kazan!</p>
            <p className="text-xs text-emerald-200/30">
              Davet linkini paylaşarak da arkadaş kazanırsan +5 tohum bonus alırsın.
            </p>
          </div>
        </div>
        <Link
          href="/hesabim/davet-et"
          className="relative z-10 shrink-0 glass-btn px-5 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all"
        >
          Davet Linkini Paylaş
        </Link>
      </div>

    </div>
  );
}
