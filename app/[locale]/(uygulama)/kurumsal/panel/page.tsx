"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase/browser";
import { Button, Card, CardStat } from "@/components/ui";
import type { CorporateQuote } from "@/lib/types";
import { intlLocale, uiLocale } from "@/lib/utils/locale";
import { moneyTry, plainTl } from "@/lib/utils/money-display";
import { seedRangeLabelKey } from "@/lib/corporate/quote-options";
import { allocationOutcome, type AllocationOutcome } from "@/lib/corporate/api-responses";
import { TRANSACTIONS_ENABLED } from "@/lib/site-config";

// Durum adı ve açıklaması çeviriden (corporatePages.overview.status.<key>); DB durum değerleri değişmez.
const STATUS_META: Record<string, { key: string; badge: string; icon: string }> = {
  PENDING:  { key: "pending",  badge: "ring-1 ring-yellow-500/50 bg-yellow-500/10 text-yellow-400",   icon: "⏳" },
  QUOTED:   { key: "quoted",   badge: "ring-1 ring-emerald-500/50 bg-emerald-500/10 text-emerald-400 glow-sm", icon: "📋" },
  PAID:     { key: "paid",     badge: "ring-1 ring-emerald-500/50 bg-emerald-500/10 text-emerald-400", icon: "✅" },
  REJECTED: { key: "rejected", badge: "ring-1 ring-red-500/50 bg-red-500/10 text-red-400",           icon: "❌" },
  EXPIRED:  { key: "expired",  badge: "ring-1 ring-slate-500/50 bg-slate-500/10 text-slate-400",     icon: "⌛" },
};
const FALLBACK_META = { key: "unknown", badge: "ring-1 ring-slate-500/50 bg-slate-500/10 text-slate-400", icon: "❓" };
const normalizeStatus = (s: string): string => s?.toUpperCase() ?? "PENDING";
const getMeta = (status: string) => STATUS_META[normalizeStatus(status)] ?? FALLBACK_META;

function QuoteAlert({
  quote,
  onPayClick,
}: {
  quote: CorporateQuote;
  onPayClick: () => void;
}) {
  const meta = getMeta(quote.status);
  const isQuoted = normalizeStatus(quote.status) === "QUOTED";
  const t = useTranslations("corporatePages.overview");
  const lang = uiLocale(useLocale());

  return (
    <div className={`rounded-2xl p-5 ring-2 ${
      isQuoted ? "ring-emerald-500/40 bg-emerald-500/[0.05]" : "ring-yellow-500/30 bg-yellow-500/[0.05]"
    }`}>
      <div className="flex items-start gap-4">
        <span className="text-3xl">{meta.icon}</span>
        <div className="flex-1">
          <h3 className="font-bold text-white text-lg">
            {isQuoted ? t("alert.readyTitle") : t("alert.reviewTitle")}
          </h3>
          {t.has(`status.${meta.key}.desc`) && <p className="text-sm text-slate-300 mt-1">{t(`status.${meta.key}.desc`)}</p>}

          {isQuoted && quote.approved_price && (
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs text-slate-400">{t("alert.total")}</p>
                <p className="text-2xl font-bold text-emerald-400" style={{ textShadow: "0 0 20px rgba(16,185,129,0.3)" }}>
                  {moneyTry(Number(quote.approved_price), lang)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t("alert.seedCount")}</p>
                <p className="text-lg font-bold text-white">{quote.approved_seed_count != null ? t("alert.seedUnit", { count: quote.approved_seed_count }) : null}</p>
              </div>
              {quote.admin_note && (
                <div className="flex-1">
                  <p className="text-xs text-slate-400">{t("alert.adminNote")}</p>
                  <p className="text-sm text-slate-300">{quote.admin_note}</p>
                </div>
              )}
            </div>
          )}

          {isQuoted && (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="primary" size="lg" onClick={onPayClick}>
                {t("alert.pay")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Employee Distribution Section ─────────────────────────────────────────────
interface Allocation {
  id: string;
  recipient_name: string;
  recipient_email: string;
  seeds_allocated: number;
  email_sent: boolean;
  certificate_id: string | null;
  created_at: string;
}
interface PoolInfo {
  id: string;
  company_name: string;
  pool_total: number;
  pool_allocated: number;
  pool_remaining: number;
}

function EmployeeDistributionSection({
  quote,
}: {
  quote: CorporateQuote;
  userId: string;
}) {
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", seeds: "1" });
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const t = useTranslations("corporatePages.employees");
  const tc = useTranslations("corporatePages");
  const lang = uiLocale(useLocale());
  const num = (n: number) => n.toLocaleString(intlLocale(lang));

  const load = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/kurumsal/employees?quote_id=${quote.id}`);
      if (res.ok) {
        const data = await res.json();
        setPool(data.quote);
        setAllocations(data.allocations ?? []);
      }
    } finally {
      setLoadingData(false);
    }
  }, [quote.id]);

  useEffect(() => { load(); }, [load]);

  const showToast = (type: "success" | "error", msg: string, ms = 3500) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), ms);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.seeds) return;
    const seeds = parseInt(form.seeds);
    if (isNaN(seeds) || seeds < 1) return;

    setSubmitting(true);
    let outcome: AllocationOutcome;
    try {
      const res = await fetch("/api/kurumsal/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: quote.id,
          recipient_name: form.name,
          recipient_email: form.email,
          seeds_allocated: seeds,
          send_email: true,
        }),
      });
      // Gövde okunamazsa (kesik/bozuk JSON) sonuç doğrulanmamış sayılır. Ham sunucu iletisi gösterilmez.
      const body: unknown = await res.json().catch(() => null);
      outcome = allocationOutcome(res.status, body);
    } catch {
      // İstek sunucuya ulaşmış olabilir: başarı ya da kesin hata denmez.
      outcome = { kind: "uncertain" };
    } finally {
      setSubmitting(false);
    }
    if (outcome.kind === "success") {
      const key = outcome.emailSent === true ? "allocatedEmailSent" : outcome.emailSent === false ? "allocatedEmailNotSent" : "allocatedNoEmailInfo";
      showToast("success", t(key, { name: form.name, count: seeds }));
      setForm({ name: "", email: "", seeds: "1" });
      load();
    } else if (outcome.kind === "uncertain") {
      // Form korunur ve istek kendiliğinden yinelenmez. Liste yalnız okunarak yenilenir; kullanıcı tahsisin
      // kaydedilip kaydedilmediğini görmeden yeniden göndermesin.
      showToast("error", t("allocateUncertain"), 10000);
      load();
    } else {
      showToast("error", t("allocateError"));
    }
  };

  const poolPct = pool ? Math.round((pool.pool_allocated / Math.max(pool.pool_total, 1)) * 100) : 0;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(52,211,153,0.12)" }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "rgba(52,211,153,0.08)" }}
      >
        <div>
          <h2 className="font-bold text-white text-sm flex items-center gap-2">
            {t("title")}
            <span
              className="text-xs font-normal px-2 py-0.5 rounded-full"
              style={{ background: "rgba(16,185,129,0.12)", color: "rgb(52,211,153)", border: "1px solid rgba(52,211,153,0.2)" }}
            >
              {quote.company_name}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{t("subtitle")}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Pool progress */}
        {pool && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-400">{t("poolUsage")}</span>
              <span className="text-xs font-bold text-white">
                {num(pool.pool_allocated)} / {num(pool.pool_total)}
                <span className="text-slate-500 font-normal ml-1">{t("remaining", { count: pool.pool_remaining })}</span>
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(30,41,59,0.8)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${poolPct}%`,
                  background: poolPct > 90
                    ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                    : "linear-gradient(90deg, #059669, #10b981)",
                  boxShadow: "0 0 10px rgba(16,185,129,0.4)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: poolPct > 90 ? "#f59e0b" : "rgb(52,211,153)" }}>
                {t("used", { pct: poolPct })}
              </span>
              {pool.pool_remaining === 0 && (
                <span className="text-xs text-red-400">{t("full")}</span>
              )}
            </div>
          </div>
        )}

        {/* Add employee form */}
        {pool && pool.pool_remaining > 0 && (
          <form onSubmit={handleAdd} className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("add")}</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder={t("name")}
                aria-label={t("name")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
                style={{
                  background: "rgba(30,41,59,0.6)",
                  border: "1px solid rgba(51,65,85,0.6)",
                  caretColor: "rgb(52,211,153)",
                }}
              />
              <input
                type="email"
                placeholder={t("email")}
                aria-label={t("email")}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
                style={{
                  background: "rgba(30,41,59,0.6)",
                  border: "1px solid rgba(51,65,85,0.6)",
                  caretColor: "rgb(52,211,153)",
                }}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={t("seeds")}
                  aria-label={t("seeds")}
                  min={1}
                  max={pool.pool_remaining}
                  value={form.seeds}
                  onChange={(e) => setForm((f) => ({ ...f, seeds: e.target.value }))}
                  required
                  className="w-24 px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{
                    background: "rgba(30,41,59,0.6)",
                    border: "1px solid rgba(51,65,85,0.6)",
                    caretColor: "rgb(52,211,153)",
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                  style={{
                    background: submitting ? "rgba(5,150,105,0.4)" : "linear-gradient(135deg, #059669, #0d9488)",
                    boxShadow: "0 2px 12px rgba(5,150,105,0.3)",
                  }}
                >
                  {submitting ? "…" : t("allocate")}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Toast */}
        {toast && (
          <div
            role={toast.type === "error" ? "alert" : "status"}
            className="px-4 py-3 rounded-xl text-sm animate-fade-in"
            style={{
              background: toast.type === "success"
                ? "rgba(16,185,129,0.12)"
                : "rgba(239,68,68,0.12)",
              border: `1px solid ${toast.type === "success" ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.25)"}`,
              color: toast.type === "success" ? "rgb(52,211,153)" : "rgb(252,165,165)",
            }}
          >
            {toast.msg}
          </div>
        )}

        {/* Allocations table */}
        {loadingData ? (
          <div className="flex justify-center py-4">
            <div role="status" aria-label={tc("loading")} className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : allocations.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              {t("distributed", { count: allocations.length })}
            </p>
            <div className="space-y-2">
              {allocations.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(30,41,59,0.8)" }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: "rgba(16,185,129,0.12)", color: "rgb(52,211,153)" }}
                  >
                    {a.recipient_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{a.recipient_name}</p>
                    <p className="text-xs text-slate-500 truncate">{a.recipient_email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: "rgb(52,211,153)" }}>
                      🌱 {num(a.seeds_allocated)}
                    </p>
                    <p className="text-xs" style={{ color: a.email_sent ? "rgb(52,211,153)" : "#94a3b8" }}>
                      {a.email_sent ? t("emailSent") : t("emailPending")}
                    </p>
                  </div>
                  {a.certificate_id && (
                    <a
                      href={`/sertifika/${a.certificate_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(52,211,153,0.2)",
                        color: "rgb(52,211,153)",
                      }}
                    >
                      {t("certificate")}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <span className="text-3xl block mb-2">👥</span>
            <p className="text-sm text-slate-500">{t("empty")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ana Sayfa ──────────────────────────────────────────────────────────────────
export default function CorporateDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [quotes, setQuotes] = useState<CorporateQuote[]>([]);
  const [loading, setLoading] = useState(true);
  // Kurumsal ödeme kapalıyken "Öde" düğmesi ödeme sayfasına gitmez, bilgi notu gösterir.
  const [payNotice, setPayNotice] = useState(false);
  const t = useTranslations("corporatePages.overview");
  const tc = useTranslations("corporatePages");
  const lang = uiLocale(useLocale());

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/kurumsal/giris"); return; }
      setUser(session.user);
      try {
        const res = await fetch(`/api/kurumsal/quotes?user_id=${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setQuotes(data);
        }
      } catch (e) {
        console.error("Quotes fetch error:", e);
      }
      setLoading(false);
    };
    load();
  }, [router]);

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div role="status" aria-label={tc("loading")} className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const companyName = user.user_metadata?.company_name || t("companyFallback");
  const activeQuote = quotes.find((q) => {
    const s = normalizeStatus(q.status);
    return s === "PENDING" || s === "QUOTED";
  });
  const paidQuotes = quotes.filter((q) => normalizeStatus(q.status) === "PAID");

  const goToPay = (quoteId: string) =>
    TRANSACTIONS_ENABLED
      ? router.push({ pathname: "/kurumsal/panel/odeme", query: { quote_id: quoteId } })
      : setPayNotice(true);

  return (
    <>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Başlık */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
            <p className="text-sm text-slate-400 mt-1">{t("subtitle", { company: companyName })}</p>
          </div>
          {quotes.length > 0 && !activeQuote && (
            <Button variant="primary" onClick={() => router.push("/kurumsal/teklif-al")}>
              {t("newQuote")}
            </Button>
          )}
        </div>
        {payNotice && (
          <div role="status" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
            {t("paySoon")}
          </div>
        )}

        {/* Aktif Teklif Uyarısı */}
        {activeQuote && (
          <QuoteAlert
            quote={activeQuote}
            onPayClick={() => goToPay(activeQuote.id)}
          />
        )}

        {/* Özet kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <CardStat icon="🏢" label={t("stats.active")}
            value={quotes.filter(q => { const s = normalizeStatus(q.status); return s === "PENDING" || s === "QUOTED"; }).length.toString()}
            sub={t("stats.activeSub")} />
          <CardStat icon="✅" label={t("stats.paid")} value={paidQuotes.length.toString()} sub={t("stats.paidSub")} />
          <CardStat icon="🌳" label={t("stats.seeds")}
            value={paidQuotes.reduce((s, q) => s + (q.approved_seed_count || 0), 0).toLocaleString(intlLocale(lang))}
            sub={t("stats.seedsSub")} />
          <CardStat icon="💰" label={t("stats.invested")}
            value={plainTl(paidQuotes.reduce((s, q) => s + Number(q.approved_price || 0), 0), lang)}
            sub={t("stats.investedSub")} />
        </div>

        {/* Teklif geçmişi */}
        <Card variant="solid" padding="none">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">{t("history")}</h2>
            <span className="text-xs text-slate-500">{t("quoteCount", { count: quotes.length })}</span>
          </div>

          {quotes.length === 0 ? (
            <div className="p-8 text-center">
              <span className="text-4xl block mb-3">📋</span>
              <p className="text-slate-400 mb-4">{t("empty")}</p>
              <Button variant="primary" onClick={() => router.push("/kurumsal/teklif-al")}>
                {t("firstQuote")}
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {quotes.map((q) => {
                const meta = getMeta(q.status);
                const isQuoted = normalizeStatus(q.status) === "QUOTED";
                return (
                  <div key={q.id} className="px-5 py-4 flex flex-wrap items-center gap-4 hover:bg-white/[0.02] transition-colors">
                    <span className="text-xl">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        #{q.id.slice(0, 8)} — {seedRangeLabelKey(q.seed_count) ? tc(`quoteOptions.seed.${seedRangeLabelKey(q.seed_count)}`) : q.seed_count}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(q.created_at).toLocaleDateString(intlLocale(lang))} —{" "}
                        {q.need_types?.map(n =>
                          t(n === "orman" ? "need.orman" : n === "sertifika" ? "need.sertifika" : "need.karbon")
                        ).join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      {q.approved_price ? (
                        <p className="text-sm font-bold text-white">
                          {plainTl(Number(q.approved_price), lang)}
                        </p>
                      ) : null}
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                        {t(`status.${meta.key}.label`)}
                      </span>
                    </div>
                    {isQuoted && (
                      <div className="flex gap-2 shrink-0 ml-auto">
                        <Button variant="primary" size="sm" onClick={() => goToPay(q.id)}>
                          {t("payShort")}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Çalışan sertifikası dağıtımı ödenmiş teklifte ve kurumsal satış açıkken (uçları TRANSACTIONS_ENABLED'da). */}
        {TRANSACTIONS_ENABLED &&
          paidQuotes.map((q) => <EmployeeDistributionSection key={q.id} quote={q} userId={user.id} />)}
      </div>
    </>
  );
}
