/** Builds private, immutable transport payloads; never contacts the mail provider. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { trDayOf, trLongDate } from "@/lib/legal/format";
import { renderLegalPdf } from "@/lib/legal/render-pdf";
import type { LegalBlock, LegalDocument } from "@/lib/legal/types";
import { notificationBody, prepareOrderConfirmation, prepareOrderNotification, prepareWithdrawalReceipt, prepareWithdrawalNotification, prepareReleaseCertificate, prepareVideoPublished } from "@/lib/mail";
import { formatTry, formatCount } from "@/lib/pricing";
import { orderPagePath } from "./access";
import { formatLongDay } from "./dates";
import { trToday } from "./schedule";
import { refundDueDay } from "./withdrawal-dates";
import { isOrderPrepared } from "./preparation";
import type { DocumentKind, ReleaseOrderRow } from "./types";
import type { NotificationJob } from "./notification-outbox";
interface StoredDocument {
    kind: DocumentKind;
    title: string;
    sha256: string;
    meta: string[];
    blocks: LegalBlock[];
}
const FILE_NAMES: Record<string, string> = {
    pre_info: "on-bilgilendirme-formu",
    contract: "mesafeli-hizmet-sozlesmesi",
    withdrawal_form: "cayma-formu",
    kvkk_notice: "kvkk-aydinlatma-metni",
};
/** Sipariş anında saklanan belgeleri (yapısal kaynak) döner. */
export async function loadStoredDocuments(supabase: SupabaseClient, orderId: string): Promise<{
    version: string;
    documents: StoredDocument[];
} | null> {
    const { data, error } = await supabase
        .from("order_events")
        .select("data")
        .eq("order_id", orderId)
        .eq("type", "documents_generated")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
    if (error || !data)
        return null;
    const payload = data.data as {
        version?: string;
        documents?: StoredDocument[];
    };
    return payload.documents?.length ? { version: payload.version ?? "", documents: payload.documents } : null;
}
export function storedDocumentToPdf(doc: StoredDocument, version: string, createdAt: Date): Buffer {
    const legal: LegalDocument = { kind: doc.kind, title: doc.title, meta: doc.meta, version, blocks: doc.blocks };
    return renderLegalPdf(legal, { sha256: doc.sha256, createdAt });
}
export const documentFileName = (kind: string, orderNo: string, ext: "pdf" | "html") => `${FILE_NAMES[kind] ?? kind}-${orderNo}.${ext}`;
export async function prepareNotification(job: NotificationJob, supabase: SupabaseClient, origin: string): Promise<string> {
    const order = job.source.order;
    if (!order || order.id !== job.order_id || !order.buyer_email)
        throw new Error("invalid_notification_source");
    const locale = order.locale === "tr" ? "tr" : "en";
    const prefix = order.locale === "tr" ? "" : `/${order.locale}`;
    const common = { orderId: order.id, orderNo: order.order_no, locale: order.locale, email: order.buyer_email,
        firstName: order.buyer_first_name, siteName: order.site_snapshot.name, totalText: formatTry(order.total_kurus, order.locale), isTest: order.is_test };
    const buyerName = `${order.buyer_first_name} ${order.buyer_last_name}`;
    switch (job.template) {
        case "release_order_confirm": {
            const current = await supabase.from("release_orders").select("*").eq("id", order.id).maybeSingle();
            if (current.error || !current.data || !await isOrderPrepared(supabase, current.data as ReleaseOrderRow))
                throw new Error("documents_unavailable");
            const stored = await loadStoredDocuments(supabase, order.id);
            if (!stored || stored.documents.length !== 4)
                throw new Error("documents_unavailable");
            const attachments = stored.documents.map(doc => ({ filename: documentFileName(doc.kind, order.order_no, "pdf"), content: storedDocumentToPdf(doc, stored.version, new Date(order.created_at)).toString("base64") }));
            return notificationBody(prepareOrderConfirmation({ ...common, quantity: order.quantity, certificateName: order.certificate_name,
                performanceDeadlineText: order.performance_deadline ? trLongDate(order.performance_deadline) : "",
                withdrawalLastDayText: order.withdrawal_deadline ? trLongDate(trDayOf(order.withdrawal_deadline)) : "",
                orderUrl: origin + orderPagePath(order.order_no, order.id, order.locale), attachments }));
        }
        case "release_order_notify": return notificationBody(prepareOrderNotification({ ...common, quantity: order.quantity, buyerName, buyerType: order.buyer_type }));
        case "release_withdrawal_receipt":
        case "release_withdrawal_notify": {
            if (!order.withdrawal_requested_at)
                throw new Error("invalid_notification_source");
            const received = new Date(order.withdrawal_requested_at);
            const due = refundDueDay(received);
            return notificationBody(job.template === "release_withdrawal_receipt"
                ? prepareWithdrawalReceipt({ ...common, receivedOnText: formatLongDay(trToday(received), locale), refundDueOnText: formatLongDay(due, locale) })
                : prepareWithdrawalNotification({ ...common, buyerName, totalText: formatTry(order.total_kurus, "tr"), refundDueOnText: formatLongDay(due, "tr") }));
        }
        case "release_certificate": {
            const current = await supabase.from("release_orders").select("certificate_code, certificate_cancelled_at, status").eq("id", order.id).maybeSingle();
            if (current.error)
                throw new Error("source_unavailable");
            if (!order.certificate_code || !order.released_at || !current.data || current.data.certificate_code !== order.certificate_code || current.data.certificate_cancelled_at || !["released", "monitoring", "completed"].includes(current.data.status))
                throw new Error("certificate_not_eligible");
            return notificationBody(prepareReleaseCertificate({ ...common, certificateName: order.certificate_name, quantityText: formatCount(order.quantity, order.locale),
                releasedOnText: formatLongDay(trToday(new Date(order.released_at)), locale), certificateUrl: `${origin}${prefix}/sertifika/${order.certificate_code}`,
                orderUrl: origin + orderPagePath(order.order_no, order.id, order.locale) }));
        }
        case "release_video": {
            const batch = job.source.batch;
            if (!batch?.video_url || !batch.released_on)
                throw new Error("invalid_notification_source");
            const land = await supabase.from("lands").select("slug, is_public").eq("id", order.land_id).maybeSingle();
            if (land.error)
                throw new Error("source_unavailable");
            return notificationBody(prepareVideoPublished({ ...common, releasedOnText: formatLongDay(batch.released_on, locale), videoUrl: batch.video_url,
                siteUrl: land.data?.is_public && land.data.slug ? `${origin}${prefix}/sahalar/${land.data.slug}` : null,
                orderUrl: origin + orderPagePath(order.order_no, order.id, order.locale) }));
        }
        default: throw new Error("invalid_notification_source");
    }
}
