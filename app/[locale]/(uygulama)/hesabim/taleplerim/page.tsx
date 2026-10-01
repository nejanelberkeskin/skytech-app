"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase/browser";
import { REQUEST_ROUTES } from "@/lib/site-config";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS, requestSummaryRows } from "@/lib/requests/labels";
import { MY_REQUEST_COLUMNS, STATUS_CLASS, TYPE_EMOJI } from "@/components/hesabim/RequestsOverview";
import type { ServiceRequest } from "@/lib/types";
import { intlLocale, uiLocale } from "@/lib/utils/locale";

type Row = ServiceRequest & { land: { name: string; region: string | null } | null };

/** Kullanıcının kendi talepleri — RLS: yalnız user_id = auth.uid(). */
export default function TaleplerimPage() {
  const t = useTranslations("accountPages.requests");
  const tPages = useTranslations("accountPages");
  const lang = uiLocale(useLocale());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("service_requests")
        .select(MY_REQUEST_COLUMNS)
        .order("created_at", { ascending: false });
      if (alive) {
        setRows((data as unknown as Row[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex justify-center py-16">
        <div role="status" aria-label={tPages("loading")} className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="text-sm text-emerald-200/40 mt-1">{t("subtitle")}</p>
        </div>
        <Link href={REQUEST_ROUTES.hub} className="glass-btn px-5 py-2.5 rounded-2xl text-sm font-medium text-white transition-all">
          {t("newRequest")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-10 text-center">
          <span className="text-5xl block mb-4 animate-float">🌿</span>
          <p className="text-emerald-200/40 text-sm mb-2">{t("empty")}</p>
          <p className="text-xs text-emerald-200/25 mb-5 max-w-md mx-auto">{t("emptyHint")}</p>
          <Link href={REQUEST_ROUTES.hub} className="inline-flex glass-btn px-6 py-3 rounded-2xl text-sm font-medium text-white transition-all">
            {t("firstRequest")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const isOpen = open === r.id;
            const landName = r.land ? (r.land.region ? `${r.land.name} (${r.land.region})` : r.land.name) : null;
            return (
              <div key={r.id} className="liquid-glass rounded-3xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  aria-expanded={isOpen}
                  className="w-full text-left px-6 py-4 flex items-center gap-4 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center glass-subtle shrink-0">
                    <span className="text-lg">{TYPE_EMOJI[r.type]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-mono text-emerald-300">{r.request_no}</span> — {REQUEST_TYPE_LABELS[lang][r.type]}
                    </p>
                    <p className="text-xs text-emerald-200/25 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString(intlLocale(lang), { dateStyle: "long" })}
                      {r.total_seeds ? ` · ${t("seeds", { count: r.total_seeds })}` : ""}
                      {landName ? ` · ${landName}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1.5 rounded-full border shrink-0 ${STATUS_CLASS[r.status]}`}>
                    {REQUEST_STATUS_LABELS[lang][r.status]}
                  </span>
                  <svg className={`w-4 h-4 text-emerald-200/30 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 pt-1 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-sm text-emerald-200/50 pt-4">{t(`hints.${r.status}`)}</p>
                    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.06]">
                      {requestSummaryRows(r, lang, landName).map((row, i) => (
                        <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                          <span className="text-emerald-200/40 shrink-0">{row.label}</span>
                          {row.href ? (
                            <a href={row.href} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-300 hover:underline break-all text-right">{row.value}</a>
                          ) : (
                            <span className={`text-white text-right ${row.multiline ? "whitespace-pre-wrap" : ""}`}>{row.value}</span>
                          )}
                        </div>
                      ))}
                      <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                        <span className="text-emerald-200/40 shrink-0">{t("contact")}</span>
                        <span className="text-white text-right">{[r.email, r.phone].filter(Boolean).join(" · ")}</span>
                      </div>
                    </div>
                    {r.message && (
                      <div>
                        <p className="text-xs text-emerald-200/40 mb-1">{t("yourNote")}</p>
                        <p className="text-sm text-emerald-100/70 whitespace-pre-wrap bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">{r.message}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
