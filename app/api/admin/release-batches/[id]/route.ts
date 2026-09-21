import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";
import { publicOrigin } from "@/lib/mail";
import { assignOrders, completeRelease, deleteBatch, unassignOrder, updateBatch, type BatchError } from "@/lib/orders/batches";
import { sendPendingCertificateEmails } from "@/lib/orders/certificates";
import { publishBatchVideo, sendPendingVideoEmails } from "@/lib/orders/jobs";

/**
 * Admin — Bırakma partisi (ayrıntı + işlemler)
 *
 * GET    → { batch, orders, candidates }   candidates: aynı saha + sezon, kesinleşmiş, partisiz
 * PATCH  { title?, plannedOn?, notes?, monitoringReportUrl? }
 * POST   { action:"assign", orderIds[] } | { action:"unassign", orderId } | { action:"release", releasedOn }
 *        | { action:"publish_video", videoUrl }   — yalnız bırakılmış parti; ilk yayımda müşterilere bildirim gider
 * DELETE → yalnız boş ve bırakılmamış parti
 *
 * "release" GERİ ALINAMAZ: siparişler `released` olur, kapasite kalıcıya geçer, fatura kuyruğu dolar,
 * Katılım Sertifikaları düzenlenir ve müşterilere bildirilir (yanıtı bekletmeden; kalanı zamanlanmış iş tamamlar).
 */
const VIEW_ROLES = ["SUPER_ADMIN", "OPERATIONS", "FINANCE"] as const;
const MANAGE_ROLES = ["SUPER_ADMIN", "OPERATIONS"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORDER_COLUMNS = "id, order_no, status, is_test, quantity, total_kurus, buyer_first_name, buyer_last_name, certificate_name, paid_at, confirmed_at, withdrawal_deadline, payment_meta";

const STATUS_FOR: Record<BatchError, number> = { not_found: 404, invalid_state: 409, mismatch: 409, capacity_not_held: 409, invalid_date: 400, empty: 400, unavailable: 503 };

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { error: authError } = await requireAdmin(request, [...VIEW_ROLES]);
  if (authError) return authError;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data: batch, error } = await supabase.from("release_batches").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (!batch) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [orders, candidates, land] = await Promise.all([
    supabase.from("release_orders").select(ORDER_COLUMNS).eq("batch_id", id).order("created_at", { ascending: true }),
    batch.released_on
      ? Promise.resolve({ data: [] })
      : supabase.from("release_orders").select(ORDER_COLUMNS).eq("status", "confirmed").is("batch_id", null).eq("land_id", batch.land_id).eq("season_label", batch.season_label).order("confirmed_at", { ascending: true }).limit(500),
    supabase.from("lands").select("name, capacity_seeds, filled_seeds, reserved_seeds").eq("id", batch.land_id).maybeSingle(),
  ]);

  const slim = (rows: Record<string, unknown>[] | null) =>
    (rows ?? []).map(({ payment_meta, ...o }) => ({ ...o, capacity_held: (payment_meta as Record<string, unknown> | null)?.capacityHeld !== false }));
  return NextResponse.json({ batch, land: land.data ?? null, orders: slim(orders.data as Record<string, unknown>[] | null), candidates: slim(candidates.data as Record<string, unknown>[] | null) });
}

const patchSchema = z.object({
  title: z.string().trim().max(120).nullable().optional(),
  plannedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  monitoringReportUrl: z.string().trim().max(500).regex(/^https:\/\/\S+$/).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { admin, error: authError } = await requireAdmin(request, [...MANAGE_ROLES]);
  if (authError || !admin) return authError ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const supabase = createServiceRoleClient();
  const result = await updateBatch(
    id,
    { title: parsed.data.title, plannedOn: parsed.data.plannedOn, notes: parsed.data.notes, monitoringReportUrl: parsed.data.monitoringReportUrl },
    supabase
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS_FOR[result.error] });
  await auditLog(supabase, { admin, action: "UPDATE", entity: "release_batch", entityId: id, details: parsed.data, ip: getClientIP(request) });
  return NextResponse.json({ ok: true, batch: result.batch });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), orderIds: z.array(z.uuid()).min(1).max(500) }),
  z.object({ action: z.literal("unassign"), orderId: z.uuid() }),
  z.object({ action: z.literal("release"), releasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ action: z.literal("publish_video"), videoUrl: z.string().trim().min(10).max(300) }),
]);

export async function POST(request: NextRequest, { params }: Ctx) {
  const { admin, error: authError } = await requireAdmin(request, [...MANAGE_ROLES]);
  if (authError || !admin) return authError ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const input = parsed.data;

  const supabase = createServiceRoleClient();
  const origin = publicOrigin(request.nextUrl.origin);

  if (input.action === "publish_video") {
    const published = await publishBatchVideo(id, input.videoUrl, supabase);
    await auditLog(supabase, { admin, action: "UPDATE", entity: "release_batch", entityId: id, details: { action: "publish_video", ...published }, ip: getClientIP(request) });
    if (!published.ok) {
      const status = published.error === "not_found" ? 404 : published.error === "unavailable" ? 503 : published.error === "invalid_url" ? 400 : 409;
      return NextResponse.json({ error: published.error }, { status });
    }
    // İlk yayımda müşterilere bildirim gider (kalanını zamanlanmış iş tamamlar).
    if (published.firstPublication) after(() => sendPendingVideoEmails(origin));
    return NextResponse.json(published);
  }

  const result =
    input.action === "assign"
      ? await assignOrders(id, input.orderIds, admin.user_id, supabase)
      : input.action === "unassign"
        ? await unassignOrder(input.orderId, admin.user_id, supabase)
        : await completeRelease(id, input.releasedOn, admin.user_id, supabase);
  if (input.action === "release" && result.ok) after(() => sendPendingCertificateEmails(origin));

  await auditLog(supabase, {
    admin,
    action: "UPDATE",
    entity: "release_batch",
    entityId: id,
    details: { action: input.action, ...(result.ok ? result : { ok: false, error: result.error, detail: result.detail ?? null }) },
    ip: getClientIP(request),
  });
  if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail ?? null }, { status: STATUS_FOR[result.error] });
  return NextResponse.json(result);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { admin, error: authError } = await requireAdmin(request, [...MANAGE_ROLES]);
  if (authError || !admin) return authError ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const supabase = createServiceRoleClient();
  const result = await deleteBatch(id, supabase);
  if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail ?? null }, { status: STATUS_FOR[result.error] });
  await auditLog(supabase, { admin, action: "DELETE", entity: "release_batch", entityId: id, ip: getClientIP(request) });
  return NextResponse.json({ ok: true });
}
