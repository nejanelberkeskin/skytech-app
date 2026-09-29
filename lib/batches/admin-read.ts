/**
 * Bırakma partileri yönetimi okuma — YALNIZ SUNUCU. Sözleşme: web-brifler/31.
 *
 * Parti okuma kapsamı (`batches.read`, sahaya göre) sorguya eklenir: parti listesi, saha seçenekleri,
 * sayaçlar ve bekleyen siparişler aynı kapsamda. Okuma hiçbir sipariş durumunu değiştirmez (kesinleştirme
 * zamanlanmış işin görevidir). Sayfalı okuma: PostgREST satır sınırı listeyi sessizce kesmez.
 * Alt sorgu hatası `null` → route 503 (sahte boş liste yok).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Assurance } from "@/lib/admin/mfa";
import type { EffectiveAccess, Permission } from "@/lib/admin/permissions";
import { permissionScope, scopeCovers, type RecordScope } from "@/lib/admin/record-scope";
import { groupScope, orderReadScope, readMfaState } from "@/lib/orders/admin-access";
import { nextSeason, seasonFor } from "@/lib/orders/schedule";
import {
  BATCH_COLUMNS, batchSummaryOf, orderColumns, orderRowOf,
  type BatchCapabilities, type BatchDetailDto, type BatchListDto, type BatchOrderGroup, type BatchSummary,
} from "./admin-dto";

type Db = SupabaseClient;
type Row = Record<string, unknown>;
class Unavailable extends Error {}

const PAGE = 1000;
/** Parti istatistiğine giren sipariş durumları (kesinleşmiş ve sonrası). */
const BATCH_STATUSES = ["confirmed", "scheduled", "released", "monitoring", "completed"];
const CANDIDATE_LIMIT = 500;

export interface ReadContext {
  access: EffectiveAccess;
  read: RecordScope;
  assurance: Assurance;
  enforced: boolean;
  satisfied: (permission: Permission) => boolean;
}

async function allRows(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Unavailable();
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

export function batchCapabilities(access: EffectiveAccess, landId: string): BatchCapabilities {
  const covers = (p: Permission) => scopeCovers(permissionScope(access, p), landId);
  return { plan: covers("batches.plan"), assign: covers("batches.assign"), release: covers("batches.release"), publish: covers("monitoring.publish") };
}

const mfaOf = (ctx: ReadContext) => ({ enforced: ctx.enforced, satisfied: ctx.satisfied("batches.release"), enrolled: ctx.assurance.enrolled });

export async function loadBatchList(db: Db, ctx: ReadContext): Promise<BatchListDto | null> {
  const { access, read } = ctx;
  try {
    const [batches, landsRes, orders, due] = await Promise.all([
      allRows((a, b) => {
        let q = db.from("release_batches").select(BATCH_COLUMNS).order("created_at", { ascending: false }).order("id", { ascending: false }).range(a, b);
        if (read.kind === "sites") q = q.in("land_id", read.siteIds);
        return q;
      }),
      (() => {
        let q = db.from("lands").select("id, name, status, is_public").order("name", { ascending: true });
        if (read.kind === "sites") q = q.in("id", read.siteIds);
        return q;
      })(),
      allRows((a, b) => {
        let q = db.from("release_orders").select("id, land_id, season_label, batch_id, quantity, status")
          .in("status", BATCH_STATUSES).order("id", { ascending: true }).range(a, b);
        if (read.kind === "sites") q = q.in("land_id", read.siteIds);
        return q;
      }),
      (() => {
        let q = db.from("release_orders").select("id", { count: "exact", head: true }).eq("status", "paid").lt("withdrawal_deadline", new Date().toISOString());
        if (read.kind === "sites") q = q.in("land_id", read.siteIds);
        return q;
      })(),
    ]);
    if (landsRes.error || due.error || typeof due.count !== "number") throw new Unavailable();
    const lands = (landsRes.data ?? []) as Row[];

    const landName = new Map(lands.map((l) => [String(l.id), typeof l.name === "string" ? l.name : null]));
    const stats = new Map<string, { orders: number; quantity: number }>();
    const waiting = new Map<string, { landId: string; seasonLabel: string; orders: number; quantity: number }>();
    for (const o of orders) {
      const quantity = Number(o.quantity) || 0;
      if (o.batch_id) {
        const s = stats.get(String(o.batch_id)) ?? { orders: 0, quantity: 0 };
        s.orders++;
        s.quantity += quantity;
        stats.set(String(o.batch_id), s);
      } else if (o.status === "confirmed") {
        const key = `${o.land_id}|${o.season_label}`;
        const w = waiting.get(key) ?? { landId: String(o.land_id), seasonLabel: String(o.season_label), orders: 0, quantity: 0 };
        w.orders++;
        w.quantity += quantity;
        waiting.set(key, w);
      }
    }

    const current = seasonFor();
    const planScope = permissionScope(access, "batches.plan");
    return {
      batches: batches.map((b) => batchSummaryOf(
        b, landName.get(String(b.land_id)) ?? null, stats.get(String(b.id)) ?? { orders: 0, quantity: 0 }, batchCapabilities(access, String(b.land_id))
      )),
      lands: lands.map((l) => ({
        id: String(l.id),
        name: typeof l.name === "string" ? l.name : null,
        status: typeof l.status === "string" ? l.status : null,
        isPublic: l.is_public === true,
        canPlan: scopeCovers(planScope, String(l.id)),
      })),
      seasons: [current.label, nextSeason(current).label],
      waiting: [...waiting.values()].map((w) => ({ ...w, landName: landName.get(w.landId) ?? null })),
      dueForConfirmation: due.count,
      scope: read,
      capabilities: { create: lands.some((l) => scopeCovers(planScope, String(l.id))) },
      mfa: mfaOf(ctx),
    };
  } catch {
    return null;
  }
}

/** Okuma kapsamındaki parti; yok ya da kapsam dışı → "not_found" (varlık sızmaz); hata → null. */
export async function loadBatchRow(db: Db, read: RecordScope, id: string): Promise<Row | "not_found" | null> {
  let q = db.from("release_batches").select(BATCH_COLUMNS).eq("id", id);
  if (read.kind === "sites") q = q.in("land_id", read.siteIds);
  const { data, error } = await q.maybeSingle();
  if (error) return null;
  return data ? (data as unknown as Row) : "not_found";
}

/** Tek partinin özeti (saha adı + sipariş sayısı/adet). Okunamazsa null. */
export async function loadBatchSummary(db: Db, access: EffectiveAccess, batch: Row): Promise<BatchSummary | null> {
  try {
    const [land, orders] = await Promise.all([
      db.from("lands").select("id, name").eq("id", String(batch.land_id)).maybeSingle(),
      allRows((a, b) => db.from("release_orders").select("quantity").eq("batch_id", String(batch.id)).order("id", { ascending: true }).range(a, b)),
    ]);
    if (land.error) throw new Unavailable();
    const name = land.data && typeof (land.data as Row).name === "string" ? String((land.data as Row).name) : null;
    const stats = { orders: orders.length, quantity: orders.reduce((s, o) => s + (Number(o.quantity) || 0), 0) };
    return batchSummaryOf(batch, name, stats, batchCapabilities(access, String(batch.land_id)));
  } catch {
    return null;
  }
}

/**
 * Parti ayrıntısı. Sipariş satırının `contact`/`finance`/`certificate` grupları 27'deki kuralla açılır:
 * grup izni ∩ `orders.read`, ikisi de partinin sahasını kapsamalı; hassas grup (özel sertifika) zorlama
 * açıkken taze yeniden doğrulama ister. Kapalı grubun kolonu sorgulanmaz.
 */
export async function loadBatchDetail(db: Db, ctx: ReadContext, batch: Row): Promise<BatchDetailDto | null> {
  const { access } = ctx;
  const landId = String(batch.land_id);
  const ordersRead = orderReadScope(access);
  const mfa = readMfaState(ctx.enforced, ctx.assurance, ctx.satisfied);
  const groups = new Set<BatchOrderGroup>(["order"]);
  const mfaRequired: BatchOrderGroup[] = [];
  if (ordersRead && scopeCovers(ordersRead, landId)) {
    for (const group of ["contact", "finance", "certificate"] as const) {
      if (!scopeCovers(groupScope(access, group, ordersRead), landId)) continue;
      if (mfa.blocked.has(group)) mfaRequired.push(group);
      else groups.add(group);
    }
  }
  const columns = orderColumns(groups);
  const showCapacity = scopeCovers(permissionScope(access, "sites.read"), landId);

  try {
    const [orders, candidates, land] = await Promise.all([
      allRows((a, b) => db.from("release_orders").select(columns).eq("batch_id", String(batch.id))
        .order("created_at", { ascending: true }).order("id", { ascending: true }).range(a, b)),
      batch.released_on
        ? Promise.resolve({ data: [], error: null })
        : db.from("release_orders").select(columns).eq("status", "confirmed").is("batch_id", null).eq("land_id", landId)
          .eq("season_label", String(batch.season_label)).order("confirmed_at", { ascending: true }).order("id", { ascending: true })
          .limit(CANDIDATE_LIMIT + 1),
      db.from("lands").select(showCapacity ? "id, name, capacity_seeds, filled_seeds, reserved_seeds" : "id, name").eq("id", landId).maybeSingle(),
    ]);
    if (candidates.error || land.error) throw new Unavailable();
    const candidateRows = (candidates.data ?? []) as Row[];
    const landRow = (land.data ?? {}) as Row;
    const name = typeof landRow.name === "string" ? landRow.name : null;
    const stats = { orders: orders.length, quantity: orders.reduce((s, o) => s + (Number(o.quantity) || 0), 0) };
    return {
      batch: batchSummaryOf(batch, name, stats, batchCapabilities(access, landId)),
      land: {
        id: landId,
        name,
        ...(showCapacity && land.data
          ? { capacity: { total: Number(landRow.capacity_seeds) || 0, filled: Number(landRow.filled_seeds) || 0, reserved: Number(landRow.reserved_seeds) || 0 } }
          : {}),
      },
      orders: orders.map((o) => orderRowOf(o, groups)),
      candidates: candidateRows.slice(0, CANDIDATE_LIMIT).map((o) => orderRowOf(o, groups)),
      candidatesTruncated: candidateRows.length > CANDIDATE_LIMIT,
      groups: [...groups],
      mfaRequiredGroups: mfaRequired,
      mfa: mfaOf(ctx),
    };
  } catch {
    return null;
  }
}

/** Eylemin kaynak siparişleri: yalnız parti okuma kapsamındakiler döner (kapsam dışı ya da yok → eksik sayılır). */
export async function sourceOrders(db: Db, read: RecordScope, ids: string[]): Promise<Row[] | null> {
  let q = db.from("release_orders").select("id, land_id, batch_id").in("id", ids);
  if (read.kind === "sites") q = q.in("land_id", read.siteIds);
  const { data, error } = await q;
  return error ? null : ((data ?? []) as Row[]);
}
