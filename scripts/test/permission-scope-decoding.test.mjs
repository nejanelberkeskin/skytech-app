// Bozuk RPC verisi gerçek izin çözümleyicisi ve kapısından geçer; ağ/veritabanı yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { accessibleScope, hasFullScope, hasPermission, toEffectiveAccess } from '../../lib/admin/permission-keys.ts';
import { realGate } from './admin-gate.mjs';

const malformedScopes = [
  null, false, 7, 'all', [], {}, { kind: 'ALL' }, { kind: 'unknown' },
  { kind: 'sites' }, { kind: 'sites', siteIds: null }, { kind: 'sites', siteIds: 's1' },
  { kind: 'sites', siteIds: [] }, { kind: 'sites', siteIds: [null] },
  { kind: 'sites', siteIds: [42] }, { kind: 'sites', siteIds: [''] },
  { kind: 'sites', siteIds: ['  '] }, { kind: 'sites', siteIds: ['s1', null] },
];
const raw = (scopes) => ({ permissions: [{ key: 'orders.read', scopes }], roles: [] });

test('bozuk kapsam hiçbir izin veya tüm kayıtlar erişimi üretmez', () => {
  for (const scope of malformedScopes) {
    const access = toEffectiveAccess(raw([scope]));
    assert.equal(hasPermission(access, 'orders.read'), false, JSON.stringify(scope));
    assert.equal(hasFullScope(access, 'orders.read'), false, JSON.stringify(scope));
    assert.deepEqual(accessibleScope(access, 'orders.read'), { all: false, siteIds: [], assigned: false });
  }
});

test('bozuk yanıt ve null dizi üyeleri çökmeksizin reddedilir; geçerli dar kapsam korunur', () => {
  for (const value of [null, false, 1, 'bad', [], { permissions: [null, 1, [], false, 'bad', {}], roles: [null, 1, [], false, 'bad', {}] }]) {
    const access = toEffectiveAccess(value);
    assert.deepEqual(access.permissions, []);
    assert.deepEqual(access.roles, []);
  }
  const access = toEffectiveAccess({
    permissions: [null, { key: ['orders.read'], scopes: [{ kind: 'all' }] },
      { key: 'orders.read', scopes: [...malformedScopes, { kind: 'sites', siteIds: ['s1', 's2'] }, { kind: 'assigned' }] }],
    roles: [null, { key: 'broken', scope: {} }, { key: 'valid', label: 'Saha', scope: { kind: 'sites', siteIds: ['s1'] }, assignmentId: 'x', version: '2026-09-27T12:00:00.123456Z', endsAt: null }],
  });
  assert.equal(access.permissions.length, 1);
  assert.equal(hasFullScope(access, 'orders.read'), false);
  assert.deepEqual(accessibleScope(access, 'orders.read'), { all: false, siteIds: ['s1', 's2'], assigned: true });
  assert.equal(access.roles.length, 1);
  assert.equal(access.roles[0].key, 'valid');
  assert.equal(access.roles[0].version, '2026-09-27T12:00:00.123456Z');
  assert.deepEqual(access.roles[0].scope, { kind: 'sites', siteIds: ['s1'] });
});

test('yalnız açık all kapsamı tam erişim verir; geçerli kapsamlar aynı biçimde kalır', () => {
  for (const scope of [{ kind: 'all' }, { kind: 'assigned' }, { kind: 'sites', siteIds: ['s1'] }]) {
    const access = toEffectiveAccess(raw([scope]));
    assert.equal(hasPermission(access, 'orders.read'), true);
    assert.equal(hasFullScope(access, 'orders.read'), scope.kind === 'all');
    assert.deepEqual(access.permissions[0].scopes, [scope]);
  }
});

test('gerçek tekil/çoğul izin kapısı bozuk RPC kapsamıyla açılamaz', async () => {
  for (const scope of malformedScopes) {
    const gate = realGate({ userId: 'u', access: raw([scope]) });
    for (const options of [{}, { scope: 'any' }]) {
      const single = await gate.requirePermission({}, 'orders.read', options);
      const any = await gate.requireAnyPermission({}, ['orders.read', 'finance.read'], { ...options, mfa: false });
      assert.equal(single.error?.status, 403, JSON.stringify(scope));
      assert.equal(single.error?.body.error.code, 'forbidden');
      assert.equal(any.error?.status, 403, JSON.stringify(scope));
      assert.equal(any.error?.body.error.code, 'forbidden');
    }
  }
  const gate = realGate({ userId: 'u', access: raw([{}, { kind: 'sites', siteIds: ['s1'] }]) });
  assert.equal((await gate.requirePermission({}, 'orders.read')).error?.body.error.code, 'scope_unsupported');
  assert.equal((await gate.requirePermission({}, 'orders.read', { scope: 'any' })).error, null);
});
