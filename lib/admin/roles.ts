/**
 * Özel roller, rol etki önizlemesi ve saha seçenekleri — YALNIZ SUNUCU. Sözleşme: web-brifler/21.
 *
 * Bütün yetki, yükseltme, sürüm ve parmak izi kuralları SQL'dedir (022); burada çağrı, biçim ve
 * hata eşlemesi var. Önizleme ucu hiçbir satır yazmaz ve sürüm tüketmez.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MFA_PERMISSIONS, type Permission } from "./permission-keys";
import { isServiceError, type ServiceError } from "./staff";

export { isServiceError, type ServiceError } from "./staff";

const err = (status: number, code: string, message: string, details?: Record<string, unknown>): ServiceError => ({
  ok: false, status, code, message, ...(details ? { details } : {}),
});
const unavailable = () => err(503, "unavailable", "Veri alınamadı. Lütfen yeniden deneyin.");

/** Kapsamla sınırlanamayan izinler: bu izni taşıyan rol yalnız "tüm kayıtlar" kapsamıyla atanabilir (021). */
export const GLOBAL_ONLY_PERMISSIONS: readonly Permission[] = ["staff.invite", "staff.manage", "roles.manage"];

const ROLE_ERRORS: Record<string, [number, string, string]> = {
  forbidden: [403, "forbidden", "Bu işlem için yetkiniz yok."],
  self_assignment: [403, "self_assignment", "Kendi taşıdığınız rolü düzenleyemezsiniz; başka bir yetkili yapmalı."],
  escalation_blocked: [403, "escalation_blocked", "Kendinizde olmayan bir yetkiyi veremezsiniz."],
  role_missing: [404, "role_missing", "Rol bulunamadı."],
  role_exists: [409, "role_exists", "Bu anahtarla bir rol zaten var. Başka bir anahtar seçin."],
  system_role_readonly: [409, "system_role_readonly", "Sistem rolleri düzenlenemez; kopyalayıp yeni rol oluşturabilirsiniz."],
  version_changed: [409, "version_changed", "Bu rolü arada başkası değiştirdi. Görünümü yenileyin."],
  usage_changed: [409, "usage_changed", "Önizlemeden sonra etkilenen kişi ya da davet listesi değişti. Önizlemeyi yenileyin."],
  global_scope_conflict: [409, "global_scope_conflict",
    "Bu izinler kapsamla sınırlanamaz; rolün saha ya da atanmış işle sınırlı ataması veya daveti var. Önce onları \"tüm kayıtlar\" kapsamına alın ya da kaldırın."],
  invalid_permissions: [422, "invalid_permissions", "İzin listesi geçersiz."],
  invalid_key: [422, "invalid_key", "Rol anahtarı geçersiz: küçük harfle başlayan 3–41 karakter; küçük harf, rakam ve alt çizgi."],
  invalid_label: [422, "invalid_label", "Rol adı 2–80 karakter olmalı."],
  invalid_description: [422, "invalid_description", "Açıklama en çok 500 karakter olabilir."],
  note_required: [422, "note_required", "Gerekçe 10–500 karakter olmalı."],
  invalid_scope: [422, "invalid_scope", "Kapsam geçersiz: seçilen sahalardan bazıları bulunamadı."],
};

/** SQL `DETAIL` alanı virgülle ayrılmış anahtar listesi taşır (022). */
const detailList = (raw: string | null | undefined): string[] =>
  String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function mapRoleError(error: { message?: string; details?: string | null } | null | undefined): ServiceError {
  const code = String(error?.message ?? "").trim();
  const known = ROLE_ERRORS[code];
  if (!known) return unavailable();
  const list = detailList(error?.details);
  if (code === "escalation_blocked" && list.length) return err(known[0], known[1], known[2], { missing: list });
  if (code === "invalid_permissions" && list.length) return err(known[0], known[1], known[2], { unknown: list });
  if (code === "invalid_scope" && list.length) return err(known[0], known[1], known[2], { missingSiteIds: list });
  if (code === "global_scope_conflict") {
    try {
      return err(known[0], known[1], known[2], JSON.parse(String(error?.details ?? "{}")) as Record<string, unknown>);
    } catch {
      return err(known[0], known[1], known[2]);
    }
  }
  return err(known[0], known[1], known[2]);
}

/* ── Biçimler ─────────────────────────────────────────────────────────────── */

export interface RoleUsage {
  /** Başlamış, bitmemiş, iptal edilmemiş; personel aktif. */
  activeAssignments: number;
  /** İleri tarihli (henüz başlamamış) atamalar; başladıklarında yeni izinlerle başlar. */
  scheduledAssignments: number;
  /** Etkin ya da ileri tarihli ataması olan farklı aktif kişi sayısı. */
  staffCount: number;
  pendingInvitations: number;
  /** Etkilenen kümenin parmak izi; PATCH'te `expectedUsage.fingerprint` olarak ZORUNLU geri gelir. */
  fingerprint: string;
}
export interface RoleDetailView {
  key: string; label: string; description: string; permissions: Permission[]; isSystem: boolean;
  version: string; createdAt: string; updatedBy: { adminId: string; label: string } | null;
  usage: RoleUsage; sensitivePermissions: Permission[]; globalOnlyPermissions: Permission[];
}
export interface RoleImpactPreview {
  role: { key: string; label: string; isSystem: boolean; version: string };
  next: { label: string; description: string; permissions: Permission[] };
  added: Permission[]; removed: Permission[]; unchanged: number; usage: RoleUsage;
  affectedStaff: { id: string; fullName: string; activeAssignments: number; scheduledAssignments: number }[];
  affectedInvitations: { id: string; email: string; status: string }[];
  blocked: { code: string; message: string; details?: Record<string, unknown> } | null;
}
export interface SiteOptionView { id: string; name: string; slug: string; status: string; isPublic: boolean }

const usageView = (raw: unknown): RoleUsage => {
  const u = (raw ?? {}) as Record<string, unknown>;
  return {
    activeAssignments: Number(u.activeAssignments ?? 0), scheduledAssignments: Number(u.scheduledAssignments ?? 0),
    staffCount: Number(u.staffCount ?? 0),
    pendingInvitations: Number(u.pendingInvitations ?? 0), fingerprint: String(u.fingerprint ?? ""),
  };
};

/** SQL ayrıntısını DTO'ya çevirir; hassas ve kapsamlanamaz izin listeleri burada hesaplanır. */
function detailView(raw: unknown): RoleDetailView {
  const r = (raw ?? {}) as Record<string, unknown>;
  const permissions = (Array.isArray(r.permissions) ? r.permissions : []).map(String) as Permission[];
  const updatedBy = (r.updatedBy ?? null) as { adminId?: unknown; label?: unknown } | null;
  return {
    key: String(r.key ?? ""), label: String(r.label ?? ""), description: String(r.description ?? ""),
    permissions, isSystem: r.isSystem === true,
    // Sürüm SQL'in ürettiği metindir (UTC, mikro saniye); Date'e çevrilirse hassasiyet kaybolur.
    version: String(r.version ?? ""), createdAt: String(r.createdAt ?? ""),
    updatedBy: updatedBy ? { adminId: String(updatedBy.adminId), label: String(updatedBy.label) } : null,
    usage: usageView(r.usage),
    sensitivePermissions: permissions.filter((p) => MFA_PERMISSIONS.has(p)),
    globalOnlyPermissions: permissions.filter((p) => GLOBAL_ONLY_PERMISSIONS.includes(p)),
  };
}

function previewView(raw: unknown): RoleImpactPreview {
  const p = (raw ?? {}) as Record<string, unknown>;
  const role = (p.role ?? {}) as Record<string, unknown>;
  const next = (p.next ?? {}) as Record<string, unknown>;
  const blocked = (p.blocked ?? null) as { code?: unknown; details?: unknown } | null;
  const code = blocked ? String(blocked.code) : null;
  const known = code ? ROLE_ERRORS[code] : null;
  const details = blocked?.details && typeof blocked.details === "object" ? (blocked.details as Record<string, unknown>) : null;
  return {
    role: { key: String(role.key ?? ""), label: String(role.label ?? ""), isSystem: role.isSystem === true,
            version: String(role.version ?? "") },
    next: { label: String(next.label ?? ""), description: String(next.description ?? ""),
            permissions: (Array.isArray(next.permissions) ? next.permissions : []).map(String) as Permission[] },
    added: (Array.isArray(p.added) ? p.added : []).map(String) as Permission[],
    removed: (Array.isArray(p.removed) ? p.removed : []).map(String) as Permission[],
    unchanged: Number(p.unchanged ?? 0),
    usage: usageView(p.usage),
    affectedStaff: (Array.isArray(p.affectedStaff) ? p.affectedStaff : []).map((s) => {
      const row = s as Record<string, unknown>;
      return {
        id: String(row.id), fullName: String(row.fullName ?? ""),
        activeAssignments: Number(row.activeAssignments ?? 0), scheduledAssignments: Number(row.scheduledAssignments ?? 0),
      };
    }),
    affectedInvitations: (Array.isArray(p.affectedInvitations) ? p.affectedInvitations : []).map((i) => {
      const row = i as Record<string, unknown>;
      return { id: String(row.id), email: String(row.email ?? ""), status: String(row.status ?? "") };
    }),
    blocked: code
      ? { code: known?.[1] ?? code, message: known?.[2] ?? "Bu değişiklik kaydedilemez.", ...(details ? { details } : {}) }
      : null,
  };
}

/* ── Saha seçenekleri imleci: (ad, kimlik) ─────────────────────────────────── */

export const encodeSiteCursor = (name: string, id: string): string =>
  `${Buffer.from(name, "utf8").toString("base64url")}|${id}`;

export function parseSiteCursor(raw: string | null | undefined): { name: string; id: string } | null {
  if (!raw) return null;
  const [name, id] = String(raw).split("|");
  if (!name || !id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    return { name: Buffer.from(name, "base64url").toString("utf8"), id };
  } catch {
    return null;
  }
}

/** PostgREST süzgecinde değer tırnaklanır; virgül ve parantez taşıyan adlar sorguyu bozmasın. */
const q = (value: string) => `"${value.replace(/["\\]/g, (m) => `\\${m}`)}"`;

/* ── Servis ───────────────────────────────────────────────────────────────── */

export interface CreateRoleInput {
  key: string; label: string; description?: string | null; permissions?: string[] | null; copyFrom?: string | null;
}
export interface UpdateRoleInput {
  label?: string | null; description?: string | null; permissions?: string[] | null;
  expectedVersion: string; expectedFingerprint: string; reason: string;
}

export function createRolesService({ db }: { db: SupabaseClient }) {
  const call = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) return mapRoleError(error);
    if (data == null) return unavailable();
    return data as unknown;
  };

  return {
    async detail(actorUserId: string, key: string): Promise<RoleDetailView | ServiceError> {
      const data = await call("admin_role_detail", { p_actor: actorUserId, p_key: key });
      return isServiceError(data) ? data : detailView(data);
    },

    async create(actorUserId: string, input: CreateRoleInput): Promise<RoleDetailView | ServiceError> {
      const data = await call("create_admin_role", {
        p_actor: actorUserId, p_key: input.key, p_label: input.label,
        p_description: input.description ?? "", p_permissions: input.permissions ?? null,
        p_copy_from: input.copyFrom ?? null,
      });
      return isServiceError(data) ? data : detailView(data);
    },

    async update(actorUserId: string, key: string, input: UpdateRoleInput): Promise<RoleDetailView | ServiceError> {
      const data = await call("update_admin_role", {
        p_actor: actorUserId, p_key: key, p_label: input.label ?? null, p_description: input.description ?? null,
        p_permissions: input.permissions ?? null, p_expected_version: input.expectedVersion,
        p_expected_fingerprint: input.expectedFingerprint, p_reason: input.reason,
      });
      return isServiceError(data) ? data : detailView(data);
    },

    /** Yazma YAPMAZ: yalnız okur ve engel kodunu kaydetmeyle aynı biçimde döner. */
    async preview(actorUserId: string, key: string,
                  input: { permissions?: string[] | null; label?: string | null; description?: string | null }
                 ): Promise<RoleImpactPreview | ServiceError> {
      const data = await call("preview_admin_role_change", {
        p_actor: actorUserId, p_key: key, p_permissions: input.permissions ?? null,
        p_label: input.label ?? null, p_description: input.description ?? null,
      });
      return isServiceError(data) ? data : previewView(data);
    },

    /** Kapsam seçimi için minimal alanlar; kapasite, doluluk ve finans alanı dönmez. */
    async siteOptions(params: { limit: number; cursor?: string | null; q?: string | null; ids?: string[] | null }
                     ): Promise<{ items: SiteOptionView[]; nextCursor: string | null } | ServiceError> {
      const columns = "id, name, slug, status, is_public";
      const toView = (rows: unknown[]): SiteOptionView[] =>
        rows.map((r) => {
          const row = r as Record<string, unknown>;
          return {
            id: String(row.id), name: String(row.name ?? ""), slug: String(row.slug ?? ""),
            status: String(row.status ?? ""), isPublic: row.is_public === true,
          };
        });

      // `ids` verildiğinde seçili kimlikleri okunabilir ada çevirmek içindir: arama ve imleç yok sayılır.
      if (params.ids?.length) {
        const { data, error } = await db.from("lands").select(columns).in("id", params.ids.slice(0, 200)).order("name");
        if (error) return unavailable();
        return { items: toView(data ?? []), nextCursor: null };
      }

      let query = db.from("lands").select(columns).order("name", { ascending: true }).order("id", { ascending: true }).limit(params.limit);
      // LIKE jokerleri ve PostgREST'in `*` takma adı aramadan çıkarılır: kullanıcı girdisi desen olmasın.
      const needle = params.q?.replace(/[%_*\\]/g, "").trim().toLowerCase().slice(0, 80);
      if (needle) query = query.or(`name.ilike.${q(`%${needle}%`)},slug.ilike.${q(`%${needle}%`)}`);
      const cursor = parseSiteCursor(params.cursor);
      if (cursor) query = query.or(`name.gt.${q(cursor.name)},and(name.eq.${q(cursor.name)},id.gt.${cursor.id})`);

      const { data, error } = await query;
      if (error) return unavailable();
      const items = toView(data ?? []);
      const last = items[items.length - 1];
      return { items, nextCursor: items.length === params.limit && last ? encodeSiteCursor(last.name, last.id) : null };
    },
  };
}

export type RolesService = ReturnType<typeof createRolesService>;
