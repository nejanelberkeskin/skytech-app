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
import { runNotificationOutbox } from "./notification-outbox";
import { youtubeIdFrom } from "@/lib/sites/releases";
import { confirmDueOrders } from "./admin-actions";
import { expireStaleOrders } from "./create";
import { seasonEndOf, trToday } from "./schedule";
import { addOrderEvent, db, transitionOrder } from "./store";
/** Bırakma sezonu bitmiş `released` siparişler izleme dönemine geçer. */
export async function startMonitoringDue(supabase: SupabaseClient = db(), today: string = trToday()): Promise<number> {
    const { data, error } = await supabase.from("release_orders").select("id, season_label").eq("status", "released").limit(2000);
    if (error || !data)
        return 0;
    let moved = 0;
    for (const row of data) {
        const end = seasonEndOf(row.season_label as string);
        if (!end || end >= today)
            continue;
        const done = await transitionOrder(supabase, row.id as string, ["released"], "monitoring");
        if (!done)
            continue;
        await addOrderEvent(supabase, done.id, "status_changed", "system", { from: "released", to: "monitoring", reason: "season_ended" });
        moved++;
    }
    return moved;
}
export type PublishVideoResult = {
    ok: true;
    firstPublication: boolean;
} | {
    ok: false;
    error: "not_found" | "invalid_state" | "invalid_url" | "unavailable";
};
/**
 * Partinin çalışma videosunu yayımlar. İlk yayımda `video_published_at` yazılır ve müşteri
 * bildirimleri kuyruğa girer; sonradan yalnız bağlantı düzeltilebilir (yeniden bildirim gitmez).
 */
export async function publishBatchVideo(batchId: string, videoUrl: string, supabase: SupabaseClient = db()): Promise<PublishVideoResult> {
    const url = videoUrl.trim();
    if (!youtubeIdFrom(url))
        return { ok: false, error: "invalid_url" };
    const { data: batch, error } = await supabase.from("release_batches").select("id, released_on, video_published_at").eq("id", batchId).maybeSingle();
    if (error)
        return { ok: false, error: "unavailable" };
    if (!batch)
        return { ok: false, error: "not_found" };
    if (!batch.released_on)
        return { ok: false, error: "invalid_state" }; // bırakılmamış çalışmanın videosu olmaz
    const first = !batch.video_published_at;
    const update = await supabase
        .from("release_batches")
        .update({ video_url: url, ...(first ? { video_published_at: new Date().toISOString() } : {}) })
        .eq("id", batchId);
    if (update.error)
        return { ok: false, error: "unavailable" };
    return { ok: true, firstPublication: first };
}
export async function sendPendingVideoEmails(origin: string, limit = 40, supabase: SupabaseClient = db()): Promise<{
    sent: number;
    failed: number;
}> {
    const result = await runNotificationOutbox(origin, supabase, { templates: ["release_video"], limit });
    return { sent: result.sent, failed: result.failed };
}
export interface ScheduledJobsReport {
    expired: number;
    confirmed: number;
    monitoring: number;
    certificateEmails: {
        sent: number;
        failed: number;
    };
    videoEmails: {
        sent: number;
        failed: number;
    };
    notifications: Awaited<ReturnType<typeof runNotificationOutbox>>;
}
export async function runScheduledJobs(origin: string, supabase: SupabaseClient = db()): Promise<ScheduledJobsReport> {
    const expired = await expireStaleOrders(supabase);
    const confirmed = await confirmDueOrders(supabase);
    const monitoring = await startMonitoringDue(supabase);
    const notifications = await runNotificationOutbox(origin, supabase, { limit: 60, budgetMs: 35000 });
    if (!notifications.configured)
        throw new Error("notification_sender_not_configured");
    const certificateEmails = notifications.byTemplate.release_certificate ?? { sent: 0, failed: 0 };
    const videoEmails = notifications.byTemplate.release_video ?? { sent: 0, failed: 0 };
    return { expired, confirmed, monitoring, certificateEmails, videoEmails, notifications };
}
