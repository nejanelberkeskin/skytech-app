"use client";

import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";
import { Button, Input, CardStat, Select } from "@/components/ui";
import type { Order, ShippingStatus } from "@/lib/types";

// ── Sipariş durumu meta ───────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:    { label: "Bekliyor",    color: "text-amber-400 bg-amber-400/10 ring-amber-400/30" },
  preparing:  { label: "Hazırlanıyor", color: "text-blue-400 bg-blue-400/10 ring-blue-400/30" },
  shipped:    { label: "Kargoda",     color: "text-purple-400 bg-purple-400/10 ring-purple-400/30" },
  delivered:  { label: "Teslim Edildi", color: "text-emerald-400 bg-emerald-400/10 ring-emerald-400/30" },
  confirmed:  { label: "Onaylandı",   color: "text-emerald-400 bg-emerald-400/10 ring-emerald-400/30" },
  expired:    { label: "Süresi Doldu", color: "text-slate-500 bg-slate-500/10 ring-slate-500/30" },
};

const ORDER_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  physical:    { label: "Fiziksel Tohum", icon: "📦", color: "text-orange-400" },
  reservation: { label: "Arazi Rezervasyonu", icon: "🌱", color: "text-emerald-400" },
  gift:        { label: "Hediye Ekim", icon: "🎁", color: "text-pink-400" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "text-slate-400 bg-slate-400/10 ring-slate-400/30" };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${meta.color}`}>
      {meta.label}
    </span>
  );
}

// ── Sipariş Detay Slide-over ──────────────────────────────────────────────────
interface OrderDetail {
  order: Order;
  allocations: Array<{
    id: string;
    seeds_allocated: number;
    status: string;
    lands: { name: string; region: string | null } | null;
  }>;
  profile: { full_name: string; email: string; phone: string | null; city: string | null; address: string | null } | null;
}

function OrderSlideOver({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingInput, setTrackingInput] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/orders?id=${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
        setTrackingInput(data.order.tracking_code ?? "");
      }
      setLoading(false);
    };
    load();
  }, [orderId]);

  const saveTracking = async () => {
    if (!detail) return;
    setSavingTracking(true);
    await fetch("/api/admin/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, tracking_code: trackingInput }),
    });
    setSavingTracking(false);
  };

  const updateStatus = async (newStatus: string) => {
    if (!detail) return;
    await fetch("/api/admin/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status: newStatus }),
    });
    // Detayı yenile
    const res = await fetch(`/api/admin/orders?id=${orderId}`);
    if (res.ok) setDetail(await res.json());
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[var(--bg-elevated)] border-l border-white/[0.08] shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
          <div>
            <h2 className="font-bold text-white">Sipariş Detayı</h2>
            <p className="text-xs text-slate-500 mt-0.5">#{orderId.slice(0, 8).toUpperCase()}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] transition-colors flex items-center justify-center text-slate-400"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/[0.08] border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : !detail ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">Sipariş bulunamadı.</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Durum & Tür */}
            <div className="flex items-center gap-3">
              <StatusBadge status={detail.order.status} />
              <span className={`text-xs ${ORDER_TYPE_META[detail.order.order_type as "physical" | "reservation"]?.color ?? "text-slate-400"}`}>
                {ORDER_TYPE_META[detail.order.order_type as "physical" | "reservation"]?.icon}{" "}
                {ORDER_TYPE_META[detail.order.order_type as "physical" | "reservation"]?.label ?? detail.order.order_type}
              </span>
            </div>

            {/* Müşteri Bilgileri */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Müşteri</p>
              <InfoRow label="Ad Soyad" value={detail.profile?.full_name ?? "Misafir"} />
              <InfoRow label="E-posta" value={detail.order.buyer_email} />
              {detail.profile?.phone && <InfoRow label="Telefon" value={detail.profile.phone} />}
              {detail.profile?.city && <InfoRow label="Şehir" value={detail.profile.city} />}
            </div>

            {/* Sipariş Bilgileri */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Sipariş</p>
              <InfoRow label="Sipariş No" value={`#${detail.order.id.slice(0, 8).toUpperCase()}`} />
              <InfoRow label="Tohum Adedi" value={`${detail.order.total_seeds.toLocaleString("tr-TR")} adet`} />
              <InfoRow label="Tutar" value={`₺${Number(detail.order.total_price).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`} />
              <InfoRow label="Tarih" value={new Date(detail.order.created_at).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })} />
              {detail.order.shipping_address && (
                <InfoRow label="Adres" value={detail.order.shipping_address} />
              )}
            </div>

            {/* Kargo Takip Kodu */}
            {detail.order.order_type === "physical" && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Kargo Takip</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Kargo takip kodu girin"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="secondary" onClick={saveTracking} disabled={savingTracking}>
                    {savingTracking ? "…" : "Kaydet"}
                  </Button>
                </div>
              </div>
            )}

            {/* Arazi Allocations */}
            {detail.allocations.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Arazi Atamaları</p>
                <div className="space-y-2">
                  {detail.allocations.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <div>
                        <p className="text-sm text-white">{a.lands?.name ?? "—"}</p>
                        <p className="text-xs text-slate-500">{a.lands?.region ?? ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-emerald-400">{a.seeds_allocated.toLocaleString("tr-TR")} tohum</p>
                        <p className="text-xs text-slate-500 capitalize">{a.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Durum Güncelle */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Durum Güncelle</p>
              <div className="flex flex-wrap gap-2">
                {(["preparing", "shipped", "delivered", "confirmed"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    disabled={detail.order.status === s}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      detail.order.status === s
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 cursor-default"
                        : "border-white/[0.08] hover:bg-white/[0.06] text-slate-400 hover:text-white"
                    }`}
                  >
                    {STATUS_META[s]?.label ?? s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs text-white text-right">{value}</span>
    </div>
  );
}

// ── Kargo İşlemleri Modal (Bottom Sheet) ──────────────────────────────────────

const COURIER_OPTIONS = [
  "Yurtiçi Kargo",
  "Aras Kargo",
  "MNG Kargo",
  "Sendeo",
  "PTT Kargo",
  "Sürat Kargo",
  "UPS",
  "DHL",
];

// Kargo durumu → Türkçe etiket
const SHIPPING_STATUS_META: Record<ShippingStatus, { label: string; icon: string; color: string }> = {
  PENDING:   { label: "Bekliyor",         icon: "⏳", color: "text-slate-400" },
  PREPARING: { label: "Hazırlanıyor",     icon: "📦", color: "text-blue-400"  },
  SHIPPED:   { label: "Kargoya Verildi",  icon: "🚀", color: "text-purple-400" },
  DELIVERED: { label: "Teslim Edildi",    icon: "✅", color: "text-emerald-400" },
};

function ShippingModal({
  order,
  onClose,
  onSuccess,
}: {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const currentShipping = (order.shipping_status ?? "PENDING") as ShippingStatus;

  const [selectedStatus, setSelectedStatus] = useState<ShippingStatus>(
    currentShipping === "PENDING" ? "PREPARING" : currentShipping
  );
  const [courierCompany, setCourierCompany] = useState(order.courier_company ?? COURIER_OPTIONS[0]);
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number ?? "");
  const [trackingUrl, setTrackingUrl] = useState(order.tracking_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setError(null);
    if (selectedStatus === "SHIPPED") {
      if (!courierCompany.trim()) { setError("Kargo firması seçmelisiniz."); return; }
      if (!trackingNumber.trim()) { setError("Takip numarası girilmesi zorunludur."); return; }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/orders/shipping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId:         order.id,
          shipping_status: selectedStatus,
          courier_company: courierCompany.trim() || undefined,
          tracking_number: trackingNumber.trim() || undefined,
          tracking_url:    trackingUrl.trim()    || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Güncelleme başarısız."); setSaving(false); return; }
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch {
      setError("Bağlantı hatası oluştu.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in
      flex flex-col justify-end md:items-center md:justify-center md:p-4">
      <div className="relative w-full max-h-[90vh] overflow-y-auto
        max-md:rounded-t-3xl max-md:animate-slide-up
        bg-[var(--bg-elevated)] border border-white/[0.08]
        md:max-w-lg md:rounded-2xl md:animate-scale-in">

        {/* Drag handle (mobile) */}
        <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-0" />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Kargo İşlemleri</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                #{order.id.slice(0, 8).toUpperCase()} · {order.buyer_email}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Mevcut durum */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <span className="text-xs text-slate-500">Mevcut kargo durumu:</span>
            <span className={`text-xs font-semibold ${SHIPPING_STATUS_META[currentShipping].color}`}>
              {SHIPPING_STATUS_META[currentShipping].icon} {SHIPPING_STATUS_META[currentShipping].label}
            </span>
          </div>

          {/* Yeni durum seçimi */}
          <div>
            <p className="text-sm font-medium text-slate-300 mb-2">Yeni Durum</p>
            <div className="grid grid-cols-3 gap-2">
              {(["PREPARING", "SHIPPED", "DELIVERED"] as ShippingStatus[]).map((s) => {
                const meta = SHIPPING_STATUS_META[s];
                return (
                  <button
                    key={s}
                    onClick={() => setSelectedStatus(s)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                      selectedStatus === s
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    <span className="text-xl">{meta.icon}</span>
                    <span className="text-center leading-tight">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kargo firması + takip no (sadece SHIPPED için) */}
          {selectedStatus === "SHIPPED" && (
            <div className="space-y-3 animate-fade-in">
              <Select
                label="Kargo Firması"
                value={courierCompany}
                onChange={(e) => setCourierCompany((e.target as HTMLSelectElement).value)}
              >
                {COURIER_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Input
                label="Takip Numarası"
                placeholder="Örn: 12345678901"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
              <Input
                label="Takip URL (opsiyonel)"
                placeholder="https://kargo.yurtici.com/takip/..."
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                💌 Müşteriye Magic Link içeren kargo e-postası otomatik gönderilecek.
              </p>
            </div>
          )}

          {selectedStatus === "PREPARING" && (
            <p className="text-xs text-slate-500 bg-blue-500/[0.06] border border-blue-500/20 px-3 py-2.5 rounded-lg">
              💌 Müşteriye &ldquo;siparişiniz hazırlanıyor&rdquo; e-postası otomatik gönderilecek.
            </p>
          )}

          {selectedStatus === "DELIVERED" && (
            <p className="text-xs text-slate-500 bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-2.5 rounded-lg">
              💌 Müşteriye &ldquo;tohumlarınız teslim edildi&rdquo; e-postası otomatik gönderilecek.
            </p>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
              <span>✅</span>
              <span>Kargo durumu güncellendi, e-posta gönderildi.</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1 pb-safe-4">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              İptal
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={success}
              className="flex-1"
            >
              {saving ? "Kaydediliyor…" : "Kaydet & E-posta Gönder"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ana Sipariş Listesi ───────────────────────────────────────────────────────
interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

function SiparislerContent() {
  const [data, setData] = useState<OrdersResponse>({ orders: [], total: 0, page: 1, limit: 30 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  // Kargo İşlemleri modal — sadece fiziksel siparişlerde açılır
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (search)       params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter)   params.set("type", typeFilter);

    const res = await fetch(`/api/admin/orders?${params}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
    setLoading(false);
  }, [search, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const orders = data.orders;

  // Metrikler (sayfadaki siparişlerden)
  const totalRevenue  = orders.reduce((s, o) => s + Number(o.total_price), 0);
  const totalSeeds    = orders.reduce((s, o) => s + o.total_seeds, 0);
  const physicalCount = orders.filter((o) => o.order_type === "physical").length;
  const reservations  = orders.filter((o) => o.order_type === "reservation").length;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-bold text-white">Bireysel Siparişler</h1>
        <p className="text-sm text-slate-400 mt-1">
          B2C siparişlerini görüntüle, kargo kodlarını gir ve durum güncellemeleri yap.
        </p>
      </div>

      {/* Metrikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CardStat icon="📦" label="Bu Sayfada" value={orders.length.toString()} sub={`${data.total} toplam`} />
        <CardStat
          icon="💰"
          label="Sayfa Cirosu"
          value={`₺${totalRevenue >= 1000 ? (totalRevenue / 1000).toFixed(1) + "K" : totalRevenue.toLocaleString("tr-TR")}`}
          sub="seçili siparişler"
        />
        <CardStat icon="📦" label="Fiziksel" value={physicalCount.toString()} sub="tohum paketi" />
        <CardStat icon="🌱" label="Rezervasyon" value={reservations.toString()} sub="arazi ekim" />
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="E-posta ile ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[var(--bg-surface)] border border-white/[0.08] text-slate-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        >
          <option value="">Tüm Durumlar</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[var(--bg-surface)] border border-white/[0.08] text-slate-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        >
          <option value="">Tüm Tipler</option>
          <option value="physical">📦 Fiziksel Tohum</option>
          <option value="reservation">🌱 Arazi Rezervasyonu</option>
          <option value="gift">🎁 Hediye Ekim</option>
        </select>
        {(search || statusFilter || typeFilter) && (
          <Button
            variant="ghost"
            onClick={() => { setSearch(""); setStatusFilter(""); setTypeFilter(""); }}
          >
            Filtreleri Temizle
          </Button>
        )}
      </div>

      {/* Tablo */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-white/[0.08] border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">Sipariş Listesi</h2>
            <span className="text-xs text-slate-500">{data.total} sipariş</span>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-4xl block mb-3">📦</span>
              <p className="text-slate-400">Sipariş bulunamadı.</p>
              {(search || statusFilter || typeFilter) && (
                <p className="text-xs text-slate-500 mt-2">Filtre kriterlerini değiştirmeyi deneyin.</p>
              )}
            </div>
          ) : (
            <>
              {/* ── Desktop Table (md+) ─────────────────────────────────── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {["Sipariş No", "E-posta", "Tarih", "Tip", "Tohum", "Tutar", "Durum", ""].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const typeMeta = ORDER_TYPE_META[o.order_type as "physical" | "reservation"];
                      return (
                        <tr
                          key={o.id}
                          className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={() => setSelectedOrderId(o.id)}
                        >
                          <td className="px-5 py-3 font-mono text-xs text-slate-400">
                            #{o.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="px-5 py-3 text-slate-300 text-xs max-w-[160px] truncate">
                            {o.buyer_email}
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">
                            {new Date(o.created_at).toLocaleDateString("tr-TR")}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className={`text-xs ${typeMeta?.color ?? "text-slate-400"}`}>
                              {typeMeta?.icon} {typeMeta?.label ?? o.order_type}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-white font-medium text-sm whitespace-nowrap">
                            {o.total_seeds.toLocaleString("tr-TR")}
                          </td>
                          <td className="px-5 py-3 text-emerald-400 font-medium text-sm whitespace-nowrap">
                            ₺{Number(o.total_price).toLocaleString("tr-TR")}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {o.order_type === "physical" && (
                                <button
                                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2.5 py-1 rounded-lg hover:bg-blue-500/10 border border-blue-500/20 whitespace-nowrap"
                                  onClick={(e) => { e.stopPropagation(); setShippingOrder(o); }}
                                >
                                  📦 Kargo
                                </button>
                              )}
                              <button
                                className="text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1 rounded-lg hover:bg-white/[0.06]"
                                onClick={(e) => { e.stopPropagation(); setSelectedOrderId(o.id); }}
                              >
                                İncele →
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile Card Stack (max-md) ─────────────────────────── */}
              <div className="md:hidden divide-y divide-white/[0.04]">
                {orders.map((o) => {
                  const typeMeta = ORDER_TYPE_META[o.order_type as "physical" | "reservation"];
                  return (
                    <div key={o.id} className="px-4 py-4 space-y-2">
                      <button
                        className="w-full text-left"
                        onClick={() => setSelectedOrderId(o.id)}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <span className="font-mono text-xs text-slate-400">
                            #{o.id.slice(0, 8).toUpperCase()}
                          </span>
                          <StatusBadge status={o.status} />
                        </div>
                        <p className="text-sm text-slate-300 truncate mb-1">{o.buyer_email}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className={typeMeta?.color ?? "text-slate-400"}>
                              {typeMeta?.icon} {typeMeta?.label ?? o.order_type}
                            </span>
                            <span>{new Date(o.created_at).toLocaleDateString("tr-TR")}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-400">
                              ₺{Number(o.total_price).toLocaleString("tr-TR")}
                            </p>
                            <p className="text-xs text-slate-500">
                              {o.total_seeds.toLocaleString("tr-TR")} tohum
                            </p>
                          </div>
                        </div>
                      </button>
                      {/* Kargo butonu — sadece fiziksel siparişlerde */}
                      {o.order_type === "physical" && (
                        <button
                          className="w-full text-xs text-blue-400 py-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.04] hover:bg-blue-500/10 transition-colors"
                          onClick={() => setShippingOrder(o)}
                        >
                          📦 Kargo İşlemleri
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Sayfalama */}
          {data.total > data.limit && (
            <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {((data.page - 1) * data.limit) + 1}–{Math.min(data.page * data.limit, data.total)} / {data.total} sipariş
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => load(data.page - 1)} disabled={data.page <= 1}>← Önceki</Button>
                <Button variant="ghost" onClick={() => load(data.page + 1)} disabled={data.page * data.limit >= data.total}>Sonraki →</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detay Slide-over */}
      {selectedOrderId && (
        <OrderSlideOver orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      )}

      {/* Kargo İşlemleri Modal */}
      {shippingOrder && (
        <ShippingModal
          order={shippingOrder}
          onClose={() => setShippingOrder(null)}
          onSuccess={() => { setShippingOrder(null); load(data.page); }}
        />
      )}
    </div>
  );
}

export default function SiparislerPage() {
  return (
    <RoleGuard path="/admin/siparisler">
      <SiparislerContent />
    </RoleGuard>
  );
}
