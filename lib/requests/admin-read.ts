/**
 * Talep yönetimi okuma ve güncelleme servisi — YALNIZ SUNUCU. Sözleşme: web-brifler/29.
 *
 * Okuma kapsamı sorguya eklenir (liste, toplam, sayaç, arama). İletişim alanları ana sorguda seçilmez:
 * sayfadaki kimlikler için yalnız iletişim grubunun kapsamındaki kayıtlarla ayrı sorgulanır.
 * Güncellemede kapsam koşulu UPDATE sorgusunun içindedir; kayıt arada kapsam dışına çıkarsa uygulanmaz.
 * Alt sorgu hatası `null` → route 503 döner (sahte boş liste/0 yok).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EffectiveAccess } from "@/lib/admin/permissions";
import { coversScope, intersectScopes, permissionScope, scopeCovers, type RecordScope } from "@/lib/admin/record-scope";
import {
  REQUEST_BASE_COLUMNS, REQUEST_CONTACT_COLUMNS, requestItemOf,
  type RequestItem, type SiteLabel, type RequestListDto, type RequestStatus, type RequestType,
} from "./admin-dto";
import { REQUEST_STATUSES } from "./schema";

type Db = SupabaseClient;
type Row = Record<string, unknown>;
class Unavailable extends Error {}

function rows(result: { data: unknown; error: unknown }): Row[] {
  if (result.error) throw new Unavailable();
  return (result.data ?? []) as Row[];
}
function exactCount(result: { count?: number | null; error?: unknown }): number {
  if (result.error || typeof result.count !== "number" || !Number.isSafeInteger(result.count) || result.count < 0) throw new Unavailable();
  return result.count;
}

export function sanitizeRequestSearch(q: string | null): string | null {
  if (!q) return null;
  const clean = q.replace(/[^\p{L}\p{N}@+.\s-]/gu, "").trim().slice(0, 60);
  return clean.length >= 2 ? clean : null;
}

export interface RequestListParams {
  status: RequestStatus | null;
  type: RequestType | null;
  q: string | null;
  page: number;
  pageSize: number;
}

/** Aktörün bu modüldeki kapsamları: okuma, iletişim (∩ okuma), güncelleme. */
export function requestScopes(access: EffectiveAccess, read: RecordScope) {
  return {
    read,
    contact: intersectScopes(permissionScope(access, "customers.contact.read"), read),
    update: permissionScope(access, "requests.update"),
  };
}

async function siteLabels(db: Db, landIds: string[]): Promise<Map<string, SiteLabel>> {
  const ids = [...new Set(landIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return new Map(rows(await db.from("lands").select("id, name, region").in("id", ids)).map((r) => [String(r.id), { name: str(r.name), region: str(r.region) }]));
}

async function contactRows(db: Db, ids: string[], contact: RecordScope | null): Promise<Map<string, Row>> {
  if (!contact || !ids.length) return new Map();
  let q = db.from("service_requests").select(REQUEST_CONTACT_COLUMNS.join(", ")).in("id", ids);
  if (contact.kind === "sites") q = q.in("land_id", contact.siteIds);
  return new Map(rows(await q).map((r) => [String(r.id), r]));
}

async function items(db: Db, base: Row[], scopes: ReturnType<typeof requestScopes>): Promise<RequestItem[]> {
  const ids = base.map((r) => String(r.id));
  const [names, contacts] = await Promise.all([
    siteLabels(db, base.map((r) => (typeof r.land_id === "string" ? r.land_id : ""))),
    contactRows(db, ids, scopes.contact),
  ]);
  return base.map((r) => {
    const landId = typeof r.land_id === "string" ? r.land_id : null;
    return requestItemOf(r, landId ? names.get(landId) ?? null : null, scopeCovers(scopes.update, landId), contacts.get(String(r.id)));
  });
}

export async function loadRequestList(db: Db, access: EffectiveAccess, read: RecordScope, params: RequestListParams): Promise<RequestListDto | null> {
  const scopes = requestScopes(access, read);
  const contactSearch = coversScope(scopes.contact, read);
  try {
    const from = (params.page - 1) * params.pageSize;
    let q = db.from("service_requests").select(REQUEST_BASE_COLUMNS.join(", "), { count: "exact" })
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(from, from + params.pageSize - 1);
    if (read.kind === "sites") q = q.in("land_id", read.siteIds);
    if (params.status) q = q.eq("status", params.status);
    if (params.type) q = q.eq("type", params.type);
    if (params.q) {
      const like = `%${params.q}%`;
      const filters = [`request_no.ilike.${like.toUpperCase()}`];
      // İletişim alanlarıyla arama yalnız iletişim kapsamı okuma kapsamının tamamını kapsıyorsa (29 §4).
      if (contactSearch) {
        filters.push(`contact_name.ilike.${like}`, `email.ilike.${like}`, `company.ilike.${like}`);
        const digits = params.q.replace(/[^\d]/g, "").replace(/^0+/, "");
        if (digits.length >= 3) filters.push(`phone.ilike.%${digits}%`);
      }
      q = q.or(filters.join(","));
    }

    const countFor = async (status: RequestStatus) => {
      let c = db.from("service_requests").select("id", { count: "exact", head: true }).eq("status", status);
      if (read.kind === "sites") c = c.in("land_id", read.siteIds);
      return exactCount(await c);
    };
    const [list, ...countValues] = await Promise.all([q, ...REQUEST_STATUSES.map((s) => countFor(s))]);
    const base = rows(list);
    return {
      items: await items(db, base, scopes),
      total: exactCount(list as { count?: number | null; error?: unknown }),
      page: params.page,
      pageSize: params.pageSize,
      counts: Object.fromEntries(REQUEST_STATUSES.map((s, i) => [s, countValues[i]])) as Record<RequestStatus, number>,
      groups: ["request", ...(scopes.contact ? ["contact" as const] : [])],
      scope: read,
      search: { contactFields: contactSearch },
      capabilities: { update: !!scopes.update },
    };
  } catch {
    return null;
  }
}

/** Okuma kapsamındaki tek kayıt; kapsam dışı ya da yok → "not_found". */
export async function loadRequestItem(db: Db, access: EffectiveAccess, read: RecordScope, id: string): Promise<RequestItem | "not_found" | null> {
  try {
    let q = db.from("service_requests").select(REQUEST_BASE_COLUMNS.join(", ")).eq("id", id);
    if (read.kind === "sites") q = q.in("land_id", read.siteIds);
    const found = rows(await q);
    if (!found.length) return "not_found";
    return (await items(db, found, requestScopes(access, read)))[0];
  } catch {
    return null;
  }
}

export type RequestPatch = { status?: RequestStatus; admin_note?: string | null };
/** `ok: true` = güncelleme UYGULANDI (audit yazılmalı); `item` yeniden okunamadıysa null. */
export type UpdateResult =
  | { ok: true; item: RequestItem | null }
  | { ok: false; error: "not_found" | "out_of_scope" | "unavailable" };

/**
 * Güncelleme. Önce okuma kapsamında aranır (yoksa not_found). Güncelleme kapsamı dışındaysa UPDATE hiç
 * gönderilmez (out_of_scope). UPDATE kapsam koşulunu yeniden taşır: arada saha değişirse uygulanmaz.
 * `handled_by` son işlem yapandır, atama değildir.
 */
export async function updateRequest(
  db: Db, access: EffectiveAccess, read: RecordScope, actorUserId: string, id: string, patch: RequestPatch
): Promise<UpdateResult> {
  const scopes = requestScopes(access, read);
  try {
    let lookup = db.from("service_requests").select("id, land_id").eq("id", id);
    if (read.kind === "sites") lookup = lookup.in("land_id", read.siteIds);
    const found = rows(await lookup)[0];
    if (!found) return { ok: false, error: "not_found" };
    const landId = typeof found.land_id === "string" ? found.land_id : null;
    if (!scopeCovers(scopes.update, landId)) return { ok: false, error: "out_of_scope" };

    let update = db.from("service_requests")
      .update({ ...patch, handled_by: actorUserId, handled_at: new Date().toISOString() })
      .eq("id", id);
    if (scopes.update!.kind === "sites") update = update.in("land_id", scopes.update!.siteIds);
    const updated = await update.select("id").maybeSingle();
    if (updated.error) return { ok: false, error: "unavailable" };
    if (!updated.data) return { ok: false, error: "not_found" };

    const item = await loadRequestItem(db, access, read, id);
    return { ok: true, item: item === null || item === "not_found" ? null : item };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
