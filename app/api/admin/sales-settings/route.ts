import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getClientIP } from "@/lib/admin-auth";
import {
  hasFullScope, mfaEnforced, mfaSatisfied, requireAnyPermission, type EffectiveAccess, type Permission,
} from "@/lib/admin/permissions";
import { evaluatePermissionSet, permissionSetResponse } from "@/lib/admin/permission-set";
import { auditLog } from "@/lib/admin/audit";
import { fail, ok, unavailable } from "@/lib/api/envelope";
import { canAcceptOrders } from "@/lib/orders/gate";
import { getPaymentProvider } from "@/lib/payments";
import { loadReadinessEvidence, salesReadiness } from "@/lib/orders/readiness";
import {
  DEFAULT_SALES_SETTINGS, SALES_SETTINGS_TAG, loadAdminSalesSettings, quoteVersion, updateSalesSettings,
  type AdminSalesSettingsRecord,
} from "@/lib/orders/settings";
import {
  QUOTE_FIELDS, diffSettings, salesSettingsSchema, settingsFieldErrors, type SalesSettings, type SettingsChange,
} from "@/lib/orders/settings-schema";
import type {
  SalesSettingsCapabilities, SalesSettingsDto, SalesSettingsGroup, SalesSettingsHistoryEntry, SalesSettingsMutationDto,
  SalesSettingsValues, SalesState,
} from "@/lib/sales/admin-dto";

/**
 * Admin — Satış ayarları (tek satır `sales_settings`). Sözleşme: web-brifler/32.
 *
 * GET → Ok<SalesSettingsDto>: sales.pause / sales.resume / sales.pricing.manage / system.readiness.read'den biri.
 *       Gruplar izne göre sorgulanır: durum (satış izinleri), değerler (fiyat), ödeme bekleyen sayısı (orders.read),
 *       geçmiş (audit.read), hazırlık (system.readiness.read). Ayarlar küresel: hepsi `all` kapsamı ister.
 * PUT { settings, expectedUpdatedAt } ya da { ordersPaused, expectedUpdatedAt } → Ok<SalesSettingsMutationDto>
 *       Yalnız gerçekten değişen alanlar izin ister: durdurma sales.pause (MFA yok), yeniden açma sales.resume (MFA),
 *       diğer her alan sales.pricing.manage (MFA). Biri eksikse hiçbir şey yazılmaz. Sürüm (CAS) korunur.
 */
export const dynamic = "force-dynamic";

const ENTITY = "sales_settings";
const ACTIONS: Permission[] = ["sales.pause", "sales.resume", "sales.pricing.manage"];

const capabilitiesOf = (access: EffectiveAccess): SalesSettingsCapabilities => ({
  pause: hasFullScope(access, "sales.pause"),
  resume: hasFullScope(access, "sales.resume"),
  pricing: hasFullScope(access, "sales.pricing.manage"),
});

async function history(db: SupabaseClient): Promise<SalesSettingsHistoryEntry[] | null> {
  const { data, error } = await db
    .from("admin_audit_logs")
    .select("admin_email, created_at, details")
    .eq("entity", ENTITY)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return null;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const changes = (r.details as { changes?: unknown } | null)?.changes;
    return {
      by: typeof r.admin_email === "string" ? r.admin_email : null,
      at: String(r.created_at),
      changes: Array.isArray(changes) ? (changes as SalesSettingsHistoryEntry["changes"]) : [],
    };
  });
}

function stateOf(record: AdminSalesSettingsRecord, settings: SalesSettings | null = record.settings, updatedAt = record.updatedAt): SalesState {
  // Geçersiz kayıt sipariş kapısını kapatır (lib/orders/settings.ts getSalesSettings ile aynı).
  const ordersPaused = settings ? settings.ordersPaused : true;
  return { ordersPaused, accepting: canAcceptOrders(getPaymentProvider(), { ordersPaused }), updatedAt, repairRequired: !settings };
}

function valuesOf(settings: SalesSettings | null, raw: Record<string, unknown>, fieldErrors: Record<string, string>): SalesSettingsValues {
  return { values: settings, raw, fieldErrors, defaults: DEFAULT_SALES_SETTINGS, quoteVersion: settings ? quoteVersion(settings) : null };
}

/** Değişikliklerin gerektirdiği izinler (32 §3). */
function requiredFor(changes: SettingsChange[]): Permission[] {
  const need = new Set<Permission>();
  for (const c of changes) {
    if (c.field === "ordersPaused") need.add(c.to === true ? "sales.pause" : "sales.resume");
    else need.add("sales.pricing.manage");
  }
  return [...need];
}

export async function GET(request: NextRequest) {
  const guard = await requireAnyPermission(request, [...ACTIONS, "system.readiness.read"], { mfa: false });
  if (guard.error) return guard.error;
  const { access, assurance } = guard;
  const capabilities = capabilitiesOf(access);
  const can: Record<SalesSettingsGroup, boolean> = {
    state: capabilities.pause || capabilities.resume || capabilities.pricing,
    settings: capabilities.pricing,
    openCheckouts: hasFullScope(access, "orders.read"),
    history: hasFullScope(access, "audit.read"),
    readiness: hasFullScope(access, "system.readiness.read"),
  };

  const db = createServiceRoleClient();
  try {
    const [record, open, past, evidence] = await Promise.all([
      loadAdminSalesSettings(db),
      can.openCheckouts
        ? db.from("release_orders").select("id", { count: "exact", head: true }).in("status", ["draft", "awaiting_payment"]).eq("is_test", false)
        : null,
      can.history ? history(db) : null,
      can.readiness ? loadReadinessEvidence(db) : undefined,
    ]);
    // Alt sorgu hatası sahte sıfır ya da boş geçmiş olarak dönmez.
    if (open && (open.error || typeof open.count !== "number")) return unavailable();
    if (can.history && !past) return unavailable();

    const dto: SalesSettingsDto = {
      groups: (Object.keys(can) as SalesSettingsGroup[]).filter((g) => can[g]),
      ...(can.state ? { state: stateOf(record) } : {}),
      ...(can.settings ? { settings: valuesOf(record.settings, record.rawSettings, record.fieldErrors) } : {}),
      ...(open ? { openCheckouts: open.count as number } : {}),
      ...(past ? { history: past } : {}),
      ...(can.readiness
        ? { readiness: salesReadiness(record.settings ?? { ...DEFAULT_SALES_SETTINGS, ordersPaused: true }, process.env, evidence) }
        : {}),
      capabilities,
      mfa: { enforced: mfaEnforced(), satisfied: mfaSatisfied("sales.resume", assurance), enrolled: assurance.enrolled },
    };
    return ok(dto);
  } catch {
    console.error("[admin/sales-settings] ayarlar okunamadı");
    return unavailable();
  }
}

const version = z.string().min(10).max(64);
const bodySchema = z.union([
  z.object({ settings: z.unknown(), expectedUpdatedAt: version }).strict(),
  z.object({ ordersPaused: z.boolean(), expectedUpdatedAt: version }).strict(),
]);

export async function PUT(request: NextRequest) {
  // Satış ayarlarında hiçbir eylem izni (tam kapsamla) yoksa gövde değerlendirilmez.
  const guard = await requireAnyPermission(request, ACTIONS, { mfa: false });
  if (guard.error) return guard.error;
  const { access, assurance, admin } = guard;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return fail(400, "invalid_body", "Geçersiz istek: ayarlar (ya da yalnız durdurma durumu) ve sürüm gerekli.");
  }
  let requested: SalesSettings | null = null;
  if ("settings" in body.data) {
    const parsed = salesSettingsSchema.safeParse(body.data.settings);
    if (!parsed.success) return fail(400, "validation", "Ayarlarda düzeltilmesi gereken alanlar var.", { fields: settingsFieldErrors(parsed.error) });
    requested = parsed.data;
  }

  const db = createServiceRoleClient();
  let current: AdminSalesSettingsRecord;
  try {
    current = await loadAdminSalesSettings(db);
  } catch {
    return unavailable();
  }

  let next: SalesSettings;
  if (requested) next = requested;
  else if (current.settings) next = { ...current.settings, ordersPaused: (body.data as { ordersPaused: boolean }).ordersPaused };
  else {
    return fail(409, "repair_required", "Ayar kaydı geçersiz; fiyat yetkilisi tam formla onarmalı. Bu durumda sipariş alımı zaten kapalıdır.");
  }

  // Yalnız gerçekten değişen alanlar izin ister; biri eksikse hiçbir şey yazılmaz (32 §3).
  const changes = diffSettings(current.settings ?? current.rawSettings, next);
  const denial = evaluatePermissionSet(access, assurance, requiredFor(changes).map((permission) => ({ permission, target: "all" as const })));
  if (denial) return permissionSetResponse(denial);

  if (current.updatedAt !== body.data.expectedUpdatedAt) {
    return fail(409, "conflict", "Ayarlar siz açtıktan sonra değişti. Güncel hâli yükleyip yeniden deneyin.");
  }
  if (!current.settings && !next.ordersPaused) {
    return fail(400, "repair_requires_pause", "Geçersiz kayıt onarılırken sipariş alımı durdurulmuş kalmalı.", { fields: { ordersPaused: "repair_requires_pause" } });
  }
  const capabilities = capabilitiesOf(access);
  if (!changes.length) {
    const unchanged: SalesSettingsMutationDto = {
      state: stateOf(current),
      ...(capabilities.pricing ? { settings: valuesOf(current.settings, current.rawSettings, current.fieldErrors) } : {}),
      changed: [],
      quoteChanged: false,
    };
    return ok(unchanged);
  }

  const saved = await updateSalesSettings(db, next, body.data.expectedUpdatedAt, admin.user_id);
  if (!saved.ok) {
    return saved.error === "conflict"
      ? fail(409, "conflict", "Ayarlar siz açtıktan sonra değişti. Güncel hâli yükleyip yeniden deneyin.")
      : unavailable();
  }

  const quoteChanged = changes.some((c) => QUOTE_FIELDS.includes(c.field));
  const warnings = await auditLog(db, {
    admin,
    action: "UPDATE",
    entity: ENTITY,
    entityId: ENTITY,
    details: { changes, quoteChanged, quoteVersion: quoteVersion(saved.record.settings) },
    ip: getClientIP(request),
  });
  // Herkese açık sayfalardaki önbellek (lib/orders/public-pricing.ts) hemen geçersiz.
  revalidateTag(SALES_SETTINGS_TAG, { expire: 0 });

  const past = hasFullScope(access, "audit.read") ? await history(db) : null;
  const result: SalesSettingsMutationDto = {
    state: stateOf(current, saved.record.settings, saved.record.updatedAt),
    ...(capabilities.pricing ? { settings: valuesOf(saved.record.settings, { ...saved.record.settings }, {}) } : {}),
    changed: changes.map((c) => c.field),
    quoteChanged,
    ...(past ? { history: past } : {}),
  };
  return ok(result, [
    ...warnings,
    ...(hasFullScope(access, "audit.read") && !past
      ? [{ code: "history_unavailable", message: "Kaydedildi; değişiklik geçmişi okunamadı. Sayfayı yenileyin." }]
      : []),
  ]);
}
