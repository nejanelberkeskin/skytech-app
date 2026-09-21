/**
 * Sipariş önizlemesi — SUNUCU tarafı (service role).
 *
 * 4. adımda gösterilen KESİN tutar, takvim ve siparişe özel hukuki metinler
 * burada hazırlanır. Tutar her zaman sunucuda hesaplanır.
 *
 * ŞU ANKİ DURUM: hukuki metin şablonları (Faz 3b) henüz yazılmadı. Bu yüzden
 * `buildSampleDocuments` yalnız GELİŞTİRME ortamında, açıkça "ÖRNEK" damgalı
 * yer tutucu metin üretir; canlıda çağrılmaz (uçlar 503 döner). Arayüz bu
 * sözleşmeye göre geliştirilir, gerçek şablonlar geldiğinde yalnız bu dosya değişir.
 */
import { createServiceRoleClient } from "@/lib/supabase/server";
import { COMPANY, companyAddressLine } from "@/lib/company";
import { UNIT_PRICE_KURUS, formatCount, formatTry, type PriceLocale } from "@/lib/pricing";
import { ilAdi } from "@/lib/tr-iller";
import type { OrderDocumentPreview, OrderPreview } from "./client";
import { scheduleFor } from "./schedule";
import { resolveCertificateName, type OrderPreviewPayload } from "./schema";

/** Gerçek şablonlar gelene kadar kullanılan sürüm etiketi. */
export const SAMPLE_DOCUMENTS_VERSION = "ORNEK-0";

/** [MM] teyitli: KDV %20. Sipariş çekirdeği bağlanınca sales_settings.vat_rate'ten okunacak. */
const VAT_RATE = 20;

export type SiteCheck =
  | { ok: true; site: { id: string; name: string; province: string | null } }
  | { ok: false; error: "site_unavailable" | "capacity" | "unavailable" };

/** Saha yayında ve katılıma açık mı, istenen adet karşılanabiliyor mu? (Sayılar dışarı verilmez.) */
export async function checkSite(landId: string, quantity: number): Promise<SiteCheck> {
  try {
    const supabase = createServiceRoleClient();
    const { data: land, error } = await supabase
      .from("lands")
      .select("id, name, province, region, is_public, status, capacity_seeds, filled_seeds, reserved_seeds")
      .eq("id", landId)
      .maybeSingle();
    if (error) return { ok: false, error: "unavailable" };
    if (!land || !land.is_public || land.status !== "open") return { ok: false, error: "site_unavailable" };
    const free = (land.capacity_seeds ?? 0) - (land.filled_seeds ?? 0) - (land.reserved_seeds ?? 0);
    if (free < quantity) return { ok: false, error: "capacity" };
    return {
      ok: true,
      site: {
        id: land.id as string,
        name: land.name as string,
        province: (land.province as string | null) ?? (land.region as string | null) ?? null,
      },
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export function totalsFor(quantity: number): OrderPreview["totals"] {
  const totalKurus = quantity * UNIT_PRICE_KURUS;
  // KDV dâhil tutarın içindeki vergi: toplam × oran / (100 + oran), kuruşa yuvarlanır.
  const vatKurus = Math.round((totalKurus * VAT_RATE) / (100 + VAT_RATE));
  return { quantity, unitPriceKurus: UNIT_PRICE_KURUS, totalKurus, vatKurus, vatRate: VAT_RATE };
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const page = (title: string, body: string) =>
  `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title>` +
  `<style>body{font:15px/1.6 system-ui,sans-serif;color:#1a2e1a;margin:24px;max-width:720px}` +
  `h1{font-size:20px}h2{font-size:16px;margin-top:24px}table{border-collapse:collapse;width:100%}` +
  `td{border:1px solid #d5e2d5;padding:6px 10px;vertical-align:top}` +
  `.stamp{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:8px 12px;border-radius:8px;font-weight:600}</style>` +
  `</head><body><p class="stamp">ÖRNEK METİN — yalnız arayüz geliştirmesi içindir; hukuki metin değildir.</p>${body}</body></html>`;

/** YALNIZ GELİŞTİRME: arayüzün belge görüntüleyicisini sınamak için yer tutucu belgeler. */
export function buildSampleDocuments(
  input: OrderPreviewPayload,
  siteName: string,
  preview: Pick<OrderPreview, "totals" | "schedule">
): OrderDocumentPreview[] {
  const locale = input.locale as PriceLocale;
  const buyer = `${input.buyer.firstName} ${input.buyer.lastName}`;
  const party =
    input.invoice.type === "corporate"
      ? `${input.invoice.companyTitle} (yetkili: ${input.invoice.authorizedPerson})`
      : buyer;
  const address = `${input.invoice.address.line}, ${input.invoice.address.district} / ${ilAdi(input.invoice.address.province) ?? ""}`;
  const rows = [
    ["Satıcı", `${COMPANY.legalName} — ${companyAddressLine()} — ${COMPANY.taxOffice} V.D. ${COMPANY.taxId}`],
    ["Alıcı", `${party} — ${address} — ${input.buyer.email} — ${input.buyer.phone}`],
    ["Hizmet", `${siteName} adlı Proje Uygulama Sahasına ${formatCount(input.quantity, locale)} adet tohum topunun dronla bırakılması`],
    ["Toplam bedel", `${formatTry(preview.totals.totalKurus, locale)} (KDV dâhil)`],
    ["Kesin son tarih", preview.schedule.performanceDeadline],
    ["Cayma hakkı son anı", preview.schedule.withdrawalDeadline],
    ["Sertifikadaki ad", resolveCertificateName(input)],
  ];
  const table = `<table>${rows.map(([k, v]) => `<tr><td><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`).join("")}</table>`;
  const filler = Array.from({ length: 6 }, (_, i) => `<h2>Madde ${i + 1}</h2><p>Bu bölüm, belge görüntüleyicisinin uzun metinle nasıl davrandığını sınamak için konmuş yer tutucudur. Gerçek madde metni hukuki şablonlarla birlikte gelecektir.</p>`).join("");
  return [
    { kind: "pre_info", title: "Ön Bilgilendirme Formu", html: page("Ön Bilgilendirme Formu", `<h1>Ön Bilgilendirme Formu</h1>${table}${filler}`) },
    { kind: "contract", title: "Mesafeli Hizmet Sözleşmesi", html: page("Mesafeli Hizmet Sözleşmesi", `<h1>Mesafeli Hizmet Sözleşmesi</h1>${table}${filler}${filler}`) },
    { kind: "withdrawal_form", title: "Cayma Formu", html: page("Cayma Formu", `<h1>Cayma Formu</h1><p>Sipariş no: (sipariş oluşunca yazılır)</p>${table}`) },
  ];
}

export function buildPreview(input: OrderPreviewPayload, siteName: string, now: Date = new Date()): OrderPreview {
  const totals = totalsFor(input.quantity);
  const schedule = scheduleFor(now);
  return {
    version: SAMPLE_DOCUMENTS_VERSION,
    totals,
    schedule,
    documents: buildSampleDocuments(input, siteName, { totals, schedule }),
  };
}
