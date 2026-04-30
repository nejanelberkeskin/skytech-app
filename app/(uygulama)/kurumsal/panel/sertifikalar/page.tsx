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
  { id: "CERT-001", recipientName: "Ahmet Yılmaz", recipientEmail: "ahmet@firma.com", treeCount: 5, forestName: "TechBank Hatıra Ormanı", createdAt: "10 Mar 2026", status: "sent" },
  { id: "CERT-002", recipientName: "Elif Demir", recipientEmail: "elif@firma.com", treeCount: 10, forestName: "TechBank Hatıra Ormanı", createdAt: "10 Mar 2026", status: "sent" },
  { id: "CERT-003", recipientName: "Can Öztürk", recipientEmail: "can@firma.com", treeCount: 5, forestName: "TechBank 50. Yıl Ormanı", createdAt: "9 Mar 2026", status: "pending" },
  { id: "CERT-004", recipientName: "Zeynep Kaya", recipientEmail: "zeynep@musteri.com", treeCount: 3, forestName: "TechBank Hatıra Ormanı", createdAt: "8 Mar 2026", status: "sent" },
  { id: "CERT-005", recipientName: "Mehmet Arslan", recipientEmail: "mehmet@partner.com", treeCount: 20, forestName: "TechBank Hatıra Ormanı", createdAt: "5 Mar 2026", status: "draft" },
];

const inputClasses = "w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder-emerald-200/20 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all";

export default function CertificatesPage() {
  const [tab, setTab] = useState<"list" | "single" | "bulk">("list");
  const [singleForm, setSingleForm] = useState({ name: "", email: "", treeCount: 1, forest: "TechBank Hatıra Ormanı" });

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Sertifika Dağıtım Merkezi</h1>
        <p className="text-sm text-emerald-200/40 mt-1">Dijital sertifikalar oluşturun, yönetin ve dağıtın.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { value: "8.320", label: "Toplam Sertifika", accent: "text-white" },
          { value: "7.980", label: "Gönderilen", accent: "text-emerald-400" },
          { value: "340", label: "Bekleyen", accent: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="liquid-glass rounded-3xl p-4 text-center overflow-hidden relative">
            <div className="relative z-10">
              <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
              <p className="text-xs text-emerald-200/30 mt-1">{s.label}</p>
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
              tab === t.id ? "glass-glow text-emerald-300" : "glass-subtle text-emerald-200/40 hover:text-white"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List tab */}
      {tab === "list" && (
        <div className="liquid-glass rounded-3xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }} className="text-left">
                <th className="px-5 py-3 text-xs font-medium text-emerald-200/30 uppercase">ID</th>
                <th className="px-5 py-3 text-xs font-medium text-emerald-200/30 uppercase">Alıcı</th>
                <th className="px-5 py-3 text-xs font-medium text-emerald-200/30 uppercase">Ağaç</th>
                <th className="px-5 py-3 text-xs font-medium text-emerald-200/30 uppercase">Orman</th>
                <th className="px-5 py-3 text-xs font-medium text-emerald-200/30 uppercase">Tarih</th>
                <th className="px-5 py-3 text-xs font-medium text-emerald-200/30 uppercase">Durum</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CERTS.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-5 py-3 text-emerald-200/30 font-mono text-xs">{c.id}</td>
                  <td className="px-5 py-3">
                    <p className="text-white">{c.recipientName}</p>
                    <p className="text-xs text-emerald-200/25">{c.recipientEmail}</p>
                  </td>
                  <td className="px-5 py-3 text-white">{c.treeCount}</td>
                  <td className="px-5 py-3 text-emerald-200/30 text-xs">{c.forestName}</td>
                  <td className="px-5 py-3 text-emerald-200/25 text-xs">{c.createdAt}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${
                      c.status === "sent" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                      c.status === "pending" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                      "bg-white/[0.04] text-emerald-200/30 border-white/[0.08]"
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
        <div className="liquid-glass rounded-3xl p-6 max-w-lg space-y-5 overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="font-semibold text-white">Tekli Sertifika Oluştur</h3>
            <div className="space-y-4 mt-5">
              <div>
                <label className="block text-sm text-emerald-200/50 mb-2">Alıcı Adı Soyadı</label>
                <input value={singleForm.name} onChange={(e) => setSingleForm({ ...singleForm, name: e.target.value })}
                  placeholder="Örn: Ahmet Yılmaz" className={inputClasses} />
              </div>
              <div>
                <label className="block text-sm text-emerald-200/50 mb-2">E-posta Adresi</label>
                <input value={singleForm.email} onChange={(e) => setSingleForm({ ...singleForm, email: e.target.value })}
                  type="email" placeholder="alici@firma.com" className={inputClasses} />
              </div>
              <div>
                <label className="block text-sm text-emerald-200/50 mb-2">Ağaç Sayısı</label>
                <input value={singleForm.treeCount} onChange={(e) => setSingleForm({ ...singleForm, treeCount: parseInt(e.target.value) || 1 })}
                  type="number" min={1} className={inputClasses} />
              </div>
            </div>
            <button className="w-full mt-5 py-3.5 glass-btn rounded-2xl text-white font-medium transition-all">
              Sertifika Oluştur & Gönder
            </button>
          </div>
        </div>
      )}

      {/* Bulk upload tab */}
      {tab === "bulk" && (
        <div className="liquid-glass rounded-3xl p-6 max-w-lg space-y-5 overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="font-semibold text-white">Excel ile Toplu Sertifika Üretimi</h3>
            <p className="text-sm text-emerald-200/40 mt-2">
              Excel dosyanızda <span className="text-white font-medium">Ad Soyad</span>,{" "}
              <span className="text-white font-medium">E-posta</span> ve{" "}
              <span className="text-white font-medium">Ağaç Sayısı</span> sütunları bulunmalıdır.
            </p>

            <div className="mt-5 border-2 border-dashed border-white/[0.08] rounded-2xl p-8 text-center hover:border-emerald-500/30 transition-colors cursor-pointer">
              <span className="text-4xl block mb-3">📁</span>
              <p className="text-sm text-white font-medium">Excel dosyanızı sürükleyin veya tıklayın</p>
              <p className="text-xs text-emerald-200/25 mt-1">.xlsx, .xls veya .csv</p>
            </div>

            <button className="w-full mt-5 py-3.5 rounded-2xl font-medium border border-white/[0.08] text-emerald-200/30 cursor-not-allowed">
              Dosya Yüklenmedi
            </button>

            <div className="mt-4 flex items-center gap-3 glass-subtle rounded-2xl px-4 py-3">
              <span className="text-lg">💡</span>
              <p className="text-xs text-emerald-200/30">
                Örnek Excel şablonunu{" "}
                <button className="text-emerald-400 hover:underline">buradan indirin</button>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
