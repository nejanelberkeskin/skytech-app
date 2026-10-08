// Yetki katmanı birimleri: kapsam yardımcıları, MFA tazeliği, denetim maskesi, kapsam kapısı. Ağ/DB yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
import { accessibleScope, hasFullScope, hasPermission, toEffectiveAccess } from '../../lib/admin/permission-keys.ts';
import { maskAuditDetails } from '../../lib/admin/audit-read.ts';

// mfa.ts, sunucu istemcisi üzerinden next/headers'a bağlı: saf yardımcıyı taklitle yüklüyoruz.
const { verifiedAtFrom } = load('lib/admin/mfa.ts', { '@/lib/supabase/server': { createSupabaseServer: async () => ({}) } });

test('kapsam: kayıpsız birleşim, tanınmayan izin düşer, limit bildirimi', () => {
  const access = toEffectiveAccess({
    adminId: 'a',
    permissions: [
      { key: 'sites.edit', scopes: [{ kind: 'sites', siteIds: ['s1'] }, { kind: 'assigned' }] },
      { key: 'orders.read', scopes: [{ kind: 'all' }] },
      { key: 'uydurma.izin', scopes: [{ kind: 'all' }] },
      { key: 'audit.read', scopes: [] },
    ],
    roles: [{ key: 'engineer', label: 'Mühendis', scope: { kind: 'sites', siteIds: ['s1'] }, assignmentId: 'x', version: '2026-09-23T10:00:00Z', endsAt: null }],
    limits: { refundKurus: 50000, enforced: false },
  });
  assert.equal(access.permissions.length, 2, 'tanınmayan ve kapsamsız izinler düşer');
  assert.equal(hasPermission(access, 'sites.edit'), true);
  assert.equal(hasFullScope(access, 'sites.edit'), false);
  assert.equal(hasFullScope(access, 'orders.read'), true);
  assert.deepEqual(accessibleScope(access, 'sites.edit'), { all: false, siteIds: ['s1'], assigned: true });
  assert.deepEqual(access.limits, { refundKurus: 50000, enforced: false });
  assert.equal(access.roles[0].version, '2026-09-23T10:00:00Z');
});

test('MFA: doğrulama zamanı yalnız oturum bilgisinden; tazelik ve zorlama bayrağı', () => {
  const nowSec = Math.floor(Date.parse('2026-09-23T12:00:00Z') / 1000);
  assert.equal(verifiedAtFrom([{ method: 'password', timestamp: nowSec - 3600 }, { method: 'totp', timestamp: nowSec - 60 }], 'aal2'), new Date((nowSec - 60) * 1000).toISOString());
  assert.equal(verifiedAtFrom([{ method: 'password', timestamp: nowSec - 60 }], 'aal1'), new Date((nowSec - 60) * 1000).toISOString());
  assert.equal(verifiedAtFrom('yok', 'aal2'), null);

  const permissions = load('lib/admin/permissions.ts', {
    'next/server': {}, '@/lib/admin-auth': {}, '@/lib/api/envelope': { fail: (s, c) => ({ status: s, code: c }) },
    '@/lib/rbac': {}, '@/lib/supabase/server': { createServiceRoleClient: () => ({}) }, './mfa': { sessionAssurance: async () => ({}) },
    './permission-keys': load('lib/admin/permission-keys.ts'),
  });
  const now = new Date('2026-09-23T12:00:00Z');
  const fresh = { aal: 'aal2', verifiedAt: '2026-09-23T11:50:00Z', enrolled: true };
  assert.equal(permissions.mfaSatisfied('refunds.execute', fresh, now), true);
  assert.equal(permissions.mfaSatisfied('refunds.execute', { ...fresh, verifiedAt: '2026-09-23T11:40:00Z' }, now), false, '15 dk geçti');
  assert.equal(permissions.mfaSatisfied('refunds.execute', { aal: 'aal1', verifiedAt: '2026-09-23T11:59:00Z', enrolled: false }, now), false);
  assert.equal(permissions.mfaSatisfied('finance.read', { aal: 'aal1', verifiedAt: null, enrolled: false }, now), true, 'hassas olmayan izin MFA istemez');
  assert.equal(permissions.mfaSatisfied('sales.pause', { aal: 'aal1', verifiedAt: null, enrolled: false }, now), true, 'acil durdurma MFA istemez');
  assert.equal(permissions.mfaEnforced({}), false);
  assert.equal(permissions.mfaEnforced({ ADMIN_MFA_ENFORCED: '1' }), true);
});

test('denetim kaydı maskesi: sır, kimlik ve derinlik', () => {
  const masked = maskAuditDetails({
    password: 'gizli', token: 'abc', authorization: 'Bearer x',
    tckn: '12345678901', invoice: { vkn: '1234567890', city: 'Ankara' },
    note: 'normal', nested: { a: { b: { c: { d: { e: 1 } } } } }, list: [1, 2, { secret: 's' }],
  });
  assert.equal(masked.password, '••••');
  assert.equal(masked.token, '••••');
  assert.equal(masked.authorization, '••••');
  assert.equal(masked.tckn, '•••••••8901');
  assert.equal(masked.invoice.vkn, '••••••7890');
  assert.equal(masked.invoice.city, 'Ankara');
  assert.equal(masked.note, 'normal');
  assert.equal(masked.list[2].secret, '••••');
  assert.equal(JSON.stringify(masked).includes('gizli'), false);
});

test('kapsam kapısı: kapsamı uygulamayan uç dar kapsamlı kişiye kapalı', async () => {
  const responses = [];
  const permissions = load('lib/admin/permissions.ts', {
    'next/server': {}, '@/lib/rbac': {},
    '@/lib/admin-auth': { requireAdmin: async () => ({ admin: { user_id: 'u', role: 'NONE', is_active: true }, error: null }) },
    '@/lib/api/envelope': { fail: (status, code, message, details) => { responses.push({ status, code, details }); return { status, code }; } },
    '@/lib/supabase/server': { createServiceRoleClient: () => ({ rpc: async () => ({ data: { adminId: 'a', permissions: [{ key: 'finance.read', scopes: [{ kind: 'sites', siteIds: ['s1'] }] }], roles: [], limits: { refundKurus: null, enforced: false } }, error: null }) }) },
    './mfa': { sessionAssurance: async () => ({ aal: 'aal1', verifiedAt: null, enrolled: false }) },
    './permission-keys': load('lib/admin/permission-keys.ts'),
  });
  const denied = await permissions.requirePermission({}, 'finance.read');
  assert.equal(denied.error.code, 'scope_unsupported');
  assert.deepEqual(responses[0].details.scopes, [{ kind: 'sites', siteIds: ['s1'] }]);
  const allowed = await permissions.requirePermission({}, 'finance.read', { scope: 'any' });
  assert.equal(allowed.error, null);
  const missing = await permissions.requirePermission({}, 'staff.manage');
  assert.equal(missing.error.code, 'forbidden');
});
