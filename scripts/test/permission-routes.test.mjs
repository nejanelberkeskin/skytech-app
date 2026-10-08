// Personel uçları: atama sahipliği, rol sözlüğü okuma yetkisi, davet bağlantısının yolu. Canlı çağrı yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { loadSource as load } from './load-source.mjs';
import { createDb, one, restClient, IDS } from './pglite-db.mjs';
import { retiredPageRedirect } from '../../lib/site-config.ts';
import { analyticsAllowedPath } from '../../lib/analytics.ts';
import * as gateHelpers from './admin-gate.mjs';

const staffId = (db, user) => one(db, `SELECT id FROM admin_users WHERE user_id=$1`, [user]).then((r) => r.id);

test('atama güncelleme/kaldırma: adresteki personel ile kaydın sahibi eşleşmeli', async () => {
  const db = await createDb();
  try {
    const { createStaffService } = await import('../../lib/admin/staff.ts');
    const service = createStaffService({ db: restClient(db), mfaStatus: async () => null, now: () => new Date() });
    const finance = await staffId(db, IDS.finance);
    const operations = await staffId(db, IDS.operations);
    const assignment = await one(db, `SELECT id, updated_at FROM admin_role_assignments WHERE admin_user_id=$1 AND revoked_at IS NULL`, [finance]);

    const wrongParent = await service.updateAssignment(IDS.superAdmin, operations, assignment.id, { kind: 'all' }, null, assignment.updated_at, 'yanlış ebeveyn');
    assert.equal(wrongParent.status, 404, 'başka personelin ataması bu adresten düzenlenemez');
    assert.equal((await one(db, `SELECT scope FROM admin_role_assignments WHERE id=$1`, [assignment.id])).scope.kind, 'all', 'kayıt değişmedi');

    const wrongRevoke = await service.revokeAssignment(IDS.superAdmin, operations, assignment.id, 'yanlış ebeveyn');
    assert.equal(wrongRevoke.status, 404);
    assert.equal((await one(db, `SELECT revoked_at FROM admin_role_assignments WHERE id=$1`, [assignment.id])).revoked_at, null);

    const right = await service.updateAssignment(IDS.superAdmin, finance, assignment.id, { kind: 'all' }, null, assignment.updated_at, 'doğru ebeveyn');
    assert.equal(right.ok, true);
  } finally { await db.close(); }
});

const response = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };
const envelope = load('lib/api/envelope.ts', { 'next/server': { NextResponse: response } });
const access = (keys) => ({ adminId: 'a', permissions: keys.map((key) => ({ key, scopes: [{ kind: 'all' }] })), roles: [], limits: { refundKurus: null, enforced: false } });

function rolesApi(keys) {
  const { realGate } = gateHelpers;
  return load('app/api/admin/roles/route.ts', {
    zod: { z },
    '@/lib/admin/permissions': realGate({ userId: 'u', access: access(keys) }),
    '@/lib/admin/roles-http': { rolesService: () => { throw new Error('sözlük okuması servisi çağırmamalı'); } },
    '@/lib/admin/staff-http': { failFrom: () => null, isServiceError: () => false, readJson: async () => ({}) },
    '@/lib/api/envelope': envelope,
    '@/lib/supabase/server': { createServiceRoleClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [{ key: 'finance', label: 'Finans', description: '', permissions: ['finance.read'], is_system: true }], error: null }) }) }) }) },
  });
}

test('rol sözlüğü: davet eden de okuyabilir, yetkisiz okuyamaz, atama hakkı değişmez', async () => {
  assert.equal((await rolesApi(['roles.manage']).GET({})).status, 200);
  const inviter = await rolesApi(['staff.invite']).GET({});
  assert.equal(inviter.status, 200, 'staff.invite sahibi rol seçeneklerini görebilmeli');
  assert.equal(inviter.body.data.roles[0].key, 'finance');
  const outsider = await rolesApi(['finance.read']).GET({});
  assert.equal(outsider.status, 403);
  assert.equal(outsider.body.error.code, 'forbidden');
});

test('davet bağlantısı /personel-daveti yoluna gider (eski /davet kalıcı yönlendirmede)', async () => {
  assert.equal(retiredPageRedirect('/davet/abc'), '/', 'eski yol hâlâ yönlendiriyor');
  assert.equal(retiredPageRedirect('/personel-daveti/abc'), null);

  const sent = [];
  const invitation = { id: 'c0000000-0000-0000-0000-000000000001', email: 'yeni@example.invalid', roleLabel: 'Finans', expiresAt: '2026-09-30T09:00:00.000Z' };
  const api = load('app/api/admin/invitations/route.ts', {
    'next/server': { after: (fn) => fn() },
    zod: { z },
    '@/lib/admin/permissions': { requirePermission: async () => ({ admin: { user_id: 'u', full_name: 'Sahip', email: 'sahip@example.invalid' }, access: access(['staff.invite']), error: null }) },
    '@/lib/admin/staff': { DEFAULT_INVITATION_DAYS: 7 },
    '@/lib/admin/staff-http': {
      failFrom: (e) => response.json({ ok: false, error: e }, { status: e.status }),
      isServiceError: () => false,
      readJson: async (request) => request.body,
      scopeSchema: z.object({ kind: z.literal('all') }).strict(),
      staffService: () => ({ createInvitation: async () => ({ ok: true, invitation, token: 'DENEME-TOKEN' }) }),
    },
    '@/lib/mail': { SKIPPED_ID: 'skipped-no-api-key', publicOrigin: () => 'https://skytechgreen.com', sendStaffInvitation: async (input) => { sent.push(input); return { id: 'mail-1' }; } },
    '@/lib/admin/pagination': load('lib/admin/pagination.ts'),
    '@/lib/api/envelope': envelope,
  });
  const res = await api.POST({ body: { email: 'yeni@example.invalid', roleKey: 'finance', scope: { kind: 'all' } }, nextUrl: { origin: 'https://skytechgreen.com' } });
  assert.equal(res.status, 201);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].acceptUrl, 'https://skytechgreen.com/personel-daveti/DENEME-TOKEN');
  const path = new URL(sent[0].acceptUrl).pathname;
  assert.equal(retiredPageRedirect(path), null, 'gönderilen bağlantı yönlendirmeye düşmez');
  for (const locale of ['', '/en', '/ru']) {
    assert.equal(analyticsAllowedPath(locale + path), false, `davet belirteci ölçüme sızmamalı: ${locale + path}`);
  }
});
