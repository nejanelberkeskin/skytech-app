"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui";

export default function Cart() {
  const {
    seedItems, removeSeedItem, clearSeedCart, seedTotalPrice,
    reservation, clearReservation, timeLeft, isExpired,
    totalPrice, totalItems,
  } = useCart();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const isUrgent = timeLeft > 0 && timeLeft < 60;

  const hasItems = seedItems.length > 0 || reservation !== null;

  if (!hasItems && !isExpired) return null;

  return (
    <>
      {/* ── Floating Cart Button ─────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-[0_0_30px_rgba(16,185,129,0.25)] px-5 py-3 flex items-center gap-3 transition-all duration-200 active:scale-95 group"
      >
        <span className="text-lg">🛒</span>
        <span className="font-medium">{totalItems} tohum</span>
        {timeLeft > 0 && (
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
            isUrgent
              ? "bg-red-500 animate-pulse"
              : "bg-white/10 text-emerald-200"
          }`}>
            {timerStr}
          </span>
        )}
      </button>

      {/* ── Slide-over Panel ─────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-[var(--bg-elevated)] border-l border-white/[0.06] flex flex-col h-full animate-slide-down">
            {/* Header */}
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Sepetiniz</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-white text-xl transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Timer */}
            {reservation && timeLeft > 0 && (
              <div className={`mx-5 mt-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between ${
                isUrgent
                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                  : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              }`}>
                <span>Ödeme için kalan süre:</span>
                <span className={`font-mono text-lg font-bold ${
                  isUrgent ? "text-red-400" : "text-emerald-400 glow-sm"
                }`} style={!isUrgent ? { textShadow: "0 0 12px rgba(16,185,129,0.5)" } : {}}>
                  {timerStr}
                </span>
              </div>
            )}

            {/* Süre doldu uyarısı */}
            {isExpired && !reservation && (
              <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                Rezervasyon süreniz doldu. Arazideki tohumlar serbest bırakıldı. Tekrar seçim yapabilirsiniz.
              </div>
            )}

            {/* İçerik */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Fiziksel siparişler */}
              {seedItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Kargo ile Gönderim
                  </p>
                  {seedItems.map((item, i) => (
                    <div
                      key={i}
                      className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between mb-2"
                    >
                      <div>
                        <p className="font-medium text-white">
                          {item.seedType?.emoji} {item.seedType?.name}
                        </p>
                        <p className="text-sm text-slate-500">{item.quantity} tohum (kargo)</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white">
                          {item.totalPrice.toLocaleString("tr-TR")} TL
                        </span>
                        <button
                          onClick={() => removeSeedItem(i)}
                          className="text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Arazi rezervasyonları */}
              {reservation && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Arazi Ekimi (Rezerve)
                  </p>
                  {reservation.items.map((item, i) => (
                    <div
                      key={i}
                      className="bg-emerald-500/[0.04] border border-emerald-500/15 rounded-xl p-4 flex items-center justify-between mb-2"
                    >
                      <div>
                        <p className="font-medium text-white">🌍 {item.landName}</p>
                        <p className="text-sm text-slate-500">
                          {item.seedType?.emoji} {item.seedType?.name} · {item.quantity} tohum
                        </p>
                      </div>
                      <span className="font-bold text-white">
                        {item.totalPrice.toLocaleString("tr-TR")} TL
                      </span>
                    </div>
                  ))}
                  <button
                    onClick={clearReservation}
                    className="text-xs text-red-400/60 hover:text-red-400 mt-1 transition-colors"
                  >
                    Rezervasyonu iptal et
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            {(seedItems.length > 0 || reservation) && (
              <div className="p-5 border-t border-white/[0.06] space-y-3">
                <div className="flex justify-between text-lg font-bold text-white">
                  <span>Toplam</span>
                  <span>{totalPrice.toLocaleString("tr-TR")} TL</span>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => { setOpen(false); router.push("/bireysel/odeme"); }}
                >
                  Ödemeye Geçin
                </Button>
                {seedItems.length > 0 && (
                  <button
                    onClick={clearSeedCart}
                    className="w-full py-2 text-sm text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Tohum sepetini temizle
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
