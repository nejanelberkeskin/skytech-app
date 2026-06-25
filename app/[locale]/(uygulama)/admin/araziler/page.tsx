"use client";

import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";
import { CardStat, Button, Input, Select } from "@/components/ui";
import type { Land } from "@/lib/types";
import { getRecommendedSeed, REGION_SEED_MAP } from "@/lib/seed-data";

// ── Türkiye'deki bölgeler ─────────────────────────────────────────────────────
const REGIONS = [
  "Antalya", "Ankara", "Bolu", "İstanbul", "İzmir", "Kastamonu",
  "Kahramanmaraş", "Konya", "Mersin", "Isparta", "Trabzon",
  "Bursa", "Eskişehir", "Muğla", "Adana", "Samsun", "Erzurum",
];

// ── Modal tipleri ─────────────────────────────────────────────────────────────
type ModalMode = "add" | "edit" | "delete" | null;

interface LandFormData {
  name: string;
  region: string;
  capacity_seeds: string;
  is_public: boolean;
}

const EMPTY_FORM: LandFormData = {
  name: "",
  region: "",
  capacity_seeds: "",
  is_public: true,
};

// ── Utility ──────────────────────────────────────────────────────────────────
function usePct(l: Land) {
  return Math.round(((l.filled_seeds + l.reserved_seeds) / l.capacity_seeds) * 100);
}

function StatusBadge({ land }: { land: Land }) {
  const pct = usePct(land);
  const available = land.capacity_seeds - land.filled_seeds - land.reserved_seeds;
  const isOverflow = available <= 0 && land.filled_seeds < land.capacity_seeds;

  if (!land.is_public || land.status === "full") {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-orange-500/40 bg-orange-500/10 text-orange-400">
        🔧 Bakımda
      </span>
    );
  }
  if (land.filled_seeds >= land.capacity_seeds) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-emerald-500/40 bg-emerald-500/10 text-emerald-400">
        Ekim Başladı
      </span>
    );
  }
  if (isOverflow) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-red-500/40 bg-red-500/10 text-red-400">
        Taşma Alarmı
      </span>
    );
  }
  if (available <= land.capacity_seeds * 0.1) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-amber-500/40 bg-amber-500/10 text-amber-400">
        Dolmak Üzere
      </span>
    );
  }
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.08]">
      Açık
    </span>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
function ArazilerContent() {
  const [lands, setLands] = useState<Land[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedLand, setSelectedLand] = useState<Land | null>(null);
  const [form, setForm] = useState<LandFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/lands");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setLands(data as Land[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Modal açma/kapama ─────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setModalMode("add");
  };

  const openEdit = (l: Land) => {
    setSelectedLand(l);
    setForm({
      name: l.name,
      region: l.region ?? "",
      capacity_seeds: l.capacity_seeds.toString(),
      is_public: l.is_public,
    });
    setError(null);
    setModalMode("edit");
  };

  const openDelete = (l: Land) => {
    setSelectedLand(l);
    setError(null);
    setModalMode("delete");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedLand(null);
    setError(null);
  };

  // ── Kaydet: Yeni Arazi ────────────────────────────────────────────────────
  const handleAdd = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/lands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        region: form.region,
        capacity_seeds: Number(form.capacity_seeds),
        is_public: form.is_public,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    await load();
    closeModal();
  };

  // ── Kaydet: Arazi Düzenle ─────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!selectedLand) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/lands", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedLand.id,
        name: form.name,
        region: form.region,
        capacity_seeds: Number(form.capacity_seeds),
        is_public: form.is_public,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    await load();
    closeModal();
  };

  // ── Bakım Modu Toggle ─────────────────────────────────────────────────────
  const toggleMaintenance = async (l: Land) => {
    const isMaintenance = !l.is_public || l.status === "full";
    const res = await fetch("/api/admin/lands", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: l.id, maintenance: isMaintenance ? false : true }),
    });
    if (res.ok) await load();
  };

  // ── Sil ───────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selectedLand) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/lands", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedLand.id }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    await load();
    closeModal();
  };

  // ── Metrikler ─────────────────────────────────────────────────────────────
  const totalCapacity = lands.reduce((s, l) => s + l.capacity_seeds, 0);
  const totalFilled   = lands.reduce((s, l) => s + l.filled_seeds, 0);
  const totalReserved = lands.reduce((s, l) => s + l.reserved_seeds, 0);
  const estimatedCarbon = Math.round(totalFilled * 0.025);

  return (
    <div className="p-8 space-y-8">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Araziler ve Kapasite</h1>
          <p className="text-sm text-slate-400 mt-1">Arazi kapasiteleri, ekolojik metrikler ve tohum kataloğu</p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          + Yeni Arazi Ekle
        </Button>
      </div>

      {/* Ekolojik istatistikler */}
      <div className="grid md:grid-cols-4 gap-5">
        <CardStat icon="🗺️" label="Toplam Kapasite" value={totalCapacity.toLocaleString("tr-TR")} sub="tohum kapasitesi" />
        <CardStat icon="🌱" label="Ekili Tohum" value={totalFilled.toLocaleString("tr-TR")} sub="dikilmiş" />
        <CardStat icon="🔒" label="Rezerve Edilen" value={totalReserved.toLocaleString("tr-TR")} sub="bekleyen" />
        <CardStat icon="♻️" label="Tahmini Karbon" value={`${estimatedCarbon} Ton`} sub="denkleştirme" />
      </div>

      {/* Arazi Tablosu */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-white/[0.08] border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">Tüm Araziler</h2>
            <span className="text-xs text-slate-500">{lands.length} arazi</span>
          </div>

          {lands.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-4xl block mb-3">🌿</span>
              <p className="text-slate-400 mb-4">Henüz arazi eklenmemiş.</p>
              <Button variant="primary" onClick={openAdd}>İlk Araziyi Ekle</Button>
            </div>
          ) : (
            <>
              {/* ── Desktop Table (md+) ─────────────────────────────────── */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left">
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Arazi</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Önerilen Tohum</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Kapasite</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Doluluk</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Durum</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {lands.map((l) => {
                    const pct = Math.round(((l.filled_seeds + l.reserved_seeds) / l.capacity_seeds) * 100);
                    const available = l.capacity_seeds - l.filled_seeds - l.reserved_seeds;
                    const { seed } = getRecommendedSeed(l.region);
                    const isMaintenance = !l.is_public || l.status === "full";

                    return (
                      <tr key={l.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-white font-medium">{l.name}</p>
                          {l.region && <p className="text-xs text-slate-500">{l.region}</p>}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs text-emerald-400 bg-emerald-400/10 ring-1 ring-emerald-400/20 px-2 py-1 rounded-full">
                            {seed.emoji} {seed.name}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400">
                          {l.filled_seeds.toLocaleString("tr-TR")} ekili +{" "}
                          {l.reserved_seeds.toLocaleString("tr-TR")} rezerve /{" "}
                          {l.capacity_seeds.toLocaleString("tr-TR")}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 90 ? "bg-emerald-400" : pct >= 70 ? "bg-lime-400" : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400">%{pct}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge land={l} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(l)}
                              className="text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1 rounded-lg hover:bg-white/[0.06]"
                            >
                              Düzenle
                            </button>
                            <button
                              onClick={() => toggleMaintenance(l)}
                              className={`text-xs transition-colors px-2.5 py-1 rounded-lg ${
                                isMaintenance
                                  ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                  : "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                              }`}
                              title={isMaintenance ? "Satışa Aç" : "Bakıma Al"}
                            >
                              {isMaintenance ? "🟢 Aç" : "🔧 Kapat"}
                            </button>
                            <button
                              onClick={() => openDelete(l)}
                              className="text-xs text-red-400/70 hover:text-red-400 transition-colors px-2.5 py-1 rounded-lg hover:bg-red-500/10"
                              title="Araziyi Sil"
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* ── Mobile Card Stack (max-md) ─────────────────────────── */}
              <div className="md:hidden divide-y divide-white/[0.04]">
                {lands.map((l) => {
                  const pct = Math.round(((l.filled_seeds + l.reserved_seeds) / l.capacity_seeds) * 100);
                  const available = l.capacity_seeds - l.filled_seeds - l.reserved_seeds;
                  const { seed } = getRecommendedSeed(l.region);
                  const isMaintenance = !l.is_public || l.status === "full";

                  return (
                    <div key={l.id} className="px-4 py-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white font-medium text-sm">{l.name}</p>
                          {l.region && <p className="text-xs text-slate-500 mt-0.5">📍 {l.region}</p>}
                        </div>
                        <StatusBadge land={l} />
                      </div>

                      {/* Seed + Progress */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-emerald-400 bg-emerald-400/10 ring-1 ring-emerald-400/20 px-2 py-1 rounded-full shrink-0">
                          {seed.emoji} {seed.name}
                        </span>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 90 ? "bg-emerald-400" : pct >= 70 ? "bg-lime-400" : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">%{pct}</span>
                        </div>
                      </div>

                      {/* Capacity stats */}
                      <p className="text-xs text-slate-500">
                        {l.filled_seeds.toLocaleString("tr-TR")} ekili · {l.reserved_seeds.toLocaleString("tr-TR")} rezerve · {available.toLocaleString("tr-TR")} müsait
                      </p>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => openEdit(l)}
                          className="flex-1 text-xs text-slate-400 hover:text-white transition-colors py-2 rounded-lg hover:bg-white/[0.06] border border-white/[0.06] text-center"
                        >
                          ✏️ Düzenle
                        </button>
                        <button
                          onClick={() => toggleMaintenance(l)}
                          className={`flex-1 text-xs transition-colors py-2 rounded-lg border text-center ${
                            isMaintenance
                              ? "text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                              : "text-orange-400 border-orange-500/20 hover:bg-orange-500/10"
                          }`}
                        >
                          {isMaintenance ? "🟢 Satışa Aç" : "🔧 Bakıma Al"}
                        </button>
                        <button
                          onClick={() => openDelete(l)}
                          className="text-xs text-red-400/70 hover:text-red-400 transition-colors py-2 px-3 rounded-lg hover:bg-red-500/10 border border-red-500/[0.15]"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Modallar ─────────────────────────────────────────────────────── */}
      {(modalMode === "add" || modalMode === "edit") && (
        <LandModal
          mode={modalMode}
          form={form}
          setForm={setForm}
          onSave={modalMode === "add" ? handleAdd : handleEdit}
          onClose={closeModal}
          saving={saving}
          error={error}
        />
      )}

      {modalMode === "delete" && selectedLand && (
        <DeleteModal
          land={selectedLand}
          onConfirm={handleDelete}
          onClose={closeModal}
          saving={saving}
          error={error}
        />
      )}
    </div>
  );
}

// ── Arazi Ekle/Düzenle Modal ──────────────────────────────────────────────────
function LandModal({
  mode,
  form,
  setForm,
  onSave,
  onClose,
  saving,
  error,
}: {
  mode: "add" | "edit";
  form: LandFormData;
  setForm: (f: LandFormData) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const setField = (key: keyof LandFormData, val: string | boolean) =>
    setForm({ ...form, [key]: val });

  // Bölgeye göre önerilen tohum
  const recommendation = form.region ? getRecommendedSeed(form.region) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative bg-[var(--bg-elevated)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-scale-in">
        <h2 className="text-lg font-bold text-white mb-1">
          {mode === "add" ? "Yeni Arazi Ekle" : "Arazi Düzenle"}
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          {mode === "add"
            ? "Yeni bir arazi alanı tanımlayın."
            : "Arazi bilgilerini güncelleyin."}
        </p>

        <div className="space-y-4">
          {/* Arazi Adı */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Arazi Adı <span className="text-red-400">*</span>
            </label>
            <Input
              placeholder="örn. Bolu Ormanı A"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
            />
          </div>

          {/* Bölge */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Bölge (İl)
            </label>
            <Select
              value={form.region}
              onChange={(e) => setField("region", e.target.value)}
            >
              <option value="">Bölge seçin (opsiyonel)</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
            {recommendation && (
              <p className="text-xs text-emerald-400/80 mt-1.5">
                💡 Bu bölge için önerilen tohum:{" "}
                <span className="font-medium">
                  {recommendation.seed.emoji} {recommendation.seed.name}
                </span>
              </p>
            )}
          </div>

          {/* Kapasite */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Toplam Kapasite (tohum) <span className="text-red-400">*</span>
            </label>
            <Input
              type="number"
              placeholder="örn. 50000"
              value={form.capacity_seeds}
              onChange={(e) => setField("capacity_seeds", e.target.value)}
              min="1"
            />
          </div>

          {/* Görünürlük */}
          <div className="flex items-center justify-between py-3 px-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div>
              <p className="text-sm font-medium text-white">Satışa Açık</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Kapalıysa B2C ve B2B satışa sunulmaz.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setField("is_public", !form.is_public)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                form.is_public ? "bg-emerald-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  form.is_public ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            İptal
          </Button>
          <Button
            variant="primary"
            onClick={onSave}
            disabled={saving || !form.name || !form.capacity_seeds}
            className="flex-1"
          >
            {saving ? "Kaydediliyor…" : mode === "add" ? "Arazi Ekle" : "Değişiklikleri Kaydet"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Silme Onay Modal ──────────────────────────────────────────────────────────
function DeleteModal({
  land,
  onConfirm,
  onClose,
  saving,
  error,
}: {
  land: Land;
  onConfirm: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const hasSeedData = land.filled_seeds > 0 || land.reserved_seeds > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[var(--bg-elevated)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in">
        <div className="flex items-start gap-4">
          <span className="text-3xl shrink-0">🗑️</span>
          <div>
            <h2 className="text-lg font-bold text-white">Araziyi Sil</h2>
            <p className="text-sm text-slate-400 mt-1">
              <span className="text-white font-medium">{land.name}</span> adlı araziyi
              kalıcı olarak silmek istediğinizden emin misiniz?
            </p>

            {hasSeedData && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                ⚠️ Bu arazide {land.filled_seeds.toLocaleString("tr-TR")} ekili ve{" "}
                {land.reserved_seeds.toLocaleString("tr-TR")} rezerve tohum bulunmaktadır.
                Silinemez.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Vazgeç
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={saving || hasSeedData}
            className="flex-1"
          >
            {saving ? "Siliniyor…" : "Evet, Sil"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function ArazilerPage() {
  return (
    <RoleGuard path="/admin/araziler">
      <ArazilerContent />
    </RoleGuard>
  );
}
