"use client";

import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";
import { Button, Input, Textarea, Card } from "@/components/ui";
import type { CorporateQuote, QuoteStatus } from "@/lib/types";

const STATUS_META: Record<string, { label: string; badge: string; icon: string }> = {
  PENDING:  { label: "Bekliyor",       badge: "ring-1 ring-yellow-500/50 bg-yellow-500/10 text-yellow-400", icon: "⏳" },
  QUOTED:   { label: "Teklif Verildi", badge: "ring-1 ring-blue-500/50 bg-blue-500/10 text-blue-400", icon: "📋" },
  PAID:     { label: "Ödendi",         badge: "ring-1 ring-emerald-500/50 bg-emerald-500/10 text-emerald-400", icon: "✅" },
  REJECTED: { label: "Reddedildi",     badge: "ring-1 ring-red-500/50 bg-red-500/10 text-red-400", icon: "❌" },
  EXPIRED:  { label: "Süresi Doldu",   badge: "ring-1 ring-slate-500/50 bg-slate-500/10 text-slate-400", icon: "⌛" },
};

const FALLBACK_META = { label: "Bilinmiyor", badge: "ring-1 ring-slate-500/50 bg-slate-500/10 text-slate-400", icon: "❓" };
const normalizeStatus = (s: string): string => s?.toUpperCase() ?? "PENDING";
const getMeta = (status: string) => STATUS_META[normalizeStatus(status)] ?? FALLBACK_META;

const NEED_LABELS: Record<string, string> = {
  orman: "Şirket Ormanı",
  sertifika: "Hediye Sertifikaları",
  karbon: "Karbon Denkleştirme",
};

export default function B2BPage() {
  return (
    <RoleGuard path="/admin/b2b">
      <B2BContent />
    </RoleGuard>
  );
}

function B2BContent() {
  const [quotes, setQuotes] = useState<CorporateQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<QuoteStatus | "ALL">("ALL");
  const [selectedQuote, setSelectedQuote] = useState<CorporateQuote | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [approvedPrice, setApprovedPrice] = useState("");
  const [approvedSeedCount, setApprovedSeedCount] = useState("");
  const [adminNote, setAdminNote] = useState("");

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/b2b");
      const data = await res.json();
      if (Array.isArray(data)) setQuotes(data);
    } catch {
      setError("Teklifler yüklenemedi.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 4000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 4000); return () => clearTimeout(t); }
  }, [error]);

  const filtered = activeFilter === "ALL"
    ? quotes
    : quotes.filter((q) => normalizeStatus(q.status) === activeFilter);

  const counts = {
    ALL: quotes.length,
    PENDING: quotes.filter((q) => normalizeStatus(q.status) === "PENDING").length,
    QUOTED: quotes.filter((q) => normalizeStatus(q.status) === "QUOTED").length,
    PAID: quotes.filter((q) => normalizeStatus(q.status) === "PAID").length,
    REJECTED: quotes.filter((q) => normalizeStatus(q.status) === "REJECTED").length,
    EXPIRED: quotes.filter((q) => normalizeStatus(q.status) === "EXPIRED").length,
  };

  const openQuote = (q: CorporateQuote) => {
    setSelectedQuote(q);
    setApprovedPrice(q.approved_price?.toString() || "");
    setApprovedSeedCount(q.approved_seed_count?.toString() || "");
    setAdminNote(q.admin_note || "");
  };

  const handleAction = async (action: "approve" | "reject") => {
    if (!selectedQuote) return;
    setActionLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        quoteId: selectedQuote.id,
        action,
        adminNote,
      };

      if (action === "approve") {
        if (!approvedPrice || !approvedSeedCount) {
          setError("Fiyat ve tohum sayısı zorunludur.");
          setActionLoading(false);
          return;
        }
        body.approvedPrice = parseFloat(approvedPrice);
        body.approvedSeedCount = parseInt(approvedSeedCount);
      }

      const res = await fetch("/api/admin/b2b", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "İşlem başarısız oldu.");
      } else {
        setSuccess(data.message || "İşlem başarıyla kaydedildi.");
        setSelectedQuote(null);
        fetchQuotes();
      }
    } catch {
      setError("Bir hata oluştu.");
    }
    setActionLoading(false);
  };

  const pricePerSeed = approvedPrice && approvedSeedCount
    ? (parseFloat(approvedPrice) / parseInt(approvedSeedCount)).toFixed(2)
    : null;

  return (
    <div className="p-8 space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kurumsal Teklifler</h1>
          <p className="text-sm text-slate-400 mt-1">Teklif yönetimi ve fiyatlandırma merkezi</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white/[0.04] ring-1 ring-yellow-500/30 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="text-yellow-400 text-lg">⏳</span>
            <span className="text-white font-bold">{counts.PENDING}</span>
            <span className="text-xs text-slate-400">bekleyen</span>
          </div>
        </div>
      </div>

      {/* Bildirimler */}
      {success && (
        <div className="bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in">
          <span>✅</span> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 ring-1 ring-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in">
          <span>❌</span> {error}
        </div>
      )}

      {/* Filtre sekmeleri */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "PENDING", "QUOTED", "PAID", "REJECTED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeFilter === f
                ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                : "bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            {f === "ALL" ? "Tümü" : (STATUS_META[f]?.label ?? f)} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Teklif listesi */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl block mb-3">📭</span>
          <p className="text-slate-400">Bu filtrede teklif bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => {
            const meta = getMeta(q.status);
            return (
              <button
                key={q.id}
                onClick={() => openQuote(q)}
                className={`w-full text-left bg-[var(--bg-surface)] border rounded-2xl p-5 transition-all hover:bg-white/[0.03] ${
                  selectedQuote?.id === q.id
                    ? "border-emerald-500/40 ring-1 ring-emerald-500/20"
                    : "border-white/[0.06] hover:border-white/[0.1]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white truncate">{q.company_name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{q.contact_person}</span>
                      <span>{q.corporate_email}</span>
                      <span>{q.seed_count} tohum</span>
                      {q.budget_range && <span>{q.budget_range}</span>}
                    </div>
                    {q.need_types && q.need_types.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {q.need_types.map((n) => (
                          <span key={n} className="text-xs px-2 py-0.5 bg-white/[0.05] text-slate-400 rounded-md border border-white/[0.06]">
                            {NEED_LABELS[n] || n}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {q.approved_price ? (
                      <p className="text-lg font-bold text-emerald-400">
                        {Number(q.approved_price).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600">Fiyat yok</p>
                    )}
                    <p className="text-xs text-slate-600 mt-1">
                      {new Date(q.created_at).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detay / Onay Modalı */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
            {/* Modal başlık */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="font-bold text-white text-lg">{selectedQuote.company_name}</h2>
                <p className="text-xs text-slate-400">
                  Teklif #{selectedQuote.id.slice(0, 8)} — {new Date(selectedQuote.created_at).toLocaleDateString("tr-TR")}
                </p>
              </div>
              <button onClick={() => setSelectedQuote(null)} className="text-slate-500 hover:text-white text-xl transition-colors">
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Firma bilgileri */}
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Firma" value={selectedQuote.company_name} />
                <InfoField label="Yetkili" value={selectedQuote.contact_person} />
                <InfoField label="E-posta" value={selectedQuote.corporate_email} />
                <InfoField label="Telefon" value={selectedQuote.phone || "—"} />
                <InfoField label="Vergi Dairesi" value={selectedQuote.tax_office || "—"} />
                <InfoField label="Vergi No" value={selectedQuote.tax_no || "—"} />
              </div>

              {/* İhtiyaçlar */}
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">İhtiyaçlar</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedQuote.need_types?.map((n) => (
                    <span key={n} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 rounded-lg text-sm font-medium">
                      {NEED_LABELS[n] || n}
                    </span>
                  ))}
                </div>
                {selectedQuote.need_details && (
                  <p className="text-sm text-slate-400 mt-2">{selectedQuote.need_details}</p>
                )}
              </div>

              {/* Proje detayları */}
              <div className="grid grid-cols-3 gap-4">
                <InfoField label="Tohum Sayısı" value={selectedQuote.seed_count} />
                <InfoField label="Bütçe" value={selectedQuote.budget_range || "—"} />
                <InfoField label="Zaman" value={selectedQuote.timeline || "—"} />
              </div>
              {selectedQuote.notes && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Ek Notlar</p>
                  <p className="text-sm text-slate-300 bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">{selectedQuote.notes}</p>
                </div>
              )}

              {/* Daha önce fiyatlanmış teklif */}
              {normalizeStatus(selectedQuote.status) !== "PENDING" && selectedQuote.approved_price && (
                <div className="bg-emerald-500/[0.05] ring-1 ring-emerald-500/20 rounded-xl p-4 space-y-2">
                  <p className="text-xs text-emerald-400 font-medium">Verilen Teklif</p>
                  <div className="grid grid-cols-3 gap-3">
                    <InfoField label="Toplam Fiyat" value={`${Number(selectedQuote.approved_price).toLocaleString("tr-TR")} TL`} />
                    <InfoField label="Tohum Sayısı" value={`${selectedQuote.approved_seed_count?.toLocaleString("tr-TR")} adet`} />
                    <InfoField label="Birim Fiyat" value={
                      selectedQuote.approved_seed_count
                        ? `${(Number(selectedQuote.approved_price) / selectedQuote.approved_seed_count).toFixed(2)} TL`
                        : "—"
                    } />
                  </div>
                  {selectedQuote.admin_note && (
                    <p className="text-sm text-slate-400 mt-2">Not: {selectedQuote.admin_note}</p>
                  )}
                </div>
              )}

              {/* Onay / Red formu (sadece PENDING) */}
              {normalizeStatus(selectedQuote.status) === "PENDING" && (
                <Card variant="solid" padding="md" className="space-y-4">
                  <h3 className="font-semibold text-white text-sm">Teklif Fiyatlandırma</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Tohum Sayısı"
                      required
                      type="number"
                      value={approvedSeedCount}
                      onChange={(e) => setApprovedSeedCount(e.target.value)}
                      placeholder="Örn: 5000"
                    />
                    <Input
                      label="Toplam Fiyat (TL)"
                      required
                      type="number"
                      value={approvedPrice}
                      onChange={(e) => setApprovedPrice(e.target.value)}
                      placeholder="Örn: 50000"
                    />
                  </div>

                  {pricePerSeed && (
                    <div className="bg-emerald-500/[0.05] ring-1 ring-emerald-500/20 rounded-lg px-4 py-2.5 text-center">
                      <span className="text-xs text-slate-400">Birim Fiyat: </span>
                      <span className="text-emerald-400 font-bold">{pricePerSeed} TL / tohum</span>
                    </div>
                  )}

                  <Textarea
                    label="Yönetici Notu (isteğe bağlı)"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={2}
                    placeholder="Müşteriye görünecek bir not ekleyebilirsiniz..."
                  />

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => handleAction("approve")}
                      loading={actionLoading}
                    >
                      Teklifi Onaylayın ve E-posta Gönderin
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleAction("reject")}
                      disabled={actionLoading}
                    >
                      Reddedin
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-white font-medium">{value}</p>
    </div>
  );
}
