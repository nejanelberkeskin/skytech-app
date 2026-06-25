"use client";

import { useState, useEffect } from "react";
import { fetchSeedCatalog, SEED_TYPES_FALLBACK, type SeedType } from "@/lib/seed-data";
import { useCart } from "@/lib/cart-context";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { TreesIcon, ClockIcon } from "@/components/ui/Icons";

export default function SiparisPage() {
  const [seedTypes, setSeedTypes] = useState<SeedType[]>(SEED_TYPES_FALLBACK);
  const [selected, setSelected] = useState<SeedType>(SEED_TYPES_FALLBACK[0]);
  const [qty, setQty] = useState(50);
  const [added, setAdded] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const { addSeedItem } = useCart();

  useEffect(() => {
    fetchSeedCatalog().then((catalog) => {
      if (catalog.length > 0) {
        setSeedTypes(catalog);
        setSelected(catalog[0]);
      }
      setCatalogLoading(false);
    });
  }, []);

  const total = selected.price * qty;

  const handleAdd = () => {
    addSeedItem({
      type: "seed",
      seedType: selected,
      quantity: qty,
      totalPrice: total,
      addedAt: Date.now(),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
      </div>

      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Sol: Seçim */}
        <div className="space-y-6 animate-fade-in-up">
          <div>
            <Link href="/bireysel/satin-al" className="text-sm text-emerald-200/40 hover:text-emerald-300 transition-colors mb-4 inline-block">
              ← Geri
            </Link>
            <h1 className="text-2xl font-bold text-white">Tohum <span className="text-gradient-eco">Sipariş</span> Verin</h1>
          </div>

          {/* Demo aşaması bilgilendirmesi */}
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl px-4 py-3 flex items-start gap-3">
            <ClockIcon className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Çok Yakında</p>
              <p className="text-xs text-amber-200/80 mt-0.5">Tohum siparişi şu anda kapalı. Altyapımız hazır olunca buradan haberdar olacaksınız.</p>
            </div>
          </div>

          {/* Tohum Türü Seçimi */}
          <div>
            <h2 className="text-sm font-medium text-emerald-200/50 mb-3">Tohum Türü Seçin</h2>
            {catalogLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {seedTypes.map((seed) => (
                  <button
                    key={seed.id}
                    onClick={() => { setSelected(seed); setQty(Math.min(qty, seed.maxQty)); }}
                    className={`relative p-5 rounded-3xl text-left transition-all duration-300 overflow-hidden ${
                      selected.id === seed.id
                        ? "glass-glow"
                        : "liquid-glass liquid-glass-hover"
                    }`}
                  >
                    <div className="relative z-10">
                      <TreesIcon className="w-7 h-7 text-emerald-300" strokeWidth={1.6} />
                      <p className="font-semibold text-white mt-2">{seed.name}</p>
                      <p className="text-xs text-emerald-200/30">{seed.latinName}</p>
                      <p className="text-sm font-bold text-emerald-400 mt-1">{seed.price} TL / tohum</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Açıklama */}
          <p className="text-sm text-emerald-100/30">{selected.description}</p>

          {/* Adet Seçimi */}
          <div className="liquid-glass relative rounded-3xl p-6 overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <label className="font-medium text-emerald-200/60">Adet</label>
                <span className="text-xs text-emerald-200/30">Maks. {selected.maxQty}</span>
              </div>
              <input
                type="range"
                min={1}
                max={selected.maxQty}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value))}
                className="w-full accent-emerald-500 mb-4"
              />
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={selected.maxQty}
                  value={qty}
                  onChange={(e) => setQty(Math.min(selected.maxQty, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-24 px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-center font-bold text-white outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
                <span className="text-emerald-200/30">tohum</span>
                <span className="ml-auto text-xl font-bold text-white">{total.toLocaleString("tr-TR")} TL</span>
              </div>
            </div>
          </div>

          {/* Sepete Ekle — demo aşamasında satış kapalı */}
          <button
            disabled
            aria-disabled="true"
            className="w-full py-4 rounded-2xl font-semibold text-sm bg-white/[0.04] border border-white/[0.08] text-emerald-200/40 cursor-not-allowed"
          >
            Çok Yakında
          </button>

          <p className="text-xs text-emerald-200/30 text-center">
            Farklı türlerden de ekleyebilirsiniz. Sepetiniz sağ altta görünecek.
          </p>
        </div>

        {/* Sağ: Ağaç Görseli */}
        <div className="flex items-center justify-center animate-fade-in">
          <div className="liquid-glass relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden flex flex-col items-center justify-center">
            <div className="relative z-10 mb-4 transition-all duration-500 animate-float">
              <TreesIcon className="w-32 h-32 text-emerald-300" strokeWidth={1.2} />
            </div>
            <div className={`relative z-10 text-center px-6 py-3 rounded-2xl bg-gradient-to-r ${selected.color} text-white`}>
              <p className="text-2xl font-bold">{selected.name}</p>
              <p className="text-sm opacity-80 italic">{selected.latinName}</p>
            </div>
            <p className="relative z-10 mt-4 text-sm text-emerald-200/30 text-center px-8">
              Bu tohum yetişkin bir {selected.name.toLowerCase()} ağacına dönüşecek
            </p>

            {/* Badge */}
            <div className="absolute top-4 right-4 glass-subtle rounded-full px-3 py-1.5 text-xs font-medium text-emerald-300 z-10">
              {qty} tohum · {total.toLocaleString("tr-TR")} TL
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
