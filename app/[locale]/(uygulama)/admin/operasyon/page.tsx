"use client";

import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";
import { Button, CardStat } from "@/components/ui";

// ── Kuyruk öğesi tipi ─────────────────────────────────────────────────────────
interface QueueItem {
  allocation_id: string;
  order_id: string;
  land_id: string;
  seeds_allocated: number;
  allocation_status: string;
  queued_at: string;
  buyer_email: string;
  buyer_name?: string;
  order_type: string;
  order_created_at: string;
  land_name: string;
  land_region: string;
}

interface PlantResult {
  success: boolean;
  planted_count: number;
  email_results: { order_id: string; success: boolean; error?: string }[];
  warnings: string[];
}

// ── Ekim Başarı Modalı ────────────────────────────────────────────────────────
function SuccessModal({ result, onClose }: { result: PlantResult; onClose: () => void }) {
  const emailOk   = result.email_results.filter((e) => e.success).length;
  const emailFail = result.email_results.filter((e) => !e.success).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-elevated)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-scale-in">
        <div className="text-center mb-6">
          <span className="text-5xl block mb-3">🌱</span>
          <h2 className="text-xl font-bold text-white">Tohumlar Toprakla Buluştu!</h2>
          <p className="text-sm text-slate-400 mt-1">Drone operasyonu tamamlandı.</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{result.planted_count}</p>
            <p className="text-xs text-slate-400 mt-0.5">Ekilen Alan</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{emailOk}</p>
            <p className="text-xs text-slate-400 mt-0.5">Mail Gönderildi</p>
          </div>
          <div className={`border rounded-xl p-3 text-center ${emailFail > 0 ? "bg-red-500/10 border-red-500/20" : "bg-white/[0.03] border-white/[0.06]"}`}>
            <p className={`text-2xl font-bold ${emailFail > 0 ? "text-red-400" : "text-slate-500"}`}>{emailFail}</p>
            <p className="text-xs text-slate-400 mt-0.5">Mail Hatası</p>
          </div>
        </div>

        {emailFail > 0 && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 space-y-1">
            <p className="font-semibold mb-1">E-posta gönderilemedi (DB kaydı güncellendi):</p>
            {result.email_results.filter((e) => !e.success).map((e) => (
              <p key={e.order_id} className="text-red-400/80">• #{e.order_id.slice(0, 8)}: {e.error}</p>
            ))}
          </div>
        )}

        {result.warnings.length > 0 && (
          <div className="mb-4 p-3 bg-amber-400/10 border border-amber-400/20 rounded-xl text-xs text-amber-400 space-y-1">
            {result.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
          </div>
        )}

        <Button variant="primary" onClick={onClose} className="w-full">
          Kuyruğa Dön
        </Button>
      </div>
    </div>
  );
}

// ── Ana İçerik ────────────────────────────────────────────────────────────────
function OperasyonContent() {
  const [queue, setQueue]       = useState<QueueItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [planting, setPlanting] = useState(false);
  const [result, setResult]     = useState<PlantResult | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    const res = await fetch("/api/admin/operations");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setQueue(data as QueueItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAll = () => {
    if (selected.size === queue.length) setSelected(new Set());
    else setSelected(new Set(queue.map((q) => q.allocation_id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handlePlant = async () => {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `${selected.size} adet tohum atamasını "Ekildi" olarak işaretlemek ve müşterilere bildirim göndermek istediğinize emin misiniz?`
    );
    if (!confirmed) return;

    setPlanting(true);
    setError(null);

    const res = await fetch("/api/admin/operations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocation_ids: [...selected] }),
    });
    const data = await res.json();
    setPlanting(false);

    if (!res.ok) { setError(data.error || "Bilinmeyen hata oluştu."); return; }
    setResult(data as PlantResult);
    await load();
  };

  const totalPending  = queue.length;
  const totalSeeds    = queue.reduce((s, q) => s + q.seeds_allocated, 0);
  const uniqueLands   = new Set(queue.map((q) => q.land_id)).size;
  const selectedSeeds = queue.filter((q) => selected.has(q.allocation_id)).reduce((s, q) => s + q.seeds_allocated, 0);

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Drone Operasyon Merkezi</h1>
          <p className="text-sm text-slate-400 mt-1">
            Onaylanmış tohumları seçin ve drone uçuşuna atayın.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-xl hover:bg-white/[0.05] border border-white/[0.08]"
        >
          <span className={loading ? "animate-spin" : ""}>🔄</span>
          Yenile
        </button>
      </div>

      {/* Metrikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CardStat icon="🚁" label="Ekim Kuyruğu"   value={totalPending.toString()}                     sub="bekleyen atama" />
        <CardStat icon="🌱" label="Bekleyen Tohum"  value={totalSeeds.toLocaleString("tr-TR")}          sub="toplam adet" />
        <CardStat icon="🗺️" label="Aktif Arazi"     value={uniqueLands.toString()}                     sub="ekim bölgesi" />
        <CardStat
          icon="☑️"
          label="Seçili"
          value={selected.size.toString()}
          sub={selected.size > 0 ? `${selectedSeeds.toLocaleString("tr-TR")} tohum` : "seçim yok"}
        />
      </div>

      {/* Eylem Çubuğu */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-fade-in">
          <div className="flex-1">
            <p className="font-semibold text-emerald-400">
              {selected.size} atama seçildi —{" "}
              <span className="text-white">{selectedSeeds.toLocaleString("tr-TR")} tohum</span>
            </p>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              Butona basılırken müşterilere "tohumunuz ekildi" maili gönderilecek.
            </p>
          </div>
          <Button variant="primary" onClick={handlePlant} disabled={planting} className="whitespace-nowrap">
            {planting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Ekilıyor…
              </span>
            ) : "🚁 Seçili Tohumları Uçuşa Ata"}
          </Button>
          <button onClick={() => setSelected(new Set())} className="text-slate-400 hover:text-white transition-colors text-lg">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* Kuyruk Tablosu */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-white/[0.08] border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">Ekim Kuyruğu</h2>
            <div className="flex items-center gap-3">
              {queue.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1 rounded-lg hover:bg-white/[0.06]"
                >
                  {selected.size === queue.length ? "Seçimi Kaldır" : "Tümünü Seç"}
                </button>
              )}
              <span className="text-xs text-slate-500">{totalPending} atama</span>
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="p-16 text-center">
              <span className="text-5xl block mb-4">✅</span>
              <h3 className="text-lg font-bold text-white mb-2">Kuyruk Boş!</h3>
              <p className="text-slate-400 text-sm">Ekim bekleyen onaylı tohum ataması bulunmuyor.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="w-12 px-5 py-3">
                      <input
                        type="checkbox"
                        checked={selected.size === queue.length && queue.length > 0}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                      />
                    </th>
                    {["Müşteri", "Arazi", "Tohum Adedi", "Sipariş Tarihi", "Kuyruğa Giriş"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => {
                    const isSelected = selected.has(item.allocation_id);
                    return (
                      <tr
                        key={item.allocation_id}
                        onClick={() => toggleOne(item.allocation_id)}
                        className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="w-12 px-5 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(item.allocation_id)}
                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-xs">{item.buyer_name ?? "Misafir"}</p>
                          <p className="text-slate-500 text-xs">{item.buyer_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white text-xs">{item.land_name}</p>
                          {item.land_region && <p className="text-slate-500 text-xs">{item.land_region}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-emerald-400 font-bold text-sm">
                            {item.seeds_allocated.toLocaleString("tr-TR")}
                          </span>
                          <span className="text-slate-500 text-xs ml-1">adet</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {new Date(item.order_created_at).toLocaleDateString("tr-TR")}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {new Date(item.queued_at).toLocaleDateString("tr-TR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Başarı Modalı */}
      {result && <SuccessModal result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

export default function OperasyonPage() {
  return (
    <RoleGuard path="/admin/operasyon">
      <OperasyonContent />
    </RoleGuard>
  );
}
