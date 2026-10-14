"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";
import type { CorporateQuote } from "@/lib/types";
import { intlLocale, uiLocale } from "@/lib/utils/locale";
import { moneyTry, plainTl } from "@/lib/utils/money-display";
import { paymentReturnStatus, paymentStartErrorKey } from "@/lib/corporate/api-responses";

function Spinner() {
  const t = useTranslations("corporatePages");
  return (
    <div className="p-6 lg:p-8 flex justify-center py-16">
      <div role="status" aria-label={t("loading")} className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
    </div>
  );
}

export default function PaymentPageWrapper() {
  return (
    <Suspense fallback={<Spinner />}>
      <PaymentPage />
    </Suspense>
  );
}

function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentStatus = paymentReturnStatus(searchParams.get("status"));
  // Adresteki `message` (sağlayıcı/sunucu iletisi) ekrana taşınmaz; durum metni çeviriden gelir.
  const quoteIdParam = searchParams.get("quote_id");
  const t = useTranslations("corporatePages.payment");
  const lang = uiLocale(useLocale());

  const [tab, setTab] = useState<"quote" | "invoices">("quote");
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [quote, setQuote] = useState<CorporateQuote | null>(null);
  const [invoices, setInvoices] = useState<{ id: string; created_at: string; amount: number; status: string }[]>([]);

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
          locale: lang,
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
        // Ham sunucu ayrıntısı gösterilmez. `checkout_unavailable`: ödeme durumu inceleme gerektiriyor; yeniden ödeme önerilmez.
        alert(t(paymentStartErrorKey(data)));
      }
    } catch {
      alert(t("startError"));
    } finally {
      setPaymentLoading(false);
    }
  };

  if (!user || loading) {
    return <Spinner />;
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("subtitle")}</p>
      </div>

      {/* Ödeme sonucu */}
      {paymentStatus === "success" && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
>
          <div>
            <p className="font-semibold text-emerald-700">{t("successTitle")}</p>
            <p className="text-sm text-emerald-700">{t("successText")}</p>
          </div>
        </div>
      )}
      {(paymentStatus === "error" || paymentStatus === "declined") && (
        <div role="alert" className="rounded-2xl px-5 py-4 flex items-center gap-3"
>
          <div>
            <p className="font-semibold text-rose-700">{t(paymentStatus === "declined" ? "declinedTitle" : "errorTitle")}</p>
            <p className="text-sm text-rose-700">{t(paymentStatus === "declined" ? "declinedText" : "errorText")}</p>
          </div>
        </div>
      )}
      {/* C1: sonuç belirsiz (ör. sağlayıcı incelemesi, sorgu zaman aşımı) — yeniden ödeme önerilmez. */}
      {paymentStatus === "pending" && (
        <div role="status" className="rounded-2xl px-5 py-4 flex items-center gap-3"
>
          <div>
            <p className="font-semibold text-amber-800">{t("pendingTitle")}</p>
            <p className="text-sm text-amber-800">{t("pendingText")}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button type="button" aria-pressed={tab === "quote"} onClick={() => setTab("quote")}
          className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all ${
            tab === "quote" ? "bg-white border border-slate-200 text-emerald-700" : "bg-white border border-slate-200 text-slate-500 hover:text-slate-900"
          }`}>
          {t("tabQuote")}
        </button>
        <button type="button" aria-pressed={tab === "invoices"} onClick={() => setTab("invoices")}
          className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all ${
            tab === "invoices" ? "bg-white border border-slate-200 text-emerald-700" : "bg-white border border-slate-200 text-slate-500 hover:text-slate-900"
          }`}>
          {t("tabInvoices")}
        </button>
      </div>

      {/* Quote Payment Tab */}
      {tab === "quote" && (
        <div className="space-y-6">
          {!quote || quote.status !== "QUOTED" ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center">
              <p className="text-slate-500 mb-2">
                {quote?.status === "PAID" ? t("alreadyPaid") : t("noActive")}
              </p>
              <button type="button" onClick={() => router.push("/kurumsal/panel")}
                className="text-sm text-emerald-700 hover:text-emerald-700 transition-colors">
                {t("backToPanel")}
              </button>
            </div>
          ) : (
            <>
              {/* Quote summary */}
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
                <div className="px-6 py-4">
                  <h3 className="font-semibold text-slate-900">{t("summary")}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">#{quote.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-slate-500">{t("company")}</p><p className="text-sm text-slate-900 font-medium">{quote.company_name}</p></div>
                    <div><p className="text-xs text-slate-500">{t("seedCount")}</p><p className="text-sm text-slate-900 font-medium">{quote.approved_seed_count != null ? t("seedUnit", { count: quote.approved_seed_count }) : null}</p></div>
                    <div><p className="text-xs text-slate-500">{t("unitPrice")}</p><p className="text-sm text-slate-900 font-medium">{quote.approved_seed_count ? (Number(quote.approved_price) / quote.approved_seed_count).toFixed(2) : "—"} {t("perSeedUnit")}</p></div>
                    <div><p className="text-xs text-slate-500">{t("total")}</p><p className="text-xl font-bold text-emerald-700">{moneyTry(Number(quote.approved_price), lang)}</p></div>
                  </div>
                  {quote.admin_note && (
                    <div className="rounded-2xl px-4 py-3">
                      <p className="text-xs text-sky-700 font-medium mb-1">{t("adminNote")}</p>
                      <p className="text-sm text-sky-700">{quote.admin_note}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment: Iyzico */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 overflow-hidden relative">
                <div className="relative z-10">
                  <h3 className="font-semibold text-slate-900">{t("cardTitle")}</h3>
                  <div id="iyzico-checkout" className="min-h-64 bg-white border border-slate-200 rounded-2xl p-4 mt-4">
                    <p className="text-center text-slate-500 text-sm py-8">{t("formHint")}</p>
                  </div>
                  <div className="flex items-center justify-between pt-4 mt-4">
                    <div>
                      <p className="text-sm text-slate-500">{t("total")}</p>
                      <p className="text-xl font-bold text-slate-900">{moneyTry(Number(quote.approved_price), lang)}</p>
                    </div>
                    <button type="button" onClick={handleQuotePayment} disabled={paymentLoading}
                      className="bg-[#1B6B3A] hover:bg-[#165c31] px-8 py-3 rounded-2xl text-white font-medium transition-all disabled:opacity-50">
                      {paymentLoading ? t("paying") : t("pay")}
                    </button>
                  </div>
                  <div className="mt-4 rounded-2xl px-4 py-3">
                    <p className="text-xs text-sky-700">{t("secureNote")}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {tab === "invoices" && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-10 text-center"><p className="text-slate-500">{t("noPayments")}</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr  className="text-left">
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t("colId")}</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t("colDate")}</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t("colAmount")}</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{inv.id.slice(0, 8)}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{new Date(inv.created_at).toLocaleDateString(intlLocale(lang))}</td>
                    <td className="px-5 py-3 text-slate-900 font-medium">{plainTl(Number(inv.amount), lang)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${
                        inv.status === "success" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/20"
                        : inv.status === "pending" ? "bg-amber-500/15 text-amber-800 border-amber-500/20"
                        : "bg-rose-500/15 text-rose-700 border-rose-500/20"
                      }`}>
                        {inv.status === "success" ? t("statusPaid") : inv.status === "pending" ? t("statusPending") : t("statusFailed")}
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
