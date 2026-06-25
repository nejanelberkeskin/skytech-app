"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import type { CorporateQuote } from "@/lib/types";

export default function PaymentPageWrapper() {
  return (
    <Suspense fallback={
      <div className="p-6 lg:p-8 flex justify-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
      </div>
    }>
      <PaymentPage />
    </Suspense>
  );
}

function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("status");
  const paymentMessage = searchParams.get("message");
  const quoteIdParam = searchParams.get("quote_id");

  const [tab, setTab] = useState<"quote" | "invoices">("quote");
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [quote, setQuote] = useState<CorporateQuote | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/kurumsal/giris");
        return;
      }
      setUser(session.user);

      try {
        const res = await fetch(`/api/kurumsal/quotes?user_id=${session.user.id}`);
        if (res.ok) {
          const quotes: CorporateQuote[] = await res.json();
          if (quoteIdParam) {
            const found = quotes.find((q) => q.id === quoteIdParam);
            if (found) setQuote(found);
          } else {
            const quoted = quotes.find((q) => q.status === "QUOTED");
            if (quoted) setQuote(quoted);
          }
        }
      } catch (e) {
        console.error("Quote fetch error:", e);
      }

      try {
        const { data: payments } = await supabase
          .from("payments")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });
        setInvoices(payments || []);
      } catch (e) {
        console.error("Payments fetch error:", e);
      }

      setLoading(false);
    };
    init();
  }, [router, quoteIdParam]);

  const handleQuotePayment = async () => {
    if (!quote || !user) return;
    setPaymentLoading(true);

    try {
      const response = await fetch("/api/payment/b2b-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          userId: user.id,
          email: user.email,
          companyName: quote.company_name,
          contactPerson: quote.contact_person,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        const formContainer = document.getElementById("iyzico-checkout");
        if (formContainer && data.checkoutFormContent) {
          formContainer.innerHTML = "";
          const fragment = document.createRange().createContextualFragment(data.checkoutFormContent);
          formContainer.appendChild(fragment);
        }
      } else {
        alert("Ödeme başlatılamadı: " + (data.error || "Bilinmeyen hata"));
      }
    } catch (error: any) {
      alert("Ödeme hatası: " + (error?.message || "Bir hata oluştu"));
    } finally {
      setPaymentLoading(false);
    }
  };

  if (!user || loading) {
    return (
      <div className="p-6 lg:p-8 flex justify-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Ödeme & Faturalandırma</h1>
        <p className="text-sm text-emerald-200/40 mt-1">Teklifinizi onaylayın ve ödeme yapın.</p>
      </div>

      {/* Ödeme sonucu */}
      {paymentStatus === "success" && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-emerald-400">Ödeme Başarılı!</p>
            <p className="text-sm text-emerald-400/60">{paymentMessage || "Teklifiniz onaylandı ve ödemeniz alındı."}</p>
          </div>
        </div>
      )}
      {paymentStatus === "error" && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <span className="text-2xl">❌</span>
          <div>
            <p className="font-semibold text-rose-400">Ödeme Başarısız</p>
            <p className="text-sm text-rose-400/60">{paymentMessage || "Lütfen tekrar deneyin."}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab("quote")}
          className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all ${
            tab === "quote" ? "glass-glow text-emerald-300" : "glass-subtle text-emerald-200/40 hover:text-white"
          }`}>
          Teklif Ödemesi
        </button>
        <button onClick={() => setTab("invoices")}
          className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all ${
            tab === "invoices" ? "glass-glow text-emerald-300" : "glass-subtle text-emerald-200/40 hover:text-white"
          }`}>
          Fatura Geçmişi
        </button>
      </div>

      {/* Quote Payment Tab */}
      {tab === "quote" && (
        <div className="space-y-6">
          {!quote || quote.status !== "QUOTED" ? (
            <div className="liquid-glass rounded-3xl p-10 text-center">
              <span className="text-4xl block mb-3">📋</span>
              <p className="text-emerald-200/40 mb-2">
                {quote?.status === "PAID"
                  ? "Bu teklifin ödemesi tamamlanmış."
                  : "Ödeme yapılabilecek aktif bir teklifiniz bulunmuyor."}
              </p>
              <button onClick={() => router.push("/kurumsal/panel")}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                Panele Dön
              </button>
            </div>
          ) : (
            <>
              {/* Quote summary */}
              <div className="liquid-glass rounded-3xl overflow-hidden">
                <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(16,185,129,0.04)" }}>
                  <h3 className="font-semibold text-white">Teklif Özeti</h3>
                  <p className="text-xs text-emerald-200/25 mt-0.5">#{quote.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-emerald-200/30">Firma</p><p className="text-sm text-white font-medium">{quote.company_name}</p></div>
                    <div><p className="text-xs text-emerald-200/30">Tohum Sayısı</p><p className="text-sm text-white font-medium">{quote.approved_seed_count?.toLocaleString("tr-TR")} adet</p></div>
                    <div><p className="text-xs text-emerald-200/30">Birim Fiyat</p><p className="text-sm text-white font-medium">{quote.approved_seed_count ? (Number(quote.approved_price) / quote.approved_seed_count).toFixed(2) : "—"} TL/tohum</p></div>
                    <div><p className="text-xs text-emerald-200/30">Toplam Tutar</p><p className="text-xl font-bold text-emerald-400">{Number(quote.approved_price).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</p></div>
                  </div>
                  {quote.admin_note && (
                    <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.15)" }}>
                      <p className="text-xs text-sky-400 font-medium mb-1">Admin Notu</p>
                      <p className="text-sm text-sky-300">{quote.admin_note}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment: Iyzico */}
              <div className="liquid-glass rounded-3xl p-6 space-y-4 overflow-hidden relative">
                <div className="relative z-10">
                  <h3 className="font-semibold text-white">Kredi Kartı ile Ödeme</h3>
                  <div id="iyzico-checkout" className="min-h-64 glass-subtle rounded-2xl p-4 mt-4">
                    <p className="text-center text-emerald-200/30 text-sm py-8">Ödeme formunu yüklemek için aşağıdaki butona tıklayın.</p>
                  </div>
                  <div className="flex items-center justify-between pt-4 mt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div>
                      <p className="text-sm text-emerald-200/40">Toplam Tutar</p>
                      <p className="text-xl font-bold text-white">{Number(quote.approved_price).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</p>
                    </div>
                    <button onClick={handleQuotePayment} disabled={paymentLoading}
                      className="glass-btn px-8 py-3 rounded-2xl text-white font-medium transition-all disabled:opacity-50">
                      {paymentLoading ? "Yükleniyor..." : "Teklifi Onayla & Öde"}
                    </button>
                  </div>
                  <div className="mt-4 rounded-2xl px-4 py-3" style={{ background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.1)" }}>
                    <p className="text-xs text-sky-400/60">Tüm ödemeler Iyzico tarafından güvenli şekilde işlenir. Faturanız otomatik olarak oluşturulacaktır.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {tab === "invoices" && (
        <div className="liquid-glass rounded-3xl overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-10 text-center"><p className="text-emerald-200/40">Henüz ödeme yapılmamış.</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }} className="text-left">
                  <th className="px-5 py-3 text-xs font-medium text-emerald-200/30 uppercase">Ödeme ID</th>
                  <th className="px-5 py-3 text-xs font-medium text-emerald-200/30 uppercase">Tarih</th>
                  <th className="px-5 py-3 text-xs font-medium text-emerald-200/30 uppercase">Tutar</th>
                  <th className="px-5 py-3 text-xs font-medium text-emerald-200/30 uppercase">Durum</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="px-5 py-3 text-emerald-200/30 font-mono text-xs">{inv.id.slice(0, 8)}</td>
                    <td className="px-5 py-3 text-emerald-200/25 text-xs">{new Date(inv.created_at).toLocaleDateString("tr-TR")}</td>
                    <td className="px-5 py-3 text-white font-medium">{Number(inv.amount).toLocaleString("tr-TR")} TL</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${
                        inv.status === "success" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                        : inv.status === "pending" ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                        : "bg-rose-500/15 text-rose-400 border-rose-500/20"
                      }`}>
                        {inv.status === "success" ? "Ödendi" : inv.status === "pending" ? "Bekleniyor" : "Başarısız"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
