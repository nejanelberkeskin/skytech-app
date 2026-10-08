import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { B2bPayment } from "@/lib/admin/finance";
import { readPages } from "@/lib/admin/read-pages";
import { FINANCE_DEFINITIONS_VERSION, istanbulMonthKey, loadFinanceOverview } from "@/lib/finance/overview";

/**
 * GET /api/admin/finance — Finans ekranı. İzin: finance.read (bugün SUPER_ADMIN, FINANCE).
 *
 * Bırakma siparişi tutarları tek finans hesabından gelir (lib/finance/overview.ts, SQL 020; tanımlar
 * web-brifler/18). B2B ayrı kaynaktır (payments, checkout_type=b2b) ve bırakma toplamlarına karışmaz.
 * Üst düzey eski alanlar mevcut ekran için korunur; yeni ekran `overview` alanını kullanır.
 */
interface RecentOrderRow {
  order_no: string;
  buyer_email: string;
  quantity: number;
  total_kurus: number | string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "finance.read");
  if (guard.error) return guard.error;

  try {
    const db = createServiceRoleClient();
    const [overview, b2b, quotes, invoices, recent] = await Promise.all([
      loadFinanceOverview(db),
      readPages<B2bPayment>((a, b) =>
        db
          .from("payments")
          .select("id, amount, status, updated_at, created_at, orders(buyer_email,total_seeds)")
          .eq("metadata->>checkout_type", "b2b")
          .order("id")
          .range(a, b) as unknown as PromiseLike<{ data: B2bPayment[] | null; error: unknown }>
      ),
      db.from("corporate_quotes").select("id", { count: "exact", head: true }).in("status", ["PENDING", "QUOTED", "pending", "quoted"]),
      db
        .from("order_invoices")
        .select("id, release_orders!inner(is_test)", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("release_orders.is_test", false),
      db
        .from("release_orders")
        .select("order_no, buyer_email, quantity, total_kurus, status, paid_at, created_at")
        .eq("is_test", false)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (quotes.error || invoices.error || recent.error) throw new Error("report_unavailable");

    const month = overview.currentMonth;
    const liabilities = overview.liabilities;
    const b2bMonthlyKurus = b2b
      .filter((p) => p.status === "success" && istanbulMonthKey(p.updated_at) === month.key)
      .reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0);

    const recentTransactions = [
      ...((recent.data ?? []) as RecentOrderRow[]).map((o) => ({
        id: o.order_no,
        date: o.paid_at ?? o.created_at,
        customer: o.buyer_email,
        seeds: o.quantity,
        amount: Number(o.total_kurus) / 100,
        type: "Bırakma hizmeti",
        status: o.status === "refunded" ? "refunded" : o.paid_at ? "success" : o.status === "expired" ? "expired" : "pending",
      })),
      ...b2b.map((p) => ({
        id: p.id,
        date: p.updated_at ?? p.created_at,
        customer: p.orders?.buyer_email ?? "—",
        seeds: p.orders?.total_seeds ?? 0,
        amount: Number(p.amount),
        type: "B2B — ayrı kaynak",
        status: p.status,
      })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);

    return NextResponse.json(
      {
        definitionsVersion: FINANCE_DEFINITIONS_VERSION,
        // Mevcut ekranın alanları (TL). Tanımlar web-brifler/18 §3.
        monthlyRevenue: month.netCashKurus / 100,
        monthlyGross: (month.orderCollectionsKurus + month.duplicateChargesKurus) / 100,
        monthlyRefunds: (month.orderRefundsKurus + month.duplicateRefundsKurus) / 100,
        pendingRefundAmount: (liabilities.orderRefundLiabilityKurus + liabilities.duplicateLiabilityKurus) / 100,
        pendingAmount: overview.pending.payableKurus / 100,
        b2bMonthlyRevenue: b2bMonthlyKurus / 100,
        activeQuotes: quotes.count ?? 0,
        pendingInvoices: invoices.count ?? 0,
        recentTransactions,
        // Yeni ekranın kaynağı (kuruş)
        overview,
        b2b: { monthlyKurus: b2bMonthlyKurus, monthBasis: "payments.updated_at" },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Finans verileri alınamadı. Lütfen yeniden deneyin." }, { status: 503 });
  }
}
