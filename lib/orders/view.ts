/**
 * Sipariş durumu sayfası (`/siparis/[no]`) — müşteriye gösterilen GÖRÜNÜM sözleşmesi.
 *
 * Bu tip, sipariş kaydının müşteriye çıkabilecek kısmıdır: ödeme belirteçleri,
 * IP özeti, yönetici notu, ham onay kayıtları ve T.C. kimlik / vergi numarası
 * BURADA YOKTUR. Arayüz yalnız bu tipe göre yazılır; veritabanı bağlandığında
 * (Faz 3c) `getOrderView` gerçek kaydı bu biçime çevirir, arayüz değişmez.
 *
 * Erişim: sipariş sahibi üye oturumuyla, misafir ise e-postadaki imzalı
 * bağlantıyla (`?t=<belirteç>`) erişir. Sipariş numarasını bilmek tek başına
 * yetmez — numara tahmin edilerek başkasının siparişi görülemez.
 */
import type { WorkType } from "@/lib/sites/types";
import type { DocumentKind, OrderStatus } from "./types";

export type OrderTimelineKey = "paid" | "confirmed" | "scheduled" | "released" | "monitoring" | "completed";

export interface OrderTimelineStep {
  key: OrderTimelineKey;
  state: "done" | "current" | "upcoming";
  /** Gerçekleştiyse tarihi — YYYY-MM-DD (İstanbul) */
  on: string | null;
}

export interface OrderViewDocument {
  kind: DocumentKind;
  title: string;
  /** HTML kopyanın SHA-256 özeti — sayfada kısaltılarak gösterilebilir. */
  sha256: string;
  /** Yetkili indirme adresleri (imzalı); doğrudan <a href> ile verilir. */
  htmlUrl: string;
  pdfUrl: string;
}

export interface PublicOrderView {
  orderNo: string;
  status: OrderStatus;
  /** Deneme siparişi (deneme ödeme sağlayıcısı / sanal POS deneme kipi) — sayfada belirtilir. */
  isTest: boolean;
  /** Sipariş tarihi — YYYY-MM-DD */
  createdOn: string;
  buyerFirstName: string;
  site: { name: string; slug: string | null; location: string | null; workType: WorkType };
  /** Tür adları Türkçe katalog adlarıdır; çeviri için `ourSeeds.seeds.<slug>.name` kullanılır. */
  species: { slug: string; name: string }[];
  quantity: number;
  totals: { unitPriceKurus: number; totalKurus: number; vatRate: number };
  certificateName: string;
  schedule: {
    seasonLabel: string;
    /** Sözleşmedeki kesin son tarih — YYYY-MM-DD */
    performanceDeadline: string;
    /** Cayma hakkının son günü — YYYY-MM-DD (İstanbul) */
    withdrawalLastDay: string;
  };
  /** Cayma düğmesi gösterilsin mi? (yalnız `paid` durumunda ve süre dolmadıysa) */
  canWithdraw: boolean;
  timeline: OrderTimelineStep[];
  documents: OrderViewDocument[];
  /** Bırakma tarihi — YYYY-MM-DD; yapılmadıysa null */
  releasedOn: string | null;
  certificate: { code: string; status: "valid" | "cancelled" } | null;
  /** Çalışma videosu yayımlandıysa (herkese açık YouTube bağlantısı) */
  videoUrl: string | null;
  /** Cayma / satıcı iptali varsa iade süreci */
  refund: { reason: "withdrawal" | "seller_cancellation"; status: "pending" | "succeeded"; requestedOn: string; completedOn: string | null } | null;
  invoice: { status: "pending" | "issued"; issuedOn: string | null; pdfUrl: string | null } | null;
}

const TIMELINE: OrderTimelineKey[] = ["paid", "confirmed", "scheduled", "released", "monitoring", "completed"];

/** Durumdan zaman çizelgesi üretir (iade/iptal durumlarında çizelge "paid"de kalır). */
export function timelineFor(status: OrderStatus, dates: Partial<Record<OrderTimelineKey, string | null>>): OrderTimelineStep[] {
  const reached = TIMELINE.indexOf(status as OrderTimelineKey);
  const current = reached >= 0 ? reached : 0;
  return TIMELINE.map((key, i) => ({
    key,
    state: i < current || status === "completed" ? "done" : i === current ? "current" : "upcoming",
    on: dates[key] ?? null,
  }));
}

/* ── Geliştirme örnekleri ─────────────────────────────────────────────────── */

const doc = (no: string, kind: DocumentKind, title: string): OrderViewDocument => ({
  kind,
  title,
  sha256: "06b920819bd0627f15f762b8174c6889bcf084d92f4c6037968b0b7e3485de97",
  htmlUrl: `/api/public/hukuk/ornek/${kind === "pre_info" ? "on-bilgilendirme" : kind === "contract" ? "mesafeli-hizmet-sozlesmesi" : "cayma-formu"}?siparis=${no}`,
  pdfUrl: `/api/public/hukuk/ornek/${kind === "pre_info" ? "on-bilgilendirme" : kind === "contract" ? "mesafeli-hizmet-sozlesmesi" : "cayma-formu"}?siparis=${no}`,
});
const docs = (no: string) => [
  doc(no, "pre_info", "Ön Bilgilendirme Formu"),
  doc(no, "contract", "Mesafeli Hizmet Sözleşmesi"),
  doc(no, "withdrawal_form", "Cayma Formu"),
];

const base = {
  isTest: false,
  buyerFirstName: "Ayşe",
  site: { name: "ÖRNEK · Çanakkale Proje Uygulama Sahası", slug: "ornek-canakkale-proje-uygulama-sahasi", location: "Eceabat, Çanakkale", workType: "ormanlastirma_genclestirme" as WorkType },
  species: [{ slug: "kizilcam", name: "Kızılçam" }],
  quantity: 200,
  totals: { unitPriceKurus: 1000, totalKurus: 200_000, vatRate: 20 },
  certificateName: "Ayşe Örnek",
  schedule: { seasonLabel: "2026-2027", performanceDeadline: "2027-03-31", withdrawalLastDay: "2026-11-03" },
};

/** Örnek belirteç: geliştirmede `?t=ornek`. */
export const ORDER_VIEW_FIXTURE_TOKEN = "ornek";

export const ORDER_VIEW_FIXTURES: PublicOrderView[] = [
  {
    ...base,
    orderNo: "SG-2026-RNEK23", // ödendi, cayma süresi içinde
    status: "paid",
    createdOn: "2026-10-20",
    canWithdraw: true,
    timeline: timelineFor("paid", { paid: "2026-10-20" }),
    documents: docs("SG-2026-RNEK23"),
    releasedOn: null,
    certificate: null,
    videoUrl: null,
    refund: null,
    invoice: null,
  },
  {
    ...base,
    orderNo: "SG-2026-RNEK45", // partiye alındı
    status: "scheduled",
    createdOn: "2026-10-02",
    canWithdraw: false,
    timeline: timelineFor("scheduled", { paid: "2026-10-02", confirmed: "2026-10-17", scheduled: "2026-11-05" }),
    documents: docs("SG-2026-RNEK45"),
    releasedOn: null,
    certificate: null,
    videoUrl: null,
    refund: null,
    invoice: null,
  },
  {
    ...base,
    orderNo: "SG-2026-RNEK67", // bırakıldı: sertifika + fatura var, video henüz yok
    status: "monitoring",
    createdOn: "2026-10-02",
    quantity: 5000,
    totals: { unitPriceKurus: 1000, totalKurus: 5_000_000, vatRate: 20 },
    certificateName: "Örnek Lojistik A.Ş. Çalışanları",
    canWithdraw: false,
    timeline: timelineFor("monitoring", { paid: "2026-10-02", confirmed: "2026-10-17", scheduled: "2026-11-05", released: "2026-11-14", monitoring: "2027-04-01" }),
    documents: docs("SG-2026-RNEK67"),
    releasedOn: "2026-11-14",
    certificate: { code: "SG-RNEK-2345", status: "valid" },
    videoUrl: null,
    refund: null,
    invoice: { status: "issued", issuedOn: "2026-11-16", pdfUrl: null },
  },
  {
    ...base,
    orderNo: "SG-2026-RNEK89", // tamamlandı: video yayımlandı
    status: "completed",
    createdOn: "2026-10-02",
    canWithdraw: false,
    timeline: timelineFor("completed", { paid: "2026-10-02", confirmed: "2026-10-17", scheduled: "2026-11-05", released: "2026-11-14", monitoring: "2027-04-01", completed: "2027-05-20" }),
    documents: docs("SG-2026-RNEK89"),
    releasedOn: "2026-11-14",
    certificate: { code: "SG-RNEK-2345", status: "valid" },
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    refund: null,
    invoice: { status: "issued", issuedOn: "2026-11-16", pdfUrl: null },
  },
  {
    ...base,
    orderNo: "SG-2026-RNEKAB", // cayma bildirildi, iade bekliyor
    status: "withdrawal_requested",
    createdOn: "2026-10-20",
    canWithdraw: false,
    timeline: timelineFor("withdrawal_requested", { paid: "2026-10-20" }),
    documents: docs("SG-2026-RNEKAB"),
    releasedOn: null,
    certificate: null,
    videoUrl: null,
    refund: { reason: "withdrawal", status: "pending", requestedOn: "2026-10-25", completedOn: null },
    invoice: null,
  },
  {
    ...base,
    orderNo: "SG-2026-RNEKCD", // iade edildi
    status: "refunded",
    createdOn: "2026-10-20",
    canWithdraw: false,
    timeline: timelineFor("refunded", { paid: "2026-10-20" }),
    documents: docs("SG-2026-RNEKCD"),
    releasedOn: null,
    certificate: null,
    videoUrl: null,
    refund: { reason: "withdrawal", status: "succeeded", requestedOn: "2026-10-25", completedOn: "2026-10-29" },
    invoice: null,
  },
];
