/**
 * Post-Payment Data Integrity Engine
 *
 * Ödeme onaylandığında çalışan merkezi veri zinciri:
 *   1. order_allocations: "reserved" → "confirmed"
 *   2. profiles: total_seeds + carbon sayaçları güncelle
 *   3. certificates: otomatik oluştur (idempotent)
 *   4. lands: doluluk oranını güncel tut
 *
 * Bu modül hem callback hem claim-order tarafından çağrılır.
 * Her adım bağımsızdır — bir adımın hatası diğerlerini engellemez.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createCertificate } from "./certificate";

interface PostPaymentParams {
  supabase: SupabaseClient;
  orderId: string;
  userId: string;
  totalSeeds: number;
  orderType: string;
  buyerEmail: string;
  metadata: Record<string, unknown>;
}

interface PostPaymentResult {
  allocationsConfirmed: number;
  profileUpdated: boolean;
  certificateCreated: boolean;
  landsUpdated: boolean;
  errors: string[];
}

export async function runPostPaymentChain(
  params: PostPaymentParams
): Promise<PostPaymentResult> {
  const { supabase, orderId, userId, totalSeeds, orderType, buyerEmail, metadata } = params;
  const result: PostPaymentResult = {
    allocationsConfirmed: 0,
    profileUpdated: false,
    certificateCreated: false,
    landsUpdated: false,
    errors: [],
  };

  /* ── 1. order_allocations: "reserved" → "confirmed" ──────────────────────
     Drone ekim kuyruğu (admin/operations) status="confirmed" filtreler.
     Bu adım olmadan tohumlar kuyrukta görünmez.
  ─────────────────────────────────────────────────────────────────────────── */
  try {
    const { data: allocations, error: allocFetchErr } = await supabase
      .from("order_allocations")
      .select("id, land_id, seeds")
      .eq("order_id", orderId)
      .eq("state", "reserved");

    if (allocFetchErr) {
      result.errors.push(`Allocation okuma hatası: ${allocFetchErr.message}`);
    } else if (allocations && allocations.length > 0) {
      const allocIds = allocations.map((a: { id: string }) => a.id);

      const { error: allocUpdateErr, count } = await supabase
        .from("order_allocations")
        .update({ state: "confirmed" })
        .in("id", allocIds);

      if (allocUpdateErr) {
        result.errors.push(`Allocation güncelleme hatası: ${allocUpdateErr.message}`);
      } else {
        result.allocationsConfirmed = count ?? allocIds.length;
        console.log(
          `[post-payment] ✅ ${result.allocationsConfirmed} allocation "confirmed" yapıldı — orderId: ${orderId}`
        );
      }
    }
  } catch (err) {
    result.errors.push(`Allocation beklenmeyen hata: ${err}`);
  }

  /* ── 2. profiles: atomik RPC ile tohum ve karbon sayacını güncelle ────────
     sync_profile_counters(p_user_id) → orders tablosundan SUM alır,
     total_seeds ve carbon_offset_kg'yi atomik olarak günceller.
     Race condition riski sıfır (tek UPDATE, DB tarafında hesaplama).
  ─────────────────────────────────────────────────────────────────────────── */
  try {
    const { error: rpcErr } = await supabase.rpc("sync_profile_counters", {
      p_user_id: userId,
    });

    if (rpcErr) {
      console.warn("[post-payment] ⚠️ sync_profile_counters RPC hatası:", rpcErr.message);
      result.errors.push(`Profil güncelleme: ${rpcErr.message}`);
    } else {
      result.profileUpdated = true;
      console.log(
        `[post-payment] ✅ Profil sayaçları senkronize edildi — userId: ${userId}`
      );
    }
  } catch (err) {
    result.errors.push(`Profil beklenmeyen hata: ${err}`);
  }

  /* ── 3. certificates: otomatik oluştur (idempotent — onConflict) ────── */
  try {
    const { error: certErr } = await createCertificate({
      supabase,
      orderId,
      userId,
      orderType,
      totalSeeds,
      buyerEmail,
      metadata,
    });

    if (certErr) {
      // onConflict: duplicate order_id → zaten var, sorun değil
      if (certErr.message?.includes("duplicate") || certErr.message?.includes("conflict")) {
        console.log("[post-payment] ℹ️ Sertifika zaten mevcut — orderId:", orderId);
        result.certificateCreated = true; // zaten var = başarılı
      } else {
        result.errors.push(`Sertifika hatası: ${certErr.message}`);
      }
    } else {
      result.certificateCreated = true;
      console.log("[post-payment] ✅ Sertifika oluşturuldu — orderId:", orderId);
    }
  } catch (err) {
    result.errors.push(`Sertifika beklenmeyen hata: ${err}`);
  }

  /* ── 4. lands: doluluk güncelle ──────────────────────────────────────────
     NOT: Arazi doluluk güncellemesi (filled_seeds) admin/operations
     tarafından "planted" işaretlendiğinde yapılır. Burada yapmıyoruz
     çünkü tohumlar henüz fiziksel olarak ekilmedi — sadece "confirmed".
     reserved_seeds zaten reserve_seeds_for_order RPC'sinde artırılmıştı.

     Ama status kontrolü yapıyoruz: eğer lands.status = "open" ve
     (filled_seeds + reserved_seeds >= capacity_seeds) ise → "full" yap.
  ─────────────────────────────────────────────────────────────────────────── */
  try {
    const { data: allocations } = await supabase
      .from("order_allocations")
      .select("land_id, seeds")
      .eq("order_id", orderId);

    if (allocations && allocations.length > 0) {
      const landIds = [...new Set(allocations.map((a: { land_id: string }) => a.land_id))];

      const { data: lands } = await supabase
        .from("lands")
        .select("id, capacity_seeds, filled_seeds, reserved_seeds, status")
        .in("id", landIds);

      if (lands) {
        for (const land of lands) {
          const total = (land.filled_seeds ?? 0) + (land.reserved_seeds ?? 0);
          if (total >= land.capacity_seeds && land.status === "open") {
            await supabase
              .from("lands")
              .update({ status: "full" })
              .eq("id", land.id);
            console.log(`[post-payment] ✅ Arazi kapasitesi doldu, status → "full" — landId: ${land.id}`);
          }
        }
        result.landsUpdated = true;
      }
    }
  } catch (err) {
    result.errors.push(`Arazi güncelleme hatası: ${err}`);
  }

  if (result.errors.length > 0) {
    console.warn("[post-payment] ⚠️ Tamamlanmayan adımlar:", result.errors);
  } else {
    console.log("[post-payment] ✅ Tüm veri zinciri başarıyla tamamlandı — orderId:", orderId);
  }

  return result;
}
