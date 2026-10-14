"use client";

import { Suspense, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase/browser";
import { claimPendingRequest } from "@/lib/requests/client";
import { REQUEST_ROUTES } from "@/lib/site-config";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/requests/labels";
import type { ServiceRequestStatus, ServiceRequestType } from "@/lib/types";
import { intlLocale, uiLocale } from "@/lib/utils/locale";

/* ═══════════════════════════════════════════════════════════════════════
   Hesabım — talep özeti (ödeme öncesi dönem)
   ═══════════════════════════════════════════════════════════════════════
   Kullanıcının kendi talepleri RLS ile okunur (service_requests: yalnız
   user_id = auth.uid()). Bekleyen misafir talebi (?talep= ya da
   localStorage) burada hesaba bağlanır.
   ═══════════════════════════════════════════════════════════════════════ */

export interface MyRequestRow {
  id: string;
  request_no: string;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  total_seeds: number | null;
  created_at: string;
  land: { name: string; region: string | null } | null;
}

/** Sahibin okuyabildiği sütunlar — migration'daki GRANT ile aynı küme. */
export const MY_REQUEST_COLUMNS =
  "id, request_no, type, status, contact_name, email, phone, company, locale, land_id, total_seeds, seed_items, details, message, consent_at, created_at, updated_at, land:lands(name, region)";

export const STATUS_CLASS: Record<ServiceRequestStatus, string> = {
  new: "bg-amber-500/15 text-amber-800 border-amber-500/20",
  contacted: "bg-sky-500/15 text-sky-700 border-sky-500/20",
  quoted: "bg-blue-500/15 text-blue-700 border-blue-500/20",
  converted: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
  closed: "bg-white text-slate-500 border-slate-200",
  spam: "bg-white text-slate-500 border-slate-200",
};

export default function RequestsOverview() {
  return (
    <Suspense fallback={<Loading />}>
      <RequestsOverviewContent />
    </Suspense>
  );
}

function Loading() {
  const t = useTranslations("accountPages");
  return (
    <div className="p-6 lg:p-8 flex justify-center py-16">
      <div role="status" aria-label={t("loading")} className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
    </div>
  );
}

function RequestsOverviewContent() {
  const searchParams = useSearchParams();
  const talepParam = searchParams.get("talep");
  const t = useTranslations("accountPages.overview");
  const lang = uiLocale(useLocale());
  const [rows, setRows] = useState<MyRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Bekleyen misafir talebini bağla (varsa), sonra listele
      await claimPendingRequest(talepParam);
      const { data } = await supabase
        .from("service_requests")
        .select("id, request_no, type, status, total_seeds, created_at, land:lands(name, region)")
        .order("created_at", { ascending: false });
      if (alive) {
        setRows((data as unknown as MyRequestRow[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [talepParam]);

  const total = rows.length;
  const waiting = rows.filter((r) => r.status === "new").length;
  const inProgress = rows.filter((r) => r.status === "contacted" || r.status === "quoted").length;
  const done = rows.filter((r) => r.status === "converted").length;

  const STATS = [
    { label: t("stats.total"), value: total, accent: "text-emerald-700" },
    { label: t("stats.waiting"), value: waiting, accent: "text-amber-800" },
    { label: t("stats.inProgress"), value: inProgress, accent: "text-sky-700" },
    { label: t("stats.done"), value: done, accent: "text-teal-700" },
  ];

  if (loading) return <Loading />;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <p className="text-sm text-slate-600">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{t("recent")}</h2>
          {rows.length > 0 && (
            <Link href="/hesabim/taleplerim" className="text-xs text-emerald-700 hover:text-emerald-700 font-medium transition-colors">
              {t("seeAll")}
            </Link>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-slate-500 text-sm mb-4">{t("empty")}</p>
            <Link href={REQUEST_ROUTES.hub} className="inline-flex bg-[#1B6B3A] hover:bg-[#165c31] px-6 py-3 rounded-2xl text-sm font-medium text-white transition-all">
              {t("firstRequest")}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {rows.slice(0, 5).map((r) => (
              <Link
                key={r.id}
                href="/hesabim/taleplerim"
                className="px-6 py-4 flex items-center gap-4 transition-colors hover:bg-slate-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">
                    <span className="font-mono text-emerald-700">{r.request_no}</span> — {REQUEST_TYPE_LABELS[lang][r.type]}
                    {r.total_seeds ? ` · ${t("seedBalls", { count: r.total_seeds })}` : ""}
                    {r.land?.name ? ` · ${r.land.name}` : ""}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(r.created_at).toLocaleDateString(intlLocale(lang))}</p>
                </div>
                <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${STATUS_CLASS[r.status]}`}>
                  {REQUEST_STATUS_LABELS[lang][r.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {[
          { href: REQUEST_ROUTES.openLand, title: t("actions.openLandTitle"), desc: t("actions.openLandDesc") },
          { href: REQUEST_ROUTES.land, title: t("actions.ownLandTitle"), desc: t("actions.ownLandDesc") },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-[#1B6B3A]/40">
            <div>
              <p className="font-semibold text-slate-900">{a.title}</p>
              <p className="text-xs text-slate-500">{a.desc}</p>
            </div>
            <span aria-hidden="true" className="text-[#1B6B3A]">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
