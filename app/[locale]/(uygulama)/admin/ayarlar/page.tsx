"use client";

import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useAdmin } from "@/lib/admin-context";
import type { SystemSettings } from "@/lib/types";

export default function AyarlarPage() {
  return (
    <RoleGuard path="/admin/ayarlar">
      <AyarlarContent />
    </RoleGuard>
  );
}

function AyarlarContent() {
  const { admin } = useAdmin();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Local form state
  const [reservationTtl, setReservationTtl] = useState(5);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [overflowPct, setOverflowPct] = useState(10);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data && !data.error) {
        setSettings(data);
        setReservationTtl(data.reservation_ttl_minutes);
        setMaintenanceMode(data.maintenance_mode);
        setOverflowPct(data.overflow_tolerance_pct);
      }
    } catch {
      setError("Ayarlar yüklenemedi.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); }
  }, [success]);

  const handleSave = async () => {
    if (reservationTtl < 1 || reservationTtl > 60) {
      setError("Rezervasyon süresi 1-60 dakika arası olmalı.");
      return;
    }
    if (overflowPct < 0 || overflowPct > 100) {
      setError("Taşma toleransı %0-%100 arası olmalı.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_ttl_minutes: reservationTtl,
          maintenance_mode: maintenanceMode,
          overflow_tolerance_pct: overflowPct,
          updated_by: admin?.user_id ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kayıt başarısız.");
        setSaving(false);
        return;
      }

      setSettings(data);
      setSuccess("Sistem ayarları güncellendi.");
    } catch {
      setError("Sunucu hatası.");
    }
    setSaving(false);
  };

  const hasChanges = settings && (
    reservationTtl !== settings.reservation_ttl_minutes ||
    maintenanceMode !== settings.maintenance_mode ||
    overflowPct !== settings.overflow_tolerance_pct
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Sistem Ayarları</h1>
        <p className="text-slate-400 text-sm mt-1">
          Platformun global kurallarını buradan yönetin.
        </p>
      </div>

      {/* Notifications */}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <span>✓</span> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* ── Section 1: Rezervasyon Süresi ──────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-2xl">⏱️</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Rezervasyon Süresi</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Kullanıcı sepetine arazi ekimini eklediğinde, tohumlar bu süre boyunca kilitlenir.
              Süre dolunca otomatik serbest bırakılır.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 pl-16">
          <input
            type="number"
            min={1}
            max={60}
            value={reservationTtl}
            onChange={(e) => setReservationTtl(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
            className="w-24 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-center font-bold text-lg outline-none focus:border-amber-500 transition-colors"
          />
          <span className="text-slate-400">dakika</span>

          {/* Quick presets */}
          <div className="flex gap-2 ml-auto">
            {[3, 5, 10, 15].map((v) => (
              <button
                key={v}
                onClick={() => setReservationTtl(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  reservationTtl === v
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-slate-800 text-slate-500 hover:text-slate-300 border border-slate-700"
                }`}
              >
                {v} dk
              </button>
            ))}
          </div>
        </div>

        {reservationTtl !== 5 && (
          <div className="pl-16">
            <p className="text-xs text-amber-400/70">
              Varsayılan: 5 dakika. Mevcut: {reservationTtl} dakika.
            </p>
          </div>
        )}
      </div>

      {/* ── Section 2: Bakım Modu ──────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            maintenanceMode ? "bg-red-500/10" : "bg-emerald-500/10"
          }`}>
            <span className="text-2xl">{maintenanceMode ? "🚧" : "✅"}</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Bakım Modu (Maintenance)</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Aktif edildiğinde B2C (bireysel) satış sayfaları geçici olarak kapatılır.
              Kurumsal panel ve admin paneli etkilenmez.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 pl-16">
          <button
            onClick={() => setMaintenanceMode(!maintenanceMode)}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              maintenanceMode ? "bg-red-600" : "bg-slate-700"
            }`}
          >
            <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 transition-all ${
              maintenanceMode ? "left-[30px]" : "left-0.5"
            }`} />
          </button>
          <span className={`text-sm font-medium ${maintenanceMode ? "text-red-400" : "text-slate-400"}`}>
            {maintenanceMode ? "Bakım Modu AÇIK — Satışlar durduruldu" : "Bakım Modu Kapalı — Satışlar aktif"}
          </span>
        </div>

        {maintenanceMode && (
          <div className="pl-16 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
            <p className="text-xs text-red-400">
              Uyarı: Bakım modu açık olduğunda bireysel müşteriler satın alma yapamaz.
              Sadece gerekli durumlarda kullanın!
            </p>
          </div>
        )}
      </div>

      {/* ── Section 3: Taşma Toleransı ─────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-2xl">📊</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Taşma (Overflow) Toleransı</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Arazilerin kapasitesinin yüzde kaç üzerine çıkılmasına izin verilecek.
              Örneğin %10 tolerans ile 1.000 kapasiteli arazi 1.100 tohuma kadar kabul eder.
            </p>
          </div>
        </div>

        <div className="pl-16 space-y-3">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={50}
              value={overflowPct}
              onChange={(e) => setOverflowPct(parseInt(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <div className="w-20 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-center">
              <span className="text-white font-bold">%{overflowPct}</span>
            </div>
          </div>

          {/* Visual example */}
          <div className="bg-slate-800/50 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-2">Örnek: 10.000 kapasiteli arazi</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: "100%" }} />
              </div>
              <div className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${Math.max(overflowPct * 0.6, 2)}px`, minWidth: overflowPct > 0 ? "4px" : "0px" }} />
              <span className="text-xs text-slate-400 whitespace-nowrap">
                Max: {(10000 + 10000 * overflowPct / 100).toLocaleString("tr-TR")} tohum
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save Button ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        {settings?.updated_at && (
          <p className="text-xs text-slate-600">
            Son güncelleme: {new Date(settings.updated_at).toLocaleString("tr-TR")}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`px-8 py-3 rounded-xl font-medium text-sm transition-all ml-auto ${
            hasChanges
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
              : "bg-slate-800 text-slate-600 cursor-not-allowed"
          }`}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Kaydediliyor...
            </span>
          ) : hasChanges ? "Değişiklikleri Kaydet" : "Değişiklik Yok"}
        </button>
      </div>
    </div>
  );
}
