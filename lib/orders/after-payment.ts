/**
 * Ödeme onaylandıktan SONRA yapılanlar — yanıtı bekletmeden (`after()`) çalışır.
 *
 * Sipariş teyidi e-postası: Ön Bilgilendirme Formu, sözleşme ve Cayma Formu PDF olarak
 * eklenir. PDF'ler, sipariş anında saklanan yapısal kaynaktan (documents_generated olayı)
 * üretilir; şablonlar o günden sonra değişmiş olsa bile müşterinin onayladığı metinle
 * birebir aynıdır. E-posta hatası siparişi etkilemez; olay olarak kaydedilir.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { trDayOf, trLongDate } from "@/lib/legal/format";
import { renderLegalPdf } from "@/lib/legal/render-pdf";
import type { LegalBlock, LegalDocument } from "@/lib/legal/types";
import { SKIPPED_ID, sendOrderConfirmation, sendOrderNotification } from "@/lib/mail";
import { formatTry } from "@/lib/pricing";
import { orderPagePath } from "./access";
import { addOrderEvent, db } from "./store";
import type { DocumentKind, ReleaseOrderRow } from "./types";

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
};

/** Sipariş anında saklanan belgeleri (yapısal kaynak) döner. */
export async function loadStoredDocuments(supabase: SupabaseClient, orderId: string): Promise<{ version: string; documents: StoredDocument[] } | null> {
  const { data, error } = await supabase
    .from("order_events")
    .select("data")
    .eq("order_id", orderId)
    .eq("type", "documents_generated")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const payload = data.data as { version?: string; documents?: StoredDocument[] };
  return payload.documents?.length ? { version: payload.version ?? "", documents: payload.documents } : null;
}

export function storedDocumentToPdf(doc: StoredDocument, version: string, createdAt: Date): Buffer {
  const legal: LegalDocument = { kind: doc.kind, title: doc.title, meta: doc.meta, version, blocks: doc.blocks };
  return renderLegalPdf(legal, { sha256: doc.sha256, createdAt });
}

export const documentFileName = (kind: string, orderNo: string, ext: "pdf" | "html") =>
  `${FILE_NAMES[kind] ?? kind}-${orderNo}.${ext}`;

/**
 * Gönderim sonuçlarını denetim izine yazar. Anahtar yokken (yerel geliştirme) e-posta
 * GÖNDERİLMEZ; bu durum "gönderildi" diye değil, nedeniyle birlikte "gönderilemedi" diye yazılır.
 */
export async function recordEmailResults(
  supabase: SupabaseClient,
  orderId: string,
  results: PromiseSettledResult<{ id?: string }>[],
  info: { template: string; attachments?: number }[]
): Promise<void> {
  for (const [i, r] of results.entries()) {
    const skipped = r.status === "fulfilled" && r.value?.id === SKIPPED_ID;
    const sent = r.status === "fulfilled" && !skipped;
    await addOrderEvent(supabase, orderId, sent ? "email_sent" : "email_failed", "system", {
      ...info[i],
      ...(sent ? { id: r.value?.id ?? null } : { reason: skipped ? "no_api_key" : "send_error" }),
    });
  }
}

export async function sendPaidOrderEmails(order: ReleaseOrderRow, origin: string): Promise<void> {
  const supabase = db();
  try {
    const stored = await loadStoredDocuments(supabase, order.id);
    const createdAt = new Date(order.created_at);
    const attachments = (stored?.documents ?? []).map((d) => ({
      filename: documentFileName(d.kind, order.order_no, "pdf"),
      content: storedDocumentToPdf(d, stored!.version, createdAt).toString("base64"),
    }));
    const totalText = formatTry(order.total_kurus, order.locale);
    const common = {
      orderId: order.id,
      orderNo: order.order_no,
      siteName: order.site_snapshot.name,
      quantity: order.quantity,
      totalText,
      isTest: order.is_test,
    };

    const results = await Promise.allSettled([
      sendOrderConfirmation({
        ...common,
        locale: order.locale,
        email: order.buyer_email,
        firstName: order.buyer_first_name,
        certificateName: order.certificate_name,
        performanceDeadlineText: order.performance_deadline ? trLongDate(order.performance_deadline) : "",
        withdrawalLastDayText: order.withdrawal_deadline ? trLongDate(trDayOf(order.withdrawal_deadline)) : "",
        orderUrl: origin + orderPagePath(order.order_no, order.id, order.locale),
        attachments,
      }),
      sendOrderNotification({
        ...common,
        buyerName: `${order.buyer_first_name} ${order.buyer_last_name}`,
        buyerType: order.buyer_type,
      }),
    ]);
    await recordEmailResults(supabase, order.id, results, [
      { template: "release_order_confirm", attachments: attachments.length },
      { template: "release_order_notify" },
    ]);
  } catch (e) {
    console.error(`[siparis] teyit e-postası hazırlanamadı (${order.order_no}):`, e instanceof Error ? e.message : e);
    await addOrderEvent(supabase, order.id, "email_failed", "system", { template: "release_order_confirm", stage: "prepare" });
  }
}
