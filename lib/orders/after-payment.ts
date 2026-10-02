/** Compatibility entry points. All commerce delivery runs through the durable outbox. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SKIPPED_ID } from "@/lib/mail";
import { addOrderEvent, db } from "./store";
import { runNotificationOutbox } from "./notification-outbox";
import type { ReleaseOrderRow } from "./types";
export { loadStoredDocuments, storedDocumentToPdf, documentFileName } from "./notification-payload";
export async function recordEmailResults(supabase: SupabaseClient, orderId: string, results: PromiseSettledResult<{
    id?: string;
}>[], info: {
    template: string;
    attachments?: number;
}[]): Promise<void> {
    for (const [i, r] of results.entries()) {
        const skipped = r.status === "fulfilled" && r.value?.id === SKIPPED_ID;
        const sent = r.status === "fulfilled" && !skipped && typeof r.value?.id === "string" && Boolean(r.value.id.trim());
        await addOrderEvent(supabase, orderId, sent ? "email_sent" : "email_failed", "system", {
            ...info[i],
            ...(sent ? { id: r.value?.id ?? null } : { reason: skipped ? "no_api_key" : "send_error" }),
        });
    }
}
export async function sendPaidOrderEmails(order: ReleaseOrderRow, origin: string): Promise<void> {
    await runNotificationOutbox(origin, db(), { orderId: order.id, templates: ["release_order_confirm", "release_order_notify"], limit: 2 });
}
