import type { NextRequest } from "next/server";
import type { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getClientIP } from "@/lib/admin-auth";
import {
  hasFullScope, mfaEnforced, mfaSatisfied, requireAdminAccess, requirePermission, type Permission,
} from "@/lib/admin/permissions";
import { onlyAssigned, permissionScope } from "@/lib/admin/record-scope";
import { evaluatePermissionSet, permissionSetResponse } from "@/lib/admin/permission-set";
import { auditLog } from "@/lib/admin/audit";
import { fail, ok, unavailable } from "@/lib/api/envelope";
import { siteAdminSchema, siteFieldErrors, toLandRow } from "@/lib/sites/admin";
import {
  SITE_COLUMNS, diffSite, requiredCreatePermissions, requiredSitePermissions, type SiteChanges, type SiteColumn,
} from "@/lib/sites/admin-access";
import { siteItemOf, type SiteAdminListDto, type SiteMutationDto } from "@/lib/sites/admin-dto";
import {
  applySiteUpdate, deleteEmptySite, generateSlug, insertSite, isSlugFree, loadSiteRow, loadSiteRows,
  loadSpeciesOptions, siteCapabilities, unknownSpecies,
} from "@/lib/sites/admin-service";
import { slugify } from "@/lib/sites/slug";

/**
 * /api/admin/lands — Proje Uygulama Sahaları yönetimi. Sözleşme: web-brifler/30.
 *
 * GET    ?include=species → Ok<SiteAdminListDto>          sites.read (all / sites)
 * POST   tam form         → Ok<SiteMutationDto> 201       sites.read + sites.edit + sites.capacity.manage (+ sites.publish
 *                                                          yayında açılıyorsa), hepsi `all`
 * PUT    { id, maintenance } ya da { id, ...tam form } → Ok<SiteMutationDto>
 *        Yalnız gerçekten değişen alanlar izin ister ve yazılır: metin/plan sites.edit; yayın ve vitrin görünürlüğünü
 *        değiştiren durum geçişi sites.publish; kapasite sites.capacity.manage. Biri eksikse istek bütünüyle reddedilir.
 * DELETE { id }            → yalnız boş saha; sınır değişmedi (eski SUPER_ADMIN rolü, 30 §6)
 *
 * Kapasite sayıları yalnız bu uçta ve panelde görünür; vitrine hiçbir yoldan çıkmaz.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const unsupported = (permission: Permission) =>
  fail(403, "scope_unsupported", "Saha yetkiniz yalnız kişiye atanmış işleri kapsıyor; sahalar için atama modeli yok.", { permission });

function invalidBody(issues: z.core.$ZodIssue[]) {
  const fields = siteFieldErrors(issues);
  return fail(400, "invalid_body", Object.values(fields)[0] ?? "Geçersiz veri.", { fields });
}
const unknownSpeciesError = (missing: string[]) =>
  fail(400, "invalid_body", `Katalogda olmayan tür: ${missing.join(", ")}`, {
    fields: { species_slugs: "Katalogda olmayan tür seçildi." }, unknown: missing,
  });
const slugTaken = () =>
  fail(409, "slug_taken", "Bu adres başka bir sahada kullanılıyor.", { fields: { slug: "Bu adres kullanılıyor." } });

/** Yayın ve kapasite alanlarının önceki/sonraki değeri; diğer alanların yalnız adı. */
function auditDetails(before: Record<string, unknown>, changes: SiteChanges) {
  const details: Record<string, unknown> = { changed: Object.keys(changes) };
  for (const column of ["is_public", "status", "capacity_seeds"] as const) {
    if (column in changes) details[column] = { from: before[column] ?? null, to: changes[column] ?? null };
  }
  return details;
}

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "sites.read", { scope: "any" });
  if (guard.error) return guard.error;
  const read = permissionScope(guard.access, "sites.read");
  if (!read) return unsupported("sites.read");

  const db = createServiceRoleClient();
  const includeSpecies = request.nextUrl.searchParams.get("include") === "species";
  const [rows, species] = await Promise.all([loadSiteRows(db, read), includeSpecies ? loadSpeciesOptions(db) : undefined]);
  if (!rows || species === null) {
    console.error("[admin/lands] sahalar okunamadı");
    return unavailable();
  }

  const { access, assurance } = guard;
  const createDraft = (["sites.read", "sites.edit", "sites.capacity.manage"] as const).every((p) => hasFullScope(access, p));
  const dto: SiteAdminListDto = {
    items: rows.map((r) => siteItemOf(r, siteCapabilities(access, String(r.id)))),
    ...(species ? { species } : {}),
    scope: read,
    capabilities: {
      create: createDraft,
      createPublic: createDraft && hasFullScope(access, "sites.publish"),
      delete: guard.admin.role === "SUPER_ADMIN",
    },
    mfa: { enforced: mfaEnforced(), satisfied: mfaSatisfied("sites.publish", assurance), enrolled: assurance.enrolled },
  };
  return ok(dto);
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminAccess(request);
  if (guard.error) return guard.error;

  const parsed = siteAdminSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.issues);
  const data = parsed.data;

  // Yeni kayıt dar kapsamla sahiplenilemez: gereken her izin `all` olmalı.
  const denial = evaluatePermissionSet(guard.access, guard.assurance,
    requiredCreatePermissions(data.is_public).map((permission) => ({ permission, target: "all" as const })));
  if (denial) return permissionSetResponse(denial);

  const db = createServiceRoleClient();
  const missing = await unknownSpecies(db, data.species_slugs);
  if (missing === null) return unavailable();
  if (missing.length) return unknownSpeciesError(missing);

  let slug: string;
  if (data.slug) {
    const free = await isSlugFree(db, data.slug);
    if (free === null) return unavailable();
    if (!free) return slugTaken();
    slug = data.slug;
  } else {
    const generated = await generateSlug(db, slugify(data.name));
    if (generated === "unavailable") return unavailable();
    if (!generated) return slugTaken();
    slug = generated;
  }

  const created = await insertSite(db, { ...toLandRow(data), slug, filled_seeds: 0, reserved_seeds: 0 });
  if (!created.ok) return created.error === "slug_taken" ? slugTaken() : unavailable();
  const id = String(created.row.id);

  const warnings = await auditLog(db, {
    admin: guard.admin,
    action: "CREATE",
    entity: "land",
    entityId: id,
    details: { name: data.name, slug, province: data.province, status: data.status, is_public: data.is_public, capacity_seeds: data.capacity_seeds },
    ip: getClientIP(request),
  });
  const body: SiteMutationDto = { site: siteItemOf(created.row, siteCapabilities(guard.access, id)), changed: [...SITE_COLUMNS] };
  return ok(body, warnings, 201);
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdminAccess(request);
  if (guard.error) return guard.error;
  const { access } = guard;
  const read = permissionScope(access, "sites.read");
  if (!read) {
    return onlyAssigned(access, "sites.read")
      ? unsupported("sites.read")
      : fail(403, "forbidden", "Sahaları okuma yetkiniz yok.", { reason: "missing_permission", permissions: ["sites.read"] });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!UUID.test(id)) return fail(400, "invalid_id", "Geçersiz saha kimliği.");
  const quick = typeof body?.maintenance === "boolean";
  let form: z.output<typeof siteAdminSchema> | null = null;
  if (!quick) {
    const parsed = siteAdminSchema.safeParse(body);
    if (!parsed.success) return invalidBody(parsed.error.issues);
    form = parsed.data;
  }

  const db = createServiceRoleClient();
  const before = await loadSiteRow(db, read, id);
  if (before === null) return unavailable();
  if (before === "not_found") return fail(404, "not_found", "Saha bulunamadı.");

  // Yalnız gerçekten değişen kolonlar. Adres boşsa mevcut korunur; hiç yoksa addan üretilir (izin kararından sonra).
  let changes: SiteChanges;
  let slugBase: string | null = null;
  if (!form) {
    changes = diffSite(before, { is_public: body?.maintenance !== true });
  } else {
    changes = diffSite(before, toLandRow(form));
    const current = typeof before.slug === "string" && before.slug ? before.slug : null;
    if (form.slug && form.slug !== current) changes.slug = form.slug;
    else if (!form.slug && !current) slugBase = slugify(form.name);
  }

  if (!Object.keys(changes).length && slugBase === null) {
    // Değişiklik yok: yazma ve audit yok. Salt okuyucuya yine de "kaydedildi" dönmez.
    const caps = siteCapabilities(access, id);
    if (!caps.edit && !caps.publish && !caps.capacity) {
      return permissionSetResponse({ code: "forbidden", reason: "missing_permission", permissions: ["sites.edit"] });
    }
    const unchanged: SiteMutationDto = { site: siteItemOf(before, caps), changed: [] };
    return ok(unchanged);
  }

  const required = requiredSitePermissions(before, slugBase !== null ? { ...changes, slug: slugBase } : changes);
  const denial = evaluatePermissionSet(access, guard.assurance, required.map((permission) => ({ permission, target: { siteId: id } })));
  if (denial) return permissionSetResponse(denial);

  // Veri kuralları (izin kararından sonra): kapasite alt sınırı, tür kataloğu, adres.
  if ("capacity_seeds" in changes) {
    const used = Number(before.filled_seeds ?? 0) + Number(before.reserved_seeds ?? 0);
    if (Number(changes.capacity_seeds) < used) {
      const message = `Kapasite ${used.toLocaleString("tr-TR")}'den az olamaz (bırakılan + ayrılan).`;
      return fail(400, "invalid_body", message, { fields: { capacity_seeds: message } });
    }
  }
  if ("species_slugs" in changes) {
    const missing = await unknownSpecies(db, (changes.species_slugs as string[]) ?? []);
    if (missing === null) return unavailable();
    if (missing.length) return unknownSpeciesError(missing);
  }
  if (typeof changes.slug === "string") {
    const free = await isSlugFree(db, changes.slug, id);
    if (free === null) return unavailable();
    if (!free) return slugTaken();
  }
  if (slugBase !== null) {
    const generated = await generateSlug(db, slugBase, id);
    if (generated === "unavailable") return unavailable();
    if (generated) changes.slug = generated;
  }

  const result = await applySiteUpdate(db, before, changes);
  if (!result.ok) {
    if (result.error === "conflict") {
      return fail(409, "conflict", "Saha arada değişti (yayın durumu ya da kapasite sayıları). Güncel kaydı yükleyip yeniden deneyin.", {
        reason: "changed_meanwhile",
      });
    }
    return result.error === "slug_taken" ? slugTaken() : unavailable();
  }

  const warnings = await auditLog(db, {
    admin: guard.admin,
    action: "UPDATE",
    entity: "land",
    entityId: id,
    details: auditDetails(before, changes),
    ip: getClientIP(request),
  });
  const updated: SiteMutationDto = { site: siteItemOf(result.row, siteCapabilities(access, id)), changed: Object.keys(changes) as SiteColumn[] };
  return ok(updated, warnings);
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdminAccess(request);
  if (guard.error) return guard.error;
  // Silme sınırı genişletilmedi: yalnız eski SUPER_ADMIN rolü (yeni izin/MFA kararı 30 §6'da).
  if (guard.admin.role !== "SUPER_ADMIN") {
    return fail(403, "forbidden", "Saha silme yalnız sahip rolüne açık.", { reason: "legacy_role_required", role: "SUPER_ADMIN" });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!UUID.test(id)) return fail(400, "invalid_id", "Geçersiz saha kimliği.");

  const db = createServiceRoleClient();
  const result = await deleteEmptySite(db, id);
  if (!result.ok) {
    switch (result.error) {
      case "not_found":
        return fail(404, "not_found", "Saha bulunamadı.");
      case "not_empty":
        return fail(409, "not_empty",
          `"${result.name}" sahasında ${result.filled} bırakılmış ve ${result.reserved} ayrılmış tohum topu kaydı var; silinemez. Yayından almak için "Yayından al" düğmesini kullanın.`,
          { filled: result.filled, reserved: result.reserved });
      case "in_use":
        return fail(409, "in_use", "Sahaya bağlı talep ya da sipariş kaydı var; silinemez. Yayından almak için \"Yayından al\" düğmesini kullanın.");
      case "conflict":
        return fail(409, "conflict", "Saha arada değişti; yeniden deneyin.", { reason: "changed_meanwhile" });
      default:
        return unavailable();
    }
  }

  const warnings = await auditLog(db, {
    admin: guard.admin,
    action: "DELETE",
    entity: "land",
    entityId: id,
    details: { name: result.name },
    ip: getClientIP(request),
  });
  return ok({ deleted: true, id }, warnings);
}
