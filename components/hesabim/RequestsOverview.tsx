"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { claimPendingRequest } from "@/lib/requests/client";
import { REQUEST_ROUTES } from "@/lib/site-config";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/requests/labels";
import type { ServiceRequestStatus, ServiceRequestType } from "@/lib/types";

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
  new: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  contacted: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  quoted: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  converted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  closed: "bg-white/[0.04] text-emerald-200/40 border-white/[0.08]",
  spam: "bg-white/[0.04] text-emerald-200/40 border-white/[0.08]",
};

export const TYPE_EMOJI: Record<ServiceRequestType, string> = {
  seed_purchase: "🌱",
  land_application: "🗺️",
  open_land_seeding: "🚁",
};

export default function RequestsOverview() {
  return (
    <Suspense fallback={<Loading />}>
      <RequestsOverviewContent />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="p-6 lg:p-8 flex justify-center py-16">
      <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
    </div>
  );
}

function RequestsOverviewContent() {
  const searchParams = useSearchParams();
  const talepParam = searchParams.get("talep");
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
    { label: "Toplam Talebim", value: total, icon: "📥", accent: "text-emerald-400" },
    { label: "Dönüş Bekleyen", value: waiting, icon: "⏳", accent: "text-amber-400" },
    { label: "Görüşme Sürüyor", value: inProgress, icon: "📞", accent: "text-sky-400" },
    { label: "Sonuçlanan", value: done, icon: "✅", accent: "text-teal-400" },
  ];

  if (loading) return <Loading />;

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Hesabım</h1>
        <p className="text-sm text-emerald-200/40 mt-1">Taleplerinizin özeti — ekibimiz her talebe bir iş günü içinde dönüş yapar.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="liquid-glass relative rounded-3xl p-5 overflow-hidden">
            <div className="relative z-10">
              <span className="text-2xl">{s.icon}</span>
              <p className={`text-3xl font-black mt-3 ${s.accent}`}>{s.value}</p>
              <p className="text-xs text-emerald-200/30 mt-1.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="liquid-glass rounded-3xl overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="font-semibold text-white">Son Talepler</h2>
          {rows.length > 0 && (
            <Link href="/hesabim/taleplerim" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Tümünü Gör →
            </Link>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <span className="text-5xl block mb-4 animate-float">🌿</span>
            <p className="text-emerald-200/40 text-sm mb-4">Hesabınıza bağlı talep bulunmuyor.</p>
            <Link href={REQUEST_ROUTES.hub} className="inline-flex glass-btn px-6 py-3 rounded-2xl text-sm font-medium text-white transition-all">
              İlk Talebi Oluştur →
            </Link>
          </div>
        ) : (
          <div>
            {rows.slice(0, 5).map((r, i) => (
              <Link
                key={r.id}
                href="/hesabim/taleplerim"
                className="px-6 py-4 flex items-center gap-4 transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: i < Math.min(rows.length, 5) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center glass-subtle">
                  <span className="text-lg">{TYPE_EMOJI[r.type]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">
                    <span className="font-mono text-emerald-300">{r.request_no}</span> — {REQUEST_TYPE_LABELS.tr[r.type]}
                    {r.total_seeds ? ` · ${r.total_seeds.toLocaleString("tr-TR")} tohum` : ""}
                    {r.land?.name ? ` · ${r.land.name}` : ""}
                  </p>
                  <p className="text-xs text-emerald-200/25 mt-0.5">{new Date(r.created_at).toLocaleDateString("tr-TR")}</p>
                </div>
                <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${STATUS_CLASS[r.status]}`}>
                  {REQUEST_STATUS_LABELS.tr[r.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { href: REQUEST_ROUTES.seed, icon: "🌱", title: "Tohum Talebi", desc: "Tohum topları adresinize gelsin" },
          { href: REQUEST_ROUTES.openLand, icon: "🚁", title: "Açık Araziye Tohum", desc: "Sahalarımıza sizin adınıza ekelim" },
          { href: REQUEST_ROUTES.land, icon: "🗺️", title: "Arazime Ekim Yapın", desc: "Araziniz için drone ile ekim başvurusu" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="liquid-glass liquid-glass-hover relative rounded-3xl p-5 flex items-center gap-4 group overflow-hidden">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center glass-subtle group-hover:scale-110 transition-transform duration-300">
              <span className="text-2xl">{a.icon}</span>
            </div>
            <div className="relative z-10">
              <p className="font-semibold text-white">{a.title}</p>
              <p className="text-xs text-emerald-200/30">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
