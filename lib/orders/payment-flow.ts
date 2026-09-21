/**
 * Ödeme akışı — YALNIZ SUNUCU.
 *
 *   startPayment()     sipariş → sağlayıcıda ödeme oturumu → `awaiting_payment`
 *   completePayment()  dönüşte: sonucu SAĞLAYICIDAN sorgula, tutarı siparişle karşılaştır,
 *                      tek seferlik işle (koşullu UPDATE) → `paid` | `payment_failed`
 *
 * Sözleşme ödemenin onaylandığı an kurulur: cayma süresi o günden başlar, bu yüzden
 * `withdrawal_deadline` burada (ödeme anına göre) yazılır. Belgelerde yazan tarih sipariş
 * anına göredir; ödeme gece yarısını aşarsa gerçek son an bir gün ileridir — müşteri lehine.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentProvider } from "@/lib/payments/types";
import { scheduleFor } from "./schedule";
import { getSalesSettings } from "./settings";
import { addOrderEvent, db, getOrderByPaymentToken, paymentTokenHash, transitionOrder } from "./store";
import type { ReleaseOrderRow } from "./types";

export type StartPaymentResult = { ok: true; redirectUrl: string } | { ok: false; error: "unavailable" };

export async function startPayment(
  order: ReleaseOrderRow,
  provider: PaymentProvider,
  ctx: { origin: string; ip: string | null }
): Promise<StartPaymentResult> {
  const supabase = db();
  const address = order.invoice.address;
  const init = await provider.init({
    orderId: order.id,
    orderNo: order.order_no,
    amountKurus: order.total_kurus,
    locale: order.locale,
    buyerId: order.user_id ?? `G-${order.id.slice(0, 13)}`,
    billingName: order.invoice.type === "corporate" ? order.invoice.companyTitle : null,
    buyer: {
      firstName: order.buyer_first_name,
      lastName: order.buyer_last_name,
      email: order.buyer_email,
      phone: order.buyer_phone,
      ip: ctx.ip,
    },
    address: { line: address.line, district: address.district, province: address.province, postalCode: address.postalCode },
    description: `${order.site_snapshot.name} — ${order.quantity} tohum topu bırakma hizmeti`,
    callbackUrl: `${ctx.origin}/api/payment/donus`,
  });

  if (!init.ok) {
    console.error("[odeme] oturum açılamadı:", init.error);
    await addOrderEvent(supabase, order.id, "payment_failed", "system", { stage: "init", error: init.error });
    return { ok: false, error: "unavailable" };
  }

  // draft → awaiting_payment; yeniden denemede (payment_failed / zaten awaiting) belirteç yenilenir.
  const patch = { payment_provider: provider.name, payment_token: init.token, payment_started_at: new Date().toISOString() };
  const moved =
    order.status === "awaiting_payment"
      ? await supabase.from("release_orders").update(patch).eq("id", order.id).eq("status", "awaiting_payment").select("id").maybeSingle()
      : { data: await transitionOrder(supabase, order.id, ["draft", "payment_failed"], "awaiting_payment", patch) };
  if (!moved.data) return { ok: false, error: "unavailable" };

  await addOrderEvent(supabase, order.id, "payment_started", "customer", { provider: provider.name, tokenHash: paymentTokenHash(init.token) });
  return { ok: true, redirectUrl: init.redirectUrl };
}

/**
 * Ödenmiş siparişe İKİNCİ bir ödeme dönüşü geldiyse (müşteri iki sekmede iki ayrı ödeme
 * oturumunu da tamamlamış olabilir) sağlayıcıya sorar; farklı bir tahsilat varsa denetim
 * izine "duplicate" olarak yazar — yönetim ekranı bunu iade edilecek tahsilat olarak gösterir.
 * Aynı dönüşün yinelenmesi (aynı paymentId) sessizce geçilir.
 */
async function flagDuplicateCharge(supabase: SupabaseClient, order: ReleaseOrderRow, token: string, provider: PaymentProvider) {
  // Bu oturumun tahsilatı zaten işlendiyse (aynı dönüş yinelendi) sağlayıcıyı boşuna sorgulama.
  // Siparişteki `payment_token` SON açılan oturumdur, ödenen oturum olmayabilir; bu yüzden
  // karşılaştırma olaylardaki belirteç özetiyle yapılır.
  const tokenHash = paymentTokenHash(token);
  const seen = await supabase
    .from("order_events")
    .select("id")
    .eq("order_id", order.id)
    .eq("type", "payment_succeeded")
    .eq("data->>tokenHash", tokenHash)
    .limit(1);
  if (seen.error || seen.data?.length) return;

  const again = await provider.retrieve(token).catch(() => null);
  if (!again || !again.ok || again.status !== "success" || again.paymentId === order.payment_id) return;
  console.error(`[odeme] ÇİFT TAHSİLAT (${order.order_no}) — ikinci tahsilat iade edilmeli`);
  await addOrderEvent(supabase, order.id, "payment_succeeded", "system", {
    duplicate: true,
    provider: provider.name,
    paymentId: again.paymentId,
    paidKurus: again.paidKurus,
    tokenHash,
  });
}

export type CompletePaymentResult =
  | { ok: true; outcome: "paid" | "already_paid" | "failed"; order: ReleaseOrderRow }
  | { ok: false; error: "not_found" | "provider_error" | "amount_mismatch" };

export async function completePayment(
  token: string,
  provider: PaymentProvider,
  supabase: SupabaseClient = db()
): Promise<CompletePaymentResult> {
  const order = await getOrderByPaymentToken(supabase, token);
  if (!order || order.payment_provider !== provider.name) return { ok: false, error: "not_found" };
  if (order.paid_at) {
    await flagDuplicateCharge(supabase, order, token, provider);
    return { ok: true, outcome: "already_paid", order };
  }

  const result = await provider.retrieve(token);
  if (!result.ok) {
    await addOrderEvent(supabase, order.id, "payment_failed", "system", { stage: "retrieve", error: result.error });
    return { ok: false, error: "provider_error" };
  }

  if (result.status === "failure") {
    const failed = await transitionOrder(supabase, order.id, ["awaiting_payment"], "payment_failed", { payment_meta: result.meta });
    await addOrderEvent(supabase, order.id, "payment_failed", "system", { reason: result.reason });
    return { ok: true, outcome: "failed", order: failed ?? order };
  }

  // Tahsil edilen tutar (ve sağlayıcı bildiriyorsa sipariş referansı) siparişle birebir aynı olmalı;
  // değilse sipariş ödenmiş SAYILMAZ, elle incelenir.
  if (result.paidKurus !== order.total_kurus || (result.reference !== undefined && result.reference !== order.order_no)) {
    console.error(`[odeme] tutar/referans uyuşmazlığı (${order.order_no})`);
    await addOrderEvent(supabase, order.id, "payment_failed", "system", {
      reason: "amount_mismatch",
      expectedKurus: order.total_kurus,
      paidKurus: result.paidKurus,
      reference: result.reference ?? null,
      paymentId: result.paymentId,
    });
    return { ok: false, error: "amount_mismatch" };
  }

  // Tahsil edilmiş ödeme, ödeme oturumu açılmış HER ödenmemiş duruma işlenir: bekleyen, başka
  // sekmedeki denemesi reddedilmiş ya da süresi dolmuş (geç ödeme). Para alınmışken sipariş açıkta kalmaz.
  if (order.status !== "awaiting_payment" && order.status !== "payment_failed" && order.status !== "expired") {
    await addOrderEvent(supabase, order.id, "payment_failed", "system", {
      reason: "unexpected_status",
      status: order.status,
      paymentId: result.paymentId,
    });
    return { ok: false, error: "provider_error" };
  }

  const settings = await getSalesSettings();
  const paidAt = new Date();
  const wasExpired = order.status === "expired";
  const paid = await transitionOrder(supabase, order.id, [order.status], "paid", {
    paid_at: paidAt.toISOString(),
    payment_id: result.paymentId,
    payment_meta: result.meta,
    withdrawal_deadline: scheduleFor(paidAt, settings.prepDays).withdrawalDeadline,
  });
  if (!paid) {
    // Başka bir istek aynı anda işledi (çift geri çağrı) — güncel kaydı döndür.
    const again = await getOrderByPaymentToken(supabase, token);
    return again?.paid_at ? { ok: true, outcome: "already_paid", order: again } : { ok: false, error: "provider_error" };
  }

  if (wasExpired) {
    // Süresi dolduğu için kapasitesi geri verilmişti: yeniden ayır. Saha bu arada dolduysa sipariş
    // kapasitesiz "ödendi" kalır; bunu hem denetim izine hem siparişe (payment_meta.capacityHeld=false)
    // yaz ki yönetim görsün ve iade/iptalde ayrılmamış kapasite "geri verilmesin".
    const again = await supabase.rpc("reserve_release_capacity", { p_land_id: paid.land_id, p_quantity: paid.quantity });
    const held = again.data === true;
    if (!held) {
      console.error(`[odeme] geç ödeme, kapasite ayrılamadı (${paid.order_no}) — yönetim incelemeli`);
      await supabase.from("release_orders").update({ payment_meta: { ...result.meta, capacityHeld: false } }).eq("id", paid.id);
    }
    await addOrderEvent(supabase, paid.id, "status_changed", "system", { note: "late_payment", capacityReserved: held });
  }
  await addOrderEvent(supabase, paid.id, "payment_succeeded", "system", {
    provider: provider.name,
    paymentId: result.paymentId,
    paidKurus: result.paidKurus,
    tokenHash: paymentTokenHash(token),
  });
  if (settings.invoiceTiming === "on_payment") {
    await supabase.from("order_invoices").insert({ order_id: paid.id, kind: "sale", provider: "manual", status: "pending", created_by: "system" });
  }
  return { ok: true, outcome: "paid", order: paid };
}
