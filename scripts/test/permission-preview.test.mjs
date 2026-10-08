// Yazma yapmayan önizleme, kararlı imleç ve tipli örnek veriler. PGlite + taklit; canlı DB yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb, one, restClient, IDS } from './pglite-db.mjs';
import { buildAccessPreview } from '../../lib/admin/preview.ts';
import { encodeCursor, keysetFilter, parseCursor, readLimit } from '../../lib/admin/pagination.ts';
import { ME_OWNER, ME_SCOPED, PREVIEW_BLOCKED, PREVIEW_NARROWING, STAFF_PAGE, AUDIT_PAGE, INVITATIONS_PAGE, ROLES } from '../../lib/admin/fixtures/permissions.ts';

const SITE_A = '20000000-0000-0000-0000-0000000000aa';
const staffId = (db, user) => one(db, `SELECT id FROM admin_users WHERE user_id=$1`, [user]).then((r) => r.id);
const preview = (db, actor, admin, change) =>
  one(db, `SELECT admin_preview_assignment($1,$2,$3::jsonb) p`, [actor, admin, JSON.stringify(change)]).then((r) => r.p);

test('önizleme: hiçbir şey yazmaz, kazanılan/kaybedilen izinleri ve eski rol aynasını gösterir', async () => {
  const db = await createDb();
  try {
    const target = await staffId(db, IDS.operations);
    const before = (await one(db, `SELECT count(*)::int n FROM admin_role_assignments`)).n;

    const assign = buildAccessPreview({ kind: 'assign', roleKey: 'finance', scope: { kind: 'all' } },
      await preview(db, IDS.superAdmin, target, { kind: 'assign', roleKey: 'finance', scope: { kind: 'all' } }));
    assert.equal(assign.blocked, null);
    assert.ok(assign.added.some((p) => p.key === 'refunds.execute'), 'yeni izinler listelenir');
    assert.equal(assign.removed.length, 0);
    assert.deepEqual(assign.legacyRoleChange, { from: 'OPERATIONS', to: 'FINANCE' }, 'eski rol aynası güçlü role yükselir');

    const assignment = (await one(db, `SELECT id FROM admin_role_assignments WHERE admin_user_id=$1`, [target])).id;
    const narrow = buildAccessPreview({ kind: 'update', assignmentId: assignment, scope: { kind: 'sites', siteIds: [SITE_A] } },
      await preview(db, IDS.superAdmin, target, { kind: 'update', assignmentId: assignment, scope: { kind: 'sites', siteIds: [SITE_A] } }));
    assert.equal(narrow.blocked, null);
    assert.deepEqual(narrow.legacyRoleChange, { from: 'OPERATIONS', to: 'NONE' }, 'daraltma eski rolü kapatır');
    assert.ok(narrow.scopeChanges.some((c) => c.key === 'orders.read' && c.to[0].kind === 'sites'));

    const revoke = buildAccessPreview({ kind: 'revoke', assignmentId: assignment },
      await preview(db, IDS.superAdmin, target, { kind: 'revoke', assignmentId: assignment }));
    assert.ok(revoke.removed.includes('orders.read'));
    assert.equal(revoke.next.permissions.length, 0);

    assert.equal((await one(db, `SELECT count(*)::int n FROM admin_role_assignments`)).n, before, 'önizleme yazmaz');
    assert.equal((await one(db, `SELECT count(*)::int n FROM admin_audit_logs`)).n, 0, 'önizleme denetim kaydı üretmez');
  } finally { await db.close(); }
});

test('önizleme: engelleri kaydetmeden bildirir (son sahip, kendine atama, yetki yükseltme)', async () => {
  const db = await createDb();
  try {
    const ownerStaff = await staffId(db, IDS.superAdmin);
    const ownerAssignment = (await one(db, `SELECT a.id FROM admin_role_assignments a JOIN admin_roles r ON r.id=a.role_id WHERE a.admin_user_id=$1 AND r.key='owner'`, [ownerStaff])).id;
    const opsStaff = await staffId(db, IDS.operations);

    const self = buildAccessPreview({ kind: 'revoke', assignmentId: ownerAssignment },
      await preview(db, IDS.superAdmin, ownerStaff, { kind: 'revoke', assignmentId: ownerAssignment }));
    assert.equal(self.blocked.code, 'self_assignment');

    const byOther = buildAccessPreview({ kind: 'revoke', assignmentId: ownerAssignment },
      await preview(db, IDS.finance, ownerStaff, { kind: 'revoke', assignmentId: ownerAssignment }));
    assert.equal(byOther.blocked.code, 'forbidden', 'roles.manage olmayan kişi');

    const narrowOwner = buildAccessPreview({ kind: 'assign', roleKey: 'owner', scope: { kind: 'sites', siteIds: [SITE_A] } },
      await preview(db, IDS.superAdmin, opsStaff, { kind: 'assign', roleKey: 'owner', scope: { kind: 'sites', siteIds: [SITE_A] } }));
    assert.equal(narrowOwner.blocked.code, 'escalation_blocked', 'personel yönetimi kapsamla sınırlanamaz');
  } finally { await db.close(); }
});

test('önizleme servisi taklit istemciyle: hata eşlemesi ve yazmama', async () => {
  const db = await createDb();
  try {
    const { createStaffService } = await import('../../lib/admin/staff.ts');
    const service = createStaffService({ db: restClient(db), mfaStatus: async () => null, now: () => new Date() });
    const target = await staffId(db, IDS.operations);
    const view = await service.previewAssignment(IDS.superAdmin, target, { kind: 'assign', roleKey: 'finance', scope: { kind: 'all' } });
    assert.equal(view.blocked, null);
    assert.ok(view.added.length > 0);
    const missing = await service.previewAssignment(IDS.superAdmin, target, { kind: 'assign', roleKey: 'yok_boyle_rol', scope: { kind: 'all' } });
    assert.equal(missing.status, 404);
  } finally { await db.close(); }
});

test('kararlı imleç: (tarih, kimlik) çifti; yalnız tarih kullanılmaz', () => {
  const cursor = encodeCursor('2026-09-23T11:58:00.000Z', 'd0000000-0000-0000-0000-000000000002');
  assert.equal(cursor, '2026-09-23T11:58:00.000Z|d0000000-0000-0000-0000-000000000002');
  assert.deepEqual(parseCursor(cursor), { at: '2026-09-23T11:58:00.000Z', id: 'd0000000-0000-0000-0000-000000000002' });
  assert.equal(parseCursor('2026-09-23T11:58:00.000Z'), null, 'tarih tek başına imleç değildir');
  assert.equal(parseCursor('bozuk|x'), null);
  assert.equal(keysetFilter(parseCursor(cursor), false),
    'created_at.lt.2026-09-23T11:58:00.000Z,and(created_at.eq.2026-09-23T11:58:00.000Z,id.lt.d0000000-0000-0000-0000-000000000002)');
  assert.equal(keysetFilter(parseCursor(cursor), true).includes('.gt.'), true);
  assert.equal(readLimit(null), 50);
  assert.equal(readLimit('1000'), 200);
  assert.equal(readLimit('0'), 50);
});

test('denetim ucu: aynı saniyedeki kayıtlar atlanmaz, imleç kimlikle sürer', async () => {
  const { loadSource: load } = await import('./load-source.mjs');
  const calls = [];
  const query = (rows) => {
    const q = {};
    for (const m of ['select', 'order', 'limit', 'eq', 'gte', 'lte']) q[m] = () => q;
    q.or = (filter) => { calls.push(filter); return q; };
    q.then = (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    return q;
  };
  const rows = [
    { id: 'd0000000-0000-0000-0000-000000000001', created_at: '2026-09-23T11:58:00.000Z', admin_id: 'u', admin_email: 'a@example.invalid', action: 'UPDATE', entity: 'admin_user', entity_id: 'x', details: { password: 'gizli' }, ip_address: null },
    { id: 'd0000000-0000-0000-0000-000000000002', created_at: '2026-09-23T11:58:00.000Z', admin_id: 'u', admin_email: 'a@example.invalid', action: 'UPDATE', entity: 'admin_user', entity_id: 'y', details: {}, ip_address: null },
  ];
  const api = load('app/api/admin/audit/route.ts', {
    'next/server': {},
    '@/lib/admin/permissions': { requirePermission: async () => ({ admin: { user_id: 'u' }, access: {}, error: null }) },
    '@/lib/admin/audit-read': load('lib/admin/audit-read.ts'),
    '@/lib/admin/pagination': load('lib/admin/pagination.ts'),
    '@/lib/supabase/server': { createServiceRoleClient: () => ({ from: () => query(rows) }) },
    '@/lib/api/envelope': { ok: (data) => ({ status: 200, data }), unavailable: () => ({ status: 503 }) },
  });
  const res = await api.GET({ nextUrl: { searchParams: new URLSearchParams({ limit: '2', cursor: '2026-09-23T11:59:00.000Z|d0000000-0000-0000-0000-000000000009' }) } });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /created_at\.lt\.2026-09-23T11:59:00\.000Z,and\(created_at\.eq\..*id\.lt\.d0000000-0000-0000-0000-000000000009\)/);
  assert.equal(res.data.items.length, 2);
  assert.equal(res.data.items[0].details.password, '••••');
  assert.equal(res.data.nextCursor, '2026-09-23T11:58:00.000Z|d0000000-0000-0000-0000-000000000002', 'imleç kimlikle biter');
});

test('örnek veriler sözleşmeyle uyumlu', () => {
  assert.equal(ME_OWNER.limits.enforced, false);
  assert.equal(ME_OWNER.mfa.enforced, false);
  assert.ok(ME_SCOPED.permissions.some((p) => p.scopes.length === 2), 'karma kapsam örneği var');
  assert.equal(ME_SCOPED.admin.legacyRole, 'NONE', 'dar kapsamlı kişi eski uçlara kapalı');
  assert.equal(STAFF_PAGE.nextCursor, null);
  assert.ok(STAFF_PAGE.items[0].assignments[0].updatedAt, 'atamada sürüm alanı var');
  assert.match(AUDIT_PAGE.nextCursor, /\|/);
  assert.equal(INVITATIONS_PAGE.items[0].status, 'pending');
  assert.ok(ROLES.every((r) => Array.isArray(r.permissions) && r.permissions.length > 0), 'roller somut izin dizisi taşır');
  assert.equal(PREVIEW_NARROWING.legacyRoleChange.to, 'NONE');
  assert.equal(PREVIEW_BLOCKED.blocked.code, 'last_active_owner');
});
