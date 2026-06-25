"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import type { Land } from "@/lib/types";
import LandCard from "@/components/LandCard";
import Navbar from "@/components/Navbar";

export default function LandsPage() {
  const [lands, setLands] = useState<Land[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "full">("all");
  const [selectedLand, setSelectedLand] = useState<Land | null>(null);
  const [reserveForm, setReserveForm] = useState({ buyer_email: "", requested_seeds: 100 });
  const [reserving, setReserving] = useState(false);
  const [reserveResult, setReserveResult] = useState<string | null>(null);
  const [overflowConfirm, setOverflowConfirm] = useState<{ overflowAmount: number; otherLands: Land[] } | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const fetchLands = async () => {
    setLoading(true);
    let query = supabase.from("lands").select("*").eq("is_public", true);
    if (filter === "open") query = query.eq("status", "open");
    if (filter === "full") query = query.eq("status", "full");
    const { data } = await query;
    if (data) {
      const sorted = (data as Land[]).sort((a, b) => {
        const pctA = (a.filled_seeds + a.reserved_seeds) / a.capacity_seeds;
        const pctB = (b.filled_seeds + b.reserved_seeds) / b.capacity_seeds;
        return pctB - pctA;
      });
      setLands(sorted);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLands(); setPage(1); }, [filter]);

  const totalCapacity = lands.reduce((s, l) => s + l.capacity_seeds, 0);
  const totalFilled = lands.reduce((s, l) => s + l.filled_seeds, 0);
  const totalReserved = lands.reduce((s, l) => s + l.reserved_seeds, 0);
  const globalPct = totalCapacity > 0 ? ((totalFilled + totalReserved) / totalCapacity) * 100 : 0;

  const handleReserveClick = (landId: string) => {
    const land = lands.find((l) => l.id === landId);
    if (!land) return;
    setSelectedLand(land);
    setReserveForm({ buyer_email: "", requested_seeds: 100 });
    setReserveResult(null);
    setOverflowConfirm(null);
  };

  const handleReserveSubmit = () => {
    if (!selectedLand) return;
    const available = selectedLand.capacity_seeds - selectedLand.filled_seeds - selectedLand.reserved_seeds;
    const overflow = reserveForm.requested_seeds - available;
    if (overflow > 0) {
      const otherLands = lands.filter(
        (l) => l.id !== selectedLand.id && l.status === "open" &&
        (l.capacity_seeds - l.filled_seeds - l.reserved_seeds) > 0
      );
      setOverflowConfirm({ overflowAmount: overflow, otherLands });
    } else {
      doReserve();
    }
  };

  const doReserve = async () => {
    if (!selectedLand) return;
    setReserving(true);
    setReserveResult(null);
    setOverflowConfirm(null);
    try {
      const res = await fetch("/api/orders/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_email: reserveForm.buyer_email,
          preferred_land_id: selectedLand.id,
          requested_seeds: reserveForm.requested_seeds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReserveResult(`Hata: ${data.error}`);
      } else {
        const summary = data.allocations
          .map((a: { land_name: string; seeds: number }) => `${a.land_name}: ${a.seeds} tohum`)
          .join(", ");
        setReserveResult(`Rezervasyon başarılı! Dağılım: ${summary}`);
        setSelectedLand(null);
        fetchLands();
      }
    } catch {
      setReserveResult("Bağlantı hatası.");
    }
    setReserving(false);
  };

  const totalPages = Math.ceil(lands.length / PAGE_SIZE);

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
        <div className="nature-orb nature-orb-3" />
      </div>

      <Navbar />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Arazi <span className="text-gradient-eco">Haritası</span>
          </h1>
          <p className="text-emerald-100/40 max-w-lg">
            Türkiye genelindeki ekim arazilerimizi keşfedin. Bir arazi seçin, tohum ekmeye başlayın.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-8">
          {(["all", "open", "full"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 ${
                filter === f
                  ? "glass-btn text-white"
                  : "text-emerald-200/40 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {f === "all" ? "Tümü" : f === "open" ? "Açık" : "Dolu"}
            </button>
          ))}
          <div className="ml-auto text-sm text-emerald-200/30">
            {lands.length} arazi
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-32">
            <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
          </div>
        ) : lands.length === 0 ? (
          <div className="text-center py-32">
            <div className="w-20 h-20 rounded-full bg-emerald-500/5 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-emerald-400/30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
            </div>
            <p className="text-emerald-100/30 text-lg">Henüz arazi kaydı yok.</p>
          </div>
        ) : (
          <>
            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
              {lands.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((land) => (
                <LandCard key={land.id} land={land} onReserve={handleReserveClick} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-10">
                <span className="text-sm text-emerald-200/30">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, lands.length)} / {lands.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-5 py-2.5 text-sm font-medium rounded-2xl glass-subtle text-emerald-200/50 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
                  >
                    Önceki
                  </button>
                  {/* Page indicators */}
                  <div className="flex items-center gap-1.5 px-3">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i + 1)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          page === i + 1
                            ? "bg-emerald-400 w-6"
                            : "bg-white/[0.1] hover:bg-white/[0.2]"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                    className="px-5 py-2.5 text-sm font-medium rounded-2xl glass-subtle text-emerald-200/50 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Global Fill Bar */}
        {!loading && lands.length > 0 && (
          <div className="liquid-glass relative rounded-3xl p-6 mt-12 overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Genel Doluluk</h2>
                <span className="text-sm text-emerald-200/50 font-medium">
                  {totalFilled + totalReserved} / {totalCapacity} tohum · %{globalPct.toFixed(1)}
                </span>
              </div>
              <div className="h-3 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-1000 ease-out progress-liquid"
                  style={{ width: `${Math.min(globalPct, 100)}%` }}
                />
              </div>
              <div className="flex gap-6 mt-3 text-xs text-emerald-200/30">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Ekili ({totalFilled})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-400/60" />
                  Rezerve ({totalReserved})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white/[0.08]" />
                  Boş ({totalCapacity - totalFilled - totalReserved})
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Reserve Modal ── */}
      {selectedLand && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="liquid-glass relative rounded-3xl w-full max-w-md p-8 overflow-hidden animate-scale-in">
            <div className="relative z-10 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Tohum Rezerve Et</h3>
                  <p className="text-sm text-emerald-200/40 mt-1">
                    <span className="text-emerald-300">{selectedLand.name}</span>
                    {" — "}{selectedLand.capacity_seeds - selectedLand.filled_seeds - selectedLand.reserved_seeds} tohum müsait
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedLand(null); setReserveResult(null); }}
                  className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {overflowConfirm ? (
                <div className="glass-subtle rounded-2xl p-5 border border-amber-500/10 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-amber-300">Kapasite Aşımı</p>
                  </div>
                  <p className="text-sm text-emerald-100/50">
                    Bu arazide yeterli yer yok. <strong className="text-white">{overflowConfirm.overflowAmount} tohum</strong> diğer arazilere dağıtılacak:
                  </p>
                  {overflowConfirm.otherLands.length > 0 ? (
                    <ul className="space-y-2">
                      {overflowConfirm.otherLands.map((l) => (
                        <li key={l.id} className="flex items-center gap-2 text-sm text-emerald-200/50">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                          {l.name} ({l.capacity_seeds - l.filled_seeds - l.reserved_seeds} boş)
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-rose-400">Yeterli kapasitede başka arazi bulunamadı.</p>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setOverflowConfirm(null)}
                      className="flex-1 py-3 rounded-2xl glass-subtle text-emerald-200/50 text-sm font-medium hover:text-white hover:bg-white/[0.06] transition-all">
                      Vazgeç
                    </button>
                    {overflowConfirm.otherLands.length > 0 && (
                      <button onClick={doReserve} disabled={reserving}
                        className="flex-1 py-3 rounded-2xl glass-btn text-white text-sm font-medium">
                        {reserving ? "İşleniyor..." : "Evet, Dağıt"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-emerald-200/50 mb-2">E-posta</label>
                      <input
                        type="email"
                        value={reserveForm.buyer_email}
                        onChange={(e) => setReserveForm((f) => ({ ...f, buyer_email: e.target.value }))}
                        placeholder="ornek@mail.com"
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder:text-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-emerald-200/50 mb-2">Tohum Adedi</label>
                      <input
                        type="number"
                        min={1}
                        value={reserveForm.requested_seeds}
                        onChange={(e) => setReserveForm((f) => ({ ...f, requested_seeds: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                  </div>
                  {reserveResult && (
                    <div className={`text-sm px-4 py-3 rounded-2xl ${
                      reserveResult.startsWith("Hata")
                        ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                    }`}>
                      {reserveResult}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => { setSelectedLand(null); setReserveResult(null); }}
                      className="flex-1 py-3 rounded-2xl glass-subtle text-emerald-200/50 hover:text-white hover:bg-white/[0.06] text-sm font-medium transition-all"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleReserveSubmit}
                      disabled={reserving || !reserveForm.buyer_email}
                      className="flex-1 py-3 rounded-2xl glass-btn text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {reserving ? "Rezerve ediliyor..." : "Rezerve Et"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
