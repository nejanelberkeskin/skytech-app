/**
 * Sipariş sihirbazının sunucuyla konuştuğu İKİ çağrı — istemci tarafı bağdaştırıcı.
 *
 * Arayüz bu dosyadaki işlevleri kullanır; `fetch`i kendisi çağırmaz. Yanıt
 * biçimleri aşağıdaki tiplerle sabittir (uçlar: app/api/public/siparis/*).
 *
 *   previewOrder()  4. adım açılırken: siparişe özel hukuki metinler, KESİN tutar
 *                   ve takvim. Tutarı sunucu hesaplar; istemcinin hesabı yalnız
 *                   anlık gösterim içindir.
 *   submitOrder()   "Siparişi Onayla ve Öde": siparişi oluşturur, ödeme sayfasının
 *                   adresini döner. İstemci `redirectUrl`e gider.
 */
import type { OrderSchedule } from "./schedule";
import type { OrderPayloadInput } from "./schema";
import type { DocumentKind } from "./types";

export interface OrderDocumentPreview {
  kind: DocumentKind;
  title: string;
  /** Sunucuda üretilmiş, kullanıcı girdileri kaçışlanmış HTML. `<iframe sandbox srcDoc>` içinde gösterilir. */
  html: string;
}

export interface OrderPreview {
  /** Hukuki metin şablonlarının sürümü — `submitOrder` gövdesinde `documentsVersion` olarak geri gönderilir. */
  version: string;
  documents: OrderDocumentPreview[];
  totals: {
    quantity: number;
    unitPriceKurus: number;
    totalKurus: number;
    /** Toplamın içindeki KDV (kuruş) — bilgi satırı. */
    vatKurus: number;
    vatRate: number;
  };
  schedule: OrderSchedule;
}

export type OrderErrorCode =
  | "validation" //        alan hataları: `fields` dolu ("buyer.email" → hata anahtarı)
  | "site_unavailable" //  saha yayından kalktı ya da katılıma kapandı
  | "capacity" //          seçilen adet bu sahada karşılanamıyor (SAYI GÖSTERİLMEZ)
  | "documents_stale" //   hukuki metinler güncellendi: önizleme yeniden alınmalı, kutular sıfırlanmalı
  | "rate_limited"
  | "closed" //            satış kapalı (SALES_ENABLED=false)
  | "generic";

export interface OrderFailure {
  ok: false;
  error: OrderErrorCode;
  fields?: Record<string, string>;
}

export type PreviewResult = ({ ok: true } & OrderPreview) | OrderFailure;
export type SubmitResult = { ok: true; orderNo: string; redirectUrl: string } | OrderFailure;

export type OrderPreviewInput = Pick<
  OrderPayloadInput,
  "landId" | "quantity" | "certificateName" | "buyer" | "invoice" | "locale"
>;

const KNOWN: readonly OrderErrorCode[] = [
  "validation",
  "site_unavailable",
  "capacity",
  "documents_stale",
  "rate_limited",
  "closed",
];

async function post<T>(url: string, body: unknown): Promise<({ ok: true } & T) | OrderFailure> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && data.ok === true) return data as { ok: true } & T;
    if (res.status === 429) return { ok: false, error: "rate_limited" };
    const code = typeof data.error === "string" && (KNOWN as readonly string[]).includes(data.error)
      ? (data.error as OrderErrorCode)
      : "generic";
    const fields = data.fields && typeof data.fields === "object" ? (data.fields as Record<string, string>) : undefined;
    return { ok: false, error: code, fields };
  } catch {
    return { ok: false, error: "generic" };
  }
}

export function previewOrder(input: OrderPreviewInput): Promise<PreviewResult> {
  return post<OrderPreview>("/api/public/siparis/onizleme", input);
}

export function submitOrder(payload: OrderPayloadInput): Promise<SubmitResult> {
  return post<{ orderNo: string; redirectUrl: string }>("/api/public/siparis", payload);
}
