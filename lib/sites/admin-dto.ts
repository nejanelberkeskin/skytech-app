/**
 * Saha yönetimi yanıt DTO'ları — YALNIZ SUNUCU dönüştürücüleri, tipler istemciyle ortak. Sözleşme: web-brifler/30.
 *
 * Her alan açık kolon listesinden gelir (`*` yok). Konum koordinatı, galeri ve eski kurumsal bayrak panelde
 * kullanılmadığı için dönmez. Kapasite sayıları yalnız yönetim uçlarında; vitrine hiçbir yoldan çıkmaz.
 */
import type { RecordScope } from "@/lib/admin/record-scope";
import type { LandStatus } from "./admin";
import { siteVisibility, type SiteColumn } from "./admin-access";
import type { WorkType } from "./types";

export const SITE_ADMIN_COLUMNS = [
  "id", "slug", "name", "region", "province", "district", "area_hectares", "is_fire_affected", "fire_year",
  "work_type", "species_slugs", "name_i18n", "summary_i18n", "cover_image", "video_url", "sort_order", "status",
  "is_public", "capacity_seeds", "filled_seeds", "reserved_seeds", "certificate_month", "monitoring_month", "created_at", "updated_at",
].join(", ");

export interface SiteAdminItem {
  id: string;
  slug: string | null;
  name: string;
  region: string | null;
  province: string | null;
  district: string | null;
  areaHectares: number | null;
  isFireAffected: boolean;
  fireYear: number | null;
  /** Sertifika / izleme içeriği teslim ayı (1–12). */
  certificateMonth: number | null;
  monitoringMonth: number | null;
  workType: WorkType;
  speciesSlugs: string[];
  nameI18n: { en?: string; ru?: string };
  summaryI18n: { tr?: string; en?: string; ru?: string };
  coverImage: string | null;
  videoUrl: string | null;
  sortOrder: number;
  status: LandStatus;
  isPublic: boolean;
  /** Vitrin etkisi: listelenir mi, sipariş alır mı. */
  visibility: { listed: boolean; acceptsOrders: boolean };
  /** Tohum topu adetleri (yalnız yönetim). `available` = toplam − bırakılan − ayrılan (en az 0). */
  capacity: { total: number; filled: number; reserved: number; available: number };
  createdAt: string | null;
  updatedAt: string | null;
  /** Bu kayıt için izin + kapsam (yeniden doğrulama ayrı: liste `mfa`). */
  capabilities: { edit: boolean; publish: boolean; capacity: boolean };
}

export interface SiteSpeciesOption {
  slug: string;
  name: string;
  latinName: string | null;
}

export interface SiteAdminListDto {
  items: SiteAdminItem[];
  /** Yalnız `?include=species` ile: katalogdaki bütün türler (pasif olan da; bilgi alanı). */
  species?: SiteSpeciesOption[];
  scope: RecordScope;
  capabilities: {
    /** Yeni saha (yayında olmadan): sites.read + sites.edit + sites.capacity.manage, hepsi `all`. */
    create: boolean;
    /** Yeni sahayı doğrudan yayında açmak: ek olarak sites.publish `all`. */
    createPublic: boolean;
    /** Silme: bugünkü sınır (eski SUPER_ADMIN rolü) korunur; 30 §6. */
    delete: boolean;
  };
  /** Yayın ve kapasite değişiklikleri için yeniden doğrulama durumu. */
  mfa: { enforced: boolean; satisfied: boolean; enrolled: boolean };
}

export interface SiteMutationDto {
  site: SiteAdminItem;
  /** Gerçekten değişen kolonlar (değişiklik yoksa boş; yazma ve audit yapılmadı). */
  changed: SiteColumn[];
}

type Row = Record<string, unknown>;
const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const int = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const maybeNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
function i18n<K extends string>(value: unknown, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const k of keys) {
      const v = (value as Row)[k];
      if (typeof v === "string" && v) out[k] = v;
    }
  }
  return out;
}

export function siteItemOf(row: Row, capabilities: SiteAdminItem["capabilities"]): SiteAdminItem {
  const total = int(row.capacity_seeds);
  const filled = int(row.filled_seeds);
  const reserved = int(row.reserved_seeds);
  return {
    id: String(row.id),
    slug: text(row.slug),
    name: typeof row.name === "string" ? row.name : "",
    region: text(row.region),
    province: text(row.province),
    district: text(row.district),
    areaHectares: maybeNumber(row.area_hectares),
    isFireAffected: row.is_fire_affected === true,
    fireYear: maybeNumber(row.fire_year),
    certificateMonth: maybeNumber(row.certificate_month),
    monitoringMonth: maybeNumber(row.monitoring_month),
    workType: (text(row.work_type) ?? "ormanlastirma_genclestirme") as WorkType,
    speciesSlugs: Array.isArray(row.species_slugs) ? row.species_slugs.map(String) : [],
    nameI18n: i18n(row.name_i18n, ["en", "ru"] as const),
    summaryI18n: i18n(row.summary_i18n, ["tr", "en", "ru"] as const),
    coverImage: text(row.cover_image),
    videoUrl: text(row.video_url),
    sortOrder: int(row.sort_order),
    status: String(row.status) as LandStatus,
    isPublic: row.is_public === true,
    visibility: siteVisibility(row.is_public, row.status),
    capacity: { total, filled, reserved, available: Math.max(0, total - filled - reserved) },
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    capabilities,
  };
}
