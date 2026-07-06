import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendB2BQuoteReadyEmail } from "@/lib/mail";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";

/**
 * Admin B2B Quote Management API
 *
 * GET  — Tüm teklifleri listele (filtreleme: ?status=PENDING)
 * PUT  — Teklif durumunu güncelle (fiyat onayla → QUOTED, reddet → REJECTED)
 */

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

  try {
    const supabase = createServiceRoleClient();
    const body = await request.json();
    const { quoteId, action, approvedPrice, approvedSeedCount, adminNote, adminUserId } = body;

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

      if (quote.status !== "PENDING") {
        return NextResponse.json(
          { error: `Cannot approve quote in ${quote.status} status` },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabase
        .from("corporate_quotes")
        .update({
          status: "QUOTED",
          approved_price: approvedPrice,
          approved_seed_count: approvedSeedCount,
          admin_note: adminNote || null,
          quoted_at: new Date().toISOString(),
          quoted_by: admin?.user_id || adminUserId || null,
        })
        .eq("id", quoteId);

      if (updateError) {
        console.error("Quote approve error:", updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Müşteriye e-posta gönder
      try {
        const pricePerSeed = approvedSeedCount > 0 ? approvedPrice / approvedSeedCount : 0;
        await sendB2BQuoteReadyEmail({
          email: quote.corporate_email,
          companyName: quote.company_name,
          contactPerson: quote.contact_person,
          quoteId: quoteId,
          approvedPrice,
          approvedSeedCount,
          adminNote: adminNote || undefined,
          pricePerSeed,
        });
      } catch (emailErr) {
        console.error("Quote email failed (non-blocking):", emailErr);
        // E-posta hatası quote durumunu etkilemez
      }

      await auditLog(supabase, {
        admin: admin!,
        action: "UPDATE",
        entity: "quote",
        entityId: quoteId,
        details: { action: "approve", approvedPrice, approvedSeedCount, adminNote },
        ip: getClientIP(request),
      });

      return NextResponse.json({
        success: true,
        message: "Teklif onaylandı ve müşteriye bildirildi",
        status: "QUOTED",
      });
    }

    // ── ACTION: reject — PENDING → REJECTED ──
    if (action === "reject") {
      if (quote.status !== "PENDING") {
        return NextResponse.json(
          { error: `Cannot reject quote in ${quote.status} status` },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabase
        .from("corporate_quotes")
        .update({
          status: "REJECTED",
          admin_note: adminNote || null,
          quoted_at: new Date().toISOString(),
          quoted_by: adminUserId || null,
        })
        .eq("id", quoteId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      await auditLog(supabase, {
        admin: admin!,
        action: "UPDATE",
        entity: "quote",
        entityId: quoteId,
        details: { action: "reject", adminNote },
        ip: getClientIP(request),
      });

      return NextResponse.json({
        success: true,
        message: "Teklif reddedildi",
        status: "REJECTED",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    console.error("B2B quote update error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
