/** Durable worker. No fallback direct send: missing migration/storage fails closed. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { NotificationDeliveryError, notificationSenderConfigured, sendFrozenNotification } from "@/lib/mail";
import { prepareNotification } from "./notification-payload";
import type { ReleaseOrderRow } from "./types";
export interface NotificationJob {
    id: string;
    order_id: string;
    template: string;
    claim_token: string;
    body: string | null;
    body_sha256: string | null;
    first_network_at: string | null;
    source: {
        order: ReleaseOrderRow;
        batch?: {
            released_on: string;
            video_url: string;
        };
    };
}
export interface NotificationOptions {
    orderId?: string;
    templates?: string[];
    limit?: number;
    budgetMs?: number;
}
export interface NotificationDependencies {
    configured: () => boolean;
    prepare: typeof prepareNotification;
    send: typeof sendFrozenNotification;
}
const defaults: NotificationDependencies = { configured: notificationSenderConfigured, prepare: prepareNotification, send: sendFrozenNotification };
export async function runNotificationOutbox(origin: string, supabase: SupabaseClient, options: NotificationOptions = {}, dependencies: NotificationDependencies = defaults) {
    const report = { sent: 0, failed: 0, configured: dependencies.configured(), byTemplate: {} as Record<string, {
            sent: number;
            failed: number;
        }> };
    const health = async () => {
        const result = await supabase.rpc("order_notification_health");
        if (result.error || !result.data || !["pending", "leased", "needsReview"].every(key => Number.isSafeInteger(result.data[key]) && result.data[key] >= 0)) {
            throw new Error("notification_health_unavailable");
        }
        return result.data as { pending: number; leased: number; needsReview: number; oldestPendingAt: string | null };
    };
    if (!report.configured)
        return { ...report, health: await health() }; // No network attempt/window starts without configured transport.
    const deadline = Date.now() + Math.min(options.budgetMs ?? 40000, 40000);
    for (let n = 0; n < Math.min(Math.max(options.limit ?? 40, 1), 100) && Date.now() < deadline; n++) {
        const claimed = await supabase.rpc("claim_order_notification", { p_templates: options.templates ?? null, p_order: options.orderId ?? null });
        if (claimed.error)
            throw new Error("notification_queue_unavailable");
        if (claimed.data === null)
            break;
        if (!claimed.data?.id || !claimed.data.claim_token || !claimed.data.template)
            throw new Error("notification_queue_invalid");
        const job = claimed.data as NotificationJob;
        const bucket = report.byTemplate[job.template] ??= { sent: 0, failed: 0 };
        const advance = async (action: string, extra: Record<string, string> = {}) => {
            const r = await supabase.rpc("advance_order_notification", { p_id: job.id, p_claim: job.claim_token, p_action: action, ...extra });
            if (r.error)
                throw new Error("notification_storage_unavailable");
            return r.data as NotificationJob | null;
        };
        try {
            let prepared = job;
            if (!prepared.body) {
                if (job.template === "release_video") {
                    const refreshed = await advance("refresh");
                    if (!refreshed) {
                        report.failed++;
                        bucket.failed++;
                        continue;
                    }
                    prepared = refreshed;
                }
                const body = await dependencies.prepare(prepared, supabase, origin);
                const frozen = await advance("freeze", { p_body: body });
                if (!frozen)
                    continue;
                prepared = frozen;
            }
            if (!prepared.body || createHash("sha256").update(prepared.body).digest("hex") !== prepared.body_sha256)
                throw new NotificationDeliveryError("body_integrity_failed", true);
            const begun = await advance("begin");
            if (!begun) {
                report.failed++;
                bucket.failed++;
                continue; // Stale lease, changed eligibility or expired idempotency window.
            }
            const receipt = await dependencies.send(prepared.body, `sg-outbox/${job.id}`);
            if (!receipt?.id || !receipt.id.trim() || receipt.id === "skipped-no-api-key")
                throw new NotificationDeliveryError("invalid_provider_response");
            if (await advance("sent", { p_provider_id: receipt.id })) {
                report.sent++;
                bucket.sent++;
            }
        }
        catch (error) {
            // Only stable error codes go to logs; no provider text, recipients, URLs or PDFs.
            const code = error instanceof NotificationDeliveryError ? error.code : error instanceof Error && ["documents_unavailable", "invalid_notification_source", "certificate_not_eligible"].includes(error.message) ? error.message : "delivery_or_storage_unavailable";
            const review = (error instanceof NotificationDeliveryError && error.permanent) || ["documents_unavailable", "invalid_notification_source", "certificate_not_eligible"].includes(code);
            await advance(review ? "review" : "retry", { p_error: code });
            report.failed++;
            bucket.failed++;
        }
    }
    return { ...report, health: await health() };
}

/** Recorded cron/admin entry: absent mail configuration is an operational failure. */
export async function runConfiguredNotifications(origin: string, supabase: SupabaseClient) {
  const result = await runNotificationOutbox(origin, supabase, { limit: 60, budgetMs: 35000 });
  if (!result.configured) throw new Error("notification_sender_not_configured");
  return result;
}
