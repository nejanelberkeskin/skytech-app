/** Certificate issuance enqueues transactionally through migration 036. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateCertificateCode } from "./identifiers";
import { addOrderEvent, db } from "./store";
import { runNotificationOutbox } from "./notification-outbox";
import type { ReleaseOrderRow } from "./types";
export const CERTIFICATE_EMAIL_TEMPLATE = "release_certificate";
/** Bırakılmış siparişe sertifika kodu verir (zaten varsa dokunmaz). */
export async function issueCertificate(supabase: SupabaseClient, order: Pick<ReleaseOrderRow, "id" | "certificate_code">): Promise<string | null> {
    if (order.certificate_code)
        return order.certificate_code;
    const at = new Date().toISOString();
    for (let attempt = 0; attempt < 6; attempt++) {
        const code = generateCertificateCode();
        const { data, error } = await supabase
            .from("release_orders")
            .update({ certificate_code: code, certificate_issued_at: at })
            .eq("id", order.id)
            .is("certificate_code", null)
            .in("status", ["released", "monitoring", "completed"])
            .select("certificate_code")
            .maybeSingle();
        if (!error && data) {
            await addOrderEvent(supabase, order.id, "certificate_issued", "system", { code });
            return code;
        }
        if (!error) {
            // Başka bir istek önce davrandı ya da sipariş uygun durumda değil: güncel kodu oku.
            const current = await supabase.from("release_orders").select("certificate_code").eq("id", order.id).maybeSingle();
            return (current.data?.certificate_code as string | null) ?? null;
        }
        if (error.code !== "23505") {
            console.error("[sertifika] kod yazılamadı:", error.code);
            return null;
        }
    }
    return null;
}
export async function sendPendingCertificateEmails(origin: string, limit = 40, supabase: SupabaseClient = db()): Promise<{
    sent: number;
    failed: number;
}> {
    const result = await runNotificationOutbox(origin, supabase, { templates: [CERTIFICATE_EMAIL_TEMPLATE], limit });
    return { sent: result.sent, failed: result.failed };
}
