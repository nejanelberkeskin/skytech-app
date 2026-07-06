/**
 * GET /api/admin/finance
 *
 * Finans dashboard verileri:
 *   - Bu ay ciro (paid orders)
 *   - Bekleyen ödeme (pending orders)
 *   - Aktif kurumsal teklif sayısı
 *   - Son işlemler (son 20 ödeme)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request, ["SUPER_ADMIN", "FINANCE"]);
  if (error) return error;

  const supabase = createServiceRoleClient();

  // Bu ayın başlangıcı
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Paralel sorgular
  const [
    paidOrdersRes,
    pendingOrdersRes,
    activeQuotesRes,
    recentPaymentsRes,
  ] = await Promise.all([
    // Bu ay ödenen siparişler — toplam ciro
    supabase
      .from("orders")
      .select("total_amount")
      .eq("payment_status", "paid")
      .gte("updated_at", monthStart),

    // Bekleyen ödemeler
    supabase
      .from("orders")
      .select("total_amount")
      .eq("payment_status", "pending")
      .neq("status", "expired")
      .neq("status", "released"),

    // Aktif kurumsal teklifler (PENDING + QUOTED)
    supabase
      .from("corporate_quotes")
      .select("id", { count: "exact", head: true })
      .in("status", ["PENDING", "QUOTED"]),

    // Son 20 ödeme
    supabase
      .from("payments")
      .select(`
        id,
        order_id,
        amount,
        currency,
        status,
        payment_method,
        metadata,
        created_at,
        orders!inner(
          buyer_email,
          total_seeds,
          order_type,
          metadata
        )
      `)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Ciro hesapla
  const monthlyRevenue = (paidOrdersRes.data ?? []).reduce(
    (sum, o) => sum + (parseFloat(o.total_amount) || 0),
    0
  );

  const pendingAmount = (pendingOrdersRes.data ?? []).reduce(
    (sum, o) => sum + (parseFloat(o.total_amount) || 0),
    0
  );

  // Son işlemleri formatlı döndür
  const recentTransactions = (recentPaymentsRes.data ?? []).map((p) => {
    const order = p.orders as unknown as {
      buyer_email: string;
      total_seeds: number;
      order_type: string;
      metadata: Record<string, unknown> | null;
    };
    const meta = p.metadata as Record<string, unknown> | null;
    const orderMeta = order?.metadata as Record<string, unknown> | null;

    return {
      id: orderMeta?.siparis_no ?? p.order_id?.slice(0, 8) ?? p.id.slice(0, 8),
      date: p.created_at,
      customer: (meta?.buyer_name as string) ?? order?.buyer_email ?? "—",
      seeds: order?.total_seeds ?? 0,
      amount: p.amount,
      type: order?.order_type === "gift"
        ? "Hediye"
        : order?.order_type === "reservation"
        ? "Arazi Ekim"
        : "Fiziksel",
      status: p.status, // "success" | "pending" | "failed"
    };
  });

  return NextResponse.json({
    monthlyRevenue,
    pendingAmount,
    activeQuotes: activeQuotesRes.count ?? 0,
    recentTransactions,
  });
}
