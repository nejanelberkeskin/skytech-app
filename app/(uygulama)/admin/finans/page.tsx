"use client";

import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";

interface Transaction {
  id: string;
  date: string;
  customer: string;
  seeds: number;
  amount: number;
  type: string;
  status: string;
}

interface FinanceData {
  monthlyRevenue: number;
  pendingAmount: number;
  activeQuotes: number;
  recentTransactions: Transaction[];
}

function formatCurrency(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function FinansContent() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/finance");
      if (!res.ok) throw new Error("Veri yüklenemedi");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <svg className="w-8 h-8 text-emerald-400 animate-spin mt-20" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button onClick={loadData} className="ml-3 underline">Tekrar dene</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const successCount = data.recentTransactions.filter((t) => t.status === "success").length;

  const cards = [
    { label: "Bu Ay Ciro", value: `₺${formatCurrency(data.monthlyRevenue)}`, icon: "💰" },
    { label: "Bekleyen Ödeme", value: `₺${formatCurrency(data.pendingAmount)}`, icon: "⏳" },
    { label: "Aktif Teklifler", value: `${data.activeQuotes} teklif`, icon: "🏢" },
    { label: "Başarılı Ödeme", value: `${successCount}/${data.recentTransactions.length}`, icon: "✅" },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Finans & Faturalar</h1>
          <p className="text-sm text-slate-400 mt-1">Ciro raporları, ödemeler ve kurumsal teklif onayları</p>
        </div>
        <button
          onClick={loadData}
          className="text-xs text-slate-500 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Yenile
        </button>
      </div>

      {/* Gelir Kartları */}
      <div className="grid md:grid-cols-4 gap-5">
        {cards.map((c) => (
          <div key={c.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <span className="text-2xl block mb-2">{c.icon}</span>
            <p className="text-xl font-bold text-white">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Son İşlemler Tablosu */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">Son İşlemler</h2>
          <span className="text-xs text-slate-500">{data.recentTransactions.length} kayıt</span>
        </div>

        {data.recentTransactions.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">
            Henüz ödeme kaydı yok.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Sipariş</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Tarih</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Müşteri</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Tür</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Tohum</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Tutar</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Durum</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.map((t, i) => (
                  <tr key={`${t.id}-${i}`} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="px-5 py-3 text-slate-400 font-mono text-xs">{t.id}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-5 py-3 text-white text-xs truncate max-w-[180px]">{t.customer}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{t.type}</td>
                    <td className="px-5 py-3 text-white">{t.seeds.toLocaleString("tr-TR")}</td>
                    <td className="px-5 py-3 text-white font-medium whitespace-nowrap">
                      ₺{formatCurrency(t.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        t.status === "success" ? "bg-emerald-500/10 text-emerald-400" :
                        t.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {t.status === "success" ? "Ödendi" : t.status === "pending" ? "Bekliyor" : "Başarısız"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinansPage() {
  return (
    <RoleGuard path="/admin/finans">
      <FinansContent />
    </RoleGuard>
  );
}
