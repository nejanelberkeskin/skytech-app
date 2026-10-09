/**
 * Yönetim panelindeki sipariş listesi — YALNIZ SUNUCU (service role). Sözleşme: web-brifler/27 §4.3.
 *
 * Kapsam filtresi sorguya eklenir (bütün tabloyu okuyup JS'de süzme yok): liste, toplam, durum sayaçları,
 * uyarılar, süzgeç ve arama aynı kapsamla çalışır. Süzgeç ve uyarılar veritabanında, sınırsız çalışır
 * (kimlik listesi kırpması yok). İletişim ve finans alanları ana sorguda seçilmez: sayfadaki kimlikler için,
 * yalnız ilgili grubun saha kapsamındaki kayıtlarla ayrı sorgulanır. Alt sorgu hatası `unavailable` olur.
 * Bu modül yazma yapmaz ve hiçbir zamanlanmış işi tetiklemez.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EffectiveAccess } from "@/lib/admin/permissions";
import { groupCoversRead, groupScope, type OrderGroup, type ReadScope } from "./admin-access";
import { listItemOf, type OrderListDto } from "./admin-dto";
import { duplicateChargesFrom } from "./duplicates";
import { ORDER_STATUSES, type OrderStatus } from "./types";

export const ORDER_FLAGS = ["refund_pending", "invoice_pending", "duplicate", "capacity", "payment_review"] as const;
export type OrderFlag = (typeof ORDER_FLAGS)[number];

/** Süzgeç ve uyarı hangi grubun iznini ister (27 §4.3). `order`: her okuyucu. */
export const FLAG_GROUP: Record<OrderFlag, OrderGroup> = {
  capacity: "order",
  refund_pending: "finance",
  payment_review: "finance",
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

/** Çift tahsilat olayları sayfa sayfa okunur (kırpma yok); kimlik parçaları URL sınırı için küçük tutulur. */
const EVENT_PAGE = 1000;
const ID_CHUNK = 100;

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

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/** Arama metnini sorgu süzgecine güvenli hâle getirir (virgül, parantez, joker yok). */
export function sanitizeSearch(q: string | null): string | null {
  if (!q) return null;
  const clean = q.replace(/[^\p{L}\p{N}@+.\s-]/gu, "").trim().slice(0, 60);
  return clean.length >= 2 ? clean : null;
}

/** Bayrak için görünür kapsam: okuma kapsamı ∩ ilgili grubun kapsamı; izin yoksa null. */
export function flagScope(access: EffectiveAccess, flag: OrderFlag, read: ReadScope): ReadScope | null {
  const group = FLAG_GROUP[flag];
  return group === "order" ? read : groupScope(access, group, read);
}

/**
 * Supabase sorgu kurucusunun kullandığımız alt kümesi. Kurucunun genel tipleri süzgeç yardımcılarında
 * aşırı derin tip çıkarımına yol açtığından (TS2589) yardımcılar bu dar arayüzle çalışır.
 */
interface Filterable {
  in(column: string, values: readonly string[]): Filterable;
  eq(column: string, value: unknown): Filterable;
  or(filters: string): Filterable;
}
const narrow = <T>(q: T) => q as unknown as Filterable;
const widen = <T>(q: Filterable) => q as unknown as T;

/** Bayrağın sipariş tablosu üzerindeki süzgeci; ilişkili tablo `!inner` birleştirmeyle (27 §4.3). */
const FLAG_EMBED: Partial<Record<OrderFlag, string>> = {
  refund_pending: "order_refunds!inner(id)",
  invoice_pending: "order_invoices!inner(id)",
};

function applyFlag(q: Filterable, flag: OrderFlag, scope: ReadScope): Filterable {
  let out = scope.kind === "sites" ? q.in("land_id", scope.siteIds) : q;
  if (flag === "payment_review") out = out.eq("payment_meta->>paymentReviewRequired", "true");
  if (flag === "capacity") out = out.eq("payment_meta->>capacityHeld", "false");
  if (flag === "refund_pending") out = out.in("order_refunds.status", ["pending", "failed"]);
  if (flag === "invoice_pending") out = out.eq("order_invoices.status", "pending");
  return out;
}

/**
 * Okuma kapsamı, deneme/durum süzgeci ve arama. Arama: sipariş no, ad, soyad, sertifika adı, şirket unvanı
 * (temel okuma verisi). E-posta ve telefon yalnız iletişim kapsamı okuma kapsamını tamamen kapsıyorsa.
 */
function applyFilters(q: Filterable, read: ReadScope, params: OrderListParams, contactSearch: boolean): Filterable {
  let out = read.kind === "sites" ? q.in("land_id", read.siteIds) : q;
  if (params.test === "only") out = out.eq("is_test", true);
  if (params.test === "hide") out = out.eq("is_test", false);
  if (params.status) out = out.eq("status", params.status);
  if (params.q) {
    const like = `%${params.q}%`;
    const filters = [
      `order_no.ilike.${like.toUpperCase()}`,
      `buyer_first_name.ilike.${like}`,
      `buyer_last_name.ilike.${like}`,
      `certificate_name.ilike.${like}`,
      `invoice->>companyTitle.ilike.${like}`,
    ];
    if (contactSearch) {
      filters.push(`buyer_email.ilike.${like}`);
      const digits = params.q.replace(/[^\d]/g, "").replace(/^0+/, "");
      if (digits.length >= 3) filters.push(`buyer_phone.ilike.%${digits}%`);
    }
    out = out.or(filters.join(","));
  }
  return out;
}

/**
 * İade edilmemiş çift tahsilatı olan siparişler (kapsam içinde, tamamı). Çift tahsilat olayları küçük bir
 * kümedir; ödeme kimliğiyle eşleşen iade düşülür (anti-join SQL'de tek sorguyla ifade edilemiyor).
 */
async function duplicateOrderIds(db: Db, scope: ReadScope): Promise<string[]> {
  const byOrder = new Map<string, { type: string; data: Row | null }[]>();
  let after = 0;
  for (;;) {
    let q = db
      .from("order_events")
      .select("id, order_id, type, data, release_orders!inner(land_id)")
      .in("type", ["payment_succeeded", "refund_succeeded"])
      .eq("data->>duplicate", "true")
      .gt("id", after)
      .order("id", { ascending: true })
      .limit(EVENT_PAGE);
    if (scope.kind === "sites") q = q.in("release_orders.land_id", scope.siteIds);
    const rows = data<{ id: number; order_id: string; type: string; data: Row | null }>(await q);
    for (const e of rows) {
      const list = byOrder.get(e.order_id) ?? [];
      list.push({ type: e.type, data: e.data });
      byOrder.set(e.order_id, list);
    }
    if (rows.length < EVENT_PAGE) break;
    after = Number(rows[rows.length - 1].id);
  }
  return [...byOrder.entries()].filter(([, events]) => duplicateChargesFrom(events).some((c) => !c.refunded)).map(([id]) => id);
}

/** Uyarı sayısı: kapsam içindeki bütün eşleşmeler, veritabanında sayılır (kırpma yok). */
async function alertCount(db: Db, flag: OrderFlag, scope: ReadScope): Promise<number> {
  if (flag === "duplicate") return (await duplicateOrderIds(db, scope)).length;
  const select = ["id", FLAG_EMBED[flag]].filter(Boolean).join(", ");
  const q = applyFlag(narrow(db.from("release_orders").select(select, { count: "exact", head: true })), flag, scope);
  return exactCount(await widen<Promise<{ count: number | null; error: unknown }>>(q));
}

/** Sayfadaki kimlikler için grup alanları; yalnız grubun saha kapsamındaki kayıtlar sorgulanır. */
async function groupFields(db: Db, columns: string[], ids: string[], scope: ReadScope | null): Promise<Map<string, Row>> {
  if (!scope || ids.length === 0) return new Map();
  let q = db.from("release_orders").select(["id", ...columns].join(", ")).in("id", ids);
  if (scope.kind === "sites") q = q.in("land_id", scope.siteIds);
  return new Map(data(await q).map((r) => [String(r.id), r]));
}

export async function loadOrderList(db: Db, access: EffectiveAccess, read: ReadScope, params: OrderListParams): Promise<OrderListDto | null> {
  const contact = groupScope(access, "contact", read);
  const finance = groupScope(access, "finance", read);
  const invoices = groupScope(access, "invoices", read);
  const contactSearch = groupCoversRead(contact, read);
  const from = (params.page - 1) * params.pageSize;

  try {
    // ── Sayfa ve toplam ────────────────────────────────────────────────────
    let rows: Row[];
    let total: number;
    const flagSc = params.flag ? flagScope(access, params.flag, read) : null;
    if (params.flag && !flagSc) throw new Error("flag_forbidden"); // route önceden denetler; buraya gelmemeli

    if (params.flag === "duplicate") {
      // Aday küme küçüktür; sıralama ve sayfalama BÜTÜN eşleşmeler üzerinden yapılır (kırpma yok).
      const candidates = await duplicateOrderIds(db, flagSc!);
      const matched: { id: string; created_at: string }[] = [];
      for (const chunk of chunks(candidates, ID_CHUNK)) {
        const q = applyFilters(narrow(db.from("release_orders").select("id, created_at").in("id", chunk)), read, params, contactSearch);
        matched.push(...data<{ id: string; created_at: string }>(await widen<Promise<{ data: unknown; error: unknown }>>(q)));
      }
      matched.sort((a, b) => (a.created_at === b.created_at ? (a.id < b.id ? 1 : -1) : a.created_at < b.created_at ? 1 : -1));
      total = matched.length;
      const pageIds = matched.slice(from, from + params.pageSize).map((r) => r.id);
      const byId = new Map<string, Row>();
      if (pageIds.length) for (const r of data(await db.from("release_orders").select(BASE_COLUMNS.join(", ")).in("id", pageIds))) byId.set(String(r.id), r);
      rows = pageIds.map((id) => byId.get(id)).filter((r): r is Row => !!r);
    } else {
      const select = [...BASE_COLUMNS, ...(params.flag && FLAG_EMBED[params.flag] ? [FLAG_EMBED[params.flag]!] : [])].join(", ");
      let q = applyFilters(narrow(
        db.from("release_orders").select(select, { count: "exact" })
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(from, from + params.pageSize - 1)
      ), read, params, contactSearch);
      if (params.flag) q = applyFlag(q, params.flag, flagSc!);
      const result = await widen<Promise<{ data: unknown; error: unknown; count: number | null }>>(q);
      rows = data(result);
      total = exactCount(result);
    }

    // ── Grup alanları, sayaçlar, uyarılar ─────────────────────────────────
    const ids = rows.map((r) => String(r.id));
    const alertFlags: OrderFlag[] = ["capacity", ...(finance ? (["refund_pending", "duplicate", "payment_review"] as const) : []), ...(invoices ? (["invoice_pending"] as const) : [])];
    const countFor = async (status: OrderStatus) => {
      let q = db.from("release_orders").select("id", { count: "exact", head: true }).eq("status", status);
      if (read.kind === "sites") q = q.in("land_id", read.siteIds);
      if (params.test === "only") q = q.eq("is_test", true);
      if (params.test === "hide") q = q.eq("is_test", false);
      return exactCount(await q);
    };
    const [contactRows, financeRows, alertValues, countValues] = await Promise.all([
      groupFields(db, ["buyer_email"], ids, contact),
      groupFields(db, ["total_kurus", "payment_provider"], ids, finance),
      Promise.all(alertFlags.map((flag) => alertCount(db, flag, flagScope(access, flag, read)!))),
      Promise.all(ORDER_STATUSES.map((s) => countFor(s))),
    ]);
    const alert = (flag: OrderFlag) => alertValues[alertFlags.indexOf(flag)];

    return {
      items: rows.map((row) => listItemOf(row, contactRows.get(String(row.id)), financeRows.get(String(row.id)))),
      total,
      page: params.page,
      pageSize: params.pageSize,
      counts: Object.fromEntries(ORDER_STATUSES.map((s, i) => [s, countValues[i]])) as Record<OrderStatus, number>,
      alerts: {
        capacity: alert("capacity"),
        ...(finance ? { paymentReview: alert("payment_review"), refundPending: alert("refund_pending"), duplicate: alert("duplicate") } : {}),
        ...(invoices ? { invoicePending: alert("invoice_pending") } : {}),
      },
      groups: ["order", ...(contact ? ["contact" as const] : []), ...(finance ? ["finance" as const] : [])],
      scope: read,
      search: { contactFields: contactSearch },
    };
  } catch {
    return null;
  }
}
