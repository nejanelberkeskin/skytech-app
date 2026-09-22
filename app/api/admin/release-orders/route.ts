import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { confirmDueOrders, duplicateChargesFrom } from "@/lib/orders/admin-actions";
import { expireStaleOrders } from "@/lib/orders/create";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/types";

/**
 * Admin — Bırakma siparişleri (liste)
 *
 * GET /api/admin/release-orders?status=&q=&test=all|only|hide&flag=&page=&pageSize=
 *     → { items, total, page, pageSize, counts, alerts }
 *
 * flag: refund_pending | invoice_pending | duplicate | capacity
 * Roller: SUPER_ADMIN, FINANCE, OPERATIONS. Liste; kimlik/vergi no, onay kayıtları ve ödeme
 * ayrıntıları taşımaz (ayrıntı ucunda, role göre).
 *
 * Liste açılırken iki "tembel" iş de yapılır (zamanlanmış işler Faz 6'da gelene kadar):
 * süresi dolmuş ödenmemiş siparişler kapatılır, cayma süresi dolan siparişler `confirmed` olur.
 */
const ROLES = ["SUPER_ADMIN", "FINANCE", "OPERATIONS"] as const;
const FLAGS = ["refund_pending", "invoice_pending", "duplicate", "capacity"] as const;
type Flag = (typeof FLAGS)[number];

const SELECT = [
  "id", "order_no", "status", "is_test", "locale", "created_at", "paid_at", "quantity", "total_kurus",
  "buyer_type", "buyer_first_name", "buyer_last_name", "buyer_email", "season_label", "batch_id",
  "withdrawal_deadline", "performance_deadline", "payment_provider", "certificate_name",
  "site_name:site_snapshot->>name", "company_title:invoice->>companyTitle",
].join(", ");

function sanitizeSearch(q: string | null): string | null {
  if (!q) return null;
  const clean = q.replace(/[^\p{L}\p{N}@+.\s-]/gu, "").trim().slice(0, 60);
  return clean.length >= 2 ? clean : null;
}

type Db = ReturnType<typeof createServiceRoleClient>;

/** İade edilmemiş çift tahsilatı olan siparişler. */
async function duplicateOrderIds(supabase: Db): Promise<string[]> {
  const { data } = await supabase
    .from("order_events")
    .select("order_id, type, data")
    .in("type", ["payment_succeeded", "refund_succeeded"])
    .eq("data->>duplicate", "true")
    .limit(2000);
  const byOrder = new Map<string, { type: string; data: Record<string, unknown> | null }[]>();
  for (const e of data ?? []) {
    const list = byOrder.get(e.order_id as string) ?? [];
    list.push({ type: e.type as string, data: e.data as Record<string, unknown> | null });
    byOrder.set(e.order_id as string, list);
  }
  return [...byOrder.entries()].filter(([, events]) => duplicateChargesFrom(events).some((c) => !c.refunded)).map(([id]) => id);
}

async function flaggedIds(supabase: Db, flag: Flag): Promise<string[]> {
  if (flag === "refund_pending") {
    const { data } = await supabase.from("order_refunds").select("order_id").in("status", ["pending", "failed"]).limit(2000);
    return [...new Set((data ?? []).map((r) => r.order_id as string))];
  }
  if (flag === "invoice_pending") {
    const { data } = await supabase.from("order_invoices").select("order_id").eq("status", "pending").limit(2000);
    return [...new Set((data ?? []).map((r) => r.order_id as string))];
  }
  if (flag === "duplicate") return duplicateOrderIds(supabase);
  const { data } = await supabase.from("release_orders").select("id").eq("payment_meta->>capacityHeld", "false").limit(2000);
  return (data ?? []).map((r) => r.id as string);
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request, [...ROLES]);
  if (authError) return authError;

  const sp = new URL(request.url).searchParams;
  const status = sp.get("status");
  const test = sp.get("test") ?? "all";
  const flag = sp.get("flag");
  const q = sanitizeSearch(sp.get("q"));
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(sp.get("pageSize") ?? "25", 10) || 25));

  if (status && !(ORDER_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  if (flag && !(FLAGS as readonly string[]).includes(flag)) return NextResponse.json({ error: "invalid_flag" }, { status: 400 });
  if (!["all", "only", "hide"].includes(test)) return NextResponse.json({ error: "invalid_test" }, { status: 400 });

  const supabase = createServiceRoleClient();
  await Promise.allSettled([expireStaleOrders(supabase), confirmDueOrders(supabase)]);

  let query = supabase
    .from("release_orders")
    .select(SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (status) query = query.eq("status", status);
  if (test === "only") query = query.eq("is_test", true);
  if (test === "hide") query = query.eq("is_test", false);
  if (flag) {
    const ids = await flaggedIds(supabase, flag as Flag);
    if (ids.length === 0) query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    else query = query.in("id", ids.slice(0, 500));
  }
  if (q) {
    const like = `%${q}%`;
    const digits = q.replace(/[^\d]/g, "").replace(/^0+/, "");
    const filters = [
      `order_no.ilike.${like.toUpperCase()}`,
      `buyer_first_name.ilike.${like}`,
      `buyer_last_name.ilike.${like}`,
      `buyer_email.ilike.${like}`,
      `certificate_name.ilike.${like}`,
    ];
    if (digits.length >= 3) filters.push(`buyer_phone.ilike.%${digits}%`);
    query = query.or(filters.join(","));
  }

  const countFor = (s: OrderStatus) => {
    let b = supabase.from("release_orders").select("id", { count: "exact", head: true }).eq("status", s);
    if (test === "only") b = b.eq("is_test", true);
    if (test === "hide") b = b.eq("is_test", false);
    return b;
  };
  const [listRes, refundIds, invoiceIds, dupIds, capacityIds, ...countRes] = await Promise.all([
    query,
    flaggedIds(supabase, "refund_pending"),
    flaggedIds(supabase, "invoice_pending"),
    flaggedIds(supabase, "duplicate"),
    flaggedIds(supabase, "capacity"),
    ...ORDER_STATUSES.map((s) => countFor(s)),
  ]);

  if (listRes.error) {
    console.error("[admin/release-orders] liste hatası:", listRes.error.message);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const counts = Object.fromEntries(ORDER_STATUSES.map((s, i) => [s, countRes[i].count ?? 0])) as Record<OrderStatus, number>;
  return NextResponse.json({
    items: listRes.data ?? [],
    total: listRes.count ?? 0,
    page,
    pageSize,
    counts,
    alerts: {
      refund_pending: refundIds.length,
      invoice_pending: invoiceIds.length,
      duplicate: dupIds.length,
      capacity: capacityIds.length,
    },
  });
}
