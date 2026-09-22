import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * Admin — Genel Bakış göstergeleri (satış modeli v2).
 *
 * Kaynaklar: release_orders (deneme siparişleri HARİÇ), order_invoices, lands (yalnız yayındaki
 * sahalar), service_requests, corporate_quotes (B2B). Eski bireysel satışın `orders` tablosu Faz 8'de
 * kaldırılan akışa aitti; burada sayılmaz.
 *
 * Tutarlar kuruş (tam sayı). Aylık grafik TL döner (grafik bileşeni TL bekler).
 */

/** Parası elimizde ve iade sürecinde olmayan siparişler — net tahsilat bunlardan hesaplanır. */
const COLLECTED = ["paid", "confirmed", "scheduled", "released", "monitoring", "completed"] as const;
/** İadesi bekleyenler: müşteri cayma bildirdi ya da satıcı iptal etti, iade henüz yapılmadı. */
const REFUND_PENDING = ["withdrawal_requested", "cancelled_by_seller"] as const;
const RELEASED = ["released", "monitoring", "completed"] as const;

const MONTH_LABEL = new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit", timeZone: "Europe/Istanbul" });
const monthKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Europe/Istanbul" }).format(d);

export async function GET(request: NextRequest) {
  const { admin, error: authError } = await requireAdmin(request);
  if (authError) return authError;

  const financial = admin?.role === "SUPER_ADMIN" || admin?.role === "FINANCE";
  const supabase = createServiceRoleClient();

  const [ordersRes, invoicesRes, landsRes, b2bRes, newRequestsRes, contactedRequestsRes] = await Promise.all([
    supabase
      .from("release_orders")
      .select("status, total_kurus, quantity, paid_at, batch_id")
      .eq("is_test", false)
      .not("paid_at", "is", null)
      .limit(20_000),
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

  if ([ordersRes, invoicesRes, landsRes, b2bRes, newRequestsRes, contactedRequestsRes].some((r) => r.error)) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const orders = ordersRes.data ?? [];
  const inStatus = (list: readonly string[]) => orders.filter((o) => list.includes(o.status as string));
  const collected = inStatus(COLLECTED);
  const publicLands = (landsRes.data ?? []).filter((l) => l.is_public);
  const b2bQuotes = b2bRes.data ?? [];

  // ── Aylık tahsilat ve tohum topu (son 6 ay, ödeme tarihine göre) ─────────────
  const now = new Date();
  const months: { key: string; month: string; revenue: number; seeds: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    months.push({ key: monthKey(d), month: MONTH_LABEL.format(d), revenue: 0, seeds: 0 });
  }
  for (const o of collected) {
    const bucket = months.find((m) => m.key === monthKey(new Date(o.paid_at as string)));
    if (!bucket) continue;
    bucket.revenue += Number(o.total_kurus) / 100;
    bucket.seeds += Number(o.quantity);
  }

  // ── Yayındaki sahalarda kapasite uyarıları (%90 ve üzeri dolu) ───────────────
  const capacityAlerts = publicLands
    .map((l) => {
      const used = (l.filled_seeds ?? 0) + (l.reserved_seeds ?? 0);
      const pct = l.capacity_seeds > 0 ? Math.round((used / l.capacity_seeds) * 100) : 0;
      return { id: l.id, name: l.name, pct, available: Math.max(l.capacity_seeds - used, 0), status: l.status, is_public: l.is_public };
    })
    .filter((l) => l.pct >= 90);

  return NextResponse.json({
    kpis: {
      ...(financial ? { netRevenueKurus: collected.reduce((s, o) => s + Number(o.total_kurus), 0) } : {}),
      orderCount: collected.length,
      releasedQuantity: inStatus(RELEASED).reduce((s, o) => s + Number(o.quantity), 0),
      pendingRefunds: inStatus(REFUND_PENDING).length,
      pendingInvoices: invoicesRes.count ?? 0,
      awaitingBatch: orders.filter((o) => o.status === "confirmed" && !o.batch_id).length,
      publicSites: publicLands.length,
      freeCapacity: publicLands.reduce((s, l) => s + Math.max(l.capacity_seeds - (l.filled_seeds ?? 0) - (l.reserved_seeds ?? 0), 0), 0),
      pendingB2b: b2bQuotes.filter((q) => ["PENDING", "pending"].includes(q.status)).length,
      quotedB2b: b2bQuotes.filter((q) => ["QUOTED", "quoted"].includes(q.status)).length,
      newRequests: newRequestsRes.count ?? 0,
      contactedRequests: contactedRequestsRes.count ?? 0,
    },
    monthlyGrowth: months.map(({ month, revenue, seeds }) => ({ month, seeds, ...(financial ? { revenue } : {}) })),
    capacityAlerts,
  });
}
