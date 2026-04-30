/**
 * /api/kurumsal/employees
 *
 * GET  — List allocations for the authenticated company (by quote_id)
 * POST — Create a new employee allocation and optionally send certificate email
 *
 * Auth: Cookie-based Supabase session (must be signed in as the company user)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmployeeCertificateEmail } from "@/lib/mail";

// ── GET ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const quoteId = searchParams.get("quote_id");

  if (!quoteId) {
    return NextResponse.json({ error: "quote_id gerekli." }, { status: 400 });
  }

  const service = createServiceRoleClient();

  // Verify the quote belongs to the authenticated user
  const { data: quote } = await service
    .from("corporate_quotes")
    .select("id, user_id, approved_seed_count, company_name")
    .eq("id", quoteId)
    .eq("user_id", session.user.id)
    .single();

  if (!quote) {
    return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
  }

  // Fetch allocations for this quote
  const { data: allocations, error } = await service
    .from("employee_allocations")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate pool usage
  const totalAllocated = (allocations ?? []).reduce(
    (sum, a) => sum + (a.seeds_allocated ?? 0),
    0
  );
  const poolTotal = quote.approved_seed_count ?? 0;

  return NextResponse.json({
    quote: {
      id: quote.id,
      company_name: quote.company_name,
      pool_total: poolTotal,
      pool_allocated: totalAllocated,
      pool_remaining: poolTotal - totalAllocated,
    },
    allocations: allocations ?? [],
  });
}

// ── POST ─────────────────────────────────────────────────────────────

interface CreateAllocationBody {
  quote_id: string;
  recipient_name: string;
  recipient_email: string;
  seeds_allocated: number;
  send_email?: boolean;
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  let body: CreateAllocationBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const { quote_id, recipient_name, recipient_email, seeds_allocated, send_email = true } = body;

  if (!quote_id || !recipient_name || !recipient_email || !seeds_allocated) {
    return NextResponse.json(
      { error: "quote_id, recipient_name, recipient_email ve seeds_allocated zorunludur." },
      { status: 400 }
    );
  }

  if (seeds_allocated < 1) {
    return NextResponse.json({ error: "En az 1 tohum atanmalıdır." }, { status: 400 });
  }

  const service = createServiceRoleClient();

  // Verify the quote belongs to this user and is PAID
  const { data: quote } = await service
    .from("corporate_quotes")
    .select("id, user_id, company_name, approved_seed_count, status")
    .eq("id", quote_id)
    .eq("user_id", session.user.id)
    .single();

  if (!quote) {
    return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
  }

  if (quote.status !== "PAID") {
    return NextResponse.json(
      { error: "Sadece ödenmiş teklifler için çalışan dağıtımı yapılabilir." },
      { status: 400 }
    );
  }

  // Check pool capacity
  const { data: existing } = await service
    .from("employee_allocations")
    .select("seeds_allocated")
    .eq("quote_id", quote_id);

  const totalAllocated = (existing ?? []).reduce(
    (sum, a) => sum + (a.seeds_allocated ?? 0),
    0
  );
  const poolTotal = quote.approved_seed_count ?? 0;

  if (totalAllocated + seeds_allocated > poolTotal) {
    return NextResponse.json(
      {
        error: `Yetersiz havuz. Kalan: ${poolTotal - totalAllocated} tohum, İstenen: ${seeds_allocated} tohum.`,
      },
      { status: 400 }
    );
  }

  // Create the allocation
  const { data: allocation, error: insertErr } = await service
    .from("employee_allocations")
    .insert({
      quote_id,
      company_id: session.user.id,
      recipient_name,
      recipient_email,
      seeds_allocated,
      email_sent: false,
    })
    .select()
    .single();

  if (insertErr || !allocation) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Dağıtım oluşturulamadı." },
      { status: 500 }
    );
  }

  // Create a certificate for this employee
  const { data: certificate } = await service
    .from("certificates")
    .insert({
      user_id: session.user.id,
      order_id: null,
      recipient_name,
      tree_count: seeds_allocated,
      forest_name: `${quote.company_name} Kurumsal Ormanı`,
      certificate_url: null,
    })
    .select("id")
    .single();

  // Link certificate to allocation
  if (certificate) {
    await service
      .from("employee_allocations")
      .update({ certificate_id: certificate.id })
      .eq("id", allocation.id);
  }

  // Send certificate email
  let emailSent = false;
  if (send_email) {
    try {
      await sendEmployeeCertificateEmail({
        recipientEmail: recipient_email,
        recipientName: recipient_name,
        companyName: quote.company_name,
        seedCount: seeds_allocated,
        certificateId: certificate?.id ?? null,
        allocationId: allocation.id,
      });
      await service
        .from("employee_allocations")
        .update({ email_sent: true })
        .eq("id", allocation.id);
      emailSent = true;
    } catch (e) {
      console.error("[employees] Email send failed:", e);
    }
  }

  return NextResponse.json({
    success: true,
    allocation: {
      ...allocation,
      certificate_id: certificate?.id ?? null,
    },
    email_sent: emailSent,
  });
}
