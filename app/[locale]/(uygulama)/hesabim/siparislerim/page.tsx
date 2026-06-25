"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/browser";
import ShippingTimeline from "@/components/ShippingTimeline";
import type { ShippingStatus } from "@/lib/types";

/* ════════════════════════════════════════════════════════════════════════
   /hesabim/siparislerim — Üye Fiziksel Sipariş Listesi (Liquid Glass)
   ════════════════════════════════════════════════════════════════════════ */

interface OrderRow {
  id: string;
  created_at: string;
  total_seeds: number;
  total_price: number;
  status: string;
  order_type: string;
  shipping_address: string | null;
  metadata?: Record<string, unknown> | null;
  shipping_status?: ShippingStatus | null;
  courier_company?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
}

// ── Durum etiketi & rengi ──────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; classes: string }> = {
  pending:    { label: "Beklemede",     classes: "bg-amber-500/15 text-amber-400 border-amber-500/20"       },
  preparing:  { label: "Hazırlanıyor",  classes: "bg-sky-500/15 text-sky-400 border-sky-500/20"             },
  shipped:    { label: "Kargoda",       classes: "bg-violet-500/15 text-violet-400 border-violet-500/20"    },
  delivered:  { label: "Teslim Edildi", classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  confirmed:  { label: "Onaylandı",     classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  expired:    { label: "Süresi Doldu",  classes: "bg-white/[0.04] text-emerald-200/30 border-white/[0.08]" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, classes: "bg-white/[0.04] text-emerald-200/30 border-white/[0.08]" };
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full border ${meta.classes}`}>
      {meta.label}
    </span>
  );
}

// ── Kargo Durumu Modal ─────────────────────────────────────
function ShippingModal({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50
        flex flex-col justify-end
        md:items-center md:justify-center md:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-h-[90vh] overflow-y-auto
          max-md:rounded-t-3xl max-md:animate-slide-up
          md:max-w-md md:rounded-3xl"
        style={{
          background: "rgba(4,11,6,0.92)",
          backdropFilter: "blur(24px) saturate(1.6)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
        }}
      >
        {/* Drag handle (mobile) */}
        <div className="md:hidden w-12 h-1.5 rounded-full mx-auto mt-3 mb-1"
          style={{ background: "rgba(255,255,255,0.15)" }} />

        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-white">Kargo Durumu</h2>
            <p className="text-xs font-mono text-emerald-200/30">#{order.id.slice(0, 12)}…</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-emerald-200/40 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Timeline */}
        <div className="px-5 py-5 pb-safe-4">
          <ShippingTimeline
            shippingStatus={order.shipping_status}
            courierCompany={order.courier_company}
            trackingNumber={order.tracking_number}
            trackingUrl={order.tracking_url}
            createdAt={order.created_at}
            shippedAt={order.shipped_at}
            deliveredAt={order.delivered_at}
          />
        </div>
      </div>
    </div>
  );
}

// ── Sipariş kartı ──────────────────────────────────────────────────────────
function OrderCard({ order, onTrackClick }: { order: OrderRow; onTrackClick: () => void }) {
  const isShippable = ["preparing", "shipped", "delivered"].includes(order.status);
  const hasInvoice  = ["confirmed", "preparing", "shipped", "delivered"].includes(order.status);
  const siparisNo   = (order.metadata as Record<string, unknown> | null)?.siparis_no as string | undefined;

  return (
    <div className="liquid-glass rounded-3xl p-5 space-y-4 overflow-hidden relative group">
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ boxShadow: "inset 0 0 30px rgba(16,185,129,0.06)" }} />

      <div className="relative z-10">
        {/* Üst satır: ID + tarih + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              {siparisNo ? siparisNo : `Sipariş #${order.id.slice(0, 8).toUpperCase()}`}
            </p>
            <p className="text-xs text-emerald-200/25 mt-0.5">
              {new Date(order.created_at).toLocaleDateString("tr-TR", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="glass-subtle rounded-2xl px-3 py-2.5">
            <p className="text-xs text-emerald-200/30 mb-0.5">Tohum</p>
            <p className="text-sm font-semibold text-white">{order.total_seeds} adet</p>
          </div>
          <div className="glass-subtle rounded-2xl px-3 py-2.5">
            <p className="text-xs text-emerald-200/30 mb-0.5">Tutar</p>
            <p className="text-sm font-semibold text-white">
              {order.total_price?.toLocaleString("tr-TR")} TL
            </p>
          </div>
          <div className="glass-subtle rounded-2xl px-3 py-2.5">
            <p className="text-xs text-emerald-200/30 mb-0.5">Kargo</p>
            <p className="text-sm font-semibold text-white truncate">
              {order.courier_company ?? (order.tracking_number ? order.tracking_number.slice(0, 8) + "…" : "—")}
            </p>
          </div>
        </div>

        {/* Adres */}
        {order.shipping_address && (
          <p className="text-xs text-emerald-200/25 flex items-start gap-1.5 mt-3">
            <span className="shrink-0 mt-px">📍</span>
            <span className="truncate">{order.shipping_address}</span>
          </p>
        )}

        {/* Buton grubu */}
        {(isShippable || hasInvoice) && (
          <div className={`grid gap-2 mt-4 ${isShippable && hasInvoice ? "grid-cols-2" : "grid-cols-1"}`}>
            {isShippable && (
              <button
                onClick={onTrackClick}
                className="min-h-[44px] flex items-center justify-center gap-2 text-sm font-medium rounded-2xl transition-all"
                style={{
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(52,211,153,0.2)",
                  color: "rgb(52,211,153)",
                }}
              >
                <span className="text-base">📦</span>
                Kargo Durumu
              </button>
            )}

            {hasInvoice && (
              <a
                href={`/fatura/${order.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] flex items-center justify-center gap-2 text-sm font-medium rounded-2xl no-underline transition-all"
                style={{
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(129,140,248,0.2)",
                  color: "rgb(165,180,252)",
                }}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Faturayı Görüntüle
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ana sayfa ──────────────────────────────────────────────────────────────
export default function SiparislerimPage() {
  const [orders,  setOrders]  = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracked, setTracked] = useState<OrderRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) { setLoading(false); return; }

    const { data } = await supabase
      .from("orders")
      .select(
        "id, created_at, total_seeds, total_price, status, order_type, shipping_address, metadata, " +
        "shipping_status, courier_company, tracking_number, tracking_url, shipped_at, delivered_at"
      )
      .eq("user_id", session.session.user.id)
      .eq("order_type", "physical")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setOrders(data as unknown as OrderRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    /* ── Realtime: Sipariş durumu değiştiğinde otomatik yenile ────────── */
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      channel = supabase
        .channel("orders-realtime")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `user_id=eq.${session.session.user.id}`,
          },
          () => { load(); }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in-up">
      {/* Başlık */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white tracking-tight">Fiziksel Siparişlerim</h1>
        <p className="text-sm text-emerald-200/40">Adresinize kargo ile gönderilen tohum siparişleri</p>
      </div>

      {/* İçerik */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-12 text-center space-y-3">
          <span className="text-5xl block animate-float">📦</span>
          <p className="text-base font-medium text-white">Henüz sipariş yok</p>
          <p className="text-sm text-emerald-200/40">
            Tohum siparişi vererek doğaya katkıda bulunabilirsiniz!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onTrackClick={() => setTracked(o)}
            />
          ))}
        </div>
      )}

      {/* Kargo Durumu Modal */}
      {tracked && (
        <ShippingModal
          order={tracked}
          onClose={() => setTracked(null)}
        />
      )}
    </div>
  );
}
