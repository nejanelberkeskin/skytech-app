/**
 * Talep yönetimi okuma DTO'ları ve dönüştürücüler — YALNIZ SUNUCU. Sözleşme: web-brifler/29.
 *
 * Her alan açık listeden gelir. İletişim grubu yalnız ayrı, kapsamlı sorgudan gelen satırla eklenir;
 * `ip_hash`, `client_token`, `user_agent`, `user_id` hiçbir izinle dönmez (`user_id` yalnız iletişim grubunda
 * `hasAccount` bayrağına çevrilir). `handled_by` atama değildir:
 * "son işlem yapan" (`lastHandled`) olarak döner.
 */
import type { RecordScope } from "@/lib/admin/record-scope";

export type RequestType = "seed_purchase" | "land_application" | "open_land_seeding";
export type RequestStatus = "new" | "contacted" | "quoted" | "converted" | "closed" | "spam";
export type RequestGroup = "request" | "contact";

export interface RequestContact {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  consent: { at: string | null; version: string | null };
  sourcePath: string | null;
  mapLink: string | null;
  accessNotes: string | null;
  certificateName: string | null;
  /** Talep üye hesabıyla mı gönderildi? Hesap kimliğinin kendisi dönmez. */
  hasAccount: boolean;
}

export type RequestDetails =
  | { type: "land_application"; province: string; district: string | null; areaValue: number; areaUnit: string;
      conditions: string[]; ownership: string; timing: string }
  | { type: "open_land_seeding"; quantity: number }
  | { type: "other" };

export interface RequestItem {
  id: string;
  requestNo: string;
  type: RequestType;
  status: RequestStatus;
  locale: "tr" | "en" | "ru";
  createdAt: string;
  updatedAt: string;
  site: { id: string; name: string | null; region: string | null } | null;
  totalSeeds: number | null;
  seedItems: { slug: string; name: string; quantity: number }[];
  details: RequestDetails;
  adminNote: string | null;
  /** Son işlem yapan — atama DEĞİL (29 §2). */
  lastHandled: { adminId: string | null; at: string | null };
  canUpdate: boolean;
  contact?: RequestContact;
}

export interface RequestListDto {
  items: RequestItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<RequestStatus, number>;
  groups: RequestGroup[];
  scope: RecordScope;
  search: { contactFields: boolean };
  capabilities: { update: boolean };
}

type Row = Record<string, unknown>;
const text = (v: unknown): string | null => (typeof v === "string" ? v : null);
const textOr = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const record = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});

/** Temel kolonlar: iletişim ve kişisel veri içermez (29 §2). */
export const REQUEST_BASE_COLUMNS = [
  "id", "request_no", "type", "status", "locale", "land_id", "total_seeds", "seed_items",
  "detail_province:details->>province", "detail_district:details->>district",
  "detail_area_value:details->>areaValue", "detail_area_unit:details->>areaUnit",
  "detail_conditions:details->conditions", "detail_ownership:details->>ownership",
  "detail_timing:details->>timing", "detail_quantity:details->>quantity",
  "admin_note", "handled_by", "handled_at", "created_at", "updated_at",
];

/** İletişim grubu kolonları: yalnız grup kapsamındaki kayıtlar için ayrı sorguyla. */
export const REQUEST_CONTACT_COLUMNS = [
  "id", "contact_name", "email", "phone", "company", "message", "consent_at", "consent_version", "source_path",
  "detail_map_link:details->>mapLink", "detail_access_notes:details->>accessNotes",
  "detail_certificate_name:details->>certificateName",
  // Yalnız `hasAccount` bayrağı için; kimlik yanıta taşınmaz.
  "user_id",
];

function detailsOf(row: Row): RequestDetails {
  if (row.type === "land_application") {
    const area = Number(row.detail_area_value);
    const conditions = Array.isArray(row.detail_conditions) ? (row.detail_conditions as unknown[]).map(String) : [];
    return {
      type: "land_application",
      province: textOr(row.detail_province),
      district: text(row.detail_district),
      areaValue: Number.isFinite(area) ? area : 0,
      areaUnit: textOr(row.detail_area_unit),
      conditions,
      ownership: textOr(row.detail_ownership),
      timing: textOr(row.detail_timing),
    };
  }
  if (row.type === "open_land_seeding") {
    const quantity = Number(row.detail_quantity);
    return { type: "open_land_seeding", quantity: Number.isFinite(quantity) ? quantity : 0 };
  }
  return { type: "other" };
}

export function contactOf(row: Row): RequestContact {
  return {
    name: textOr(row.contact_name),
    email: text(row.email),
    phone: text(row.phone),
    company: text(row.company),
    message: text(row.message),
    consent: { at: text(row.consent_at), version: text(row.consent_version) },
    sourcePath: text(row.source_path),
    mapLink: text(row.detail_map_link),
    accessNotes: text(row.detail_access_notes),
    certificateName: text(row.detail_certificate_name),
    hasAccount: typeof row.user_id === "string" && row.user_id.length > 0,
  };
}

export type SiteLabel = { name: string | null; region: string | null };

export function requestItemOf(row: Row, site: SiteLabel | null, canUpdate: boolean, contact: Row | undefined): RequestItem {
  const landId = text(row.land_id);
  const items = Array.isArray(row.seed_items) ? (row.seed_items as unknown[]) : [];
  return {
    id: textOr(row.id),
    requestNo: textOr(row.request_no),
    type: textOr(row.type) as RequestType,
    status: textOr(row.status) as RequestStatus,
    locale: (["tr", "en", "ru"].includes(textOr(row.locale)) ? row.locale : "tr") as "tr" | "en" | "ru",
    createdAt: textOr(row.created_at),
    updatedAt: textOr(row.updated_at),
    site: landId ? { id: landId, name: site?.name ?? null, region: site?.region ?? null } : null,
    totalSeeds: num(row.total_seeds),
    seedItems: items.map((i) => {
      const r = record(i);
      return { slug: textOr(r.slug), name: textOr(r.name), quantity: num(r.quantity) ?? 0 };
    }),
    details: detailsOf(row),
    adminNote: text(row.admin_note),
    lastHandled: { adminId: text(row.handled_by), at: text(row.handled_at) },
    canUpdate,
    ...(contact ? { contact: contactOf(contact) } : {}),
  };
}
