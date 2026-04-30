"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { getRecommendedSeed, type CartItem } from "@/lib/seed-data";
import { useCart } from "@/lib/cart-context";
import type { ReservationInfo } from "@/lib/cart-context";
import type { Land, GiftInfo } from "@/lib/types";
import Link from "next/link";
import { Input, Textarea } from "@/components/ui";

// ── Bölge → 7 coğrafi bölge eşleştirme ──────────────────────────────────────
function getGeoRegion(region: string | null): string | null {
  if (!region) return null;
  const r = region.toLowerCase();
  if (r.includes("marmara") || r.includes("istanbul") || r.includes("bursa") ||
      r.includes("edirne") || r.includes("tekirdağ") || r.includes("kocaeli") ||
      r.includes("sakarya") || r.includes("bilecik") || r.includes("yalova") ||
      r.includes("çanakkale") || r.includes("balıkesir")) return "Marmara";
  if (r.includes("ege") || r.includes("izmir") || r.includes("manisa") ||
      r.includes("aydın") || r.includes("muğla") || r.includes("denizli") ||
      r.includes("uşak") || r.includes("afyon") || r.includes("kütahya")) return "Ege";
  if (r.includes("akdeniz") || r.includes("antalya") || r.includes("mersin") ||
      r.includes("adana") || r.includes("hatay") || r.includes("isparta") ||
      r.includes("burdur") || r.includes("kahramanmaraş")) return "Akdeniz";
  if (r.includes("karadeniz") || r.includes("trabzon") || r.includes("samsun") ||
      r.includes("ordu") || r.includes("rize") || r.includes("artvin") ||
      r.includes("giresun") || r.includes("zonguldak") || r.includes("kastamonu") ||
      r.includes("sinop") || r.includes("bolu") || r.includes("amasya") ||
      r.includes("tokat") || r.includes("çorum") || r.includes("bartın") ||
      r.includes("düzce")) return "Karadeniz";
  if (r.includes("iç anadolu") || r.includes("ankara") || r.includes("konya") ||
      r.includes("sivas") || r.includes("kayseri") || r.includes("aksaray") ||
      r.includes("niğde") || r.includes("karaman") || r.includes("çankırı") ||
      r.includes("kırıkkale") || r.includes("kırşehir") || r.includes("nevşehir") ||
      r.includes("yozgat") || r.includes("eskişehir")) return "İç Anadolu";
  if (r.includes("doğu anadolu") || r.includes("erzurum") || r.includes("erzincan") ||
      r.includes("kars") || r.includes("ağrı") || r.includes("van") ||
      r.includes("bitlis") || r.includes("muş") || r.includes("bingöl") ||
      r.includes("elazığ") || r.includes("malatya") || r.includes("tunceli") ||
      r.includes("hakkari") || r.includes("iğdır")) return "Doğu Anadolu";
  if (r.includes("güneydoğu") || r.includes("gaziantep") || r.includes("diyarbakır") ||
      r.includes("şanlıurfa") || r.includes("mardin") || r.includes("batman") ||
      r.includes("siirt") || r.includes("şırnak") || r.includes("adıyaman") ||
      r.includes("kilis")) return "Güneydoğu Anadolu";
  return null;
}

// ── Turkey SVG bölge tanımları ────────────────────────────────────────────────
const REGION_DEFS: Record<string, { d: string; cx: number; cy: number; short: string }> = {
  "Marmara": {
    d: "M 0,0 L 250,0 L 255,130 L 215,165 L 165,175 L 80,165 L 20,135 L 0,100 Z",
    cx: 118, cy: 82, short: "Marmara",
  },
  "Karadeniz": {
    d: "M 250,0 L 800,0 L 800,100 L 760,140 L 710,155 L 640,150 L 570,135 L 470,110 L 360,80 L 255,130 Z",
    cx: 510, cy: 60, short: "Karadeniz",
  },
  "Ege": {
    d: "M 0,100 L 20,135 L 80,165 L 165,175 L 195,235 L 165,310 L 90,345 L 0,345 Z",
    cx: 74, cy: 228, short: "Ege",
  },
  "İç Anadolu": {
    d: "M 255,130 L 360,80 L 470,110 L 570,135 L 640,150 L 660,185 L 665,260 L 630,310 L 560,300 L 530,320 L 415,315 L 305,300 L 220,270 L 195,235 L 165,175 L 215,165 Z",
    cx: 400, cy: 210, short: "İç Anadolu",
  },
  "Akdeniz": {
    d: "M 0,345 L 90,345 L 165,310 L 195,235 L 220,270 L 305,300 L 415,315 L 530,320 L 560,300 L 585,375 L 530,400 L 360,400 L 150,400 L 0,400 Z",
    cx: 258, cy: 372, short: "Akdeniz",
  },
  "Doğu Anadolu": {
    d: "M 640,150 L 710,155 L 760,140 L 800,100 L 800,300 L 775,315 L 735,325 L 695,305 L 665,260 L 660,185 Z",
    cx: 718, cy: 222, short: "Doğu",
  },
  "Güneydoğu Anadolu": {
    d: "M 530,320 L 560,300 L 630,310 L 665,260 L 695,305 L 735,325 L 775,315 L 800,300 L 800,400 L 530,400 L 585,375 Z",
    cx: 656, cy: 358, short: "Güneydoğu",
  },
};

// ── TurkeyMap component ───────────────────────────────────────────────────────
function TurkeyMap({
  lands,
  selected,
  onSelect,
}: {
  lands: Land[];
  selected: string | null;
  onSelect: (r: string | null) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Calculate stats per geo region
  const regionStats: Record<string, { capacity: number; used: number; count: number }> = {};
  lands.forEach((land) => {
    const gr = getGeoRegion(land.region);
    if (!gr) return;
    if (!regionStats[gr]) regionStats[gr] = { capacity: 0, used: 0, count: 0 };
    regionStats[gr].capacity += land.capacity_seeds;
    regionStats[gr].used += land.filled_seeds + land.reserved_seeds;
    regionStats[gr].count += 1;
  });

  function regionColor(name: string, isSelected: boolean, isHovered: boolean) {
    const stats = regionStats[name];
    if (!stats || stats.count === 0) {
      return isSelected ? "#1f4937" : isHovered ? "#1a3d2f" : "#0f2419";
    }
    const pct = stats.used / stats.capacity;
    let base: string;
    if (pct < 0.5) base = isSelected ? "#10b981" : isHovered ? "#059669" : "#065f46";
    else if (pct < 0.8) base = isSelected ? "#f59e0b" : isHovered ? "#d97706" : "#92400e";
    else base = isSelected ? "#ef4444" : isHovered ? "#dc2626" : "#7f1d1d";
    return base;
  }

  function regionOpacity(name: string) {
    const stats = regionStats[name];
    if (!stats || stats.count === 0) return 0.3;
    return 0.75;
  }

  const activeRegion = hovered ?? selected;
  const activeStats = activeRegion ? regionStats[activeRegion] : null;
  const activePct = activeStats
    ? Math.round((activeStats.used / activeStats.capacity) * 100)
    : null;
  const activeAvail = activeStats
    ? activeStats.capacity - activeStats.used
    : null;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 space-y-3 transform-gpu">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Arazi Haritası</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bölgeye tıklayarak filtreleyin
          </p>
        </div>
        {selected && (
          <button
            onClick={() => onSelect(null)}
            className="text-xs text-slate-500 hover:text-white px-3 py-1 bg-white/[0.05] hover:bg-white/[0.1] rounded-full transition-all"
          >
            ✕ Filtreyi Kaldır
          </button>
        )}
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 800 420"
          className="w-full h-auto"
          style={{ maxHeight: 220 }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {Object.entries(REGION_DEFS).map(([name, def]) => {
            const isSelected = selected === name;
            const isHovered = hovered === name;
            const hasLands = !!(regionStats[name]?.count);
            return (
              <g key={name}>
                <path
                  d={def.d}
                  fill={regionColor(name, isSelected, isHovered)}
                  fillOpacity={regionOpacity(name)}
                  stroke={isSelected ? "#10b981" : isHovered ? "#6ee7b7" : "#ffffff10"}
                  strokeWidth={isSelected ? 2 : 1}
                  filter={isSelected ? "url(#glow)" : undefined}
                  style={{ cursor: hasLands ? "pointer" : "default", transition: "all 0.2s" }}
                  onClick={() => {
                    if (!hasLands) return;
                    onSelect(selected === name ? null : name);
                  }}
                  onMouseEnter={() => setHovered(name)}
                  onMouseLeave={() => setHovered(null)}
                />
                {/* Region label */}
                <text
                  x={def.cx}
                  y={def.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill={hasLands ? (isSelected || isHovered ? "#fff" : "#94a3b8") : "#334155"}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {def.short}
                </text>
                {hasLands && (
                  <text
                    x={def.cx}
                    y={def.cy + 13}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="8"
                    fill={isSelected || isHovered ? "#6ee7b7" : "#475569"}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {regionStats[name].count} arazi
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {activeRegion && activeStats && (
          <div className="absolute top-2 right-2 bg-[var(--bg-elevated)] border border-white/[0.12] rounded-xl px-3 py-2 text-xs space-y-0.5 shadow-xl pointer-events-none">
            <p className="font-bold text-white">{activeRegion}</p>
            <p className="text-slate-400">{activeStats.count} arazi</p>
            <p className="text-emerald-400 font-medium">
              {activeAvail?.toLocaleString("tr-TR")} tohum müsait
            </p>
            <p className="text-slate-500">%{activePct} dolu</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-700 inline-block" />
          Müsait
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-800 inline-block" />
          Dolmak üzere
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-900 inline-block" />
          Kritik
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-800 inline-block" />
          Arazi yok
        </span>
      </div>
    </div>
  );
}

// ── Tamamlanan araziler banner ─────────────────────────────────────────────────
function CompletedLandsBanner({ lands }: { lands: Land[] }) {
  // Arazi yalnızca filled_seeds ≥ kapasite VE rezerve tohum kalmamışsa tamamlandı sayılır
  const completed = lands.filter(
    (l) => l.filled_seeds >= l.capacity_seeds && (l.reserved_seeds ?? 0) === 0
  );
  if (completed.length === 0) return null;
  const items = [...completed, ...completed];
  return (
    <div className="bg-emerald-600/10 border-b border-emerald-500/20 overflow-hidden py-2.5 relative">
      <div className="flex items-center gap-2 px-6 mb-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500/70">
          Ekim Tamamlanan Araziler
        </span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-glow-pulse" />
      </div>
      <div className="marquee-wrapper overflow-hidden">
        <div className="marquee-track flex gap-8 whitespace-nowrap animate-marquee">
          {items.map((land, i) => {
            const { seed } = getRecommendedSeed(land.region ?? null);
            return (
              <span key={i} className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
                <span className="text-emerald-400">🌱</span>
                <span>{land.name}</span>
                {land.region && <span className="text-slate-500">· {land.region}</span>}
                <span className="text-slate-500">· {land.filled_seeds.toLocaleString("tr-TR")} {seed.emoji} tohum</span>
                <span className="mx-4 text-white/10">|</span>
              </span>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 30s linear infinite; }
      `}</style>
    </div>
  );
}

// ── Toggle Switch ──────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; description?: string;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 p-4 bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-xl transition-all duration-200 group text-left">
      <div>
        <p className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors duration-200 ${checked ? "bg-emerald-500" : "bg-slate-700"}`}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </div>
    </button>
  );
}

// ── Ana Sayfa ──────────────────────────────────────────────────────────────────
export default function AraziPage() {
  const [lands, setLands] = useState<Land[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLand, setSelectedLand] = useState<Land | null>(null);
  const [qty, setQty] = useState(100);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<string | null>(null);

  // Hediye durumu
  const [isGift, setIsGift] = useState(false);
  const [giftForm, setGiftForm] = useState<GiftInfo>({
    recipientName: "", recipientEmail: "", giftNote: "",
  });

  const { reservation, setReservation, reservationTtlMinutes } = useCart();

  const fetchLands = async () => {
    setLoading(true);
    const { data } = await supabase.from("lands").select("*").eq("is_public", true);
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

  useEffect(() => { fetchLands(); }, []);

  const closeModal = () => {
    setSelectedLand(null);
    setError(null);
    setIsGift(false);
    setGiftForm({ recipientName: "", recipientEmail: "", giftNote: "" });
  };

  const recommended = selectedLand ? getRecommendedSeed(selectedLand.region ?? null) : null;

  const handleReserve = async () => {
    if (!selectedLand || !recommended) return;
    setReserving(true);
    setError(null);

    if (isGift) {
      if (!giftForm.recipientName.trim()) { setError("Alıcının adını girmeniz gerekiyor."); setReserving(false); return; }
      if (!giftForm.recipientEmail.trim() || !giftForm.recipientEmail.includes("@")) { setError("Geçerli bir e-posta adresi girmeniz gerekiyor."); setReserving(false); return; }
    }

    const available = selectedLand.capacity_seeds - selectedLand.filled_seeds - selectedLand.reserved_seeds;
    if (qty > available) {
      setError(`Bu arazide yalnızca ${available.toLocaleString("tr-TR")} tohum müsait.`);
      setReserving(false);
      return;
    }

    try {
      const res = await fetch("/api/orders/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_email: "temp@rezervasyon.com",
          preferred_land_id: selectedLand.id,
          requested_seeds: qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Rezervasyon başarısız oldu."); setReserving(false); return; }

      const cartItems: CartItem[] = data.allocations.map(
        (a: { land_id: string; land_name: string; seeds: number }) => ({
          type: "reservation" as const,
          seedType: recommended.seed,
          pricePerSeed: recommended.seed.price,
          quantity: a.seeds,
          landId: a.land_id,
          landName: a.land_name,
          totalPrice: recommended.seed.price * a.seeds,
          addedAt: Date.now(),
        })
      );

      const reservationPayload: ReservationInfo = {
        orderId: data.order_id,
        items: cartItems,
        expiresAt: Date.now() + reservationTtlMinutes * 60 * 1000,
        gift: isGift ? {
          recipientName: giftForm.recipientName.trim(),
          recipientEmail: giftForm.recipientEmail.trim().toLowerCase(),
          giftNote: giftForm.giftNote.trim(),
        } : null,
      };

      setReservation(reservationPayload);
      closeModal();
      fetchLands();
    } catch { setError("Bağlantı hatası oluştu."); }
    setReserving(false);
  };

  // Aktif satış: filled < kapasite VEYA (filled ≥ kapasite ama rezerve tohum hâlâ var — iptal olabilir)
  const saleLands = lands.filter(
    (l) => !(l.filled_seeds >= l.capacity_seeds && (l.reserved_seeds ?? 0) === 0)
  );
  const filteredLands = mapFilter
    ? saleLands.filter((l) => getGeoRegion(l.region) === mapFilter)
    : saleLands;
  const giftValid = !isGift || (
    giftForm.recipientName.trim().length > 0 && giftForm.recipientEmail.trim().includes("@")
  );

  return (
    <div className="relative min-h-screen">
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
      </div>
      <header className="liquid-glass fixed top-0 left-0 right-0 z-40 border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/bireysel/satin-al" className="text-emerald-200/40 hover:text-white text-sm transition-colors">← Geri</Link>
          <h1 className="text-lg font-bold text-white">Sizin Yerinize <span className="text-gradient-eco">Ekelim</span></h1>
        </div>
      </header>

      <div className="relative z-10">
      <div className="h-16" /> {/* Spacer for fixed header */}
      <CompletedLandsBanner lands={lands} />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Aktif rezervasyon uyarısı */}
        {reservation && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
            <span>⏱️</span>
            <span>
              Aktif rezervasyonunuz bulunmaktadır.
              {reservation.gift && (
                <> <span className="text-amber-400">🎁 <strong>{reservation.gift.recipientName}</strong>&apos;e hediye ekim var.</span></>
              )}
              {" "}Ödeme yapılmazsa {reservationTtlMinutes} dk içinde serbest bırakılır.
            </span>
          </div>
        )}

        <p className="text-slate-400">
          Bir arazi seçin ve kaç tohum ekeceğinizi belirleyin. Skytech, bölgeye en uygun tohum türünü sizin için belirler.
        </p>

        {/* ── Türkiye Haritası ─────────────────────────────────────────────── */}
        {!loading && lands.length > 0 && (
          <TurkeyMap lands={lands} selected={mapFilter} onSelect={setMapFilter} />
        )}

        {/* Filtre durumu */}
        {mapFilter && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">
              <span className="text-emerald-400 font-medium">{mapFilter}</span> bölgesi gösteriliyor
              {" · "}{filteredLands.length} arazi
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : filteredLands.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            {mapFilter
              ? `${mapFilter} bölgesinde henüz aktif arazi bulunmuyor.`
              : "Şu anda müsait arazi bulunmuyor."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {filteredLands.map((land) => {
              const available = land.capacity_seeds - land.filled_seeds - land.reserved_seeds;
              const displayAvailable = Math.max(0, available);
              const pct = Math.round(((land.filled_seeds + land.reserved_seeds) / land.capacity_seeds) * 100);
              // Gerçek doluluğu: filled ≥ kapasite VE rezerve kalmamış
              const isFull = land.filled_seeds >= land.capacity_seeds && (land.reserved_seeds ?? 0) === 0;
              // Rezerve ile dolu: kapasite bitmiş ama rezerve tohumlar hâlâ iptal olabilir
              const isReserveFull = !isFull && available <= 0;
              const isCritical = pct >= 85 && !isFull && !isReserveFull;
              const { seed: recSeed } = getRecommendedSeed(land.region ?? null);
              const isSelected = selectedLand?.id === land.id;
              const projectName = `${land.name.replace(" Ormanı", "")} Otonom İmece Projesi`;

              return (
                <button key={land.id}
                  onClick={() => !isFull && !isReserveFull && setSelectedLand(land)}
                  disabled={isFull || isReserveFull}
                  className={`group w-full text-left rounded-2xl overflow-hidden transition-all duration-300 ${
                    isSelected
                      ? "ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.12)]"
                      : isCritical
                      ? "ring-2 ring-emerald-500/50 animate-pulse"
                      : isFull
                      ? "opacity-50 cursor-not-allowed"
                      : isReserveFull
                      ? "ring-1 ring-amber-500/30 opacity-75 cursor-not-allowed"
                      : "ring-1 ring-white/[0.06] hover:ring-white/[0.15] hover:shadow-[0_0_20px_rgba(16,185,129,0.06)]"
                  }`}
                  style={{
                    background: isSelected
                      ? "rgba(16,185,129,0.06)"
                      : "rgba(255,255,255,0.02)",
                  }}
                >
                  {/* ── Gradient Header with Nature Silhouette ── */}
                  <div
                    className="relative h-28 overflow-hidden"
                    style={{
                      background: isFull
                        ? "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
                        : isCritical
                        ? "linear-gradient(135deg, #7f1d1d 0%, #451a03 40%, #1c1917 100%)"
                        : `linear-gradient(135deg, #064e3b 0%, #065f46 40%, #0f172a 100%)`,
                    }}
                  >
                    {/* Decorative tree silhouettes */}
                    <svg className="absolute bottom-0 left-0 w-full h-16 opacity-20" viewBox="0 0 320 60" preserveAspectRatio="none">
                      <path d="M0,60 L0,40 L20,15 L35,40 L45,10 L60,40 L75,20 L90,40 L100,60 Z" fill="currentColor" className="text-emerald-400" />
                      <path d="M90,60 L90,45 L110,22 L125,45 L140,18 L155,42 L170,25 L185,45 L195,60 Z" fill="currentColor" className="text-emerald-500" />
                      <path d="M185,60 L185,50 L200,30 L210,45 L225,20 L240,42 L250,28 L265,48 L275,35 L290,50 L300,60 Z" fill="currentColor" className="text-emerald-600" />
                      <path d="M295,60 L295,42 L310,18 L320,40 L320,60 Z" fill="currentColor" className="text-emerald-500" />
                    </svg>

                    {/* Glow orb */}
                    {!isFull && (
                      <div className="absolute top-2 right-4 w-20 h-20 rounded-full pointer-events-none"
                        style={{
                          background: isCritical
                            ? "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)"
                            : "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
                        }}
                      />
                    )}

                    {/* Status badge */}
                    <div className="absolute top-3 right-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-md ${
                        isFull
                          ? "bg-slate-500/20 text-slate-400 border border-slate-500/20"
                          : isReserveFull
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : isCritical
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}>
                        {isFull
                          ? "Tamamlandı"
                          : isReserveFull
                          ? "Rezerve Bekleniyor"
                          : isCritical
                          ? `Son ${displayAvailable.toLocaleString("tr-TR")}`
                          : "Açık Proje"}
                      </span>
                    </div>

                    {/* Project name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 pt-10"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)" }}
                    >
                      <h3 className="font-bold text-white text-sm leading-tight">{projectName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {land.region && (
                          <span className="text-xs text-slate-300/70">📍 {land.region}</span>
                        )}
                        <span className="text-xs text-slate-300/50">·</span>
                        <span className="flex items-center gap-1 text-xs text-emerald-400/80">
                          {recSeed.emoji} {recSeed.name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Card Body ── */}
                  <div className="p-4 space-y-3">
                    {/* Reserve-full alert */}
                    {isReserveFull && (
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold"
                        style={{
                          background: "rgba(245,158,11,0.1)",
                          border: "1px solid rgba(245,158,11,0.2)",
                          color: "rgb(252,211,77)",
                        }}
                      >
                        <span className="text-sm">⏳</span>
                        Kapasite Dolu — Rezerve İptali Bekleniyor
                      </div>
                    )}

                    {/* Critical threshold alert */}
                    {isCritical && (
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold animate-pulse"
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          color: "rgb(252,165,165)",
                        }}
                      >
                        <span className="text-sm">🚨</span>
                        Operasyon Hazırlığı: Son {displayAvailable.toLocaleString("tr-TR")} Tohum!
                      </div>
                    )}

                    {/* ── Main Progress Bar ── */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-slate-400">İmece İlerlemesi</span>
                        <span className="text-xs font-bold" style={{
                          color: pct >= 85 ? "rgb(252,165,165)" : pct >= 60 ? "rgb(251,191,36)" : "rgb(52,211,153)"
                        }}>
                          %{pct}
                        </span>
                      </div>
                      <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: "linear-gradient(90deg, #10b981, #84cc16)",
                            boxShadow: isCritical ? "0 0 12px rgba(16,185,129,0.5)" : "none",
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-slate-500">
                          {(land.filled_seeds + land.reserved_seeds).toLocaleString("tr-TR")} / {land.capacity_seeds.toLocaleString("tr-TR")}
                        </span>
                        <span className="text-xs font-semibold" style={{
                          color: (isFull || isReserveFull) ? "#94a3b8" : "rgb(52,211,153)"
                        }}>
                          {isFull
                            ? "Tamamlandı"
                            : isReserveFull
                            ? "Rezerve Bekleniyor"
                            : `${displayAvailable.toLocaleString("tr-TR")} müsait`}
                        </span>
                      </div>
                    </div>

                    {/* ── Founder Badge ── */}
                    {!isFull && (
                      <div
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                        style={{
                          background: "rgba(245,158,11,0.06)",
                          border: "1px solid rgba(251,191,36,0.15)",
                        }}
                      >
                        <span className="text-base shrink-0">🏅</span>
                        <p className="text-xs leading-relaxed" style={{ color: "rgb(251,191,36)" }}>
                          Bu projeyi %100&apos;e tamamlayanlara{" "}
                          <strong>&ldquo;Kurucu Üye&rdquo;</strong>{" "}
                          dijital nişanı verilecektir.
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Rezervasyon Modalı ────────────────────────────────────────────── */}
        {selectedLand && recommended && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 animate-fade-in
            flex flex-col justify-end
            md:items-center md:justify-center md:p-4">
            <div className="relative w-full max-h-[90vh] overflow-y-auto
              max-md:rounded-t-3xl max-md:overflow-x-hidden max-md:animate-slide-up
              md:max-w-lg md:rounded-3xl md:animate-scale-in">
              <div className="liquid-glass relative rounded-3xl max-md:rounded-b-none p-6 md:p-8 space-y-5 overflow-hidden pb-safe-4">
                {/* Mobile bottom-sheet drag handle */}
                <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto -mt-2 mb-2" />
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedLand.name}</h3>
                    {selectedLand.region && <p className="text-sm text-slate-500 mt-0.5">📍 {selectedLand.region}</p>}
                  </div>
                  <button onClick={closeModal}
                    className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0">
                    ✕
                  </button>
                </div>

                <div className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl p-4">
                  <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-2">Skytech Tohum Önerisi</p>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{recommended.seed.emoji}</span>
                    <div>
                      <p className="font-semibold text-white">{recommended.seed.name}</p>
                      <p className="text-xs text-slate-500 italic">{recommended.seed.latinName}</p>
                      <p className="text-sm font-bold text-emerald-400 mt-0.5">{recommended.seed.price} TL / tohum</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">💡 {recommended.reason}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tohum Adedi</label>
                  <p className="text-xs text-slate-500 mb-2">
                    Müsait kapasite:{" "}
                    <span className="font-bold text-white">
                      {(selectedLand.capacity_seeds - selectedLand.filled_seeds - selectedLand.reserved_seeds).toLocaleString("tr-TR")}
                    </span>{" "}tohum
                  </p>
                  <input type="number"
                    min={1}
                    max={selectedLand.capacity_seeds - selectedLand.filled_seeds - selectedLand.reserved_seeds}
                    value={qty}
                    onChange={(e) => {
                      const maxAvail = selectedLand.capacity_seeds - selectedLand.filled_seeds - selectedLand.reserved_seeds;
                      const val = parseInt(e.target.value) || 1;
                      setQty(Math.min(Math.max(1, val), maxAvail));
                    }}
                    className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-colors" />
                </div>

                {/* 🎁 Hediye Toggle */}
                <div className="border-t border-white/[0.06] pt-3">
                  <ToggleSwitch checked={isGift} onChange={setIsGift}
                    label="🎁  Bu ekimi birine hediye etmek istiyorum"
                    description="Alıcı adına sertifika oluşturulur ve bildirimler ona gönderilir." />
                  <div style={{ maxHeight: isGift ? "500px" : "0", opacity: isGift ? 1 : 0, overflow: "hidden", transition: "max-height 0.35s ease, opacity 0.25s ease", marginTop: isGift ? "12px" : "0" }}>
                    <div className="p-4 bg-amber-400/[0.05] border border-amber-400/20 rounded-xl space-y-3">
                      <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-1">Hediye Bilgileri</p>
                      <Input label="Alıcının Adı Soyadı" placeholder="Ayşe Kaya"
                        value={giftForm.recipientName}
                        onChange={(e) => setGiftForm((p) => ({ ...p, recipientName: e.target.value }))} />
                      <Input label="Alıcının E-postası" type="email" placeholder="ayse@mail.com"
                        value={giftForm.recipientEmail}
                        onChange={(e) => setGiftForm((p) => ({ ...p, recipientEmail: e.target.value }))} />
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                          Hediye Notu <span className="text-slate-600">(opsiyonel)</span>
                        </label>
                        <Textarea placeholder="Sana özel bir orman parçası hediye ettim. Sevgiyle 🌱"
                          value={giftForm.giftNote}
                          onChange={(e) => setGiftForm((p) => ({ ...p, giftNote: e.target.value }))}
                          rows={2} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center py-3 border-t border-white/[0.06]">
                  <span className="text-slate-400">Toplam</span>
                  <div className="text-right">
                    <span className="text-xl font-bold text-white">
                      {(recommended.seed.price * qty).toLocaleString("tr-TR")} TL
                    </span>
                    {isGift && giftForm.recipientName && (
                      <p className="text-xs text-amber-400/80 mt-0.5">🎁 {giftForm.recipientName} için</p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>
                )}

                <button
                  onClick={handleReserve}
                  disabled={reserving || !giftValid}
                  className="w-full py-4 glass-btn rounded-2xl text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                  {reserving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Rezerve ediliyor...
                    </>
                  ) : isGift
                    ? `🎁 Hediye Olarak Rezerve Et (${reservationTtlMinutes} dk)`
                    : `Rezerve Et (${reservationTtlMinutes} dk)`}
                </button>
                <p className="text-xs text-emerald-200/30 text-center relative z-10">
                  Sepete eklediğinizde kapasite kilitlenir. {reservationTtlMinutes} dk içinde ödeme yapmazsanız tohumlar serbest bırakılır.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
