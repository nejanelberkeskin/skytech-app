// lib/admin/roles.ts DTO dönüşümleri: sürüm metni kayıpsız taşınır; hesaplanan listeler doğru.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRolesService, mapRoleError } from '../../lib/admin/roles.ts';

const fakeDb = (data) => ({ rpc: async () => ({ data, error: null }) });

test('roles DTO: version/createdAt SQL metni olduğu gibi döner (Date dönüşümü yok)', async () => {
  const raw = { key: 'x_rol', label: 'X', description: '', permissions: ['roles.manage', 'sites.read', 'orders.export'], isSystem: false,
    version: '2026-09-23T11:00:00.123456Z', createdAt: '2026-09-20T08:00:00.000001Z', updatedBy: null,
    usage: { activeAssignments: 1, scheduledAssignments: 2, staffCount: 3, pendingInvitations: 0, fingerprint: 'f'.repeat(32) } };
  const dto = await createRolesService({ db: fakeDb(raw) }).detail('u', 'x_rol');
  assert.equal(dto.version, '2026-09-23T11:00:00.123456Z');
  assert.equal(dto.createdAt, '2026-09-20T08:00:00.000001Z');
  assert.deepEqual(dto.sensitivePermissions, ['roles.manage', 'orders.export'], 'yeniden doğrulama isteyenler, rol sırasıyla');
  assert.deepEqual(dto.globalOnlyPermissions, ['roles.manage']);
  assert.equal(dto.usage.scheduledAssignments, 2);

  const preview = await createRolesService({ db: fakeDb({ role: { key: 'x_rol', label: 'X', isSystem: false, version: '2026-09-23T11:00:00.123456Z' },
    next: { label: 'X', description: '', permissions: ['sites.read'] }, added: [], removed: ['roles.manage'], unchanged: 1,
    usage: raw.usage, affectedStaff: [], affectedInvitations: [],
    blocked: { code: 'global_scope_conflict', details: { permissions: ['staff.invite'], assignments: 1, invitations: 0 } } }) }).preview('u', 'x_rol', {});
  assert.equal(preview.role.version, '2026-09-23T11:00:00.123456Z');
  assert.equal(preview.blocked.code, 'global_scope_conflict');
  assert.deepEqual(preview.blocked.details, { permissions: ['staff.invite'], assignments: 1, invitations: 0 });
  assert.match(preview.blocked.message, /kapsamla sınırlanamaz/);
});

test('roles hata eşlemesi: ayrıntılar kod başına doğru alanda', () => {
  assert.deepEqual(mapRoleError({ message: 'escalation_blocked', details: 'a.b,c.d' }).details, { missing: ['a.b', 'c.d'] });
  assert.deepEqual(mapRoleError({ message: 'invalid_permissions', details: 'x.y' }).details, { unknown: ['x.y'] });
  assert.deepEqual(mapRoleError({ message: 'invalid_scope', details: '20000000-0000-0000-0000-0000000000ff' }).details,
    { missingSiteIds: ['20000000-0000-0000-0000-0000000000ff'] });
  const conflict = mapRoleError({ message: 'global_scope_conflict', details: '{"permissions":["staff.invite"],"assignments":2,"invitations":1}' });
  assert.equal(conflict.status, 409);
  assert.deepEqual(conflict.details, { permissions: ['staff.invite'], assignments: 2, invitations: 1 });
  assert.equal(mapRoleError({ message: 'bilinmeyen' }).status, 503, 'tanınmayan SQL hatası 503 unavailable');
  assert.equal(mapRoleError({ message: 'usage_changed' }).code, 'usage_changed');
  assert.equal(mapRoleError({ message: 'invalid_label' }).code, 'invalid_label');
});
