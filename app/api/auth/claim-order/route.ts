/**
 * POST /api/auth/claim-order
 *
 * Misafir ödeme sonrası yeni oluşturulan hesabı siparişe bağlar.
 *
 * Güvenlik:
 *   1. signUp ile oluşturulan userId gerçekten o e-posta adresine ait mi?
 *      → auth.admin.getUserById(userId).email === orders.buyer_email
 *   2. Sipariş zaten başka bir user'a ait mi? → Engelle
 *
 * Yaptıkları:
 *   1. orders.user_id = userId  (orderId üzerinden)
 *   2. payments.user_id = userId (order_id = orderId olan kayıt)
 *   3. payments.metadata.buyer_name okunur
 *   4. profiles UPSERT: { id: userId, full_name: buyerName, email: buyerEmail }
 *   5. VERİ BÜTÜNLÜĞÜ ZİNCİRİ: allocations → confirmed, profil sayaçları, sertifika, arazi kapasitesi
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runPostPaymentChain } from "@/lib/order/post-payment";
import { ensureReferralCode } from "@/lib/user/referral";

export async function POST(req: NextRequest) {
  console.log("[claim-order] 📨 POST isteği geldi");

  try {
    /* ── 1. Parametreleri al ────────────────────────────────────────────── */
    const body = await req.json();
    const orderId: string | undefined = body.orderId;
    const userId: string | undefined  = body.userId;

    console.log("[claim-order] Parametreler:", {
      orderId: orderId ?? "UNDEFINED",
      userId:  userId  ?? "UNDEFINED",
    });

    if (!orderId || !userId) {
      console.error("[claim-order] ❌ Eksik parametre — 400 dönüyor");
      return NextResponse.json(
        { error: "orderId ve userId zorunludur." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    console.log("[claim-order] Service role client oluşturuldu");

    /* ── 2. Kullanıcının e-postasını auth'dan al ────────────────────────── */
    const { data: userRecord, error: userErr } =
      await supabase.auth.admin.getUserById(userId);

    if (userErr || !userRecord?.user?.email) {
      console.error("[claim-order] Kullanıcı bulunamadı:", userErr?.message);
      return NextResponse.json(
        { error: "Kullanıcı doğrulanamadı." },
        { status: 403 }
      );
    }

    const authEmail = userRecord.user.email.toLowerCase().trim();

    /* ── 3. Siparişi oku ve sahiplik doğrula ───────────────────────────── */
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, buyer_email, user_id")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      console.error("[claim-order] Sipariş bulunamadı:", orderErr?.message);
      return NextResponse.json(
        { error: "Sipariş bulunamadı." },
        { status: 404 }
      );
    }

    // Zaten başka bir kullanıcıya atanmışsa reddet
    if (order.user_id && order.user_id !== userId) {
      console.warn("[claim-order] Sipariş zaten başka kullanıcıya ait:", order.user_id);
      return NextResponse.json(
        { error: "Bu sipariş başka bir hesaba ait." },
        { status: 409 }
      );
    }

    // E-posta eşleşmesini doğrula (IDOR koruması)
    const orderEmail = (order.buyer_email as string | null)?.toLowerCase().trim() ?? "";
    if (orderEmail !== authEmail) {
      console.warn(
        "[claim-order] E-posta uyuşmazlığı:",
        { orderEmail, authEmail }
      );
      return NextResponse.json(
        { error: "Sipariş bu hesaba ait değil." },
        { status: 403 }
      );
    }

    /* ── 4. orders.user_id güncelle ────────────────────────────────────── */
    const { error: orderUpdateErr, count: orderUpdateCount } = await supabase
      .from("orders")
      .update({ user_id: userId })
      .eq("id", orderId);

    if (orderUpdateErr) {
      console.error("[claim-order] ❌ orders.user_id güncellenemedi:", orderUpdateErr.message);
    } else {
      console.log("[claim-order] ✅ orders.user_id güncellendi (count:", orderUpdateCount, ")");
    }

    /* ── 5. payments.user_id güncelle ──────────────────────────────────── */
    const { data: payment, error: payFetchErr } = await supabase
      .from("payments")
      .select("id, metadata")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (payFetchErr) {
      console.error("[claim-order] Ödeme kaydı okunamadı:", payFetchErr.message);
    }

    if (payment?.id) {
      const { error: payUpdateErr } = await supabase
        .from("payments")
        .update({ user_id: userId })
        .eq("id", payment.id);

      if (payUpdateErr) {
        console.error("[claim-order] ❌ payments.user_id güncellenemedi:", payUpdateErr.message);
      } else {
        console.log("[claim-order] ✅ payments.user_id güncellendi — paymentId:", payment.id);
      }
    } else {
      console.warn("[claim-order] ⚠️ Ödeme kaydı bulunamadı, payments.user_id güncellenemedi");
    }

    /* ── 6. buyer_name + phone metadata'dan al ──────────────────────────── */
    const meta = (payment?.metadata as Record<string, unknown>) ?? {};
    const buyerName  = (meta.buyer_name  as string | null) ?? null;
    const buyerPhone = (meta.buyer_phone as string | null) ?? null;

    /* ── 7. profiles UPSERT ─────────────────────────────────────────────── */
    const profilePayload: Record<string, unknown> = {
      id:         userId,
      email:      authEmail,
      updated_at: new Date().toISOString(),
    };
    if (buyerName)  profilePayload.full_name = buyerName;
    if (buyerPhone) profilePayload.phone     = buyerPhone;

    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (profileErr) {
      console.error("[claim-order] ❌ profiles upsert hatası:", profileErr.message);
    } else {
      console.log("[claim-order] ✅ profiles upsert başarılı — full_name:", buyerName ?? "(yok)", "phone:", buyerPhone ?? "(yok)");
    }

    /* ── 8. VERİ BÜTÜNLÜĞÜ ZİNCİRİ ──────────────────────────────────────
       Misafir sipariş akışında hesap oluşturduktan sonra:
       1. order_allocations: "reserved" → "confirmed" (drone kuyruğuna düşsün)
       2. profiles: total_seeds + carbon_offset_kg güncelle
       3. certificates: otomatik oluştur (idempotent — onConflict)
       4. lands: kapasite kontrolü, gerekirse status → "full"
    ─────────────────────────────────────────────────────────────────────── */
    try {
      const { data: orderForChain } = await supabase
        .from("orders")
        .select("total_seeds, order_type, buyer_email")
        .eq("id", orderId)
        .single();

      if (orderForChain) {
        const chainResult = await runPostPaymentChain({
          supabase,
          orderId,
          userId,
          totalSeeds: orderForChain.total_seeds ?? 0,
          orderType: orderForChain.order_type || "physical",
          buyerEmail: orderForChain.buyer_email,
          metadata: meta,
        });
        console.log("[claim-order] 🔗 Veri zinciri sonucu:", JSON.stringify(chainResult));
      }
    } catch (chainEx) {
      console.error("[claim-order] ⚠️ Veri zinciri hatası (işlem etkilenmedi):", chainEx);
    }

    // ── Referral Code: ilk hesap açılışında otomatik üret ─────────────────
    try {
      const code = await ensureReferralCode(supabase, userId);
      if (code) console.log("[claim-order] ✅ Referral kodu üretildi:", code);
    } catch (refErr) {
      console.error("[claim-order] ⚠️ Referral kod üretme hatası (işlem etkilenmedi):", refErr);
    }

    console.log(
      `[claim-order] ✅ userId=${userId} orderId=${orderId.slice(0, 8)} email=${authEmail} name=${buyerName ?? "(yok)"} phone=${buyerPhone ?? "(yok)"}`
    );

    return NextResponse.json({ success: true, buyerName });

  } catch (err) {
    console.error("[claim-order] Beklenmeyen hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
