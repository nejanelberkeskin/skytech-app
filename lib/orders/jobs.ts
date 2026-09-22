/**
 * Zamana bağlı işler ve çalışma videosu — YALNIZ SUNUCU.
 *
 *   startMonitoringDue()      bırakma sezonu bitince (1 Nisan) `released` → `monitoring`
 *   publishBatchVideo()       partinin videosunu yayımlar (yönetim)
 *   sendPendingVideoEmails()  videosu yayımlanmış, bildirimi gitmemiş siparişlere e-posta →
 *                             `video_notified_at` + sipariş `completed`
 *   runScheduledJobs()        zamanlanmış işin tamamı (günde bir; /api/cron/siparis-isleri)
 *
 * Hepsi yinelenebilir: aynı iş iki kez çalışsa da ikinci kez bir şey yapmaz (koşullu UPDATE).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SKIPPED_ID, sendVideoPublished } from "@/lib/mail";
import { youtubeIdFrom } from "@/lib/sites/releases";
import { orderPagePath } from "./access";
import { confirmDueOrders } from "./admin-actions";
import { recordEmailResults } from "./after-payment";
import { sendPendingCertificateEmails } from "./certificates";
import { expireStaleOrders } from "./create";
import { formatLongDay } from "./dates";
import { seasonEndOf, trToday } from "./schedule";
import { addOrderEvent, db, transitionOrder } from "./store";
import type { OrderActor, ReleaseOrderRow } from "./types";

/** Bırakma sezonu bitmiş `released` siparişler izleme dönemine geçer. */
export async function startMonitoringDue(supabase: SupabaseClient = db(), today: string = trToday()): Promise<number> {
  const { data, error } = await supabase.from("release_orders").select("id, season_label").eq("status", "released").limit(2000);
  if (error || !data) return 0;
  let moved = 0;
  for (const row of data) {
    const end = seasonEndOf(row.season_label as string);
    if (!end || end >= today) continue;
    const done = await transitionOrder(supabase, row.id as string, ["released"], "monitoring");
    if (!done) continue;
    await addOrderEvent(supabase, done.id, "status_changed", "system", { from: "released", to: "monitoring", reason: "season_ended" });
    moved++;
  }
  return moved;
}

export type PublishVideoResult = { ok: true; firstPublication: boolean } | { ok: false; error: "not_found" | "invalid_state" | "invalid_url" | "unavailable" };

/**
 * Partinin çalışma videosunu yayımlar. İlk yayımda `video_published_at` yazılır ve müşteri
 * bildirimleri kuyruğa girer; sonradan yalnız bağlantı düzeltilebilir (yeniden bildirim gitmez).
 */
export async function publishBatchVideo(batchId: string, videoUrl: string, supabase: SupabaseClient = db()): Promise<PublishVideoResult> {
  const url = videoUrl.trim();
  if (!youtubeIdFrom(url)) return { ok: false, error: "invalid_url" };
  const { data: batch, error } = await supabase.from("release_batches").select("id, released_on, video_published_at").eq("id", batchId).maybeSingle();
  if (error) return { ok: false, error: "unavailable" };
  if (!batch) return { ok: false, error: "not_found" };
  if (!batch.released_on) return { ok: false, error: "invalid_state" }; // bırakılmamış çalışmanın videosu olmaz
  const first = !batch.video_published_at;
  const update = await supabase
    .from("release_batches")
    .update({ video_url: url, ...(first ? { video_published_at: new Date().toISOString() } : {}) })
    .eq("id", batchId);
  if (update.error) return { ok: false, error: "unavailable" };
  return { ok: true, firstPublication: first };
}

const VIDEO_TEMPLATE = "release_video";

export async function sendPendingVideoEmails(
  origin: string,
  limit = 40,
  supabase: SupabaseClient = db(),
  /** Testlerde sahte gönderici verilebilir; olağan kullanımda gerçek e-posta işlevi. */
  sender: typeof sendVideoPublished = sendVideoPublished
): Promise<{ sent: number; failed: number }> {
  const { data: batches, error } = await supabase.from("release_batches").select("id, land_id, released_on, video_url").not("video_published_at", "is", null).not("video_url", "is", null).limit(500);
  if (error || !batches?.length) return { sent: 0, failed: 0 };
  const byId = new Map(batches.map((b) => [b.id as string, b]));

  const { data: orders } = await supabase
    .from("release_orders")
    .select("*")
    .in("batch_id", [...byId.keys()])
    .is("video_notified_at", null)
    .in("status", ["released", "monitoring"])
    .limit(limit);
  if (!orders?.length) return { sent: 0, failed: 0 };

  const landIds = [...new Set(batches.map((b) => b.land_id as string))];
  const { data: lands } = await supabase.from("lands").select("id, slug, is_public").in("id", landIds);
  const landById = new Map((lands ?? []).map((l) => [l.id as string, l]));

  let sent = 0;
  let failed = 0;
  const actor: OrderActor = "system";
  for (const order of orders as ReleaseOrderRow[]) {
    const batch = byId.get(order.batch_id ?? "");
    if (!batch) continue;
    const land = landById.get(order.land_id);
    const prefix = order.locale === "tr" ? "" : `/${order.locale}`;
    const mailLocale = order.locale === "tr" ? "tr" : "en";
    const results = await Promise.allSettled([
      sender({
        orderId: order.id,
        orderNo: order.order_no,
        locale: order.locale,
        email: order.buyer_email,
        firstName: order.buyer_first_name,
        siteName: order.site_snapshot.name,
        releasedOnText: formatLongDay((batch.released_on as string) ?? trToday(new Date(order.released_at ?? Date.now())), mailLocale),
        videoUrl: batch.video_url as string,
        siteUrl: land?.is_public && land.slug ? `${origin}${prefix}/sahalar/${land.slug}` : null,
        orderUrl: origin + orderPagePath(order.order_no, order.id, order.locale),
        isTest: order.is_test,
      }),
    ]);
    await recordEmailResults(supabase, order.id, results, [{ template: VIDEO_TEMPLATE }]);
    const ok = results[0].status === "fulfilled" && (results[0].value as { id?: string })?.id !== SKIPPED_ID;
    if (!ok) {
      failed++;
      continue; // bildirim gitmediyse sipariş "tamamlandı" sayılmaz; sonraki çalışmada yeniden denenir
    }
    const at = new Date().toISOString();
    await supabase.from("release_orders").update({ video_notified_at: at }).eq("id", order.id).is("video_notified_at", null);
    await addOrderEvent(supabase, order.id, "video_notified", actor, { batchId: batch.id });
    // Video izleme dönemi başlamadan yayımlandıysa ara durum da işlenir: released → monitoring → completed
    let status = order.status;
    if (status === "released") {
      const m = await transitionOrder(supabase, order.id, ["released"], "monitoring");
      if (m) status = "monitoring";
    }
    if (status === "monitoring") {
      const c = await transitionOrder(supabase, order.id, ["monitoring"], "completed", { completed_at: at });
      if (c) await addOrderEvent(supabase, order.id, "status_changed", actor, { from: order.status, to: "completed", reason: "video_published" });
    }
    sent++;
  }
  return { sent, failed };
}

export interface ScheduledJobsReport {
  expired: number;
  confirmed: number;
  monitoring: number;
  certificateEmails: { sent: number; failed: number };
  videoEmails: { sent: number; failed: number };
}

export async function runScheduledJobs(origin: string, supabase: SupabaseClient = db()): Promise<ScheduledJobsReport> {
  const expired = await expireStaleOrders(supabase);
  const confirmed = await confirmDueOrders(supabase);
  const monitoring = await startMonitoringDue(supabase);
  const certificateEmails = await sendPendingCertificateEmails(origin, 60, supabase);
  const videoEmails = await sendPendingVideoEmails(origin, 60, supabase);
  return { expired, confirmed, monitoring, certificateEmails, videoEmails };
}
