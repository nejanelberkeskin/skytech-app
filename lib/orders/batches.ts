/**
 * Bırakma partileri — YALNIZ SUNUCU (service role).
 *
 * Parti = bir sahada, bir sezonda, aynı gün yapılacak bırakma çalışması. Yalnız `confirmed`
 * (cayma süresi dolmuş) siparişler partiye alınır → `scheduled`. Parti "bırakıldı" işaretlenince
 * içindeki siparişler `released` olur, sahada ayrılan kapasite kalıcıya (`filled_seeds`) geçer ve
 * fatura zamanı "bırakmada" ise siparişler fatura kuyruğuna girer. Bu adım GERİ ALINAMAZ.
 *
 * Katılım Sertifikası ve müşteri bildirimi Faz 6'da bu adımın üstüne eklenecek.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { trToday } from "./schedule";
import { getSalesSettings } from "./settings";
import { addOrderEvent, db, transitionOrder } from "./store";
import type { OrderActor, ReleaseOrderRow } from "./types";

export type BatchError =
  | "not_found"
  | "invalid_state" //     parti zaten bırakılmış / sipariş uygun durumda değil
  | "mismatch" //          sipariş başka sahaya ya da sezona ait
  | "capacity_not_held" // geç ödenmiş, kapasitesi ayrılamamış sipariş partiye alınamaz
  | "invalid_date"
  | "empty"
  | "unavailable";

export type BatchResult<T = object> = ({ ok: true } & T) | { ok: false; error: BatchError; detail?: string };

const actorOf = (adminUserId: string): OrderActor => `admin:${adminUserId}`;
const SEASON_RE = /^\d{4}-\d{4}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface BatchInput {
  landId: string;
  seasonLabel: string;
  title: string | null;
  plannedOn: string | null;
  notes: string | null;
}

export interface BatchRow {
  id: string;
  land_id: string;
  season_label: string;
  title: string | null;
  planned_on: string | null;
  released_on: string | null;
  video_url: string | null;
  video_published_at: string | null;
  notes: string | null;
  created_at: string;
}

async function getBatch(supabase: SupabaseClient, id: string): Promise<BatchRow | null> {
  const { data, error } = await supabase.from("release_batches").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`parti okunamadı: ${error.code}`);
  return (data as BatchRow | null) ?? null;
}

export async function createBatch(input: BatchInput, adminUserId: string, supabase: SupabaseClient = db()): Promise<BatchResult<{ batch: BatchRow }>> {
  if (!SEASON_RE.test(input.seasonLabel) || (input.plannedOn && !DAY_RE.test(input.plannedOn))) return { ok: false, error: "invalid_date" };
  const land = await supabase.from("lands").select("id").eq("id", input.landId).maybeSingle();
  if (land.error) return { ok: false, error: "unavailable" };
  if (!land.data) return { ok: false, error: "not_found" };
  const { data, error } = await supabase
    .from("release_batches")
    .insert({ land_id: input.landId, season_label: input.seasonLabel, title: input.title, planned_on: input.plannedOn, notes: input.notes, created_by: adminUserId })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "unavailable" };
  return { ok: true, batch: data as BatchRow };
}

export async function updateBatch(
  id: string,
  patch: { title?: string | null; plannedOn?: string | null; notes?: string | null },
  supabase: SupabaseClient = db()
): Promise<BatchResult<{ batch: BatchRow }>> {
  const batch = await getBatch(supabase, id);
  if (!batch) return { ok: false, error: "not_found" };
  if (patch.plannedOn && !DAY_RE.test(patch.plannedOn)) return { ok: false, error: "invalid_date" };
  // Bırakılmış partinin planı değişmez; başlık ve not düzeltilebilir.
  if (batch.released_on && patch.plannedOn !== undefined && patch.plannedOn !== batch.planned_on) return { ok: false, error: "invalid_state" };
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.plannedOn !== undefined) update.planned_on = patch.plannedOn;
  if (patch.notes !== undefined) update.notes = patch.notes;
  const { data, error } = await supabase.from("release_batches").update(update).eq("id", id).select("*").single();
  if (error || !data) return { ok: false, error: "unavailable" };
  return { ok: true, batch: data as BatchRow };
}

/** Hiçbir siparişin bağlı olmadığı parti silinebilir (yanlış açılan kayıt, deneme temizliği sonrası boş kalan parti). */
export async function deleteBatch(id: string, supabase: SupabaseClient = db()): Promise<BatchResult> {
  const batch = await getBatch(supabase, id);
  if (!batch) return { ok: false, error: "not_found" };
  const used = await supabase.from("release_orders").select("id", { count: "exact", head: true }).eq("batch_id", id);
  if (used.error) return { ok: false, error: "unavailable" };
  if ((used.count ?? 0) > 0) return { ok: false, error: "invalid_state", detail: "partide sipariş var" };
  const { error } = await supabase.from("release_batches").delete().eq("id", id);
  return error ? { ok: false, error: "unavailable" } : { ok: true };
}

/** Kesinleşmiş siparişleri partiye alır. Uygun olmayanlar atlanmaz: biri bile uygunsuzsa hiçbiri alınmaz. */
export async function assignOrders(batchId: string, orderIds: string[], adminUserId: string, supabase: SupabaseClient = db()): Promise<BatchResult<{ assigned: number }>> {
  if (orderIds.length === 0) return { ok: false, error: "empty" };
  const batch = await getBatch(supabase, batchId);
  if (!batch) return { ok: false, error: "not_found" };
  if (batch.released_on) return { ok: false, error: "invalid_state" };

  const { data, error } = await supabase.from("release_orders").select("id, order_no, status, land_id, season_label, batch_id, payment_meta").in("id", orderIds);
  if (error) return { ok: false, error: "unavailable" };
  const orders = data ?? [];
  if (orders.length !== new Set(orderIds).size) return { ok: false, error: "not_found" };
  for (const o of orders) {
    if (o.status !== "confirmed" || o.batch_id) return { ok: false, error: "invalid_state", detail: o.order_no as string };
    if (o.land_id !== batch.land_id || o.season_label !== batch.season_label) return { ok: false, error: "mismatch", detail: o.order_no as string };
    if ((o.payment_meta as Record<string, unknown> | null)?.capacityHeld === false) return { ok: false, error: "capacity_not_held", detail: o.order_no as string };
  }

  const at = new Date().toISOString();
  let assigned = 0;
  for (const o of orders) {
    const moved = await transitionOrder(supabase, o.id as string, ["confirmed"], "scheduled", { batch_id: batch.id, scheduled_at: at });
    if (!moved) continue; // bu arada durumu değişti (ör. satıcı iptali)
    await addOrderEvent(supabase, moved.id, "batch_assigned", actorOf(adminUserId), { batchId: batch.id, title: batch.title, plannedOn: batch.planned_on });
    assigned++;
  }
  return { ok: true, assigned };
}

export async function unassignOrder(orderId: string, adminUserId: string, supabase: SupabaseClient = db()): Promise<BatchResult> {
  const { data: order, error } = await supabase.from("release_orders").select("id, status, batch_id").eq("id", orderId).maybeSingle();
  if (error) return { ok: false, error: "unavailable" };
  if (!order) return { ok: false, error: "not_found" };
  if (order.status !== "scheduled" || !order.batch_id) return { ok: false, error: "invalid_state" };
  const batch = await getBatch(supabase, order.batch_id as string);
  if (batch?.released_on) return { ok: false, error: "invalid_state" };
  const moved = await transitionOrder(supabase, order.id as string, ["scheduled"], "confirmed", { batch_id: null, scheduled_at: null });
  if (!moved) return { ok: false, error: "invalid_state" };
  await addOrderEvent(supabase, moved.id, "status_changed", actorOf(adminUserId), { from: "scheduled", to: "confirmed", reason: "batch_unassigned", batchId: order.batch_id });
  return { ok: true };
}

/**
 * Partiyi "bırakıldı" işaretler — GERİ ALINAMAZ. Parti önce sahiplenilir (released_on yalnız NULL iken
 * yazılır): aynı anda gelen ikinci istek siparişleri ikinci kez işleyemez.
 */
export async function completeRelease(batchId: string, releasedOn: string, adminUserId: string, supabase: SupabaseClient = db()): Promise<BatchResult<{ released: number; skipped: string[] }>> {
  if (!DAY_RE.test(releasedOn) || releasedOn > trToday()) return { ok: false, error: "invalid_date" };
  const batch = await getBatch(supabase, batchId);
  if (!batch) return { ok: false, error: "not_found" };
  if (batch.released_on) return { ok: false, error: "invalid_state" };

  const { data: orders, error } = await supabase.from("release_orders").select("*").eq("batch_id", batchId).eq("status", "scheduled");
  if (error) return { ok: false, error: "unavailable" };
  if (!orders?.length) return { ok: false, error: "empty" };
  // Cayma süresi dolmadan bırakma yapılamaz (sözleşme + mevzuat). `scheduled` olması bunu zaten
  // gerektirir; tarih de ayrıca denetlenir.
  const tooEarly = (orders as ReleaseOrderRow[]).find((o) => o.withdrawal_deadline && trToday(new Date(o.withdrawal_deadline)) >= releasedOn);
  if (tooEarly) return { ok: false, error: "invalid_date", detail: `${tooEarly.order_no}: cayma süresi bırakma tarihinde dolmamış` };

  const claimed = await supabase.from("release_batches").update({ released_on: releasedOn }).eq("id", batchId).is("released_on", null).select("id").maybeSingle();
  if (claimed.error) return { ok: false, error: "unavailable" };
  if (!claimed.data) return { ok: false, error: "invalid_state" };

  const settings = await getSalesSettings();
  const releasedAt = new Date(`${releasedOn}T09:00:00Z`).toISOString(); // İstanbul 12:00 — gün kaymaz
  const skipped: string[] = [];
  let released = 0;
  for (const order of orders as ReleaseOrderRow[]) {
    const moved = await transitionOrder(supabase, order.id, ["scheduled"], "released", { released_at: releasedAt });
    if (!moved) {
      skipped.push(order.order_no);
      continue;
    }
    await supabase.rpc("commit_reserved_capacity", { p_land_id: moved.land_id, p_quantity: moved.quantity });
    await addOrderEvent(supabase, moved.id, "release_completed", actorOf(adminUserId), { batchId, releasedOn });
    if (settings.invoiceTiming === "on_performance") {
      const open = await supabase.from("order_invoices").select("id").eq("order_id", moved.id).eq("kind", "sale").in("status", ["pending", "issued"]).limit(1);
      if (!open.data?.length) await supabase.from("order_invoices").insert({ order_id: moved.id, kind: "sale", provider: "manual", status: "pending", created_by: "system" });
    }
    released++;
  }
  return { ok: true, released, skipped };
}
