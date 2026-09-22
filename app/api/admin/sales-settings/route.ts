import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";
import {
  DEFAULT_SALES_SETTINGS,
  SALES_SETTINGS_TAG,
  loadSalesSettings,
  quoteVersion,
  updateSalesSettings,
} from "@/lib/orders/settings";
import { QUOTE_FIELDS, diffSettings, salesSettingsSchema, settingsFieldErrors } from "@/lib/orders/settings-schema";

/**
 * Admin — Satış ayarları (tek satır `sales_settings`)
 *
 * GET /api/admin/sales-settings
 *   → { settings, updatedAt, defaults, quoteVersion, openCheckouts, history }
 *     openCheckouts: ödeme bekleyen (gerçek) sipariş sayısı — bu siparişler kendi tutarlarıyla sürer
 *     history: son değişiklikler (denetim kaydından: kim, ne zaman, hangi alan)
 * PUT /api/admin/sales-settings { settings, expectedUpdatedAt }
 *   → { ok, settings, updatedAt, quoteChanged } · 400 validation · 409 conflict (arada başkası kaydetti)
 *
 * Yalnız SUPER_ADMIN (plan §7). Her kayıt admin_audit_logs'a alan alan yazılır.
 */
const ROLES = ["SUPER_ADMIN"] as const;
const ENTITY = "sales_settings";

async function history(supabase: ReturnType<typeof createServiceRoleClient>) {
  const { data } = await supabase
    .from("admin_audit_logs")
    .select("admin_email, created_at, details")
    .eq("entity", ENTITY)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []).map((r) => ({
    by: r.admin_email as string | null,
    at: r.created_at as string,
    changes: Array.isArray((r.details as { changes?: unknown })?.changes)
      ? ((r.details as { changes: { field: string; from: unknown; to: unknown }[] }).changes)
      : [],
  }));
}

export async function GET(request: NextRequest) {
  const { admin, error: authError } = await requireAdmin(request, [...ROLES]);
  if (authError || !admin) return authError ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createServiceRoleClient();
  try {
    const [record, open, past] = await Promise.all([
      loadSalesSettings(supabase),
      supabase
        .from("release_orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "awaiting_payment"])
        .eq("is_test", false),
      history(supabase),
    ]);
    return NextResponse.json({
      settings: record.settings,
      updatedAt: record.updatedAt,
      defaults: DEFAULT_SALES_SETTINGS,
      quoteVersion: quoteVersion(record.settings),
      openCheckouts: open.count ?? 0,
      history: past,
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

const bodySchema = z.object({
  settings: z.unknown(),
  expectedUpdatedAt: z.string().min(10).max(64),
});

export async function PUT(request: NextRequest) {
  const { admin, error: authError } = await requireAdmin(request, [...ROLES]);
  if (authError || !admin) return authError ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const parsed = salesSettingsSchema.safeParse(body.data.settings);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", fields: settingsFieldErrors(parsed.error) }, { status: 400 });
  }
  const next = parsed.data;

  const supabase = createServiceRoleClient();
  let current;
  try {
    current = await loadSalesSettings(supabase);
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (current.updatedAt !== body.data.expectedUpdatedAt) {
    return NextResponse.json({ error: "conflict" }, { status: 409 });
  }
  const changes = diffSettings(current.settings, next);
  if (changes.length === 0) {
    return NextResponse.json({ ok: true, unchanged: true, settings: current.settings, updatedAt: current.updatedAt, quoteChanged: false });
  }

  const saved = await updateSalesSettings(supabase, next, body.data.expectedUpdatedAt, admin.user_id);
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: saved.error === "conflict" ? 409 : 503 });
  }

  const quoteChanged = changes.some((c) => QUOTE_FIELDS.includes(c.field));
  await auditLog(supabase, {
    admin,
    action: "UPDATE",
    entity: ENTITY,
    entityId: ENTITY,
    details: { changes, quoteChanged, quoteVersion: quoteVersion(saved.record.settings) },
    ip: getClientIP(request),
  });
  // Herkese açık sayfalardaki önbellek (lib/orders/public-pricing.ts) hemen geçersiz.
  revalidateTag(SALES_SETTINGS_TAG, { expire: 0 });

  return NextResponse.json({
    ok: true,
    settings: saved.record.settings,
    updatedAt: saved.record.updatedAt,
    quoteChanged,
    history: await history(supabase),
  });
}
