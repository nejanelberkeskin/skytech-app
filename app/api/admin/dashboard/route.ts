import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { can, requireAdminAccess } from "@/lib/admin/permissions";
import { FINANCE_DEFINITIONS_VERSION, loadFinanceOverview, monthLabel, type FinanceOverview } from "@/lib/finance/overview";

/**
 * Admin — Genel Bakış göstergeleri (satış modeli v2).
 *
 * Sipariş ve para göstergeleri tek finans hesabından gelir (lib/finance/overview.ts, SQL 020): satır sınırı
 * yok, deneme siparişleri hariç, dönem Europe/Istanbul. Tanımlar: web-brifler/18.
 *   netRevenueKurus  = elde tutulan sipariş tutarı (tüm zamanlar; iade sürecindekiler ve iade edilenler hariç)
 *   monthlyGrowth    = son 6 ay: net tahsilat (TL, nakit esası) ve ödeme ayına göre tohum topu adedi
 * Para alanları (`netRevenueKurus`, `revenue`, `overview`) yalnız `finance.read` iznine döner.
 * Alt sorgulardan biri bile okunamazsa 503: eksik veri sıfır gibi gösterilmez.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminAccess(request);
  if (guard.error) return guard.error;

  const financial = can(guard.access, "finance.read");
  const supabase = createServiceRoleClient();

  const [overviewRes, invoicesRes, landsRes, b2bRes, newRequestsRes, contactedRequestsRes] = await Promise.all([
    loadFinanceOverview(supabase).then(
      (data): { data: FinanceOverview; error: null } => ({ data, error: null }),
      (error: unknown) => ({ data: null, error })
    ),
    // Kesilmeyi bekleyen faturalar (deneme siparişlerininki hariç)
    supabase
      .from("order_invoices")
      .select("id, release_orders!inner(is_test)", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("release_orders.is_test", false),
    supabase.from("lands").select("id, name, capacity_seeds, filled_seeds, reserved_seeds, status, is_public"),
    supabase.from("corporate_quotes").select("id, status").in("status", ["PENDING", "pending", "QUOTED", "quoted"]),
    supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "contacted"),
  ]);

  const overview = overviewRes.data;
  if (!overview || [invoicesRes, landsRes, b2bRes, newRequestsRes, contactedRequestsRes].some((r) => r.error)) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const publicLands = (landsRes.data ?? []).filter((l) => l.is_public);
  const b2bQuotes = b2bRes.data ?? [];

  // ── Yayındaki sahalarda kapasite uyarıları (%90 ve üzeri dolu) ───────────────
  const capacityAlerts = publicLands
    .map((l) => {
      const used = (l.filled_seeds ?? 0) + (l.reserved_seeds ?? 0);
      const pct = l.capacity_seeds > 0 ? Math.round((used / l.capacity_seeds) * 100) : 0;
      return { id: l.id, name: l.name, pct, available: Math.max(l.capacity_seeds - used, 0), status: l.status, is_public: l.is_public };
    })
    .filter((l) => l.pct >= 90);

  return NextResponse.json(
    {
      definitionsVersion: FINANCE_DEFINITIONS_VERSION,
      kpis: {
        ...(financial ? { netRevenueKurus: overview.allTime.heldOrderValueKurus } : {}),
        orderCount: overview.allTime.heldOrderCount,
        releasedQuantity: overview.allTime.releasedQuantity,
        pendingRefunds: overview.liabilities.orderRefundLiabilityCount,
        pendingDuplicateRefunds: overview.liabilities.duplicateLiabilityCount,
        overdueRefunds: overview.liabilities.overdueRefundCount,
        pendingInvoices: invoicesRes.count ?? 0,
        awaitingBatch: overview.operations.awaitingBatchCount,
        publicSites: publicLands.length,
        freeCapacity: publicLands.reduce((s, l) => s + Math.max(l.capacity_seeds - (l.filled_seeds ?? 0) - (l.reserved_seeds ?? 0), 0), 0),
        pendingB2b: b2bQuotes.filter((q) => ["PENDING", "pending"].includes(q.status)).length,
        quotedB2b: b2bQuotes.filter((q) => ["QUOTED", "quoted"].includes(q.status)).length,
        newRequests: newRequestsRes.count ?? 0,
        contactedRequests: contactedRequestsRes.count ?? 0,
      },
      monthlyGrowth: overview.months.map((m) => ({
        month: monthLabel(m.key),
        seeds: m.paidQuantity,
        ...(financial ? { revenue: m.netCashKurus / 100 } : {}),
      })),
      capacityAlerts,
      ...(financial ? { overview } : {}),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
