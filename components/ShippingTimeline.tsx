"use client";

import { useState } from "react";
import type { ShippingStatus } from "@/lib/types";

/* ════════════════════════════════════════════════════════════════════════
   ShippingTimeline — Kargo İlerleme Çizelgesi
   Hem /kargo-takip (misafir) hem de /hesabim/siparislerim (üye) kullanır.

   Props:
     shippingStatus  — null/undefined → sadece "Sipariş Alındı" aktif
     courierCompany  — SHIPPED/DELIVERED'da kargo firması
     trackingNumber  — SHIPPED/DELIVERED'da takip numarası
     trackingUrl     — opsiyonel, kargo firması takip linki
     createdAt       — sipariş tarihi (ISO)
     shippedAt       — kargoya verilme tarihi (ISO)
     deliveredAt     — teslim tarihi (ISO)
   ════════════════════════════════════════════════════════════════════════ */

export interface ShippingTimelineProps {
  shippingStatus?: ShippingStatus | null;
  courierCompany?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  createdAt?: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
}

// ── Adım tanımları ────────────────────────────────────────────────────────────
const STEPS = [
  { key: "ORDERED",   icon: "📝", label: "Sipariş Alındı",    subLabel: "Ödemeniz onaylandı" },
  { key: "PREPARING", icon: "📦", label: "Hazırlanıyor",       subLabel: "Tohumlarınız paketleniyor" },
  { key: "SHIPPED",   icon: "🚀", label: "Kargoya Verildi",    subLabel: "Yola çıktı" },
  { key: "DELIVERED", icon: "✅", label: "Teslim Edildi",      subLabel: "Elinize ulaştı" },
] as const;

// Kargo durumu → tamamlanan adım indeksi (inclusive)
function getCompletedUpTo(status?: ShippingStatus | null): number {
  switch (status) {
    case "PREPARING": return 1;
    case "SHIPPED":   return 2;
    case "DELIVERED": return 3;
    default:          return 0; // null/undefined/PENDING → sadece "Sipariş Alındı"
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Takip numarasını panoya kopyalayan küçük buton
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  return (
    <button
      onClick={copy}
      title="Kopyala"
      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all ${
        copied
          ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
          : "text-slate-400 border-white/[0.08] bg-white/[0.03] hover:text-white hover:bg-white/[0.07]"
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Kopyalandı
        </>
      ) : (
        <>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Kopyala
        </>
      )}
    </button>
  );
}

export default function ShippingTimeline({
  shippingStatus,
  courierCompany,
  trackingNumber,
  trackingUrl,
  createdAt,
  shippedAt,
  deliveredAt,
}: ShippingTimelineProps) {
  const completedUpTo = getCompletedUpTo(shippingStatus);
  const isShipped   = completedUpTo >= 2;
  const isDelivered = completedUpTo >= 3;

  // Zaman damgaları — her adım için
  const timestamps: Record<number, string> = {};
  if (createdAt)   timestamps[0] = formatDate(createdAt);
  if (shippedAt)   timestamps[2] = formatDate(shippedAt);
  if (deliveredAt) timestamps[3] = formatDate(deliveredAt);

  return (
    <div className="space-y-1">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < completedUpTo;
        const isActive    = idx === completedUpTo;
        const isFuture    = idx > completedUpTo;

        return (
          <div key={step.key}>
            {/* ── Adım satırı ── */}
            <div className={`flex items-start gap-4 py-3 transition-opacity ${isFuture ? "opacity-40" : ""}`}>
              {/* Ikon + dikey çizgi */}
              <div className="flex flex-col items-center shrink-0">
                {/* Ikon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 transition-all ${
                    isCompleted
                      ? "bg-emerald-500/20 ring-2 ring-emerald-500/50"
                      : isActive
                      ? "bg-emerald-500/15 ring-2 ring-emerald-400/60 animate-pulse"
                      : "bg-white/[0.04] ring-1 ring-white/[0.08]"
                  }`}
                  style={
                    isActive
                      ? { boxShadow: "0 0 16px rgba(52,211,153,0.25)" }
                      : isCompleted
                      ? { boxShadow: "0 0 8px rgba(16,185,129,0.15)" }
                      : {}
                  }
                >
                  {step.icon}
                </div>

                {/* Dikey bağlantı çizgisi (son adım hariç) */}
                {idx < STEPS.length - 1 && (
                  <div
                    className={`w-px mt-1 mb-0 ${isCompleted ? "bg-emerald-500/40" : "bg-white/[0.06]"}`}
                    style={{ height: "28px" }}
                  />
                )}
              </div>

              {/* İçerik */}
              <div className="flex-1 min-w-0 pt-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-semibold ${
                    isCompleted ? "text-emerald-300" : isActive ? "text-white" : "text-slate-500"
                  }`}>
                    {step.label}
                  </p>
                  {isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                      Şu An
                    </span>
                  )}
                  {isCompleted && (
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{step.subLabel}</p>
                {timestamps[idx] && (
                  <p className="text-xs text-slate-600 mt-0.5 font-mono">{timestamps[idx]}</p>
                )}
              </div>
            </div>

            {/* ── Kargo detay kutusu — yalnızca 3. adımda (SHIPPED) ve durum SHIPPED/DELIVERED ise ── */}
            {idx === 2 && isShipped && (courierCompany || trackingNumber) && (
              <div
                className="ml-14 mb-2 rounded-xl p-4 space-y-3"
                style={{
                  background: "rgba(16,185,129,0.05)",
                  border: "1px solid rgba(52,211,153,0.2)",
                }}
              >
                {/* Kargo firması */}
                {courierCompany && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Kargo Firması</span>
                    <span className="text-sm font-semibold text-white">{courierCompany}</span>
                  </div>
                )}

                {/* Takip numarası + kopyala */}
                {trackingNumber && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400 shrink-0">Takip No</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-sm font-mono font-bold text-emerald-400 truncate"
                        style={{ letterSpacing: "0.06em" }}
                      >
                        {trackingNumber}
                      </span>
                      <CopyButton text={trackingNumber} />
                    </div>
                  </div>
                )}

                {/* Kargo sitesine git */}
                {trackingUrl && (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: "rgba(16,185,129,0.08)",
                      border: "1px solid rgba(52,211,153,0.25)",
                      color: "rgb(52,211,153)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.14)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.08)";
                    }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {courierCompany ?? "Kargo"} Sitesinde Takip Et
                  </a>
                )}

                {/* Tracking URL olmadan da genel ipucu */}
                {!trackingUrl && trackingNumber && (
                  <p className="text-xs text-slate-500 text-center">
                    Takip numarasını kargo firmasının web sitesine girerek durumu sorgulayabilirsiniz.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
