"use client";

import { useState } from "react";

interface Certificate {
  id: string;
  recipientName: string;
  recipientEmail: string;
  treeCount: number;
  forestName: string;
  createdAt: string;
  status: "sent" | "pending" | "draft";
}

const MOCK_CERTS: Certificate[] = [
  { id: "CERT-001", recipientName: "Ahmet Yılmaz", recipientEmail: "ahmet@firma.com", treeCount: 5, forestName: "TechBank Kurumsal Ormanı", createdAt: "10 Mar 2026", status: "sent" },
  { id: "CERT-002", recipientName: "Elif Demir", recipientEmail: "elif@firma.com", treeCount: 10, forestName: "TechBank Kurumsal Ormanı", createdAt: "10 Mar 2026", status: "sent" },
  { id: "CERT-003", recipientName: "Can Öztürk", recipientEmail: "can@firma.com", treeCount: 5, forestName: "TechBank 50. Yıl Ormanı", createdAt: "9 Mar 2026", status: "pending" },
  { id: "CERT-004", recipientName: "Zeynep Kaya", recipientEmail: "zeynep@musteri.com", treeCount: 3, forestName: "TechBank Kurumsal Ormanı", createdAt: "8 Mar 2026", status: "sent" },
  { id: "CERT-005", recipientName: "Mehmet Arslan", recipientEmail: "mehmet@partner.com", treeCount: 20, forestName: "TechBank Kurumsal Ormanı", createdAt: "5 Mar 2026", status: "draft" },
];

const inputClasses = "w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all";

export default function CertificatesPage() {
  const [tab, setTab] = useState<"list" | "single" | "bulk">("list");
  const [singleForm, setSingleForm] = useState({ name: "", email: "", treeCount: 1, forest: "TechBank Kurumsal Ormanı" });

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sertifika Dağıtım Merkezi</h1>
        <p className="text-sm text-slate-500 mt-1">Dijital sertifikalar oluşturun, yönetin ve dağıtın.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { value: "8.320", label: "Toplam Sertifika", accent: "text-slate-900" },
          { value: "7.980", label: "Gönderilen", accent: "text-emerald-700" },
          { value: "340", label: "Bekleyen", accent: "text-amber-800" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-3xl p-4 text-center overflow-hidden relative">
            <div className="relative z-10">
              <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { id: "list" as const, label: "Sertifika Listesi" },
          { id: "single" as const, label: "Tekli Oluştur" },
          { id: "bulk" as const, label: "Excel ile Toplu Yükle" },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all ${
              tab === t.id ? "bg-white border border-slate-200 text-emerald-700" : "bg-white border border-slate-200 text-slate-500 hover:text-slate-900"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List tab */}
      {tab === "list" && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr  className="text-left">
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">ID</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Alıcı</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Ağaç</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Orman</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Tarih</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Durum</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CERTS.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors"
>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{c.id}</td>
                  <td className="px-5 py-3">
                    <p className="text-slate-900">{c.recipientName}</p>
                    <p className="text-xs text-slate-500">{c.recipientEmail}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-900">{c.treeCount}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{c.forestName}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{c.createdAt}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${
                      c.status === "sent" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/20" :
                      c.status === "pending" ? "bg-amber-500/15 text-amber-800 border-amber-500/20" :
                      "bg-white text-slate-500 border-slate-200"
                    }`}>
                      {c.status === "sent" ? "Gönderildi" : c.status === "pending" ? "Bekliyor" : "Taslak"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Single create tab */}
      {tab === "single" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg space-y-5 overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="font-semibold text-slate-900">Tekli Sertifika Oluştur</h3>
            <div className="space-y-4 mt-5">
              <div>
                <label className="block text-sm text-slate-700 mb-2">Alıcı Adı Soyadı</label>
                <input value={singleForm.name} onChange={(e) => setSingleForm({ ...singleForm, name: e.target.value })}
                  placeholder="Örn: Ahmet Yılmaz" className={inputClasses} />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-2">E-posta Adresi</label>
                <input value={singleForm.email} onChange={(e) => setSingleForm({ ...singleForm, email: e.target.value })}
                  type="email" placeholder="alici@firma.com" className={inputClasses} />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-2">Ağaç Sayısı</label>
                <input value={singleForm.treeCount} onChange={(e) => setSingleForm({ ...singleForm, treeCount: parseInt(e.target.value) || 1 })}
                  type="number" min={1} className={inputClasses} />
              </div>
            </div>
            <button className="w-full mt-5 py-3.5 bg-[#1B6B3A] hover:bg-[#165c31] rounded-2xl text-white font-medium transition-all">
              Sertifika Oluştur & Gönder
            </button>
          </div>
        </div>
      )}

      {/* Bulk upload tab */}
      {tab === "bulk" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg space-y-5 overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="font-semibold text-slate-900">Excel ile Toplu Sertifika Üretimi</h3>
            <p className="text-sm text-slate-500 mt-2">
              Excel dosyanızda <span className="text-slate-900 font-medium">Ad Soyad</span>,{" "}
              <span className="text-slate-900 font-medium">E-posta</span> ve{" "}
              <span className="text-slate-900 font-medium">Ağaç Sayısı</span> sütunları bulunmalıdır.
            </p>

            <div className="mt-5 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-emerald-500/30 transition-colors cursor-pointer">
              <p className="text-sm text-slate-900 font-medium">Excel dosyanızı sürükleyin veya tıklayın</p>
              <p className="text-xs text-slate-500 mt-1">.xlsx, .xls veya .csv</p>
            </div>

            <button className="w-full mt-5 py-3.5 rounded-2xl font-medium border border-slate-200 text-slate-500 cursor-not-allowed">
              Dosya Yüklenmedi
            </button>

            <div className="mt-4 flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3">
              <p className="text-xs text-slate-500">
                Örnek Excel şablonunu{" "}
                <button className="text-emerald-700 hover:underline">buradan indirin</button>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
