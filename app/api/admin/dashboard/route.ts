import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasFullScope, requireAdminAccess } from "@/lib/admin/permissions";
import { FINANCE_DEFINITIONS_VERSION, loadFinanceOverview, monthLabel } from "@/lib/finance/overview";
import type { DashboardData } from "@/lib/admin/dashboard-dto";
import { readPages } from "@/lib/admin/read-pages";

const NO_STORE = { "Cache-Control": "private, no-store" };

function exactCount(result: { count?: number | null; error?: unknown } | null | undefined): number {
  if (!result || result.error || typeof result.count !== "number" || !Number.isSafeInteger(result.count) || result.count < 0) {
    throw new Error("dashboard_count_unavailable");
  }
  return result.count;
}

/**
 * Admin — Genel Bakış göstergeleri (satış modeli v2).
 *
 * Sipariş ve para göstergeleri tek finans hesabından gelir (lib/finance/overview.ts, SQL 020): satır sınırı
 * yok, deneme siparişleri hariç, dönem Europe/Istanbul. Tanımlar: web-brifler/18.
 *   netRevenueKurus  = elde tutulan sipariş tutarı (tüm zamanlar; iade sürecindekiler ve iade edilenler hariç)
 *   monthlyGrowth    = son 6 ay: net tahsilat (TL, nakit esası) ve ödeme ayına göre tohum topu adedi
 * Her metrik kendi tam kapsamlı okuma iznine bağlıdır. Ham overview dışarı çıkmaz.
 * Yalnız izinli alt sorgular çalışır; bunların hatası 503 olur, eksik veri sıfır gösterilmez.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminAccess(request);
  if (guard.error) return guard.error;

  // Genel Bakış toplamlarında dar kapsam erişim vermez.
  const orders = hasFullScope(guard.access, "orders.read");
  const batches = hasFullScope(guard.access, "batches.read");
  const sites = hasFullScope(guard.access, "sites.read");
  const requests = hasFullScope(guard.access, "requests.read");
  const invoices = hasFullScope(guard.access, "invoices.read");
  const financial = hasFullScope(guard.access, "finance.read");
  // Mevcut B2B API'si ve menüsü eski rol kapısı kullanır; özel finans rolü bunu açmaz.
  const b2b = guard.admin.role === "SUPER_ADMIN" || guard.admin.role === "FINANCE";

  try {
    const supabase = createServiceRoleClient();

    const [overview, invoicesRes, lands, pendingB2bRes, quotedB2bRes, newRequestsRes, contactedRequestsRes] = await Promise.all([
      orders || batches || financial ? loadFinanceOverview(supabase) : null,
      // Kesilmeyi bekleyen faturalar (deneme siparişlerininki hariç)
      invoices ? supabase
        .from("order_invoices")
        .select("id, release_orders!inner(is_test)", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("release_orders.is_test", false) : null,
      sites ? readPages(async (from, to) => {
        const page = await supabase.from("lands").select("id, name, capacity_seeds, filled_seeds, reserved_seeds, status, is_public")
          .eq("is_public", true).order("id", { ascending: true }).range(from, to);
        if (!page || page.error || !Array.isArray(page.data)) throw new Error("dashboard_sites_unavailable");
        return page;
      }) : null,
      b2b ? supabase.from("corporate_quotes").select("id", { count: "exact", head: true }).in("status", ["PENDING", "pending"]) : null,
      b2b ? supabase.from("corporate_quotes").select("id", { count: "exact", head: true }).in("status", ["QUOTED", "quoted"]) : null,
      requests ? supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "new") : null,
      requests ? supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "contacted") : null,
    ]);

    // head/count yanıtında data:null normaldir; count:null/undefined ise veri
    // yoktur, sıfır değildir. Devre dışı izin grubunda sorgu hiç çalıştırılmaz.
    const pendingInvoices = invoices ? exactCount(invoicesRes) : null;
    const pendingB2b = b2b ? exactCount(pendingB2bRes) : null;
    const quotedB2b = b2b ? exactCount(quotedB2bRes) : null;
    const newRequests = requests ? exactCount(newRequestsRes) : null;
    const contactedRequests = requests ? exactCount(contactedRequestsRes) : null;
    const publicLands = lands ?? [];

    // ── Yayındaki sahalarda kapasite uyarıları (%90 ve üzeri dolu) ───────────────
    const capacityAlerts = publicLands
      .map((l) => {
        const used = (l.filled_seeds ?? 0) + (l.reserved_seeds ?? 0);
        const pct = l.capacity_seeds > 0 ? Math.round((used / l.capacity_seeds) * 100) : 0;
        return { id: l.id, name: l.name, pct, available: Math.max(l.capacity_seeds - used, 0), status: l.status, is_public: l.is_public };
      })
      .filter((l) => l.pct >= 90);

    const data: DashboardData = {
        definitionsVersion: FINANCE_DEFINITIONS_VERSION,
        generatedAt: overview?.generatedAt || new Date().toISOString(),
        kpis: {
          ...(financial && overview ? {
            netRevenueKurus: overview.allTime.heldOrderValueKurus,
            pendingRefunds: overview.liabilities.orderRefundLiabilityCount,
            pendingDuplicateRefunds: overview.liabilities.duplicateLiabilityCount,
            overdueRefunds: overview.liabilities.overdueRefundCount,
          } : {}),
          ...(orders && overview ? {
            orderCount: overview.allTime.heldOrderCount,
            releasedQuantity: overview.allTime.releasedQuantity,
          } : {}),
          ...(pendingInvoices !== null ? { pendingInvoices } : {}),
          ...(batches && overview ? { awaitingBatch: overview.operations.awaitingBatchCount } : {}),
          ...(sites ? {
            publicSites: publicLands.length,
            freeCapacity: publicLands.reduce((s, l) => s + Math.max(l.capacity_seeds - (l.filled_seeds ?? 0) - (l.reserved_seeds ?? 0), 0), 0),
          } : {}),
          ...(pendingB2b !== null && quotedB2b !== null ? { pendingB2b, quotedB2b } : {}),
          ...(newRequests !== null && contactedRequests !== null ? { newRequests, contactedRequests } : {}),
        },
        ...(overview && (orders || financial) ? { monthlyGrowth: overview.months.map((m) => ({
          month: monthLabel(m.key),
          ...(orders ? { seeds: m.paidQuantity } : {}),
          ...(financial ? { revenue: m.netCashKurus / 100 } : {}),
        })) } : {}),
        ...(sites ? { capacityAlerts } : {}),
      };
    return NextResponse.json(data, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
