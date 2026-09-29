/**
 * Yönetim panelindeki sipariş listesi — YALNIZ SUNUCU (service role). Sözleşme: web-brifler/27 §4.3.
 *
 * Kapsam filtresi sorguya eklenir (bütün tabloyu okuyup JS'de süzme yok): liste, toplam, durum sayaçları,
 * uyarılar, süzgeç ve arama aynı kapsamla çalışır. Hassas grup kolonları yalnız grup izni varsa seçilir ve
 * satır bazında grup kapsamına göre eklenir. Herhangi bir alt sorgu hatası `unavailable` olur; sahte 0 yok.
 * Bu modül yazma yapmaz; zamanlanmış işlerin tetiklenmesi route'ta ve yalnız tam kapsamlı okuyucuda.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EffectiveAccess } from "@/lib/admin/permissions";
import { groupCoversRead, groupScope, scopeCovers, type OrderGroup, type ReadScope } from "./admin-access";
import { listItemOf, type OrderListDto } from "./admin-dto";
import { duplicateChargesFrom } from "./duplicates";
import { ORDER_STATUSES, type OrderStatus } from "./types";

export const ORDER_FLAGS = ["refund_pending", "invoice_pending", "duplicate", "capacity"] as const;
export type OrderFlag = (typeof ORDER_FLAGS)[number];

/** Süzgeç ve uyarı hangi grubun iznini ister (27 §4.3). `order`: her okuyucu. */
export const FLAG_GROUP: Record<OrderFlag, OrderGroup> = {
  capacity: "order",
  refund_pending: "finance",
  duplicate: "finance",
  invoice_pending: "invoices",
};

export interface OrderListParams {
  status: OrderStatus | null;
  test: "all" | "only" | "hide";
  flag: OrderFlag | null;
  q: string | null;
  page: number;
  pageSize: number;
}

const BASE_COLUMNS = [
  "id", "order_no", "status", "is_test", "locale", "created_at", "paid_at", "quantity", "land_id",
  "buyer_type", "buyer_first_name", "buyer_last_name", "season_label", "batch_id",
  "withdrawal_deadline", "performance_deadline", "certificate_name",
  "site_name:site_snapshot->>name", "company_title:invoice->>companyTitle",
];

const FLAG_LIMIT = 2000;
const FILTER_LIMIT = 500;

type Db = SupabaseClient;
type Row = Record<string, unknown>;
class Unavailable extends Error {}

function data<T = Row>(result: { data: unknown; error: unknown }): T[] {
  if (result.error) throw new Unavailable();
  return (result.data ?? []) as T[];
}

function exactCount(result: { count?: number | null; error?: unknown }): number {
  if (result.error || typeof result.count !== "number" || !Number.isSafeInteger(result.count) || result.count < 0) throw new Unavailable();
  return result.count;
}

/** Arama metnini sorgu süzgecine güvenli hâle getirir (virgül, parantez, joker yok). */
export function sanitizeSearch(q: string | null): string | null {
  if (!q) return null;
  const clean = q.replace(/[^\p{L}\p{N}@+.\s-]/gu, "").trim().slice(0, 60);
  return clean.length >= 2 ? clean : null;
}

/**
 * Süzgeç/uyarı için kapsam içindeki sipariş kimlikleri. İlişkili tablolar siparişe iç birleştirmeyle
 * bağlanır; saha kapsamında birleştirilmiş siparişin `land_id`'sine göre süzülür.
 */
async function flaggedIds(db: Db, flag: OrderFlag, scope: ReadScope): Promise<string[]> {
  const sites = scope.kind === "sites" ? scope.siteIds : null;
  if (flag === "capacity") {
    let q = db.from("release_orders").select("id").eq("payment_meta->>capacityHeld", "false").limit(FLAG_LIMIT);
    if (sites) q = q.in("land_id", sites);
    return data<{ id: string }>(await q).map((r) => r.id);
  }
  if (flag === "refund_pending" || flag === "invoice_pending") {
    const table = flag === "refund_pending" ? "order_refunds" : "order_invoices";
    let q = db.from(table).select("order_id, release_orders!inner(land_id)").limit(FLAG_LIMIT);
    q = flag === "refund_pending" ? q.in("status", ["pending", "failed"]) : q.eq("status", "pending");
    if (sites) q = q.in("release_orders.land_id", sites);
    return [...new Set(data<{ order_id: string }>(await q).map((r) => r.order_id))];
  }
  let q = db
    .from("order_events")
    .select("order_id, type, data, release_orders!inner(land_id)")
    .in("type", ["payment_succeeded", "refund_succeeded"])
    .eq("data->>duplicate", "true")
    .limit(FLAG_LIMIT);
  if (sites) q = q.in("release_orders.land_id", sites);
  const byOrder = new Map<string, { type: string; data: Row | null }[]>();
  for (const e of data<{ order_id: string; type: string; data: Row | null }>(await q)) {
    const list = byOrder.get(e.order_id) ?? [];
    list.push({ type: e.type, data: e.data });
    byOrder.set(e.order_id, list);
  }
  return [...byOrder.entries()].filter(([, events]) => duplicateChargesFrom(events).some((c) => !c.refunded)).map(([id]) => id);
}

/** Bayrak için görünür kapsam: okuma kapsamı ∩ ilgili grubun kapsamı; izin yoksa null. */
export function flagScope(access: EffectiveAccess, flag: OrderFlag, read: ReadScope): ReadScope | null {
  const group = FLAG_GROUP[flag];
  return group === "order" ? read : groupScope(access, group, read);
}

export async function loadOrderList(db: Db, access: EffectiveAccess, read: ReadScope, params: OrderListParams): Promise<OrderListDto | null> {
  const contact = groupScope(access, "contact", read);
  const finance = groupScope(access, "finance", read);
  const invoices = groupScope(access, "invoices", read);
  const contactSearch = groupCoversRead(contact, read);

  try {
    const columns = [...BASE_COLUMNS, ...(contact ? ["buyer_email"] : []), ...(finance ? ["total_kurus", "payment_provider"] : [])];
    let query = db.from("release_orders").select(columns.join(", "), { count: "exact" })
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range((params.page - 1) * params.pageSize, params.page * params.pageSize - 1);
    if (read.kind === "sites") query = query.in("land_id", read.siteIds);
    if (params.test === "only") query = query.eq("is_test", true);
    if (params.test === "hide") query = query.eq("is_test", false);
    if (params.status) query = query.eq("status", params.status);
    if (params.flag) {
      const scope = flagScope(access, params.flag, read);
      if (!scope) throw new Error("flag_forbidden"); // route önceden denetler; buraya gelmemeli
      const ids = await flaggedIds(db, params.flag, scope);
      query = ids.length ? query.in("id", ids.slice(0, FILTER_LIMIT)) : query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
    if (params.q) {
      const like = `%${params.q}%`;
      const filters = [
        `order_no.ilike.${like.toUpperCase()}`,
        `buyer_first_name.ilike.${like}`,
        `buyer_last_name.ilike.${like}`,
        `certificate_name.ilike.${like}`,
      ];
      // İletişim alanlarıyla arama yalnız iletişim kapsamı okuma kapsamının tamamını kapsıyorsa: aksi hâlde
      // sonuç sayısından kapsam dışı kaydın e-postası/telefonu çıkarılabilir.
      if (contactSearch) {
        filters.push(`buyer_email.ilike.${like}`);
        const digits = params.q.replace(/[^\d]/g, "").replace(/^0+/, "");
        if (digits.length >= 3) filters.push(`buyer_phone.ilike.%${digits}%`);
      }
      query = query.or(filters.join(","));
    }

    const countFor = (status: OrderStatus) => {
      let q = db.from("release_orders").select("id", { count: "exact", head: true }).eq("status", status);
      if (read.kind === "sites") q = q.in("land_id", read.siteIds);
      if (params.test === "only") q = q.eq("is_test", true);
      if (params.test === "hide") q = q.eq("is_test", false);
      return q;
    };

    const alertFlags: OrderFlag[] = ["capacity", ...(finance ? (["refund_pending", "duplicate"] as const) : []), ...(invoices ? (["invoice_pending"] as const) : [])];
    const [listRes, alertIds, ...countRes] = await Promise.all([
      query,
      Promise.all(alertFlags.map((flag) => flaggedIds(db, flag, flagScope(access, flag, read)!))),
      ...ORDER_STATUSES.map((s) => countFor(s)),
    ]);

    const items = data(listRes).map((row) =>
      listItemOf(row, scopeCovers(contact, row.land_id as string), scopeCovers(finance, row.land_id as string)));
    const total = exactCount(listRes as { count?: number | null; error?: unknown });
    const counts = Object.fromEntries(ORDER_STATUSES.map((s, i) => [s, exactCount(countRes[i] as { count?: number | null; error?: unknown })])) as Record<OrderStatus, number>;
    const alertCount = (flag: OrderFlag) => alertIds[alertFlags.indexOf(flag)].length;

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      counts,
      alerts: {
        capacity: alertCount("capacity"),
        ...(finance ? { refundPending: alertCount("refund_pending"), duplicate: alertCount("duplicate") } : {}),
        ...(invoices ? { invoicePending: alertCount("invoice_pending") } : {}),
      },
      groups: ["order", ...(contact ? ["contact" as const] : []), ...(finance ? ["finance" as const] : [])],
      scope: read,
      search: { contactFields: contactSearch },
    };
  } catch {
    return null;
  }
}
