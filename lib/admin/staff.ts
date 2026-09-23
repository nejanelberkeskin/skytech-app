/**
 * Personel, rol atamaları, davetler ve denetim kaydı — YALNIZ SUNUCU. Sözleşme: web-brifler/19.
 *
 * Bütün yetki ve son sahip kuralları SQL'de (021); burada yalnız çağrı, biçim ve hata eşlemesi var.
 * Davet belirteci sunucuda saklanmaz: yalnız SHA-256 özeti yazılır, ham değer tek kullanımlık bağlantıdadır.
 */
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { keysetFilter, parseCursor, type Cursor } from "./pagination";
import { buildAccessPreview, type AccessPreview, type PreviewChange } from "./preview";
import type { Scope } from "./permission-keys";

export type ServiceError = { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };
export const isServiceError = (v: unknown): v is ServiceError => typeof v === "object" && v !== null && (v as { ok?: unknown }).ok === false;

const err = (status: number, code: string, message: string, details?: Record<string, unknown>): ServiceError => ({
  ok: false, status, code, message, ...(details ? { details } : {}),
});
const unavailable = () => err(503, "unavailable", "Veri alınamadı. Lütfen yeniden deneyin.");

/** SQL fonksiyonlarının RAISE mesajı → API hatası (web-brifler/19). */
const SQL_ERRORS: Record<string, [number, string, string]> = {
  forbidden: [403, "forbidden", "Bu işlem için yetkiniz yok."],
  self_assignment: [403, "self_assignment", "Kendi yetkinizi değiştiremezsiniz; başka bir yetkili yapmalı."],
  escalation_blocked: [403, "escalation_blocked", "Kendinizde olmayan bir yetkiyi ya da daha geniş bir kapsamı veremezsiniz."],
  staff_missing: [404, "not_found", "Personel kaydı bulunamadı."],
  role_missing: [404, "not_found", "Rol bulunamadı."],
  assignment_missing: [404, "not_found", "Atama bulunamadı."],
  invitation_missing: [404, "not_found", "Davet bulunamadı."],
  invalid_change: [400, "invalid_body", "Geçersiz değişiklik."],
  assignment_revoked: [409, "invalid_state", "Bu atama zaten kaldırılmış."],
  version_changed: [409, "version_changed", "Bu atamayı arada başkası değiştirdi. Görünümü yenileyin."],
  last_active_owner: [409, "last_active_owner", "Sistemde en az bir aktif sahip kalmalı. Önce yeni sahibi atayın."],
  already_staff: [409, "already_staff", "Bu e-posta zaten aktif bir personele ait."],
  invitation_exists: [409, "invitation_exists", "Bu e-posta için bekleyen bir davet var. Önce onu iptal edin ya da yeniden gönderin."],
  invitation_unusable: [410, "invitation_unusable", "Bu davet kullanılamaz: kabul edilmiş, iptal edilmiş ya da süresi geçmiş."],
  invitation_email_mismatch: [403, "invitation_email_mismatch", "Davet başka bir e-posta adresi için oluşturulmuş."],
  invalid_scope: [422, "invalid_scope", "Kapsam geçersiz."],
  invalid_expiry: [422, "invalid_expiry", "Davet süresi 1–30 gün arası olmalı."],
};

export function mapSqlError(error: { message?: string; details?: string | null } | null | undefined): ServiceError {
  const known = SQL_ERRORS[String(error?.message ?? "").trim()];
  if (!known) return unavailable();
  return err(known[0], known[1], known[2]);
}

/* ── Biçimler ─────────────────────────────────────────────────────────────── */

export interface StaffAssignmentView {
  id: string; roleKey: string; roleLabel: string; scope: Scope;
  startsAt: string; endsAt: string | null; revokedAt: string | null; reason: string | null; updatedAt: string;
}
export interface StaffView {
  id: string; userId: string; fullName: string; email: string; isActive: boolean; legacyRole: string;
  createdAt: string; assignments: StaffAssignmentView[]; mfa: { enrolled: boolean } | null;
}
export interface InvitationView {
  id: string; email: string; roleKey: string; roleLabel: string; scope: Scope; status: string;
  createdAt: string; expiresAt: string; lastSentAt: string; sentCount: number;
  acceptedAt: string | null; revokedAt: string | null; accessEndsAt: string | null;
}

interface RoleRow { key: string; label: string }
interface AssignmentRow {
  id: string; scope: Scope; starts_at: string; ends_at: string | null; revoked_at: string | null;
  reason: string | null; updated_at: string; admin_roles: RoleRow | null;
}
interface StaffRow {
  id: string; user_id: string; full_name: string; email: string; is_active: boolean; role: string; created_at: string;
  admin_role_assignments: AssignmentRow[] | null;
}
interface InvitationRow {
  id: string; email: string; scope: Scope; status: string; created_at: string; expires_at: string;
  last_sent_at: string; sent_count: number; accepted_at: string | null; revoked_at: string | null;
  access_ends_at: string | null; admin_roles: RoleRow | null;
}

const assignmentView = (row: AssignmentRow): StaffAssignmentView => ({
  id: row.id, roleKey: row.admin_roles?.key ?? "", roleLabel: row.admin_roles?.label ?? "", scope: row.scope,
  startsAt: row.starts_at, endsAt: row.ends_at, revokedAt: row.revoked_at, reason: row.reason, updatedAt: row.updated_at,
});
const staffView = (row: StaffRow, mfa: { enrolled: boolean } | null): StaffView => ({
  id: row.id, userId: row.user_id, fullName: row.full_name, email: row.email, isActive: row.is_active,
  legacyRole: row.role, createdAt: row.created_at, mfa,
  assignments: (row.admin_role_assignments ?? []).filter((a) => !a.revoked_at).map(assignmentView),
});
const invitationView = (row: InvitationRow): InvitationView => ({
  id: row.id, email: row.email, roleKey: row.admin_roles?.key ?? "", roleLabel: row.admin_roles?.label ?? "",
  scope: row.scope, status: row.status, createdAt: row.created_at, expiresAt: row.expires_at,
  lastSentAt: row.last_sent_at, sentCount: row.sent_count, acceptedAt: row.accepted_at,
  revokedAt: row.revoked_at, accessEndsAt: row.access_ends_at,
});

const STAFF_FIELDS =
  "id, user_id, full_name, email, is_active, role, created_at, admin_role_assignments(id, scope, starts_at, ends_at, revoked_at, reason, updated_at, admin_roles(key, label))";
const INVITATION_FIELDS =
  "id, email, scope, status, created_at, expires_at, last_sent_at, sent_count, accepted_at, revoked_at, access_ends_at, admin_roles(key, label)";

/* ── Davet belirteci ──────────────────────────────────────────────────────── */

export const hashInvitationToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newInvitationToken = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInvitationToken(token) };
};
export const DEFAULT_INVITATION_DAYS = 7;

export interface StaffDeps {
  db: SupabaseClient;
  /** Kişinin MFA aygıtları (yönetim API'si); okunamazsa null döner, işlem durmaz. */
  mfaStatus(userId: string): Promise<{ enrolled: boolean } | null>;
  now(): Date;
}

export function createStaffService(deps: StaffDeps) {
  const { db } = deps;

  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(name, args);
    if (error) return mapSqlError(error);
    if (!data) return unavailable();
    return { ok: true as const, data };
  };

  /** Kararlı sayfalama: (created_at, id) imleci. Aynı saniyedeki kayıtlar atlanmaz. */
  async function list(page: { limit: number; cursor?: string | null } = { limit: 50 }): Promise<StaffView[] | ServiceError> {
    let query = db.from("admin_users").select(STAFF_FIELDS).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(page.limit);
    const cursor: Cursor | null = parseCursor(page.cursor);
    if (cursor) query = query.or(keysetFilter(cursor, true));
    const { data, error } = await query;
    if (error) return unavailable();
    const rows = (data ?? []) as unknown as StaffRow[];
    return Promise.all(rows.map(async (r) => staffView(r, await deps.mfaStatus(r.user_id))));
  }

  /** Yazma YAPMAYAN yetki önizlemesi: kaydetmeden önce ne değişeceğini ve engel olup olmadığını döner. */
  async function previewAssignment(actor: string, adminId: string, change: PreviewChange): Promise<AccessPreview | ServiceError> {
    const { data, error } = await db.rpc("admin_preview_assignment", { p_actor: actor, p_admin: adminId, p_change: change });
    if (error) return mapSqlError(error);
    if (!data) return unavailable();
    return buildAccessPreview(change, data);
  }

  async function detail(id: string): Promise<StaffView | ServiceError> {
    const { data, error } = await db.from("admin_users").select(STAFF_FIELDS).eq("id", id).maybeSingle();
    if (error) return unavailable();
    if (!data) return err(404, "not_found", "Personel kaydı bulunamadı.");
    const row = data as unknown as StaffRow;
    return staffView(row, await deps.mfaStatus(row.user_id));
  }

  const assign = (actor: string, adminId: string, roleKey: string, scope: Scope, endsAt: string | null, reason: string | null) =>
    rpc("assign_admin_role", { p_actor: actor, p_admin: adminId, p_role_key: roleKey, p_scope: scope, p_ends_at: endsAt, p_reason: reason });

  const updateAssignment = (actor: string, assignmentId: string, scope: Scope, endsAt: string | null, expectedVersion: string, reason: string | null) =>
    rpc("update_admin_assignment", {
      p_actor: actor, p_assignment: assignmentId, p_scope: scope, p_ends_at: endsAt,
      p_expected_updated_at: expectedVersion, p_reason: reason,
    });

  const revokeAssignment = (actor: string, assignmentId: string, reason: string | null) =>
    rpc("revoke_admin_assignment", { p_actor: actor, p_assignment: assignmentId, p_reason: reason });

  const setActive = (actor: string, adminId: string, active: boolean, reason: string | null) =>
    rpc("set_admin_active", { p_actor: actor, p_admin: adminId, p_active: active, p_reason: reason });

  async function invitations(page: { limit: number; cursor?: string | null } = { limit: 50 }): Promise<InvitationView[] | ServiceError> {
    let query = db.from("admin_invitations").select(INVITATION_FIELDS).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(page.limit);
    const cursor: Cursor | null = parseCursor(page.cursor);
    if (cursor) query = query.or(keysetFilter(cursor, false));
    const { data, error } = await query;
    if (error) return unavailable();
    return ((data ?? []) as unknown as InvitationRow[]).map(invitationView);
  }

  /** Davet oluşturur ve ham belirteci DÖNDÜRÜR; belirteç yalnız e-postaya konur, kayda yazılmaz. */
  async function createInvitation(
    actor: string,
    input: { email: string; roleKey: string; scope: Scope; accessEndsAt: string | null; expiresInDays: number }
  ): Promise<{ ok: true; invitation: InvitationView; token: string } | ServiceError> {
    const { token, hash } = newInvitationToken();
    const expiresAt = new Date(deps.now().getTime() + input.expiresInDays * 86_400_000).toISOString();
    const result = await rpc("create_admin_invitation", {
      p_actor: actor, p_email: input.email, p_role_key: input.roleKey, p_scope: input.scope,
      p_access_ends_at: input.accessEndsAt, p_token_hash: hash, p_expires_at: expiresAt,
    });
    if (isServiceError(result)) return result;
    const view = await invitationById(String((result.data as { id: string }).id));
    return isServiceError(view) ? view : { ok: true, invitation: view, token };
  }

  async function invitationById(id: string): Promise<InvitationView | ServiceError> {
    const { data, error } = await db.from("admin_invitations").select(INVITATION_FIELDS).eq("id", id).maybeSingle();
    if (error) return unavailable();
    if (!data) return err(404, "not_found", "Davet bulunamadı.");
    return invitationView(data as unknown as InvitationRow);
  }

  async function resendInvitation(actor: string, id: string, expiresInDays: number) {
    const { token, hash } = newInvitationToken();
    const expiresAt = new Date(deps.now().getTime() + expiresInDays * 86_400_000).toISOString();
    const result = await rpc("resend_admin_invitation", { p_actor: actor, p_id: id, p_token_hash: hash, p_expires_at: expiresAt });
    if (isServiceError(result)) return result;
    const view = await invitationById(id);
    return isServiceError(view) ? view : { ok: true as const, invitation: view, token };
  }

  const revokeInvitation = (actor: string, id: string) => rpc("revoke_admin_invitation", { p_actor: actor, p_id: id });

  const acceptInvitation = (token: string, userId: string, email: string, fullName: string) =>
    rpc("accept_admin_invitation", { p_token_hash: hashInvitationToken(token), p_user: userId, p_email: email, p_full_name: fullName });

  const migrationReport = () => rpc("admin_migration_report", {});

  return { list, detail, previewAssignment, assign, updateAssignment, revokeAssignment, setActive, invitations, invitationById, createInvitation, resendInvitation, revokeInvitation, acceptInvitation, migrationReport };
}

export type StaffService = ReturnType<typeof createStaffService>;
