/**
 * Sipariş oluşturma — YALNIZ SUNUCU.
 *
 * Sıra bilinçlidir:
 *   1. O sahada süresi dolmuş ödenmemiş siparişler kapatılır, tuttukları kapasite geri verilir.
 *   2. Aynı `clientToken` daha önce geldiyse o sipariş döner (çift tıklama, ağ tekrarı);
 *      o sipariş süresi dolduğu için kapandıysa belirteç serbest bırakılır, yeni sipariş oluşur.
 *   3. Saha + kapasite ön denetimi, ayarlar, tutar ve takvim (hepsi sunucuda).
 *   4. Kapasite SATIR KİLİDİYLE ayrılır (reserve_release_capacity).
 *   5. Sipariş `draft` olarak yazılır; siparişe özel belgeler üretilip DEĞİŞMEZ olarak saklanır.
 *   6. Denetim izi: sipariş, onaylar (sürüm + an), belgeler (özetler + yapısal kaynak).
 * Herhangi bir adım düşerse ayrılan kapasite geri verilir; yarım kalan sipariş `expired` olur
 * (gerçek siparişler silinemez).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLegalContext, buildOrderDocuments } from "@/lib/legal/documents";
import { LEGAL_DOCUMENTS_VERSION } from "@/lib/legal/version";
import { generateOrderNo } from "./identifiers";
import { checkSite } from "./preview";
import { scheduleFor, trToday } from "./schedule";
import { resolveCertificateName, type OrderPayload } from "./schema";
import { quantityRangeError } from "@/lib/pricing";
import { orderTotals, type SalesSettings } from "./settings";
import { addOrderEvent, db, transitionOrder } from "./store";
import type { OrderConsents, ReleaseOrderRow } from "./types";

export interface CreateOrderMeta {
  userId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  sourcePath: string | null;
  /** Deneme sağlayıcısı / sanal POS deneme kipi → deneme siparişi */
  isTest: boolean;
}

export type CreateOrderResult =
  | { ok: true; order: ReleaseOrderRow; reused: boolean }
  | { ok: false; error: "site_unavailable" | "capacity" | "unavailable" }
  | { ok: false; error: "quantity"; field: "quantityMin" | "quantityMax" };

const UNPAID = ["draft", "awaiting_payment", "payment_failed"] as const;

/** Ödeme süresi dolmuş siparişleri kapatır ve kapasitelerini geri verir (tembel temizlik). */
export async function expireStaleOrders(supabase: SupabaseClient, landId?: string): Promise<number> {
  let query = supabase
    .from("release_orders")
    .select("id, land_id, quantity")
    .in("status", [...UNPAID])
    .lt("payment_expires_at", new Date().toISOString())
    .limit(50);
  if (landId) query = query.eq("land_id", landId);
  const { data, error } = await query;
  if (error || !data) return 0;

  let expired = 0;
  for (const row of data) {
    const done = await transitionOrder(supabase, row.id as string, [...UNPAID], "expired");
    if (!done) continue; // başka bir istek önce davrandı (ör. ödeme tam o anda geldi)
    await supabase.rpc("release_reserved_capacity", { p_land_id: row.land_id, p_quantity: row.quantity });
    await addOrderEvent(supabase, row.id as string, "order_expired", "system");
    expired++;
  }
  return expired;
}

function consentRecords(payload: OrderPayload, at: string): OrderConsents {
  const rec = (granted: boolean) => ({ granted, at, version: LEGAL_DOCUMENTS_VERSION });
  return {
    preInfo: rec(payload.consents.preInfo),
    contract: rec(payload.consents.contract),
    kvkkRead: rec(payload.consents.kvkkRead),
    marketing: rec(payload.consents.marketing),
    ...(payload.invoice.type === "corporate" ? { corporateAuthority: rec(payload.consents.corporateAuthority) } : {}),
  };
}

export async function createOrder(payload: OrderPayload, meta: CreateOrderMeta, settings: SalesSettings): Promise<CreateOrderResult> {
  const supabase = db();

  // 1 · Tembel temizlik (önce: aşağıdaki denetim, süresi geçmiş siparişi "açık" sanmasın)
  await expireStaleOrders(supabase, payload.landId);

  // 2 · Idempotency — aynı sihirbaz oturumu tek sipariş üretir
  const existing = await supabase.from("release_orders").select("*").eq("client_token", payload.clientToken).maybeSingle();
  if (existing.error) return { ok: false, error: "unavailable" };
  if (existing.data) {
    const previous = existing.data as ReleaseOrderRow;
    if (previous.status !== "expired") return { ok: true, order: previous, reused: true };
    // Süresi dolmuş sipariş yeniden ödenemez (kapasitesi geri verildi). Müşteri sihirbazı yenilemeden
    // tekrar "öde"ye bastıysa eski siparişin belirtecini bırak ve güncel koşullarla YENİ sipariş oluştur.
    const freed = await supabase.from("release_orders").update({ client_token: null }).eq("id", previous.id).eq("status", "expired");
    if (freed.error) return { ok: false, error: "unavailable" };
  }

  // 3 · Saha, tutar, takvim (ayarlar çağırandan gelir: önizlemeyle aynı değerler)
  const range = quantityRangeError(payload.quantity, settings);
  if (range) return { ok: false, error: "quantity", field: range };
  const site = await checkSite(payload.landId, payload.quantity);
  if (!site.ok) return { ok: false, error: site.error };

  const now = new Date();
  const totals = orderTotals(payload.quantity, settings);
  const schedule = scheduleFor(now, settings.prepDays);

  // 4 · Kapasiteyi satır kilidiyle ayır
  const reserved = await supabase.rpc("reserve_release_capacity", { p_land_id: payload.landId, p_quantity: payload.quantity });
  if (reserved.error) return { ok: false, error: "unavailable" };
  if (reserved.data !== true) return { ok: false, error: "capacity" };
  const giveBack = () => supabase.rpc("release_reserved_capacity", { p_land_id: payload.landId, p_quantity: payload.quantity });

  // 5 · Sipariş satırı (numara çakışırsa yeniden dene)
  const at = now.toISOString();
  const row = {
    status: "draft",
    is_test: meta.isTest,
    user_id: meta.userId,
    locale: payload.locale,
    client_token: payload.clientToken,
    land_id: payload.landId,
    site_snapshot: site.site,
    season_label: schedule.season.label,
    quantity: payload.quantity,
    unit_price_kurus: totals.unitPriceKurus,
    total_kurus: totals.totalKurus,
    vat_rate: totals.vatRate,
    certificate_name: resolveCertificateName(payload),
    buyer_type: payload.invoice.type,
    buyer_first_name: payload.buyer.firstName,
    buyer_last_name: payload.buyer.lastName,
    buyer_email: payload.buyer.email,
    buyer_phone: payload.buyer.phone,
    invoice: payload.invoice,
    consents: consentRecords(payload, at),
    marketing_consent: payload.consents.marketing,
    documents_version: LEGAL_DOCUMENTS_VERSION,
    ip_hash: meta.ipHash,
    user_agent: meta.userAgent,
    source_path: meta.sourcePath,
    performance_deadline: schedule.performanceDeadline,
    payment_expires_at: new Date(now.getTime() + settings.paymentTtlMinutes * 60_000).toISOString(),
  };

  let order: ReleaseOrderRow | null = null;
  for (let attempt = 0; attempt < 5 && !order; attempt++) {
    const { data, error } = await supabase
      .from("release_orders")
      .insert({ ...row, order_no: generateOrderNo(now) })
      .select("*")
      .single();
    if (!error && data) {
      order = data as ReleaseOrderRow;
      break;
    }
    if (error?.code === "23505" && /client_token/.test(error.message ?? "")) {
      // Aynı istek eşzamanlı ikinci kez geldi: ayırdığımızı geri ver, ilk kaydı döndür.
      await giveBack();
      const first = await supabase.from("release_orders").select("*").eq("client_token", payload.clientToken).maybeSingle();
      return first.data ? { ok: true, order: first.data as ReleaseOrderRow, reused: true } : { ok: false, error: "unavailable" };
    }
    if (error?.code !== "23505") {
      console.error("[siparis] kayıt hatası:", error?.code);
      break;
    }
  }
  if (!order) {
    await giveBack();
    return { ok: false, error: "unavailable" };
  }

  // 6 · Siparişe özel belgeler (değişmez kopya + özet) ve denetim izi
  const context = buildLegalContext({
    input: payload,
    site: site.site,
    totals,
    schedule,
    orderDate: trToday(now),
    orderNo: order.order_no,
  });
  const documents = buildOrderDocuments(context);
  const inserted = await supabase.from("order_documents").insert(
    documents.map((d) => ({
      order_id: order.id,
      kind: d.kind,
      template_version: d.version,
      locale: "tr",
      title: d.title,
      html: d.html,
      sha256: d.sha256,
    }))
  );
  if (inserted.error) {
    console.error("[siparis] belgeler yazılamadı:", inserted.error.code);
    await transitionOrder(supabase, order.id, ["draft"], "expired");
    await giveBack();
    await addOrderEvent(supabase, order.id, "order_expired", "system", { reason: "documents_failed" });
    return { ok: false, error: "unavailable" };
  }

  await addOrderEvent(supabase, order.id, "order_created", "customer", {
    quantity: order.quantity,
    totalKurus: order.total_kurus,
    season: schedule.season.label,
    performanceDeadline: schedule.performanceDeadline,
    rolledToNextSeason: schedule.rolledToNextSeason,
    isTest: meta.isTest,
  });
  await addOrderEvent(supabase, order.id, "consent_recorded", "customer", {
    consents: order.consents,
    ipHash: meta.ipHash,
    userAgent: meta.userAgent,
  });
  // Yapısal kaynak (bloklar) da saklanır: PDF, şablonlar sonradan değişse bile
  // müşterinin onayladığı metinle BİREBİR aynı içerikten yeniden üretilebilir.
  await addOrderEvent(supabase, order.id, "documents_generated", "system", {
    version: LEGAL_DOCUMENTS_VERSION,
    documents: documents.map((d) => ({ kind: d.kind, title: d.title, sha256: d.sha256, meta: d.document.meta, blocks: d.document.blocks })),
  });

  return { ok: true, order, reused: false };
}
