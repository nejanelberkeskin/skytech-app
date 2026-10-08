// 021 yetki çekirdeği — gerçek SQL, PGlite. Canlı DB, e-posta ve gerçek kişi yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDb, one, rows, sqlError, IDS } from './pglite-db.mjs';
import { PERMISSIONS } from '../../lib/admin/permission-keys.ts';

const SITE_A = '20000000-0000-0000-0000-0000000000aa';
const SITE_B = '20000000-0000-0000-0000-0000000000bb';
const effective = (db, user) => one(db, `SELECT admin_effective_permissions($1) e`, [user]).then((r) => r.e);
const staffId = (db, user) => one(db, `SELECT id FROM admin_users WHERE user_id=$1`, [user]).then((r) => r.id);
const assign = (db, actor, admin, role, scope = { kind: 'all' }, endsAt = null, reason = 'test') =>
  one(db, `SELECT assign_admin_role($1,$2,$3,$4::jsonb,$5,$6) a`, [actor, admin, role, JSON.stringify(scope), endsAt, reason]).then((r) => r.a);
const invite = (db, actor, email, role = 'finance', scope = { kind: 'all' }, hash = 'a'.repeat(64), days = 7) =>
  one(db, `SELECT create_admin_invitation($1,$2,$3,$4::jsonb,NULL,$5,now() + make_interval(days => $6)) i`,
    [actor, email, role, JSON.stringify(scope), hash, days]).then((r) => r.i);

test('021: izin listesi SQL rol tohumlarıyla birebir', async () => {
  const sql = await readFile(new URL('../../supabase/migrations/021_permission_core.sql', import.meta.url), 'utf8');
  const seeded = new Set([...sql.matchAll(/'([a-z_]+(?:\.[a-z_]+)+)'/g)].map((m) => m[1]).filter((k) => k.includes('.')));
  const known = new Set(PERMISSIONS);
  for (const key of seeded) assert.ok(known.has(key), `SQL'de olup sözlükte olmayan izin: ${key}`);
  const owner = new Set([...sql.matchAll(/'([a-z_]+\.[a-z_.]+)'/g)].map((m) => m[1]));
  for (const key of PERMISSIONS) assert.ok(owner.has(key), `Sözlükte olup SQL'de olmayan izin: ${key}`);
});

test('021: kapsamlar izin bazında kayıpsız birleşir; all daralmayı yutmaz', async () => {
  const db = await createDb();
  try {
    const target = await staffId(db, IDS.operations);
    await assign(db, IDS.superAdmin, target, 'engineer', { kind: 'sites', siteIds: [SITE_A] });
    await assign(db, IDS.superAdmin, target, 'content_editor', { kind: 'assigned' });
    const access = await effective(db, IDS.operations);
    const scopesOf = (key) => access.permissions.find((p) => p.key === key)?.scopes ?? [];
    assert.deepEqual(scopesOf('orders.read'), [{ kind: 'all' }], 'operations ataması tüm kayıtlarda');
    const siteScopes = scopesOf('sites.edit');
    assert.deepEqual(siteScopes, [{ kind: 'sites', siteIds: [SITE_A] }]);
    assert.deepEqual(scopesOf('content.edit'), [{ kind: 'assigned' }]);
    const mixed = scopesOf('sites.read');
    assert.equal(mixed.some((s) => s.kind === 'all'), true, 'operations tüm sahaları okuyabilir');
    // Aynı izni iki dar kapsamla veren ikinci atama: kayıpsız birleşim
    await assign(db, IDS.superAdmin, target, 'engineer', { kind: 'assigned' });
    const after = await effective(db, IDS.operations);
    const edit = after.permissions.find((p) => p.key === 'sites.edit').scopes;
    assert.equal(edit.length, 2);
    assert.deepEqual(edit.map((s) => s.kind).sort(), ['assigned', 'sites']);
    assert.equal(after.limits.enforced, false, 'tutar sınırı uygulanmıyor olarak bildirilir');
  } finally { await db.close(); }
});

test('021: eski rol aynası yalnız tüm kayıtlar + süresiz atamada yazılır', async () => {
  const db = await createDb();
  try {
    const target = await staffId(db, IDS.operations);
    await db.query(`UPDATE admin_role_assignments SET revoked_at = now() WHERE admin_user_id = $1`, [target]);
    await assign(db, IDS.superAdmin, target, 'finance', { kind: 'sites', siteIds: [SITE_B] });
    assert.equal((await one(db, `SELECT role FROM admin_users WHERE id=$1`, [target])).role, 'NONE', 'dar kapsam eski rolü açmaz');
    await assign(db, IDS.superAdmin, target, 'finance', { kind: 'all' }, new Date(Date.now() + 86_400_000).toISOString());
    assert.equal((await one(db, `SELECT role FROM admin_users WHERE id=$1`, [target])).role, 'NONE', 'süreli atama eski rolü açmaz');
    await assign(db, IDS.superAdmin, target, 'finance');
    assert.equal((await one(db, `SELECT role FROM admin_users WHERE id=$1`, [target])).role, 'FINANCE');
  } finally { await db.close(); }
});

test('021: atama daraltılınca eski rol aynası aynı işlemde yenilenir (P1 gerilemesi)', async () => {
  const db = await createDb();
  try {
    const target = await staffId(db, IDS.finance);
    const assignment = (await one(db, `SELECT id, updated_at FROM admin_role_assignments WHERE admin_user_id=$1 AND revoked_at IS NULL`, [target]));
    assert.equal((await one(db, `SELECT role FROM admin_users WHERE id=$1`, [target])).role, 'FINANCE');

    // all → sites: etkili kapsam daralır, eski rol aynası da NONE olmalı.
    await one(db, `SELECT update_admin_assignment($1,$2,$3::jsonb,NULL,$4,'daralt') u`,
      [IDS.superAdmin, assignment.id, JSON.stringify({ kind: 'sites', siteIds: [SITE_A] }), assignment.updated_at]);
    assert.equal((await one(db, `SELECT role FROM admin_users WHERE id=$1`, [target])).role, 'NONE',
      'dar kapsamlı kişi eski rol listesine dayanan uçlara giremez');
    const scopes = (await effective(db, IDS.finance)).permissions.find((p) => p.key === 'finance.read').scopes;
    assert.deepEqual(scopes, [{ kind: 'sites', siteIds: [SITE_A] }]);

    // sites → all: ayna geri döner.
    const v1 = (await one(db, `SELECT updated_at FROM admin_role_assignments WHERE id=$1`, [assignment.id])).updated_at;
    await one(db, `SELECT update_admin_assignment($1,$2,'{"kind":"all"}'::jsonb,NULL,$3,'geri') u`, [IDS.superAdmin, assignment.id, v1]);
    assert.equal((await one(db, `SELECT role FROM admin_users WHERE id=$1`, [target])).role, 'FINANCE');

    // all → süreli: süreli erişim de eski rolü açmaz.
    const v2 = (await one(db, `SELECT updated_at FROM admin_role_assignments WHERE id=$1`, [assignment.id])).updated_at;
    await one(db, `SELECT update_admin_assignment($1,$2,'{"kind":"all"}'::jsonb,now() + interval '2 days',$3,'süre') u`, [IDS.superAdmin, assignment.id, v2]);
    assert.equal((await one(db, `SELECT role FROM admin_users WHERE id=$1`, [target])).role, 'NONE');
    assert.ok((await rows(db, `SELECT 1 FROM admin_audit_logs WHERE entity='admin_assignment' AND action='UPDATE'`)).length >= 3);
  } finally { await db.close(); }
});

test('021: yetki yükseltme, kendine atama ve kapsam genişletme engellenir', async () => {
  const db = await createDb();
  try {
    const financeStaff = await staffId(db, IDS.finance);
    const opsStaff = await staffId(db, IDS.operations);
    assert.match(await sqlError(assign(db, IDS.finance, opsStaff, 'owner')), /forbidden/, 'roles.manage yok');
    await assign(db, IDS.superAdmin, financeStaff, 'business_manager');
    // business_manager roles.manage vermez; yine de deneyelim
    assert.match(await sqlError(assign(db, IDS.finance, opsStaff, 'finance')), /forbidden/);
    // Sahibin kendine atama yapması engellenir
    const ownerStaff = await staffId(db, IDS.superAdmin);
    assert.match(await sqlError(assign(db, IDS.superAdmin, ownerStaff, 'finance')), /self_assignment/);
    // Personel/rol yönetimi kapsamla sınırlanamaz: dar kapsamla verilemez.
    assert.match(await sqlError(assign(db, IDS.superAdmin, opsStaff, 'owner', { kind: 'sites', siteIds: [SITE_A] })), /escalation_blocked/);

    // Dar kapsamlı yönetici kendi kapsamını aşan atama yapamaz.
    await db.query(`UPDATE admin_role_assignments SET revoked_at = now() WHERE admin_user_id = $1`, [financeStaff]);
    await db.query(`INSERT INTO admin_roles(key,label,permissions) VALUES ('scoped_manager','Kapsamlı yönetici',ARRAY['roles.manage'])`);
    await assign(db, IDS.superAdmin, financeStaff, 'scoped_manager');
    await assign(db, IDS.superAdmin, financeStaff, 'engineer', { kind: 'sites', siteIds: [SITE_A] });
    assert.match(await sqlError(assign(db, IDS.finance, opsStaff, 'engineer', { kind: 'all' })), /escalation_blocked/);
    assert.match(await sqlError(assign(db, IDS.finance, opsStaff, 'engineer', { kind: 'sites', siteIds: [SITE_A, SITE_B] })), /escalation_blocked/);
    const narrow = await assign(db, IDS.finance, opsStaff, 'engineer', { kind: 'sites', siteIds: [SITE_A] });
    assert.ok(narrow.id, 'kendi kapsamı içinde atama yapılabilir');

    // Süre devri: atayanın erişimi biterken daha uzun erişim veremez.
    await db.query(`UPDATE admin_role_assignments SET ends_at = now() + interval '2 days' WHERE admin_user_id = $1 AND revoked_at IS NULL`, [financeStaff]);
    assert.match(await sqlError(assign(db, IDS.finance, opsStaff, 'engineer', { kind: 'sites', siteIds: [SITE_A] })), /escalation_blocked/, 'süresiz erişim verilemez');
    const timed = await assign(db, IDS.finance, opsStaff, 'engineer', { kind: 'sites', siteIds: [SITE_A] }, new Date(Date.now() + 86_400_000).toISOString());
    assert.ok(timed.id, 'kendi süresi içinde atama yapılabilir');
  } finally { await db.close(); }
});

test('021: son kalıcı sahip kaldırılamaz, süreli yapılamaz, pasifleştirilemez; devir iki adımda', async () => {
  const db = await createDb();
  try {
    const ownerStaff = await staffId(db, IDS.superAdmin);
    const ownerAssignment = (await one(db, `SELECT a.id FROM admin_role_assignments a JOIN admin_roles r ON r.id=a.role_id WHERE a.admin_user_id=$1 AND r.key='owner'`, [ownerStaff])).id;
    const other = await staffId(db, IDS.finance);
    assert.match(await sqlError(one(db, `SELECT revoke_admin_assignment($1,$2,'dene') r`, [IDS.superAdmin, ownerAssignment])), /self_assignment/, 'kendi atamasına dokunamaz');

    // Tek sahipken: süre verilemez, kaldırılamaz, pasifleştirilemez.
    await assign(db, IDS.superAdmin, other, 'read_only');   // ikinci kişi henüz sahip değil
    const v0 = (await one(db, `SELECT updated_at FROM admin_role_assignments WHERE id=$1`, [ownerAssignment])).updated_at;
    assert.match(
      await sqlError(one(db, `SELECT update_admin_assignment($1,$2,'{"kind":"all"}'::jsonb,now() + interval '1 day',$3,'süre') u`, [IDS.finance, ownerAssignment, v0])),
      /forbidden/, 'read_only kişi atama değiştiremez',
    );

    // Devir: yeni sahip atanır, sonra eskisi düşürülebilir.
    await assign(db, IDS.superAdmin, other, 'owner');
    const secondAssignment = (await one(db, `SELECT a.id FROM admin_role_assignments a JOIN admin_roles r ON r.id=a.role_id WHERE a.admin_user_id=$1 AND r.key='owner'`, [other])).id;
    const v1 = (await one(db, `SELECT updated_at FROM admin_role_assignments WHERE id=$1`, [ownerAssignment])).updated_at;
    const timed = await one(db, `SELECT update_admin_assignment($1,$2,'{"kind":"all"}'::jsonb,now() + interval '1 day',$3,'devir') u`, [IDS.finance, ownerAssignment, v1]);
    assert.ok(timed.u.ends_at, 'ikinci sahip varken süre verilebilir');
    assert.equal((await one(db, `SELECT admin_owner_count(NULL) n`)).n, 1, 'kalıcı sahip: yalnız yeni sahip');

    // Artık son kalıcı sahip ikinci kişi: onun ataması kaldırılamaz ve süreli yapılamaz.
    assert.match(await sqlError(one(db, `SELECT revoke_admin_assignment($1,$2,'dene') r`, [IDS.superAdmin, secondAssignment])), /last_active_owner/);
    const v2 = (await one(db, `SELECT updated_at FROM admin_role_assignments WHERE id=$1`, [secondAssignment])).updated_at;
    assert.match(
      // Atayanın kendi erişimi 1 gün sonra bitiyor; 12 saatlik süre onun penceresinin içinde kalır,
      // bu yüzden hata kapsam/süre değil son sahip kuralından gelir.
      await sqlError(one(db, `SELECT update_admin_assignment($1,$2,'{"kind":"all"}'::jsonb,now() + interval '12 hours',$3,'süre') u`, [IDS.superAdmin, secondAssignment, v2])),
      /last_active_owner/, 'son kalıcı sahibe süre konulamaz',
    );
    assert.match(await sqlError(one(db, `SELECT set_admin_active($1,$2,false,'dene') s`, [IDS.superAdmin, other])), /last_active_owner/);
    assert.equal((await one(db, `SELECT admin_owner_count(NULL) n`)).n, 1, 'her durumda bir kalıcı sahip kalır');

    // İki sahibin sırayla sürelenmesi: ikisi birden süreli olamaz.
    const third = await staffId(db, IDS.operations);
    // Süreli sahip kalıcı sahip atayamaz (süre devri kuralı); atamayı kalıcı sahip yapar.
    assert.match(await sqlError(assign(db, IDS.superAdmin, third, 'owner')), /escalation_blocked/);
    await assign(db, IDS.finance, third, 'owner');
    const thirdAssignment = (await one(db, `SELECT a.id FROM admin_role_assignments a JOIN admin_roles r ON r.id=a.role_id WHERE a.admin_user_id=$1 AND r.key='owner' AND a.revoked_at IS NULL`, [third])).id;
    const v3 = (await one(db, `SELECT updated_at FROM admin_role_assignments WHERE id=$1`, [thirdAssignment])).updated_at;
    await one(db, `SELECT update_admin_assignment($1,$2,'{"kind":"all"}'::jsonb,now() + interval '10 hours',$3,'süre') u`, [IDS.superAdmin, thirdAssignment, v3]);
    const v4 = (await one(db, `SELECT updated_at FROM admin_role_assignments WHERE id=$1`, [secondAssignment])).updated_at;
    assert.match(
      await sqlError(one(db, `SELECT update_admin_assignment($1,$2,'{"kind":"all"}'::jsonb,now() + interval '11 hours',$3,'süre') u`, [IDS.superAdmin, secondAssignment, v4])),
      /last_active_owner/, 'iki sahip sırayla sürelenip sistem sahipsiz kalamaz',
    );
  } finally { await db.close(); }
});

test('021: davet yaşam döngüsü — tek bekleyen, yeniden gönderim eski belirteci geçersiz kılar, kabul ve reddetme', async () => {
  const db = await createDb();
  try {
    const ownerUser = IDS.superAdmin;
    const first = await invite(db, ownerUser, 'Yeni@Example.COM');
    assert.equal(first.email, 'yeni@example.com');
    assert.match(await sqlError(invite(db, ownerUser, 'yeni@example.com', 'finance', { kind: 'all' }, 'b'.repeat(64))), /invitation_exists/);
    assert.match(await sqlError(invite(db, ownerUser, 'owner@example.com', 'finance', { kind: 'all' }, 'c'.repeat(64))), /already_staff/);
    assert.match(await sqlError(invite(db, IDS.finance, 'baska@example.com', 'finance', { kind: 'all' }, 'd'.repeat(64))), /forbidden/);

    await one(db, `SELECT resend_admin_invitation($1,$2,$3,now() + interval '3 days') r`, [ownerUser, first.id, 'e'.repeat(64)]);
    const newUser = '10000000-0000-0000-0000-0000000000ff';
    assert.match(await sqlError(one(db, `SELECT accept_admin_invitation($1,$2,'yeni@example.com','Yeni Kişi') a`, ['a'.repeat(64), newUser])), /invitation_missing/, 'eski belirteç geçersiz');
    assert.match(await sqlError(one(db, `SELECT accept_admin_invitation($1,$2,'baska@example.com','Yeni') a`, ['e'.repeat(64), newUser])), /invitation_email_mismatch/);

    const accepted = (await one(db, `SELECT accept_admin_invitation($1,$2,'yeni@example.com','Yeni Kişi') a`, ['e'.repeat(64), newUser])).a;
    assert.equal(accepted.admin.role, 'FINANCE');
    assert.equal((await effective(db, newUser)).permissions.length > 5, true);
    assert.match(await sqlError(one(db, `SELECT accept_admin_invitation($1,$2,'yeni@example.com','Yeni') a`, ['e'.repeat(64), newUser])), /invitation_unusable/, 'tek kullanımlık');

    const second = await invite(db, ownerUser, 'sureli@example.com', 'read_only', { kind: 'all' }, 'f'.repeat(64));
    await db.query(`UPDATE admin_invitations SET expires_at = now() - interval '1 minute' WHERE id=$1`, [second.id]);
    assert.match(await sqlError(one(db, `SELECT accept_admin_invitation($1,$2,'sureli@example.com','X') a`, ['f'.repeat(64), '10000000-0000-0000-0000-0000000000ee'])), /invitation_unusable/);
    await one(db, `SELECT revoke_admin_invitation($1,$2) r`, [ownerUser, second.id]);
    assert.equal((await one(db, `SELECT status FROM admin_invitations WHERE id=$1`, [second.id])).status, 'revoked');
    assert.ok((await rows(db, `SELECT 1 FROM admin_audit_logs WHERE entity='admin_invitation'`)).length >= 4, 'her adım denetim kaydına yazılır');
  } finally { await db.close(); }
});

test('021: süresi dolan ve kaldırılan atama erişim vermez; pasif kişi yetkisizdir', async () => {
  const db = await createDb();
  try {
    const target = await staffId(db, IDS.operations);
    await db.query(`UPDATE admin_role_assignments SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' WHERE admin_user_id=$1`, [target]);
    assert.equal((await effective(db, IDS.operations)).permissions.length, 0);
    await db.query(`UPDATE admin_role_assignments SET ends_at = NULL WHERE admin_user_id=$1`, [target]);
    assert.ok((await effective(db, IDS.operations)).permissions.length > 0);
    await one(db, `SELECT set_admin_active($1,$2,false,'ayrıldı') s`, [IDS.superAdmin, target]);
    assert.equal((await effective(db, IDS.operations)).permissions.length, 0, 'pasif kişi yetkisiz');
  } finally { await db.close(); }
});

test('021: geçiş raporu mevcut personeli ve izin sayısını gösterir', async () => {
  const db = await createDb();
  try {
    const report = (await one(db, `SELECT admin_migration_report() r`)).r;
    assert.equal(report.length, 3);
    const owner = report.find((r) => r.legacyRole === 'SUPER_ADMIN');
    assert.deepEqual(owner.roles, ['owner']);
    assert.ok(owner.permissionCount > 40);
    assert.equal(owner.narrowed, false);
  } finally { await db.close(); }
});
