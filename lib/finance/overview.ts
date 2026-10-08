/**
 * Tek finans hesabı — Genel Bakış ve Finans aynı tanımları kullanır (web-brifler/18).
 *
 * Toplama veritabanında yapılır (020 `admin_finance_overview`): satır sınırına bağlı değildir, deneme
 * siparişleri hariçtir, dönem Europe/Istanbul takvim ayıdır. Tutarlar kuruş ve KDV dahildir (tahsil
 * edilen para); bu ekranlar sağlayıcı hesap ekstresi ya da muhasebe hasılatı değildir.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const FINANCE_DEFINITIONS_VERSION = 1;

export interface FinanceMonth {
  key: string; // "2026-09"
  orderCollectionsKurus: number;
  duplicateChargesKurus: number;
  refundsKurus: number;
  netCashKurus: number;
  paidQuantity: number;
}

export interface FinanceOverview {
  definitionsVersion: number;
  timeZone: "Europe/Istanbul";
  generatedAt: string;
  currentMonth: {
    key: string;
    from: string;
    to: string;
    orderCollectionsKurus: number;
    duplicateChargesKurus: number;
    orderRefundsKurus: number;
    duplicateRefundsKurus: number;
    netCashKurus: number;
    paidQuantity: number;
    paidOrderCount: number;
  };
  allTime: { heldOrderValueKurus: number; heldOrderCount: number; releasedQuantity: number; refundedOrderCount: number };
  liabilities: {
    orderRefundLiabilityKurus: number;
    orderRefundLiabilityCount: number;
    duplicateLiabilityKurus: number;
    duplicateLiabilityCount: number;
    overdueRefundCount: number;
  };
  pending: { payableKurus: number; payableCount: number };
  operations: { awaitingBatchCount: number };
  months: FinanceMonth[];
}

/** Ekran etiketleri ve açıklamaları — arayüz bu metinleri kullanır ki iki ekran aynı dili konuşsun. */
export const FINANCE_DEFINITIONS = {
  orderCollections: { label: "Sipariş tahsilatı", description: "Dönemde ödemesi alınan bırakma siparişlerinin toplamı (sonradan iade edilse de ödeme ayında sayılır)." },
  duplicateCharges: { label: "Çift tahsilat", description: "Aynı siparişe gelen ikinci ödemeler. Gelir değildir; iade yükümlülüğüdür." },
  refunds: { label: "Tamamlanan iadeler", description: "Dönemde tamamlanan sipariş ve çift tahsilat iadeleri (iadenin tamamlandığı ayda sayılır)." },
  netCash: { label: "Net tahsilat", description: "Sipariş tahsilatı + çift tahsilat − tamamlanan iadeler. Nakit esasıdır; iadenin yoğun olduğu ayda eksi çıkabilir." },
  heldOrderValue: { label: "Elde tutulan sipariş tutarı", description: "Tüm zamanlarda ödenmiş ve iade sürecinde olmayan siparişlerin toplamı." },
  refundLiability: { label: "İade yükümlülüğü", description: "Cayma ya da satıcı iptali nedeniyle iadesi bekleyen siparişler + iade edilmemiş çift tahsilatlar." },
  payable: { label: "Ödenebilir bekleyen", description: "Ödeme sayfası açık ve süresi dolmamış siparişler. Terk edilmiş ya da süresi dolmuş sepetler dahil değildir." },
} as const;

const n = (v: unknown) => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : 0;
};
const record = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Veritabanı yanıtını sayısal alanları garanti eden tipe çevirir (eksik alan 0; biçim bozuksa hata). */
export function normalizeOverview(raw: unknown): FinanceOverview {
  const r = record(raw);
  const cm = record(r.currentMonth);
  const at = record(r.allTime);
  const li = record(r.liabilities);
  const pe = record(r.pending);
  const op = record(r.operations);
  if (typeof cm.key !== "string" || !Array.isArray(r.months)) throw new Error("finance_overview_malformed");
  return {
    definitionsVersion: n(r.definitionsVersion),
    timeZone: "Europe/Istanbul",
    generatedAt: String(r.generatedAt ?? ""),
    currentMonth: {
      key: cm.key,
      from: String(cm.from ?? ""),
      to: String(cm.to ?? ""),
      orderCollectionsKurus: n(cm.orderCollectionsKurus),
      duplicateChargesKurus: n(cm.duplicateChargesKurus),
      orderRefundsKurus: n(cm.orderRefundsKurus),
      duplicateRefundsKurus: n(cm.duplicateRefundsKurus),
      netCashKurus: n(cm.netCashKurus),
      paidQuantity: n(cm.paidQuantity),
      paidOrderCount: n(cm.paidOrderCount),
    },
    allTime: {
      heldOrderValueKurus: n(at.heldOrderValueKurus),
      heldOrderCount: n(at.heldOrderCount),
      releasedQuantity: n(at.releasedQuantity),
      refundedOrderCount: n(at.refundedOrderCount),
    },
    liabilities: {
      orderRefundLiabilityKurus: n(li.orderRefundLiabilityKurus),
      orderRefundLiabilityCount: n(li.orderRefundLiabilityCount),
      duplicateLiabilityKurus: n(li.duplicateLiabilityKurus),
      duplicateLiabilityCount: n(li.duplicateLiabilityCount),
      overdueRefundCount: n(li.overdueRefundCount),
    },
    pending: { payableKurus: n(pe.payableKurus), payableCount: n(pe.payableCount) },
    operations: { awaitingBatchCount: n(op.awaitingBatchCount) },
    months: (r.months as unknown[]).map((m) => {
      const x = record(m);
      return {
        key: String(x.key ?? ""),
        orderCollectionsKurus: n(x.orderCollectionsKurus),
        duplicateChargesKurus: n(x.duplicateChargesKurus),
        refundsKurus: n(x.refundsKurus),
        netCashKurus: n(x.netCashKurus),
        paidQuantity: n(x.paidQuantity),
      };
    }),
  };
}

/** Hata ya da biçim bozukluğunda FIRLATIR: çağıran 503 döner, sıfır göstermez. */
export async function loadFinanceOverview(db: SupabaseClient, months = 6): Promise<FinanceOverview> {
  const { data, error } = await db.rpc("admin_finance_overview", { p_months: months });
  if (error || !data) throw new Error("finance_overview_unavailable");
  return normalizeOverview(data);
}

const MONTH_LABEL = new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit", timeZone: "Europe/Istanbul" });

/** "2026-09" → "Eyl 26" (grafik ekseni). */
export function monthLabel(key: string): string {
  const d = new Date(`${key}-15T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? key : MONTH_LABEL.format(d);
}

/** Tarihin İstanbul takvim ayı ("2026-09"). */
export function istanbulMonthKey(date: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(date));
}
