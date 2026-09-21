/**
 * Katılım Sertifikası — düzenleme ve müşteri bildirimi. YALNIZ SUNUCU.
 *
 * Sertifika, tohum topu bırakma TAMAMLANDIĞINDA düzenlenir (parti "bırakıldı" işaretlenince).
 * Kod benzersizdir (veritabanı kısıtı); çakışmada yeniden üretilir. Bildirim e-postası partinin
 * büyüklüğünden bağımsız olsun diye kuyruk mantığıyla gönderilir: `sendPendingCertificateEmails`
 * hem bırakma işleminin ardından hem zamanlanmış işten çağrılır; gönderilmiş olanı bir daha göndermez.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SKIPPED_ID, sendReleaseCertificate } from "@/lib/mail";
import { formatCount } from "@/lib/pricing";
import { orderPagePath } from "./access";
import { recordEmailResults } from "./after-payment";
import { formatLongDay } from "./dates";
import { generateCertificateCode } from "./identifiers";
import { trToday } from "./schedule";
import { addOrderEvent, db } from "./store";
import type { ReleaseOrderRow } from "./types";

export const CERTIFICATE_EMAIL_TEMPLATE = "release_certificate";
const NOTIFY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** Bırakılmış siparişe sertifika kodu verir (zaten varsa dokunmaz). */
export async function issueCertificate(supabase: SupabaseClient, order: Pick<ReleaseOrderRow, "id" | "certificate_code">): Promise<string | null> {
  if (order.certificate_code) return order.certificate_code;
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

/**
 * Sertifikası düzenlenmiş ama bildirimi gitmemiş siparişlere e-posta gönderir.
 * "Gitti mi?" bilgisi denetim izinden okunur (`email_sent` + şablon adı) — ayrı bir sütun gerekmez.
 */
export async function sendPendingCertificateEmails(
  origin: string,
  limit = 40,
  supabase: SupabaseClient = db(),
  /** Testlerde sahte gönderici verilebilir; olağan kullanımda gerçek e-posta işlevi. */
  sender: typeof sendReleaseCertificate = sendReleaseCertificate
): Promise<{ sent: number; failed: number }> {
  const { data: candidates, error } = await supabase
    .from("release_orders")
    .select("*")
    .not("certificate_code", "is", null)
    .is("certificate_cancelled_at", null)
    .in("status", ["released", "monitoring", "completed"])
    // Yalnız son 14 günde düzenlenenler taranır: bildirilmiş eski kayıtlar kuyruğu tıkamasın.
    .gte("certificate_issued_at", new Date(Date.now() - NOTIFY_WINDOW_MS).toISOString())
    .order("certificate_issued_at", { ascending: true })
    .limit(1000);
  if (error || !candidates?.length) return { sent: 0, failed: 0 };

  const ids = candidates.map((o) => o.id as string);
  const { data: sentEvents } = await supabase.from("order_events").select("order_id").in("order_id", ids).eq("type", "email_sent").eq("data->>template", CERTIFICATE_EMAIL_TEMPLATE);
  const already = new Set((sentEvents ?? []).map((e) => e.order_id as string));

  let sent = 0;
  let failed = 0;
  for (const order of (candidates as ReleaseOrderRow[]).filter((o) => !already.has(o.id)).slice(0, limit)) {
    const mailLocale = order.locale === "tr" ? "tr" : "en";
    const prefix = order.locale === "tr" ? "" : `/${order.locale}`;
    const results = await Promise.allSettled([
      sender({
        orderId: order.id,
        orderNo: order.order_no,
        locale: order.locale,
        email: order.buyer_email,
        firstName: order.buyer_first_name,
        certificateName: order.certificate_name,
        siteName: order.site_snapshot.name,
        quantityText: formatCount(order.quantity, order.locale),
        releasedOnText: formatLongDay(trToday(new Date(order.released_at ?? Date.now())), mailLocale),
        certificateUrl: `${origin}${prefix}/sertifika/${order.certificate_code}`,
        orderUrl: origin + orderPagePath(order.order_no, order.id, order.locale),
        isTest: order.is_test,
      }),
    ]);
    await recordEmailResults(supabase, order.id, results, [{ template: CERTIFICATE_EMAIL_TEMPLATE }]);
    if (results[0].status === "fulfilled" && (results[0].value as { id?: string })?.id !== SKIPPED_ID) sent++;
    else failed++;
  }
  return { sent, failed };
}
