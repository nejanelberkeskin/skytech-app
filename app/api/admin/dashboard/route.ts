import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  const supabase = createServiceRoleClient();

  // ── Paralel sorgular ─────────────────────────────────────────────────────
  const [ordersRes, landsRes, b2bRes, monthlyRes] = await Promise.all([
    // Tüm ödenmiş siparişler (ciro + tohum toplamı)
    supabase
      .from("orders")
      .select("total_price, total_seeds, created_at, status")
      .in("status", ["confirmed", "delivered", "shipped", "preparing"]),

    // Arazi kapasiteleri
    supabase
      .from("lands")
      .select("id, name, capacity_seeds, filled_seeds, reserved_seeds, status, is_public"),

    // Bekleyen B2B teklifler
    supabase
      .from("corporate_quotes")
      .select("id, status, approved_price")
      .in("status", ["PENDING", "pending", "QUOTED", "quoted"]),

    // Son 6 aylık sipariş verileri (aylık gruplama için)
    supabase
      .from("orders")
      .select("total_price, total_seeds, created_at")
      .in("status", ["confirmed", "delivered", "shipped", "preparing"])
      .gte("created_at", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const orders = ordersRes.data ?? [];
  const lands = landsRes.data ?? [];
  const b2bQuotes = b2bRes.data ?? [];
  const recentOrders = monthlyRes.data ?? [];

  // ── KPI Hesapları ────────────────────────────────────────────────────────
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_price || 0), 0);
  const totalFilledSeeds = lands.reduce((s, l) => s + (l.filled_seeds || 0), 0);
  const totalCapacity = lands.reduce((s, l) => s + (l.capacity_seeds || 0), 0);
  const carbonTons = Math.round(totalFilledSeeds * 0.025);
  const pendingB2b = b2bQuotes.filter((q) =>
    ["PENDING", "pending"].includes(q.status)
  ).length;
  const quotedB2b = b2bQuotes.filter((q) =>
    ["QUOTED", "quoted"].includes(q.status)
  ).length;

  // ── Aylık büyüme verileri (son 6 ay) ────────────────────────────────────
  const monthlyMap: Record<string, { revenue: number; seeds: number; month: string }> = {};

  recentOrders.forEach((o) => {
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("tr-TR", { month: "short", year: "2-digit" });
    if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, seeds: 0, month: label };
    monthlyMap[key].revenue += Number(o.total_price || 0);
    monthlyMap[key].seeds += Number(o.total_seeds || 0);
  });

  // Son 6 ayı sıralı döndür
  const monthlyGrowth = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, v]) => v);

  // Eğer veri yoksa örnek months ekle (grafik boş görünmesin)
  if (monthlyGrowth.length === 0) {
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyGrowth.push({
        month: d.toLocaleString("tr-TR", { month: "short", year: "2-digit" }),
        revenue: 0,
        seeds: 0,
      });
    }
  }

  // ── Kapasite Uyarıları (>90% dolu) ──────────────────────────────────────
  const capacityAlerts = lands
    .filter((l) => {
      const used = l.filled_seeds + l.reserved_seeds;
      const pct = l.capacity_seeds > 0 ? (used / l.capacity_seeds) * 100 : 0;
      return pct >= 90;
    })
    .map((l) => {
      const used = l.filled_seeds + l.reserved_seeds;
      const pct = Math.round((used / l.capacity_seeds) * 100);
      return {
        id: l.id,
        name: l.name,
        pct,
        available: l.capacity_seeds - used,
        status: l.status,
        is_public: l.is_public,
      };
    });

  return NextResponse.json({
    kpis: {
      totalRevenue,
      totalFilledSeeds,
      totalCapacity,
      carbonTons,
      pendingB2b,
      quotedB2b,
      totalLands: lands.length,
    },
    monthlyGrowth,
    capacityAlerts,
  });
}
