"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/browser";
import Link from "next/link";

/* ── CountUp Hook ──────────────────────────────────────────── */
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);

  return value;
}

interface DashboardData {
  totalSeeds: number;
  estimatedCarbon: number;
  activeReservations: number;
  certificates: number;
}

export default function HesabimOverview() {
  const [data, setData] = useState<DashboardData>({ totalSeeds: 0, estimatedCarbon: 0, activeReservations: 0, certificates: 0 });
  const [recentOrders, setRecentOrders] = useState<{ id: string; created_at: string; total_seeds: number; status: string; order_type: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let userId: string | null = null;
    let ordersChannel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      userId = session.session.user.id;

      const [{ data: allOrders }, { data: recentRaw }, { count: certCount }, { data: profile }] = await Promise.all([
        supabase
          .from("orders")
          .select("total_seeds, payment_status, status")
          .eq("user_id", userId),
        supabase
          .from("orders")
          .select("id, created_at, total_seeds, status, order_type")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("certificates")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("profiles")
          .select("total_seeds, carbon_offset_kg")
          .eq("id", userId)
          .single(),
      ]);

      if (recentRaw) setRecentOrders(recentRaw);

      // Profil sayaçları varsa onları kullan (daha doğru), yoksa orders'dan hesapla
      const profileSeeds = (profile?.total_seeds as number) ?? 0;
      const profileCarbon = (profile?.carbon_offset_kg as number) ?? 0;

      const paid = (allOrders ?? []).filter((o) =>
        o.payment_status === "paid" ||
        ["confirmed", "preparing", "shipped", "delivered", "planted"].includes(o.status)
      );
      const orderSeeds = paid.reduce((s, o) => s + (o.total_seeds ?? 0), 0);
      const totalSeeds = profileSeeds > 0 ? profileSeeds : orderSeeds;
      const active = (allOrders ?? []).filter((o) =>
        ["reserved", "pending", "preparing"].includes(o.status)
      ).length;

      setData({
        totalSeeds,
        estimatedCarbon: profileCarbon > 0
          ? Math.round(profileCarbon * 10) / 10
          : Math.round(totalSeeds * 0.025 * 10) / 10,
        activeReservations: active,
        certificates: certCount ?? 0,
      });

      setLoading(false);

      /* ── Realtime: Siparişler ve sertifikalar değiştiğinde yenile ────── */
      ordersChannel = supabase
        .channel("dashboard-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
          () => { load(); }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "certificates", filter: `user_id=eq.${userId}` },
          () => { load(); }
        )
        .subscribe();
    };
    load();

    return () => {
      if (ordersChannel) supabase.removeChannel(ordersChannel);
    };
  }, []);

  // Animated counters
  const seedCount = useCountUp(data.totalSeeds);
  const carbonCount = useCountUp(Math.round(data.estimatedCarbon * 10));
  const activeCount = useCountUp(data.activeReservations);
  const certCount = useCountUp(data.certificates);

  const STATS = [
    {
      label: "Doğaya Kazandırdığım Tohum",
      value: seedCount.toLocaleString("tr-TR"),
      icon: "🌳",
      gradient: "from-emerald-500/20 to-teal-500/10",
      glow: "rgba(16,185,129,0.15)",
      accent: "text-emerald-400",
    },
    {
      label: "Nötrlediğim Karbon (Tahmini)",
      value: `${(carbonCount / 10).toFixed(1)} Ton`,
      icon: "💨",
      gradient: "from-sky-500/20 to-blue-500/10",
      glow: "rgba(56,189,248,0.12)",
      accent: "text-sky-400",
    },
    {
      label: "Aktif Ekim / Sipariş",
      value: activeCount.toString(),
      icon: "🌱",
      gradient: "from-teal-500/20 to-emerald-500/10",
      glow: "rgba(20,184,166,0.12)",
      accent: "text-teal-400",
    },
    {
      label: "Sertifikalarım",
      value: certCount.toString(),
      icon: "📜",
      gradient: "from-violet-500/20 to-purple-500/10",
      glow: "rgba(139,92,246,0.12)",
      accent: "text-violet-400",
    },
  ];

  const statusLabel = (s: string) =>
    s === "pending" ? "Beklemede" :
    s === "preparing" ? "Hazırlanıyor" :
    s === "shipped" ? "Kargolandı" :
    s === "delivered" ? "Teslim Edildi" :
    s === "confirmed" ? "Onaylandı" :
    s === "reserved" ? "Rezerve" :
    s === "planted" ? "Ekildi" :
    s === "expired" ? "Süresi Doldu" : s;

  const statusClasses = (s: string) =>
    ["confirmed", "delivered", "planted"].includes(s)
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
      : ["pending", "preparing", "reserved"].includes(s)
      ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
      : s === "shipped"
      ? "bg-sky-500/15 text-sky-400 border-sky-500/20"
      : "bg-white/[0.04] text-emerald-200/40 border-white/[0.08]";

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Hesabım</h1>
        <p className="text-sm text-emerald-200/40 mt-1">Doğaya katkılarınızın genel özeti</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="liquid-glass relative rounded-3xl p-5 overflow-hidden group"
              >
                {/* Gradient glow */}
                <div
                  className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ boxShadow: `inset 0 0 40px ${s.glow}` }}
                />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{s.icon}</span>
                  </div>
                  <p className={`text-3xl font-black ${s.accent}`}>{s.value}</p>
                  <p className="text-xs text-emerald-200/30 mt-1.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Orders */}
          <div className="liquid-glass rounded-3xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <h2 className="font-semibold text-white">Son Hareketler</h2>
              <Link href="/hesabim/siparislerim" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Tümünü Gör →
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="p-10 text-center">
                <span className="text-5xl block mb-4 animate-float">🌿</span>
                <p className="text-emerald-200/40 text-sm mb-4">Henüz siparişiniz bulunmuyor.</p>
                <Link href="/bireysel/satin-al"
                  className="inline-flex glass-btn px-6 py-3 rounded-2xl text-sm font-medium text-white transition-all">
                  İlk Tohumu Al →
                </Link>
              </div>
            ) : (
              <div>
                {recentOrders.map((o, i) => (
                  <div
                    key={o.id}
                    className="px-6 py-4 flex items-center gap-4 transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: i < recentOrders.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                  >
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center glass-subtle">
                      <span className="text-lg">{o.order_type === "physical" ? "📦" : "🌱"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        {o.order_type === "physical" ? "Fiziksel Sipariş" : "Arazi Ekimi"} — {o.total_seeds} tohum
                      </p>
                      <p className="text-xs text-emerald-200/25 mt-0.5">
                        {new Date(o.created_at).toLocaleDateString("tr-TR")}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${statusClasses(o.status)}`}>
                      {statusLabel(o.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/bireysel/satin-al/siparis"
              className="liquid-glass liquid-glass-hover relative rounded-3xl p-5 flex items-center gap-4 group overflow-hidden">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center glass-subtle group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">📦</span>
              </div>
              <div className="relative z-10">
                <p className="font-semibold text-white">Tohum Sipariş Ver</p>
                <p className="text-xs text-emerald-200/30">Adresine tohum paketi gönderelim</p>
              </div>
            </Link>
            <Link href="/bireysel/satin-al/arazi"
              className="liquid-glass liquid-glass-hover relative rounded-3xl p-5 flex items-center gap-4 group overflow-hidden">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center glass-subtle group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">🚁</span>
              </div>
              <div className="relative z-10">
                <p className="font-semibold text-white">Benim Yerime Siz Ekin</p>
                <p className="text-xs text-emerald-200/30">Drone ile arazi ekimi yaptır</p>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
