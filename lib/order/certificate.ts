/**
 * Sertifika oluşturma helper'ı — callback ve claim-order'da ortak kullanılır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface CreateCertificateParams {
  supabase: SupabaseClient;
  orderId: string;
  userId: string;
  orderType: string;
  totalSeeds: number;
  buyerEmail: string;
  metadata: Record<string, unknown>;
}

export async function createCertificate({
  supabase,
  orderId,
  userId,
  orderType,
  totalSeeds,
  buyerEmail,
  metadata,
}: CreateCertificateParams) {
  let forestName = "Skytech Doğa Projesi";

  if (orderType === "reservation" || orderType === "gift") {
    const { data: allocData } = await supabase
      .from("order_allocations")
      .select("lands(name)")
      .eq("order_id", orderId)
      .limit(1)
      .single();
    const landName = (allocData?.lands as unknown as { name: string } | null)?.name;
    if (landName) forestName = landName;
  }

  const recipientName =
    (metadata.gift_recipient_name as string | null) ??
    (metadata.buyer_name as string | null) ??
    buyerEmail ??
    "Değerli Katılımcı";

  const { error } = await supabase
    .from("certificates")
    .upsert(
      {
        user_id: userId,
        order_id: orderId,
        recipient_name: recipientName,
        tree_count: totalSeeds ?? 0,
        forest_name: forestName,
      },
      { onConflict: "order_id", ignoreDuplicates: true }
    );

  return { error, forestName };
}
