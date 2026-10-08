import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendB2BQuoteReadyEmail, SKIPPED_ID } from "@/lib/mail";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";

/**
 * Admin B2B Quote Management API
 *
 * GET  — Tüm teklifleri listele (filtreleme: ?status=PENDING)
 * PUT  — Teklif durumunu güncelle (fiyat onayla → QUOTED, reddet → REJECTED)
 *
 * Durum geçişi koşulludur (web-brifler/33 §2): güncelleme yalnız teklif hâlâ bekliyorsa uygulanır. Aynı anda
 * gelen ikinci onay/ret hiçbir şey yazmaz, e-posta ve audit üretmez (409). İzin anahtarları sözlükte olmadığı için
 * kapı bilinçli olarak eski rollerde kalır (33 §4, karar 34).
 */

/**
 * "Bekliyor" durumunun iki yazımı. Canlı tabloda 004 uygulanmamış: kolon varsayılanı küçük harf 'pending' ve
 * durum kısıtı yok (29 Eylül salt okuma doğrulaması: 4 PENDING, 1 pending). Yeni yazımlar büyük harftir.
 */
const PENDING_STATUSES = ["PENDING", "pending"];
const isPending = (status: unknown) => typeof status === "string" && PENDING_STATUSES.includes(status);
const alreadyProcessed = () =>
  NextResponse.json(
    { error: "Teklif bu arada başka bir işlemle sonuçlandı. Yeniden onaylamayın; listeyi yenileyin.", code: "already_processed" },
    { status: 409 }
  );

// ── GET: List all quotes ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // ── Auth Guard ──────────────────────────────────────────────────────
  const { error: authError } = await requireAdmin(request, ["SUPER_ADMIN", "FINANCE"]);
  if (authError) return authError;

  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("corporate_quotes")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("B2B quotes fetch error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── PUT: Update quote status (approve/reject) ──────────────────────
export async function PUT(request: NextRequest) {
  const { admin, error: authError } = await requireAdmin(request, ["SUPER_ADMIN", "FINANCE"]);
  if (authError) return authError;
  if (!admin?.user_id) return NextResponse.json({ error: "Doğrulanmış yönetici oturumu bulunamadı." }, { status: 401 });

  try {
    const supabase = createServiceRoleClient();
    const body = await request.json();
    const { quoteId, action, approvedPrice, approvedSeedCount, adminNote } = body;

    if (!quoteId || !action) {
      return NextResponse.json(
        { error: "quoteId and action are required" },
        { status: 400 }
      );
    }

    // Mevcut teklifi getir
    const { data: quote, error: fetchError } = await supabase
      .from("corporate_quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (fetchError || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // ── ACTION: approve — PENDING → QUOTED ──
    if (action === "approve") {
      if (!approvedPrice || !approvedSeedCount) {
        return NextResponse.json(
          { error: "approvedPrice and approvedSeedCount are required for approval" },
          { status: 400 }
        );
      }
      if (
        typeof approvedPrice !== "number" || !Number.isFinite(approvedPrice) || approvedPrice <= 0 ||
        !Number.isInteger(approvedSeedCount) || approvedSeedCount <= 0
      ) {
        return NextResponse.json(
          { error: "approvedPrice must be a positive amount and approvedSeedCount a positive integer" },
          { status: 400 }
        );
      }

      if (!isPending(quote.status)) {
        return NextResponse.json(
          { error: `Cannot approve quote in ${quote.status} status` },
          { status: 400 }
        );
      }

      // Koşullu geçiş: yalnız hâlâ bekleyen teklif onaylanır; eşzamanlı ikinci onay fiyatın üzerine yazamaz
      // ve müşteriye ikinci e-posta gitmez.
      const { data: moved, error: updateError } = await supabase
        .from("corporate_quotes")
        .update({
          status: "QUOTED",
          approved_price: approvedPrice,
          approved_seed_count: approvedSeedCount,
          admin_note: adminNote || null,
          quoted_at: new Date().toISOString(),
          quoted_by: admin.user_id,
        })
        .eq("id", quoteId)
        .in("status", PENDING_STATUSES)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("Quote approve error:", updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      if (!moved) return alreadyProcessed();

      // Quote persistence and transport acceptance are separate results. Missing
      // credentials or an ambiguous response must never claim customer delivery.
      let notificationStatus: "accepted" | "not_configured" | "unconfirmed" = "unconfirmed";
      try {
        const pricePerSeed = approvedSeedCount > 0 ? approvedPrice / approvedSeedCount : 0;
        const receipt = await sendB2BQuoteReadyEmail({
          email: quote.corporate_email,
          companyName: quote.company_name,
          contactPerson: quote.contact_person,
          quoteId: quoteId,
          approvedPrice,
          approvedSeedCount,
          adminNote: adminNote || undefined,
          pricePerSeed,
        });
        if (receipt.id === SKIPPED_ID) notificationStatus = "not_configured";
        else if (typeof receipt.id === "string" && receipt.id.trim()) notificationStatus = "accepted";
      } catch {
        console.error("[b2b] quote_notification_unconfirmed");
        // The approved quote stays saved; do not encourage repeating the mutation.
      }

      const warnings = await auditLog(supabase, {
        admin,
        action: "UPDATE",
        entity: "quote",
        entityId: quoteId,
        details: { action: "approve", approvedPrice, approvedSeedCount, adminNote },
        ip: getClientIP(request),
      });

      return NextResponse.json({
        warnings,
        success: true,
        message: notificationStatus === "accepted"
          ? "Teklif onaylandı; e-posta gönderim için kabul edildi."
          : notificationStatus === "not_configured"
            ? "Teklif onaylandı. E-posta gönderimi yapılandırılmadığı için müşteri bildirimi gönderilmedi. Teklifi yeniden onaylamayın; bildirim için yöneticiyle görüşün."
            : "Teklif onaylandı. Müşteri e-postasının gönderimi doğrulanamadı. Teklifi yeniden onaylamayın; bildirim kaydını kontrol edin.",
        notification: { status: notificationStatus },
        status: "QUOTED",
      });
    }

    // ── ACTION: reject — PENDING → REJECTED ──
    if (action === "reject") {
      if (!isPending(quote.status)) {
        return NextResponse.json(
          { error: `Cannot reject quote in ${quote.status} status` },
          { status: 400 }
        );
      }

      const { data: moved, error: updateError } = await supabase
        .from("corporate_quotes")
        .update({
          status: "REJECTED",
          admin_note: adminNote || null,
          quoted_at: new Date().toISOString(),
          quoted_by: admin.user_id,
        })
        .eq("id", quoteId)
        .in("status", PENDING_STATUSES)
        .select("id")
        .maybeSingle();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      if (!moved) return alreadyProcessed();

      const warnings = await auditLog(supabase, {
        admin,
        action: "UPDATE",
        entity: "quote",
        entityId: quoteId,
        details: { action: "reject", adminNote },
        ip: getClientIP(request),
      });

      return NextResponse.json({
        warnings,
        success: true,
        message: "Teklif reddedildi",
        status: "REJECTED",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: unknown) {
    console.error("B2B quote update error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
