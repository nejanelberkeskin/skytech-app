/**
 * Bırakma partileri yönetimi yanıt DTO'ları — YALNIZ SUNUCU dönüştürücüleri, tipler istemciyle ortak.
 * Sözleşme: web-brifler/31.
 *
 * Parti izni tek başına müşteri, ödeme ve özel sertifika verisini açmaz: sipariş satırının temel alanları
 * operasyonel bilgidir; alıcı adı (`contact`), tutar/ödeme zamanı (`finance`) ve sertifika adı (`certificate`)
 * sipariş sözleşmesindeki (27) grup kurallarıyla açılır ve yalnız açıkken sorgulanır. `payment_meta` hiç seçilmez.
 */
import type { RecordScope } from "@/lib/admin/record-scope";

export type BatchOrderGroup = "order" | "contact" | "finance" | "certificate";

export interface BatchCapabilities {
  /** Başlık, plan tarihi, not; boş partiyi silme. */
  plan: boolean;
  /** Kesinleşmiş siparişi partiye alma / partiden çıkarma. */
  assign: boolean;
  /** Bırakmayı kesinleştirme (geri alınmaz; MFA). */
  release: boolean;
  /** Video ve izleme raporunu herkese açık yayımlama (MFA). */
  publish: boolean;
}

export interface BatchSummary {
  id: string;
  landId: string;
  landName: string | null;
  seasonLabel: string;
  title: string | null;
  plannedOn: string | null;
  releasedOn: string | null;
  videoUrl: string | null;
  videoPublishedAt: string | null;
  monitoringReportUrl: string | null;
  notes: string | null;
  createdAt: string;
  /** Partideki sipariş sayısı ve toplam tohum topu. */
  orders: number;
  quantity: number;
  capabilities: BatchCapabilities;
}

export interface BatchListDto {
  batches: BatchSummary[];
  /** Okuma kapsamındaki sahalar; `canPlan`: bu sahada yeni parti açılabilir. */
  lands: { id: string; name: string | null; status: string | null; isPublic: boolean; canPlan: boolean }[];
  seasons: string[];
  /** Partiye alınmayı bekleyen (kesinleşmiş, partisiz) siparişler — saha × sezon. */
  waiting: { landId: string; landName: string | null; seasonLabel: string; orders: number; quantity: number }[];
  /**
   * Cayma süresi dolduğu hâlde henüz kesinleşmemiş (zamanlanmış iş çalışmamış) sipariş sayısı.
   * Liste okuması artık bu siparişleri kesinleştirmez (31 §5); sıfırdan büyükse iş çalıştırılmalı.
   */
  dueForConfirmation: number;
  scope: RecordScope;
  capabilities: { create: boolean };
  /** Bırakma ve yayın için yeniden doğrulama durumu. */
  mfa: { enforced: boolean; satisfied: boolean; enrolled: boolean };
}

export interface BatchOrderRow {
  id: string;
  orderNo: string;
  status: string;
  isTest: boolean;
  quantity: number;
  confirmedAt: string | null;
  withdrawalDeadline: string | null;
  /** Ödeme geç geldiği için kapasitesi ayrılamamış sipariş partiye alınamaz. */
  capacityHeld: boolean;
  buyer?: { firstName: string; lastName: string };
  finance?: { totalKurus: number; paidAt: string | null };
  certificateName?: string;
}

export interface BatchDetailDto {
  batch: BatchSummary;
  land: { id: string; name: string | null; capacity?: { total: number; filled: number; reserved: number } };
  orders: BatchOrderRow[];
  /** Aynı saha + sezon, kesinleşmiş, partisiz (bırakılmış partide boş). */
  candidates: BatchOrderRow[];
  /** En çok 500 aday döner; daha fazlası varsa true. */
  candidatesTruncated: boolean;
  /** Bu partinin siparişlerinde görülebilen alan grupları. */
  groups: BatchOrderGroup[];
  /** İzni olduğu hâlde yeniden doğrulama beklediği için kapalı gruplar. */
  mfaRequiredGroups: BatchOrderGroup[];
  mfa: { enforced: boolean; satisfied: boolean; enrolled: boolean };
}

type Row = Record<string, unknown>;
const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const int = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

export const BATCH_COLUMNS =
  "id, land_id, season_label, title, planned_on, released_on, video_url, video_published_at, monitoring_report_url, notes, created_at";

export function batchSummaryOf(
  row: Row, landName: string | null, stats: { orders: number; quantity: number }, capabilities: BatchCapabilities
): BatchSummary {
  return {
    id: String(row.id),
    landId: String(row.land_id),
    landName,
    seasonLabel: String(row.season_label),
    title: text(row.title),
    plannedOn: text(row.planned_on),
    releasedOn: text(row.released_on),
    videoUrl: text(row.video_url),
    videoPublishedAt: text(row.video_published_at),
    monitoringReportUrl: text(row.monitoring_report_url),
    notes: text(row.notes),
    createdAt: String(row.created_at),
    orders: stats.orders,
    quantity: stats.quantity,
    capabilities,
  };
}

/** Sipariş satırı kolonları: temel + yalnız açık grupların kolonları. `payment_meta` yalnız tek JSON yolu. */
export function orderColumns(groups: ReadonlySet<BatchOrderGroup>): string {
  const cols = [
    "id", "order_no", "status", "is_test", "quantity", "confirmed_at", "withdrawal_deadline",
    "capacity_held:payment_meta->>capacityHeld",
  ];
  if (groups.has("contact")) cols.push("buyer_first_name", "buyer_last_name");
  if (groups.has("finance")) cols.push("total_kurus", "paid_at");
  if (groups.has("certificate")) cols.push("certificate_name");
  return cols.join(", ");
}

export function orderRowOf(row: Row, groups: ReadonlySet<BatchOrderGroup>): BatchOrderRow {
  return {
    id: String(row.id),
    orderNo: String(row.order_no),
    status: String(row.status),
    isTest: row.is_test === true,
    quantity: int(row.quantity),
    confirmedAt: text(row.confirmed_at),
    withdrawalDeadline: text(row.withdrawal_deadline),
    capacityHeld: row.capacity_held !== "false" && row.capacity_held !== false,
    ...(groups.has("contact")
      ? { buyer: { firstName: String(row.buyer_first_name ?? ""), lastName: String(row.buyer_last_name ?? "") } }
      : {}),
    ...(groups.has("finance") ? { finance: { totalKurus: int(row.total_kurus), paidAt: text(row.paid_at) } } : {}),
    ...(groups.has("certificate") ? { certificateName: String(row.certificate_name ?? "") } : {}),
  };
}
