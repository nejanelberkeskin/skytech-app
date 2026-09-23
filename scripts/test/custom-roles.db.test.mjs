// 022 özel roller, etki önizlemesi ve kapsam kimlik doğrulaması — gerçek SQL, PGlite.
// Canlı DB, e-posta, gerçek personel ya da MFA işlemi yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb, one, rows, sqlError, IDS } from './pglite-db.mjs';
import { PERMISSIONS } from '../../lib/admin/permission-keys.ts';

const MISSING_SITE = '20000000-0000-0000-0000-0000000000ff';
const staffId = (db, user) => one(db, `SELECT id FROM admin_users WHERE user_id=$1`, [user]).then((r) => r.id);
const assign = (db, actor, admin, role, scope = { kind: 'all' }, endsAt = null, reason = 'test') =>
  one(db, `SELECT assign_admin_role($1,$2,$3,$4::jsonb,$5,$6) a`, [actor, admin, role, JSON.stringify(scope), endsAt, reason]).then((r) => r.a);
const invite = (db, actor, email, role, scope = { kind: 'all' }, hash = 'a'.repeat(64)) =>
  one(db, `SELECT create_admin_invitation($1,$2,$3,$4::jsonb,NULL,$5,now() + interval '7 days') i`,
    [actor, email, role, JSON.stringify(scope), hash]).then((r) => r.i);
const createRole = (db, actor, key, permissions, copyFrom = null, label = 'Deneme rolü') =>
  one(db, `SELECT create_admin_role($1,$2,$3,'',$4::text[],$5) r`, [actor, key, label, permissions, copyFrom]).then((r) => r.r);
const usage = (db, key) => one(db, `SELECT admin_role_usage(id) u FROM admin_roles WHERE key=$1`, [key]).then((r) => r.u);
/** `fingerprint` verilmezse güncel parmak izi okunur (önizlemeyi yeni yapmış arayüz gibi); `null` açıkça boş gönderir. */
const updateRole = async (db, actor, key, { permissions = null, label = null, version, fingerprint, reason = 'Deneme amaçlı değişiklik.' }) => {
  const fp = fingerprint === undefined ? (await usage(db, key))?.fingerprint ?? null : fingerprint;
  return one(db, `SELECT update_admin_role($1,$2,$3,NULL,$4::text[],$5,$6,$7) r`, [actor, key, label, permissions, version, fp, reason]).then((r) => r.r);
};
const preview = (db, actor, key, permissions = null) =>
  one(db, `SELECT preview_admin_role_change($1,$2,$3::text[],NULL,NULL) p`, [actor, key, permissions]).then((r) => r.p);
const has = (db, user, key) => one(db, `SELECT admin_has_permission($1,$2) h`, [user, key]).then((r) => r.h);
/** Aktörde bulunmayan ilk izin: testler rol tohumlarına bağımlı kalmasın. */
const lacking = (db, user) =>
  one(db, `SELECT k FROM unnest(admin_permission_keys()) k WHERE NOT admin_has_permission($1, k) ORDER BY k LIMIT 1`, [user]).then((r) => r.k);
const sqlDetail = async (promise) => { try { await promise; return null; } catch (e) { return { message: e.message, detail: e.detail ?? null }; } };

/** Operasyon sorumlusuna rol yönetimi yetkisi verir (sahibin oluşturduğu özel rol, süresiz, tüm kayıtlar). */
async function roleManager(db) {
  await createRole(db, IDS.superAdmin, 'rol_yoneticisi', ['roles.manage', 'sites.read']);
  await assign(db, IDS.superAdmin, await staffId(db, IDS.operations), 'rol_yoneticisi');
}

test('022: SQL izin sözlüğü TS sözlüğüyle birebir', async () => {
  const db = await createDb();
  try {
    const sql = (await one(db, `SELECT admin_permission_keys() k`)).k;
    assert.deepEqual([...sql].sort(), [...PERMISSIONS].sort());
    const seeded = (await rows(db, `SELECT DISTINCT unnest(permissions) k FROM admin_roles`)).map((r) => r.k);
    for (const key of seeded) assert.ok(sql.includes(key), `tohumda olup sözlükte olmayan: ${key}`);
  } finally { await db.close(); }
});

test('022: rol oluşturma — benzersiz anahtar, sistem anahtarı reddi, kopyalama, bilinmeyen izin, audit', async () => {
  const db = await createDb();
  try {
    const created = await createRole(db, IDS.superAdmin, 'saha_sorumlusu', ['sites.read', 'batches.read', 'sites.read']);
    assert.deepEqual(created.permissions, ['batches.read', 'sites.read'], 'tekrarlar ayıklanır, sıralı saklanır');
    assert.equal(created.isSystem, false);
    assert.equal(created.usage.activeAssignments, 0);
    assert.ok(created.version && created.usage.fingerprint);

    assert.equal(await sqlError(createRole(db, IDS.superAdmin, 'saha_sorumlusu', ['sites.read'])), 'role_exists');
    assert.equal(await sqlError(createRole(db, IDS.superAdmin, 'owner', ['sites.read'])), 'role_exists', 'sistem rol anahtarı kullanılamaz');
    assert.equal(await sqlError(createRole(db, IDS.superAdmin, 'Kötü-Anahtar', ['sites.read'])), 'invalid_key');

    const copy = await createRole(db, IDS.superAdmin, 'finans_kopyasi', null, 'finance');
    const finance = (await one(db, `SELECT permissions FROM admin_roles WHERE key='finance'`)).permissions;
    assert.deepEqual(copy.permissions, [...finance].sort(), 'izin verilmezse kopyalanan rolün izinleri gelir');
    assert.equal(await sqlError(createRole(db, IDS.superAdmin, 'olmayan_kopya', null, 'yok_boyle')), 'role_missing');
    assert.equal(await sqlError(createRole(db, IDS.superAdmin, 'bos_rol', null, null)), 'invalid_permissions');

    const unknown = await sqlDetail(createRole(db, IDS.superAdmin, 'bilinmeyen', ['sites.read', 'uydurma.izin']));
    assert.equal(unknown.message, 'invalid_permissions');
    assert.equal(unknown.detail, 'uydurma.izin');

    const audit = await rows(db, `SELECT action, entity_id, details FROM admin_audit_logs WHERE entity='admin_role' ORDER BY created_at, entity_id`);
    assert.deepEqual(audit.map((a) => a.entity_id).sort(), ['finans_kopyasi', 'saha_sorumlusu']);
    assert.equal(audit.find((a) => a.entity_id === 'finans_kopyasi').details.copyFrom, 'finance');
  } finally { await db.close(); }
});

test('022: yükseltme yasağı — aktörde olmayan, dar kapsamlı ya da süreli izin role eklenemez', async () => {
  const db = await createDb();
  try {
    await roleManager(db);
    const ops = await staffId(db, IDS.operations);

    // 1) Hiç taşımadığı izin
    const missing = await lacking(db, IDS.operations);
    const blocked = await sqlDetail(createRole(db, IDS.operations, 'yeni_rol', ['sites.read', missing]));
    assert.equal(blocked.message, 'escalation_blocked');
    assert.equal(blocked.detail, missing, 'eksik izin ayrıntıda');
    assert.ok(await createRole(db, IDS.operations, 'izinli_rol', ['sites.read']), 'taşıdığı izinle rol kurabilir');

    // 2) Yalnız saha kapsamında taşıdığı izin
    const narrow = (await one(db, `SELECT k FROM unnest((SELECT permissions FROM admin_roles WHERE key='engineer')) k
                                     WHERE NOT admin_has_permission($1, k) ORDER BY k LIMIT 1`, [IDS.operations])).k;
    await assign(db, IDS.superAdmin, ops, 'engineer', { kind: 'sites', siteIds: [IDS.siteA] });
    assert.equal(await has(db, IDS.operations, narrow), true, 'izin saha kapsamında var');
    assert.equal(await sqlError(createRole(db, IDS.operations, 'dar_rol', [narrow])), 'escalation_blocked');

    // 3) Yarın bitecek atamayla taşıdığı izin: başkalarına kalıcı olarak eklenemez
    const timed = await lacking(db, IDS.operations);
    await createRole(db, IDS.superAdmin, 'gecici_rol', [timed]);
    await assign(db, IDS.superAdmin, ops, 'gecici_rol', { kind: 'all' }, new Date(Date.now() + 86_400_000).toISOString());
    assert.equal(await has(db, IDS.operations, timed), true);
    assert.equal(await sqlError(createRole(db, IDS.operations, 'kalici_rol', [timed])), 'escalation_blocked');

    // Düzenlemede de aynı kural: yalnız EKLENEN izinler denetlenir
    const target = await createRole(db, IDS.superAdmin, 'hedef_rol', ['sites.read', missing]);
    const removeOnly = await updateRole(db, IDS.operations, 'hedef_rol', { permissions: ['sites.read'], version: target.version });
    assert.deepEqual(removeOnly.permissions, ['sites.read'], 'taşımadığı izni KALDIRMAK yükseltme değildir');
    assert.equal(await sqlError(updateRole(db, IDS.operations, 'hedef_rol', { permissions: ['sites.read', missing], version: removeOnly.version })), 'escalation_blocked');
  } finally { await db.close(); }
});

test('022: kendi taşıdığı rolü düzenleyemez — ileri tarihli atama dahil', async () => {
  const db = await createDb();
  try {
    await roleManager(db);
    const own = await one(db, `SELECT updated_at FROM admin_roles WHERE key='rol_yoneticisi'`);
    assert.equal(await sqlError(updateRole(db, IDS.operations, 'rol_yoneticisi', { permissions: ['roles.manage'], version: own.updated_at })), 'self_assignment');

    const future = await createRole(db, IDS.superAdmin, 'ileri_rol', ['sites.read']);
    const a = await assign(db, IDS.superAdmin, await staffId(db, IDS.operations), 'ileri_rol');
    await db.query(`UPDATE admin_role_assignments SET starts_at = now() + interval '2 days' WHERE id = $1`, [a.id]);
    assert.equal(await sqlError(updateRole(db, IDS.operations, 'ileri_rol', { permissions: ['sites.read', 'roles.manage'], version: future.version })), 'self_assignment',
      'bugün düzenleyip yarın kendisine genişletemez');
    assert.equal((await preview(db, IDS.operations, 'ileri_rol', ['sites.read'])).blocked.code, 'self_assignment');
  } finally { await db.close(); }
});

test('022: sistem rolleri salt okunur — fonksiyon, önizleme ve doğrudan SQL', async () => {
  const db = await createDb();
  try {
    const owner = await one(db, `SELECT updated_at FROM admin_roles WHERE key='finance'`);
    assert.equal(await sqlError(updateRole(db, IDS.superAdmin, 'finance', { permissions: ['finance.read'], version: owner.updated_at })), 'system_role_readonly');
    assert.equal((await preview(db, IDS.superAdmin, 'finance', ['finance.read'])).blocked.code, 'system_role_readonly');
    assert.equal(await sqlError(db.query(`UPDATE admin_roles SET label='x' WHERE key='owner'`)), 'system_role_readonly');
    assert.equal(await sqlError(db.query(`DELETE FROM admin_roles WHERE key='finance'`)), 'system_role_readonly');
    const custom = await createRole(db, IDS.superAdmin, 'silinmez_degil', ['sites.read']);
    assert.ok(custom, 'özel rol oluşturulabilir; silme ucu yok ama tetikleyici yalnız sistem rolünü korur');
  } finally { await db.close(); }
});

test('022: önizleme yazmaz; sayılar doğru; sürüm, parmak izi ve gerekçe kaydetmeyi korur', async () => {
  const db = await createDb();
  try {
    const role = await createRole(db, IDS.superAdmin, 'saha_sorumlusu', ['sites.read', 'batches.read']);
    await assign(db, IDS.superAdmin, await staffId(db, IDS.finance), 'saha_sorumlusu', { kind: 'sites', siteIds: [IDS.siteA] });
    await assign(db, IDS.superAdmin, await staffId(db, IDS.operations), 'saha_sorumlusu');
    await invite(db, IDS.superAdmin, 'yeni.kisi@example.invalid', 'saha_sorumlusu');

    const snapshot = async () => ({
      audit: (await one(db, `SELECT count(*)::int c FROM admin_audit_logs`)).c,
      role: (await one(db, `SELECT updated_at, permissions FROM admin_roles WHERE key='saha_sorumlusu'`)),
    });
    const before = await snapshot();
    const p = await preview(db, IDS.superAdmin, 'saha_sorumlusu', ['sites.read']);
    assert.deepEqual(await snapshot(), before, 'önizleme hiçbir satır yazmaz, sürüm tüketmez');

    assert.deepEqual(p.removed, ['batches.read']);
    assert.deepEqual(p.added, []);
    assert.equal(p.unchanged, 1);
    assert.deepEqual({ a: p.usage.activeAssignments, s: p.usage.staffCount, i: p.usage.pendingInvitations }, { a: 2, s: 2, i: 1 });
    assert.equal(p.affectedStaff.length, 2);
    assert.equal(p.affectedInvitations[0].email, 'y***@example.invalid', 'davet e-postası maskeli');
    assert.equal(p.blocked, null);
    assert.equal(p.role.version, role.version);

    // Yanlış sürüm
    assert.equal(await sqlError(updateRole(db, IDS.superAdmin, 'saha_sorumlusu', { permissions: ['sites.read'], version: '2020-01-01T00:00:00Z', fingerprint: p.usage.fingerprint })), 'version_changed');
    // NULL sürüm ya da parmak izi atlatma değildir: uyuşmazlık sayılır
    assert.equal(await sqlError(updateRole(db, IDS.superAdmin, 'saha_sorumlusu', { permissions: ['sites.read'], version: null, fingerprint: p.usage.fingerprint })), 'version_changed');
    assert.equal(await sqlError(updateRole(db, IDS.superAdmin, 'saha_sorumlusu', { permissions: ['sites.read'], version: role.version, fingerprint: null })), 'usage_changed');
    // Önizlemeden sonra etkilenen küme değişti
    await invite(db, IDS.superAdmin, 'ikinci@example.invalid', 'saha_sorumlusu', { kind: 'all' }, 'b'.repeat(64));
    assert.equal(await sqlError(updateRole(db, IDS.superAdmin, 'saha_sorumlusu', { permissions: ['sites.read'], version: role.version, fingerprint: p.usage.fingerprint })), 'usage_changed');
    // Gerekçe
    const fresh = await preview(db, IDS.superAdmin, 'saha_sorumlusu', ['sites.read']);
    assert.equal(fresh.usage.pendingInvitations, 2);
    assert.equal(await sqlError(updateRole(db, IDS.superAdmin, 'saha_sorumlusu', { permissions: ['sites.read'], version: role.version, fingerprint: fresh.usage.fingerprint, reason: 'kısa' })), 'note_required');

    assert.equal(await has(db, IDS.operations, 'batches.read'), true);
    const saved = await updateRole(db, IDS.superAdmin, 'saha_sorumlusu', { permissions: ['sites.read'], version: role.version, fingerprint: fresh.usage.fingerprint, reason: 'Parti okuma yetkisi kaldırıldı.' });
    assert.deepEqual(saved.permissions, ['sites.read']);
    assert.notEqual(saved.version, role.version, 'kayıt sürümü ilerler');
    assert.equal(saved.updatedBy.adminId, IDS.superAdmin);

    const opsRoles = (await one(db, `SELECT permissions FROM admin_roles WHERE key='operations'`)).permissions;
    if (!opsRoles.includes('batches.read')) {
      assert.equal(await has(db, IDS.operations, 'batches.read'), false, 'rolü taşıyanlarda değişiklik anında geçerli');
    }

    const audit = await one(db, `SELECT details FROM admin_audit_logs WHERE entity='admin_role' AND action='UPDATE' AND entity_id='saha_sorumlusu'`);
    assert.deepEqual(audit.details.removed, ['batches.read']);
    assert.deepEqual(audit.details.before.permissions, ['batches.read', 'sites.read']);
    assert.equal(audit.details.reason, 'Parti okuma yetkisi kaldırıldı.');

    // Eski sürümle ikinci kaydetme reddedilir (bayat onay uygulanamaz)
    assert.equal(await sqlError(updateRole(db, IDS.superAdmin, 'saha_sorumlusu', { permissions: ['sites.read', 'batches.read'], version: role.version, fingerprint: fresh.usage.fingerprint })), 'version_changed');
  } finally { await db.close(); }
});

test('022: önizleme engel kodları kaydetmeyle aynı; yetkisiz kişi önizleme göremez', async () => {
  const db = await createDb();
  try {
    await roleManager(db);
    const target = await createRole(db, IDS.superAdmin, 'hedef_rol', ['sites.read']);
    const missing = await lacking(db, IDS.operations);

    const cases = [
      { permissions: ['sites.read', missing], code: 'escalation_blocked' },
      { permissions: ['sites.read', 'uydurma.izin'], code: 'invalid_permissions' },
    ];
    for (const c of cases) {
      const p = await preview(db, IDS.operations, 'hedef_rol', c.permissions);
      assert.equal(p.blocked?.code, c.code);
      assert.equal(await sqlError(updateRole(db, IDS.operations, 'hedef_rol', { permissions: c.permissions, version: target.version })), c.code,
        `önizleme ve kaydetme aynı kodu vermeli: ${c.code}`);
    }
    const esc = await preview(db, IDS.operations, 'hedef_rol', ['sites.read', missing]);
    assert.deepEqual(esc.blocked.details, { missing: [missing] }, 'ayrıntı API hatasıyla aynı biçimde');
    const unk = await preview(db, IDS.operations, 'hedef_rol', ['sites.read', 'uydurma.izin']);
    assert.deepEqual(unk.blocked.details, { unknown: ['uydurma.izin'] });

    assert.equal(await sqlError(preview(db, IDS.finance, 'hedef_rol', ['sites.read'])), 'forbidden', 'rol yöneticisi olmayan etkilenen listeyi göremez');
    assert.equal(await sqlError(preview(db, IDS.superAdmin, 'yok_boyle', ['sites.read'])), 'role_missing');
  } finally { await db.close(); }
});

test('022: var olmayan saha kimliğiyle atama, atama güncelleme ve davet reddedilir', async () => {
  const db = await createDb();
  try {
    const ops = await staffId(db, IDS.operations);
    const bad = await sqlDetail(assign(db, IDS.superAdmin, ops, 'engineer', { kind: 'sites', siteIds: [IDS.siteA, MISSING_SITE] }));
    assert.equal(bad.message, 'invalid_scope');
    assert.equal(bad.detail, MISSING_SITE, 'yalnız bulunamayan kimlik ayrıntıda');

    const good = await assign(db, IDS.superAdmin, ops, 'engineer', { kind: 'sites', siteIds: [IDS.siteA, IDS.siteB] });
    assert.ok(good.id);
    const current = await one(db, `SELECT updated_at FROM admin_role_assignments WHERE id=$1`, [good.id]);
    assert.equal(await sqlError(one(db, `SELECT update_admin_assignment($1,$2,$3::jsonb,NULL,$4,'deneme',$5) u`,
      [IDS.superAdmin, good.id, JSON.stringify({ kind: 'sites', siteIds: [MISSING_SITE] }), current.updated_at, ops])), 'invalid_scope');

    assert.equal(await sqlError(invite(db, IDS.superAdmin, 'saha@example.invalid', 'engineer', { kind: 'sites', siteIds: [MISSING_SITE] })), 'invalid_scope');
    assert.ok(await invite(db, IDS.superAdmin, 'saha@example.invalid', 'engineer', { kind: 'sites', siteIds: [IDS.siteB] }));
    assert.equal(await sqlError(db.query(`UPDATE admin_invitations SET scope = $1::jsonb`, [JSON.stringify({ kind: 'sites', siteIds: [MISSING_SITE] })])), 'invalid_scope',
      'doğrudan SQL de aynı kurala takılır');
  } finally { await db.close(); }
});

test('022: parmak izi kapsam, bitiş, atama sürümü, ileri tarihli atama, pasiflik ve davet süresini yakalar', async () => {
  const db = await createDb();
  try {
    await createRole(db, IDS.superAdmin, 'izlenen_rol', ['sites.read']);
    const fin = await staffId(db, IDS.finance);
    const a = await assign(db, IDS.superAdmin, fin, 'izlenen_rol');
    const fp = async () => (await usage(db, 'izlenen_rol')).fingerprint;
    const seen = new Set([await fp()]);
    const expectChange = async (label) => {
      const next = await fp();
      assert.ok(!seen.has(next), `parmak izi değişmeliydi: ${label}`);
      seen.add(next);
    };

    const v1 = await one(db, `SELECT updated_at FROM admin_role_assignments WHERE id=$1`, [a.id]);
    await one(db, `SELECT update_admin_assignment($1,$2,$3::jsonb,NULL,$4,'kapsam daraltma',$5) u`,
      [IDS.superAdmin, a.id, JSON.stringify({ kind: 'sites', siteIds: [IDS.siteA] }), v1.updated_at, fin]);
    await expectChange('kapsam all → sites');

    const v2 = await one(db, `SELECT updated_at FROM admin_role_assignments WHERE id=$1`, [a.id]);
    await one(db, `SELECT update_admin_assignment($1,$2,$3::jsonb,$4,$5,'süre verme',$6) u`,
      [IDS.superAdmin, a.id, JSON.stringify({ kind: 'sites', siteIds: [IDS.siteA] }), new Date(Date.now() + 7 * 86_400_000).toISOString(), v2.updated_at, fin]);
    await expectChange('bitiş tarihi');

    const future = await assign(db, IDS.superAdmin, await staffId(db, IDS.operations), 'izlenen_rol');
    await db.query(`UPDATE admin_role_assignments SET starts_at = now() + interval '3 days' WHERE id=$1`, [future.id]);
    const u = await usage(db, 'izlenen_rol');
    assert.equal(u.scheduledAssignments, 1, 'ileri tarihli atama ayrı sayılır');
    assert.equal(u.activeAssignments, 1);
    assert.equal(u.staffCount, 2);
    await expectChange('ileri tarihli atama');

    await db.query(`UPDATE admin_role_assignments SET starts_at = now() + interval '4 days' WHERE id=$1`, [future.id]);
    await expectChange('ileri tarihli atamanın başlangıcı');

    await db.query(`UPDATE admin_users SET is_active = false WHERE id=$1`, [fin]);
    await expectChange('personel pasifleşti');

    const inv = await invite(db, IDS.superAdmin, 'bekleyen@example.invalid', 'izlenen_rol');
    await expectChange('bekleyen davet');
    await db.query(`UPDATE admin_invitations SET expires_at = now() + interval '9 days' WHERE id=$1`, [inv.id]);
    await expectChange('davet süresi uzatıldı (yeniden gönderim)');

    const before = await fp();
    await preview(db, IDS.superAdmin, 'izlenen_rol', ['sites.read', 'batches.read']);
    assert.equal(await fp(), before, 'önizleme parmak izini değiştirmez');
  } finally { await db.close(); }
});

test('022: kapsamla sınırlanamayan izin, dar kapsamlı canlı atama/davet varken role eklenemez', async () => {
  const db = await createDb();
  try {
    const role = await createRole(db, IDS.superAdmin, 'saha_ekibi', ['sites.read']);
    const ops = await staffId(db, IDS.operations);
    const narrow = await assign(db, IDS.superAdmin, ops, 'saha_ekibi', { kind: 'sites', siteIds: [IDS.siteA] });

    const p = await preview(db, IDS.superAdmin, 'saha_ekibi', ['sites.read', 'staff.invite']);
    assert.equal(p.blocked.code, 'global_scope_conflict');
    assert.deepEqual(p.blocked.details, { permissions: ['staff.invite'], assignments: 1, invitations: 0 });
    const saved = await sqlDetail(updateRole(db, IDS.superAdmin, 'saha_ekibi', { permissions: ['sites.read', 'staff.invite'], version: role.version }));
    assert.equal(saved.message, 'global_scope_conflict', 'önizleme ve kaydetme aynı kod');
    assert.deepEqual(JSON.parse(saved.detail), { permissions: ['staff.invite'], assignments: 1, invitations: 0 });

    // İleri tarihli dar atama da sayılır
    await db.query(`UPDATE admin_role_assignments SET starts_at = now() + interval '2 days' WHERE id=$1`, [narrow.id]);
    assert.equal(await sqlError(updateRole(db, IDS.superAdmin, 'saha_ekibi', { permissions: ['sites.read', 'staff.invite'], version: role.version })), 'global_scope_conflict');

    // Atama "tüm kayıtlar"a alınınca dar davet hâlâ engeller; süresi geçmiş ama bekleyen davet de sayılır
    const cur = await one(db, `SELECT updated_at FROM admin_role_assignments WHERE id=$1`, [narrow.id]);
    await one(db, `SELECT update_admin_assignment($1,$2,'{"kind":"all"}'::jsonb,NULL,$3,'genişletme',$4) u`, [IDS.superAdmin, narrow.id, cur.updated_at, ops]);
    const inv = await invite(db, IDS.superAdmin, 'dar@example.invalid', 'saha_ekibi', { kind: 'sites', siteIds: [IDS.siteB] });
    await db.query(`UPDATE admin_invitations SET expires_at = now() - interval '1 hour' WHERE id=$1`, [inv.id]);
    const withInvite = await sqlDetail(updateRole(db, IDS.superAdmin, 'saha_ekibi', { permissions: ['sites.read', 'staff.invite'], version: role.version }));
    assert.equal(withInvite.message, 'global_scope_conflict');
    assert.equal(JSON.parse(withInvite.detail).invitations, 1, 'yeniden gönderilebilecek davet de dar kayıttır');

    await db.query(`UPDATE admin_invitations SET status='revoked', revoked_at=now() WHERE id=$1`, [inv.id]);
    const ok = await updateRole(db, IDS.superAdmin, 'saha_ekibi', { permissions: ['sites.read', 'staff.invite'], version: role.version });
    assert.ok(ok.permissions.includes('staff.invite'), 'dar kayıt kalmayınca eklenebilir');
    assert.deepEqual(ok.globalOnlyPermissions ?? null, null, 'SQL ayrıntısı hesaplanmış listeyi taşımaz; TS katmanı ekler');

    // Yedek tetikleyici: bundan sonra dar kapsamla atama ya da davet, doğrudan SQL ile bile olmaz
    assert.equal(await sqlError(assign(db, IDS.superAdmin, await staffId(db, IDS.finance), 'saha_ekibi', { kind: 'sites', siteIds: [IDS.siteA] })), 'escalation_blocked');
    const roleId = (await one(db, `SELECT id FROM admin_roles WHERE key='saha_ekibi'`)).id;
    assert.equal(await sqlError(db.query(`INSERT INTO admin_role_assignments(admin_user_id, role_id, scope) VALUES ($1,$2,$3::jsonb)`,
      [await staffId(db, IDS.finance), roleId, JSON.stringify({ kind: 'assigned' })])), 'escalation_blocked');
  } finally { await db.close(); }
});

test('022: silinen sahaya bağlı atama ve davet her zaman kaldırılabilir', async () => {
  const db = await createDb();
  try {
    const ops = await staffId(db, IDS.operations);
    const a = await assign(db, IDS.superAdmin, ops, 'engineer', { kind: 'sites', siteIds: [IDS.siteB] });
    const inv = await invite(db, IDS.superAdmin, 'eski.saha@example.invalid', 'engineer', { kind: 'sites', siteIds: [IDS.siteB] });
    await db.query(`DELETE FROM lands WHERE id=$1`, [IDS.siteB]);
    const revoked = await one(db, `SELECT revoke_admin_assignment($1,$2,'saha kaldırıldı',$3) r`, [IDS.superAdmin, a.id, ops]);
    assert.ok(revoked.r.revoked_at, 'iptal, silinmiş saha yüzünden engellenmez');
    await db.query(`UPDATE admin_invitations SET status='revoked', revoked_at=now() WHERE id=$1`, [inv.id]);
    assert.equal((await one(db, `SELECT status FROM admin_invitations WHERE id=$1`, [inv.id])).status, 'revoked');
  } finally { await db.close(); }
});

test('022: 021 yazıcıları yalnız rol kilidi farkıyla yeniden tanımlandı (gövde kayması yok)', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (f) => readFile(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8');
  const [m21, m22] = await Promise.all([read('021_permission_core.sql'), read('022_custom_roles.sql')]);
  const body = (src, name, prefix) => {
    const start = src.indexOf(`${prefix} public.${name}(`);
    assert.ok(start >= 0, `${name} bulunamadı`);
    return src.slice(start, src.indexOf('END $$;', start) + 7);
  };
  for (const name of ['assign_admin_role', 'update_admin_assignment', 'create_admin_invitation']) {
    const normalized = body(m22, name, 'CREATE OR REPLACE FUNCTION')
      .replace('CREATE OR REPLACE FUNCTION', 'CREATE FUNCTION')
      .replace(' WHERE key = p_role_key FOR SHARE;', ' WHERE key = p_role_key;')
      .replace('  PERFORM 1 FROM public.admin_roles WHERE id = v_row.role_id FOR SHARE;\n', '');
    assert.equal(normalized, body(m21, name, 'CREATE FUNCTION'), `${name}: 021 gövdesinden sapma`);
    assert.match(body(m22, name, 'CREATE OR REPLACE FUNCTION'), /admin_roles WHERE [^;]* FOR SHARE;/, `${name}: rol kilidi yok`);
  }
});
