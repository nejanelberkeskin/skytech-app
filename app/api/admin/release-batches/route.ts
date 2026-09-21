import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";
import { confirmDueOrders } from "@/lib/orders/admin-actions";
import { createBatch } from "@/lib/orders/batches";
import { nextSeason, seasonFor } from "@/lib/orders/schedule";

/**
 * Admin — Bırakma partileri
 *
 * GET  /api/admin/release-batches → { batches, lands, seasons, waiting }
 *      batches: parti + saha adı + içindeki sipariş sayısı ve toplam tohum topu adedi
 *      waiting: partiye alınmayı bekleyen (kesinleşmiş, partisiz) siparişler — saha × sezon
 * POST /api/admin/release-batches { landId, seasonLabel, title?, plannedOn?, notes? } → { ok, batch }
 *
 * Görüntüleme: SUPER_ADMIN, OPERATIONS, FINANCE. Yönetim: SUPER_ADMIN, OPERATIONS.
 */
const VIEW_ROLES = ["SUPER_ADMIN", "OPERATIONS", "FINANCE"] as const;
const MANAGE_ROLES = ["SUPER_ADMIN", "OPERATIONS"] as const;

export async function GET(request: NextRequest) {
  const { admin, error: authError } = await requireAdmin(request, [...VIEW_ROLES]);
  if (authError || !admin) return authError ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createServiceRoleClient();
  await confirmDueOrders(supabase).catch(() => 0);

  const [batches, lands, orders] = await Promise.all([
    supabase.from("release_batches").select("id, land_id, season_label, title, planned_on, released_on, video_url, notes, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("lands").select("id, name, status, is_public").order("name", { ascending: true }),
    // Parti istatistikleri ve bekleyenler: yalnız partiyle ilgili durumlar
    supabase.from("release_orders").select("id, land_id, season_label, batch_id, quantity, status, is_test").in("status", ["confirmed", "scheduled", "released", "monitoring", "completed"]).limit(5000),
  ]);
  if (batches.error || lands.error || orders.error) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const landName = new Map((lands.data ?? []).map((l) => [l.id as string, l.name as string]));
  const stats = new Map<string, { orders: number; quantity: number }>();
  const waiting = new Map<string, { landId: string; seasonLabel: string; orders: number; quantity: number }>();
  for (const o of orders.data ?? []) {
    if (o.batch_id) {
      const s = stats.get(o.batch_id as string) ?? { orders: 0, quantity: 0 };
      s.orders++;
      s.quantity += o.quantity as number;
      stats.set(o.batch_id as string, s);
    } else if (o.status === "confirmed") {
      const key = `${o.land_id}|${o.season_label}`;
      const w = waiting.get(key) ?? { landId: o.land_id as string, seasonLabel: o.season_label as string, orders: 0, quantity: 0 };
      w.orders++;
      w.quantity += o.quantity as number;
      waiting.set(key, w);
    }
  }

  const current = seasonFor();
  return NextResponse.json({
    batches: (batches.data ?? []).map((b) => ({ ...b, land_name: landName.get(b.land_id as string) ?? "—", ...(stats.get(b.id as string) ?? { orders: 0, quantity: 0 }) })),
    lands: lands.data ?? [],
    seasons: [current.label, nextSeason(current).label],
    waiting: [...waiting.values()].map((w) => ({ ...w, landName: landName.get(w.landId) ?? "—" })),
    canManage: (MANAGE_ROLES as readonly string[]).includes(admin.role),
  });
}

const createSchema = z.object({
  landId: z.uuid(),
  seasonLabel: z.string().regex(/^\d{4}-\d{4}$/),
  title: z.string().trim().max(120).nullable().optional(),
  plannedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdmin(request, [...MANAGE_ROLES]);
  if (authError || !admin) return authError ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const input = parsed.data;

  const supabase = createServiceRoleClient();
  const result = await createBatch(
    { landId: input.landId, seasonLabel: input.seasonLabel, title: input.title || null, plannedOn: input.plannedOn || null, notes: input.notes || null },
    admin.user_id,
    supabase
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : result.error === "unavailable" ? 503 : 400 });

  await auditLog(supabase, { admin, action: "CREATE", entity: "release_batch", entityId: result.batch.id, details: { landId: input.landId, seasonLabel: input.seasonLabel, plannedOn: input.plannedOn ?? null }, ip: getClientIP(request) });
  return NextResponse.json({ ok: true, batch: result.batch }, { status: 201 });
}
