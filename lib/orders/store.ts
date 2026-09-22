/**
 * Sipariş tablolarına erişim — YALNIZ SUNUCU (service role).
 *
 * Durum değişiklikleri KOŞULLU UPDATE ile yapılır: "şu durumdaysa şuna çevir".
 * Böylece eşzamanlı iki istek (ör. ödeme dönüşü ile süre dolumu) aynı siparişi
 * iki kez işleyemez; kazanan tek istek olur, diğeri `null` alır.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { assertTransition } from "./state";
import type { OrderActor, OrderEventType, OrderStatus, ReleaseOrderRow } from "./types";

export const db = (): SupabaseClient => createServiceRoleClient();

export async function addOrderEvent(
  supabase: SupabaseClient,
  orderId: string,
  type: OrderEventType,
  actor: OrderActor,
  data: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.from("order_events").insert({ order_id: orderId, type, actor, data });
  // Denetim izi yazılamadıysa akışı düşürme ama mutlaka logla (kişisel veri olmadan).
  if (error) console.error(`[siparis] olay yazılamadı (${type}):`, error.code);
}

export async function getOrderByNo(supabase: SupabaseClient, orderNo: string): Promise<ReleaseOrderRow | null> {
  const { data, error } = await supabase.from("release_orders").select("*").eq("order_no", orderNo).maybeSingle();
  if (error) throw new Error(`siparis okunamadı: ${error.code}`);
  return (data as ReleaseOrderRow | null) ?? null;
}

/** Ödeme belirtecinin denetim izinde tutulan özeti (belirtecin kendisi olaylara yazılmaz). */
export const paymentTokenHash = (token: string) => createHash("sha256").update(token).digest("hex").slice(0, 40);

/**
 * Siparişi ödeme belirtecinden bulur. Müşteri ödemeyi yeniden başlattıysa siparişte yalnız
 * SON belirteç durur; eski sekmede tamamlanan bir ödemenin dönüşü eski belirteçle gelir.
 * O durumda sipariş, `payment_started` olaylarındaki belirteç özetinden bulunur — tahsil
 * edilmiş bir ödeme hiçbir koşulda sahipsiz kalmaz.
 */
export async function getOrderByPaymentToken(supabase: SupabaseClient, token: string): Promise<ReleaseOrderRow | null> {
  const { data, error } = await supabase.from("release_orders").select("*").eq("payment_token", token).maybeSingle();
  if (error) throw new Error(`siparis okunamadı: ${error.code}`);
  if (data) return data as ReleaseOrderRow;

  const earlier = await supabase
    .from("order_events")
    .select("order_id")
    .eq("type", "payment_started")
    .eq("data->>tokenHash", paymentTokenHash(token))
    .limit(1)
    .maybeSingle();
  if (earlier.error || !earlier.data) return null;
  const byId = await supabase.from("release_orders").select("*").eq("id", earlier.data.order_id).maybeSingle();
  if (byId.error) throw new Error(`siparis okunamadı: ${byId.error.code}`);
  return (byId.data as ReleaseOrderRow | null) ?? null;
}

/**
 * Durumu `from` kümesindeyken `to`ya çevirir. Geçiş tablosuna aykırıysa hata fırlatır;
 * sipariş artık o durumda değilse (başka bir istek önce davrandıysa) `null` döner.
 */
export async function transitionOrder(
  supabase: SupabaseClient,
  orderId: string,
  from: OrderStatus[],
  to: OrderStatus,
  patch: Record<string, unknown> = {}
): Promise<ReleaseOrderRow | null> {
  from.forEach((f) => assertTransition(f, to));
  const { data, error } = await supabase
    .from("release_orders")
    .update({ ...patch, status: to })
    .eq("id", orderId)
    .in("status", from)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`durum değiştirilemedi (${to}): ${error.code}`);
  return (data as ReleaseOrderRow | null) ?? null;
}
