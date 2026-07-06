"use client";

import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";
import { Button, Input, Textarea, Select, Card, CardStat } from "@/components/ui";
import type { SeedProduct } from "@/lib/types";

const EMPTY_PRODUCT: Omit<SeedProduct, "id" | "created_at" | "updated_at"> = {
  slug: "",
  name: "",
  latin_name: "",
  emoji: "🌱",
  color: "from-green-600 to-green-800",
  description: "",
  price: 0,
  stock: 0,
  max_order_qty: 500,
  is_active: true,
  sort_order: 0,
};

export default function KatalogPage() {
  return (
    <RoleGuard path="/admin/katalog">
      <KatalogContent />
    </RoleGuard>
  );
}

function KatalogContent() {
  const [products, setProducts] = useState<SeedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);

  const [deleteTarget, setDeleteTarget] = useState<SeedProduct | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/catalog");
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch {
      setError("Veriler yüklenemedi.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); }
  }, [success]);

  const set = (k: string, v: string | number | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_PRODUCT);
    setModalOpen(true);
    setError(null);
  };

  const openEdit = (p: SeedProduct) => {
    setEditingId(p.id);
    setForm({
      slug: p.slug, name: p.name, latin_name: p.latin_name, emoji: p.emoji,
      color: p.color, description: p.description, price: p.price, stock: p.stock,
      max_order_qty: p.max_order_qty, is_active: p.is_active, sort_order: p.sort_order,
    });
    setModalOpen(true);
    setError(null);
  };

  const handleSave = async () => {
    if (!form.slug || !form.name || form.price <= 0) {
      setError("Slug, ad ve fiyat zorunludur (fiyat > 0).");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...form } : form;
      const res = await fetch("/api/admin/catalog", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "İşlem başarısız oldu.");
        setSaving(false);
        return;
      }
      setSuccess(editingId ? "Ürün başarıyla güncellendi." : "Yeni tohum başarıyla eklendi.");
      setModalOpen(false);
      fetchProducts();
    } catch {
      setError("Sunucu hatası oluştu.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/catalog", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Silme işlemi başarısız oldu.");
      } else {
        setSuccess(`"${deleteTarget.name}" başarıyla silindi.`);
        fetchProducts();
      }
    } catch {
      setError("Sunucu hatası oluştu.");
    }
    setDeleteTarget(null);
    setSaving(false);
  };

  const toggleActive = async (p: SeedProduct) => {
    const res = await fetch("/api/admin/catalog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    });
    if (res.ok) {
      setSuccess(`"${p.name}" ${p.is_active ? "pasife alındı" : "aktifleştirildi"}.`);
      fetchProducts();
    }
  };

  const activeCount = products.filter((p) => p.is_active).length;
  const totalStock = products.reduce((s, p) => s + p.stock, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tohum Kataloğu</h1>
          <p className="text-slate-400 text-sm mt-1">
            Bireysel (B2C) tohum ürünlerini yönetin — fiyat, stok ve limit ayarları.
          </p>
        </div>
        <Button variant="primary" onClick={openNew} icon={<span className="text-lg">+</span>}>
          Yeni Tohum Ekleyin
        </Button>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 gap-4">
        <CardStat icon="📦" label="Toplam Ürün" value={products.length.toString()} sub="katalogda" />
        <CardStat icon="✅" label="Aktif Ürün" value={activeCount.toString()} sub="satışta" />
        <CardStat icon="🌱" label="Toplam Stok" value={totalStock.toLocaleString("tr-TR")} sub="adet tohum" />
      </div>

      {/* Bildirimler */}
      {success && (
        <div className="bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-400 text-sm px-4 py-3 rounded-xl animate-fade-in">
          ✅ {success}
        </div>
      )}
      {error && !modalOpen && (
        <div className="bg-red-500/10 ring-1 ring-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl animate-fade-in">
          ❌ {error}
        </div>
      )}

      {/* Tablo */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-white/[0.08] border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🌱</div>
          <p className="text-slate-400">Henüz ürün bulunmamaktadır. İlk tohumu ekleyiniz!</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-5 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider">Tohum</th>
                <th className="text-left px-5 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider">Fiyat</th>
                <th className="text-left px-5 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider">Stok</th>
                <th className="text-left px-5 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider">Maks. Sipariş</th>
                <th className="text-left px-5 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider">Durum</th>
                <th className="text-right px-5 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.emoji}</span>
                      <div>
                        <p className="font-medium text-white">{p.name}</p>
                        <p className="text-xs text-slate-500 italic">{p.latin_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-white font-semibold">{p.price} ₺</span>
                    <span className="text-xs text-slate-500 ml-1">/ tohum</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`font-medium ${p.stock < 1000 ? "text-amber-400" : "text-slate-300"}`}>
                      {p.stock.toLocaleString("tr-TR")}
                    </span>
                    {p.stock < 1000 && (
                      <span className="ml-2 text-xs text-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30 px-2 py-0.5 rounded-full">Düşük</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-300">{p.max_order_qty.toLocaleString("tr-TR")}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                        p.is_active
                          ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20"
                          : "bg-white/[0.04] text-slate-500 ring-1 ring-white/[0.06] hover:bg-white/[0.08]"
                      }`}
                    >
                      {p.is_active ? "Aktif" : "Pasif"}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>Düzenleyin</Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(p)}>Silin</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Ekle / Düzenle Modalı ── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingId ? "Tohumu Düzenleyin" : "Yeni Tohum Ekleyin"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-white text-xl transition-colors">&times;</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Satır 1: Ad + Slug */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Tohum Adı"
                  required
                  value={form.name}
                  onChange={(e) => {
                    set("name", e.target.value);
                    if (!editingId) {
                      set("slug", e.target.value.toLowerCase()
                        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u")
                        .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
                        .replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
                    }
                  }}
                  placeholder="Kızılçam"
                />
                <Input
                  label="Slug"
                  required
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="kizilcam"
                />
              </div>

              {/* Satır 2: Latince + Emoji */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Input
                    label="Latince Adı"
                    value={form.latin_name}
                    onChange={(e) => set("latin_name", e.target.value)}
                    placeholder="Pinus brutia"
                  />
                </div>
                <Input
                  label="Emoji"
                  value={form.emoji}
                  onChange={(e) => set("emoji", e.target.value)}
                />
              </div>

              {/* Satır 3: Fiyat, Stok, Maks. Sipariş */}
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Birim Fiyat (₺)"
                  required
                  type="number"
                  value={form.price.toString()}
                  onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
                />
                <Input
                  label="Stok Miktarı"
                  type="number"
                  value={form.stock.toString()}
                  onChange={(e) => set("stock", parseInt(e.target.value) || 0)}
                />
                <Input
                  label="Maks. Sipariş Limiti"
                  type="number"
                  value={form.max_order_qty.toString()}
                  onChange={(e) => set("max_order_qty", parseInt(e.target.value) || 1)}
                />
              </div>

              {/* Açıklama */}
              <Textarea
                label="Açıklama"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                placeholder="Bu tohum hakkında kısa bilgi giriniz..."
              />

              {/* Renk + Sıralama + Aktif */}
              <div className="grid grid-cols-3 gap-4">
                <Select
                  label="Gradient Renk"
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                >
                  <option value="from-green-600 to-green-800">Yeşil</option>
                  <option value="from-amber-600 to-amber-800">Amber</option>
                  <option value="from-emerald-700 to-teal-800">Zümrüt</option>
                  <option value="from-orange-500 to-red-700">Turuncu-Kırmızı</option>
                  <option value="from-blue-600 to-blue-800">Mavi</option>
                  <option value="from-purple-600 to-purple-800">Mor</option>
                  <option value="from-rose-500 to-pink-700">Pembe</option>
                </Select>
                <Input
                  label="Sıralama"
                  type="number"
                  value={form.sort_order.toString()}
                  onChange={(e) => set("sort_order", parseInt(e.target.value) || 0)}
                />
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => set("is_active", !form.is_active)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        form.is_active ? "bg-emerald-600" : "bg-white/[0.08]"
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                        form.is_active ? "translate-x-5.5 left-[22px]" : "left-0.5"
                      }`} />
                    </div>
                    <span className="text-sm text-slate-300">{form.is_active ? "Aktif" : "Pasif"}</span>
                  </label>
                </div>
              </div>

              {/* Önizleme */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase font-medium mb-2 tracking-wider">Önizleme</p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{form.emoji}</span>
                  <div>
                    <p className="font-semibold text-white">{form.name || "Tohum Adı"}</p>
                    <p className="text-xs text-slate-400 italic">{form.latin_name || "Latin adı"}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-lg font-bold text-emerald-400">{form.price} ₺</p>
                    <p className="text-xs text-slate-500">Maks. {form.max_order_qty} adet</p>
                  </div>
                </div>
              </div>

              {/* Hata */}
              {error && (
                <div className="bg-red-500/10 ring-1 ring-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}
            </div>

            {/* Alt butonlar */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>İptal</Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {editingId ? "Güncelleyin" : "Ekleyin"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Silme Onay Modalı ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass border border-white/[0.08] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-scale-in">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/10 ring-1 ring-red-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">🗑️</span>
              </div>
              <h3 className="text-lg font-bold text-white">Silmek istediğinize emin misiniz?</h3>
              <p className="text-sm text-slate-400 mt-2">
                <span className="text-white font-medium">{deleteTarget.emoji} {deleteTarget.name}</span> kalıcı olarak silinecektir.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setDeleteTarget(null)}>Vazgeçin</Button>
              <Button variant="danger" fullWidth onClick={handleDelete} loading={saving}>Evet, Silin</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
