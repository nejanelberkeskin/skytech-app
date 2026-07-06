"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";

interface ReservationRow {
  id: string;
  created_at: string;
  total_seeds: number;
  status: string;
  metadata?: Record<string, unknown> | null;
  order_allocations: {
    land_id: string;
    seeds_allocated: number;
    status: string;
    lands: { name: string; region: string | null } | null;
  }[];
}

const STATUS_META: Record<string, { label: string; classes: string; glow?: string }> = {
  confirmed:  { label: "Drona Yükleniyor 🚁",        classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", glow: "rgba(16,185,129,0.1)" },
  preparing:  { label: "Drona Yükleniyor 🚁",        classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", glow: "rgba(16,185,129,0.1)" },
  planted:    { label: "Toprakla Buluştu 🌱",        classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", glow: "rgba(16,185,129,0.1)" },
  delivered:  { label: "Toprakla Buluştu 🌱",        classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", glow: "rgba(16,185,129,0.1)" },
  reserved:   { label: "Rezerve — Ödeme Bekleniyor", classes: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  pending:    { label: "Ödeme Bekleniyor",            classes: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  expired:    { label: "Süresi Doldu",                classes: "bg-white/[0.04] text-emerald-200/30 border-white/[0.08]" },
  released:   { label: "İptal Edildi",                classes: "bg-white/[0.04] text-emerald-200/30 border-white/[0.08]" },
};

const statusLabel = (s: string) => STATUS_META[s]?.label ?? s;
const statusClasses = (s: string) => STATUS_META[s]?.classes ?? "bg-sky-500/15 text-sky-400 border-sky-500/20";

export default function RezervasyonlarPage() {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      const userId = session.session.user.id;

      const { data } = await supabase
        .from("orders")
        .select(`id, created_at, total_seeds, status, metadata, order_allocations ( land_id, seeds_allocated, status, lands ( name, region ) )`)
        .eq("user_id", userId)
        .in("order_type", ["reservation", "gift"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) setReservations(data as unknown as ReservationRow[]);
      setLoading(false);

      /* ── Realtime: Ekim durumu değiştiğinde otomatik yenile ────────── */
      channel = supabase
        .channel("reservations-realtime")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
          () => { load(); }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "order_allocations" },
          () => { load(); }
        )
        .subscribe();
    };
    load();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Arazi Ekimlerim</h1>
        <p className="text-sm text-emerald-200/40 mt-1">Skytech drone&lsquo;ları ile arazilere ektirdiğiniz tohumlar</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-12 text-center">
          <span className="text-5xl block mb-4 animate-float">🌱</span>
          <p className="text-emerald-200/50 mb-2">Henüz arazi ekimi yaptırmadınız.</p>
          <p className="text-sm text-emerald-200/30">Skytech drone&lsquo;ları ile arazilere tohum ektirin!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((r) => {
            const meta = STATUS_META[r.status];
            return (
              <div
                key={r.id}
                className="liquid-glass rounded-3xl p-5 overflow-hidden relative"
                style={meta?.glow ? { boxShadow: `0 0 30px ${meta.glow}` } : undefined}
              >
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {(r.metadata?.siparis_no as string | undefined)
                          ? (r.metadata!.siparis_no as string)
                          : `Ekim #${r.id.slice(0, 8).toUpperCase()}`}
                        {(r.metadata?.gift_recipient_name as string | undefined) && (
                          <span className="ml-2 text-xs font-normal text-amber-400">
                            🎁 {r.metadata!.gift_recipient_name as string}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-emerald-200/25 mt-0.5">
                        {new Date(r.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${statusClasses(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {r.order_allocations?.map((a, i) => (
                      <div key={i} className="flex items-center gap-3 glass-subtle rounded-2xl px-4 py-3">
                        <span className="text-lg">🌲</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">
                            {a.lands?.name ?? "Bilinmeyen Arazi"}
                          </p>
                          {a.lands?.region && <p className="text-xs text-emerald-200/25">{a.lands.region}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-400">{a.seeds_allocated} tohum</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusClasses(a.status)}`}>
                            {statusLabel(a.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-right">
                    <p className="text-xs text-emerald-200/25">
                      Toplam: <span className="font-medium text-emerald-200/50">{r.total_seeds} tohum</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
