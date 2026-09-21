"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/browser";
import { CUSTOMER_STATUS_HINTS, CUSTOMER_STATUS_LABELS } from "@/lib/orders/labels";
import type { OrderStatus } from "@/lib/orders/types";
import { formatCount, formatTry } from "@/lib/pricing";

/* ═══════════════════════════════════════════════════════════════════════
   Hesabım — Siparişlerim (sahaya tohum topu bıraktırma)
   ═══════════════════════════════════════════════════════════════════════
   Üyenin kendi siparişleri RLS ile okunur (release_orders: yalnız
   user_id = auth.uid(); sütun yetkisi fatura/onay/ödeme ayrıntısını
   dışarıda bırakır). Yalnız sözleşmesi kurulmuş (ödenmiş) siparişler
   listelenir. Ayrıntı ve belgeler sipariş sayfasındadır (/siparis/<no>;
   üye oturumuyla, belirteç gerekmez).
   Aynı e-postayla misafir olarak verilmiş siparişler, e-posta doğrulanmışsa
   sayfa açılırken hesaba bağlanır (POST /api/auth/claim-orders).
   ═══════════════════════════════════════════════════════════════════════ */

interface Row {
  id: string;
  order_no: string;
  status: OrderStatus;
  is_test: boolean;
  site_snapshot: { name: string; province: string | null; district: string | null };
  quantity: number;
  total_kurus: number;
  certificate_name: string;
  certificate_code: string | null;
  certificate_cancelled_at: string | null;
  paid_at: string | null;
  withdrawal_deadline: string | null;
  performance_deadline: string | null;
  released_at: string | null;
  created_at: string;
  batch: { released_on: string | null; video_url: string | null; video_published_at: string | null } | null;
}

const COLUMNS =
  "id, order_no, status, is_test, site_snapshot, quantity, total_kurus, certificate_name, certificate_code, certificate_cancelled_at, paid_at, withdrawal_deadline, performance_deadline, released_at, created_at, batch:release_batches(released_on, video_url, video_published_at)";

const STATUS_CLASS: Partial<Record<OrderStatus, string>> = {
  paid: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  scheduled: "bg-teal-500/15 text-teal-300 border-teal-500/20",
  released: "bg-green-500/15 text-green-300 border-green-500/20",
  monitoring: "bg-lime-500/15 text-lime-300 border-lime-500/20",
  completed: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
  withdrawal_requested: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  cancelled_by_seller: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  refunded: "bg-white/[0.04] text-emerald-200/50 border-white/[0.08]",
};

const longDay = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }) : null;

export default function SiparislerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(0);
  const [failed, setFailed] = useState(false);
  // "Şimdi" render sırasında okunmaz (saf render); liste yüklendiği an esas alınır.
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Misafirken aynı e-postayla verilmiş siparişleri hesaba bağla (yinelenebilir; hata listeyi engellemez).
      try {
        const res = await fetch("/api/auth/claim-orders", { method: "POST" });
        const json = (await res.json().catch(() => null)) as { linked?: number } | null;
        if (alive && res.ok && json?.linked) setLinked(json.linked);
      } catch {
        /* bağlantı hatası: liste yine de gösterilir */
      }
      const { data, error } = await supabase.from("release_orders").select(COLUMNS).not("paid_at", "is", null).order("created_at", { ascending: false });
      if (!alive) return;
      if (error) setFailed(true);
      setLoadedAt(Date.now());
      setRows((data as unknown as Row[]) ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex justify-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Siparişlerim</h1>
          <p className="text-sm text-emerald-200/40 mt-1">Proje Uygulama Sahalarına tohum topu bıraktırma siparişleriniz.</p>
        </div>
        <Link href="/sahalar" className="glass-btn px-5 py-2.5 rounded-2xl text-sm font-medium text-white transition-all">
          Proje Uygulama Sahaları
        </Link>
      </div>

      {linked > 0 && (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Bu e-posta adresiyle daha önce verdiğiniz {linked} sipariş hesabınıza bağlandı.
        </p>
      )}
      {failed && (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">Siparişler şu anda yüklenemedi. Lütfen sayfayı yenileyin.</p>
      )}

      {rows.length === 0 && !failed ? (
        <div className="liquid-glass rounded-3xl p-10 text-center">
          <p className="text-emerald-200/50 text-sm mb-2">Hesabınıza bağlı sipariş bulunmuyor.</p>
          <p className="text-xs text-emerald-200/30 mb-5 max-w-md mx-auto">
            Misafir olarak sipariş verdiyseniz, sipariş teyidi e-postanızdaki bağlantıyla siparişinizi görüntüleyebilirsiniz. Aynı e-posta adresiyle açılmış ve doğrulanmış hesaplarda siparişler buraya kendiliğinden bağlanır.
          </p>
          <Link href="/sahalar" className="inline-flex glass-btn px-6 py-3 rounded-2xl text-sm font-medium text-white transition-all">
            Sahaları incele →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const place = [r.site_snapshot.district, r.site_snapshot.province].filter(Boolean).join(", ");
            const releasedOn = r.released_at ? (r.batch?.released_on ?? r.released_at) : null;
            const canWithdraw = r.status === "paid" && r.withdrawal_deadline !== null && loadedAt <= new Date(r.withdrawal_deadline).getTime();
            const video = r.batch?.video_published_at ? r.batch.video_url : null;
            const interrupted = r.status === "withdrawal_requested" || r.status === "cancelled_by_seller" || r.status === "refunded";
            return (
              <div key={r.id} className="liquid-glass rounded-3xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-mono text-emerald-300">{r.order_no}</span>
                      {r.is_test && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-300">DENEME</span>}
                    </p>
                    <p className="text-base font-semibold text-white mt-1 break-words">{r.site_snapshot.name}</p>
                    <p className="text-xs text-emerald-200/30 mt-0.5">
                      {longDay(r.created_at)}
                      {place ? ` · ${place}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1.5 rounded-full border shrink-0 ${STATUS_CLASS[r.status] ?? "bg-white/[0.04] text-emerald-200/50 border-white/[0.08]"}`}>
                    {CUSTOMER_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>

                <p className="text-sm text-emerald-200/50">{CUSTOMER_STATUS_HINTS[r.status]}</p>

                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.06] text-sm">
                  <Line label="Tohum topu adedi" value={formatCount(r.quantity, "tr")} />
                  <Line label="Toplam hizmet bedeli (KDV dâhil)" value={formatTry(r.total_kurus, "tr")} />
                  <Line label="Sertifikadaki ad" value={r.certificate_name} />
                  {releasedOn ? (
                    <Line label="Bırakma tarihi" value={longDay(releasedOn) ?? "—"} />
                  ) : !interrupted && r.performance_deadline ? (
                    <Line label="En geç bırakılacağı tarih" value={longDay(r.performance_deadline) ?? "—"} />
                  ) : null}
                  {canWithdraw && <Line label="Cayma hakkının son günü" value={longDay(r.withdrawal_deadline) ?? "—"} />}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <Link href={`/siparis/${r.order_no}`} className="text-emerald-300 hover:underline font-medium">Sipariş ayrıntıları ve belgeler →</Link>
                  {r.certificate_code && !r.certificate_cancelled_at && (
                    <Link href={`/sertifika/${r.certificate_code}`} className="text-emerald-300 hover:underline">Katılım Sertifikası</Link>
                  )}
                  {video && /^https:\/\//.test(video) && (
                    <a href={video} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">Çalışmanın görüntüleri ↗</a>
                  )}
                  {canWithdraw && <Link href={`/cayma?no=${r.order_no}`} className="text-emerald-200/50 hover:text-white hover:underline">Cayma bildiriminde bulun</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <span className="text-emerald-200/40 shrink-0">{label}</span>
      <span className="text-white text-right break-words">{value}</span>
    </div>
  );
}
