// 21 uçları: gerçek izin kapısı + gerçek servis + gerçek SQL (PGlite). Canlı DB, e-posta, MFA yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb, one, IDS } from './pglite-db.mjs';
import { AAL1, AAL2_FRESH, envelope, loadAdminRoute, params, realGate, request, withMfaEnforced } from './admin-gate.mjs';
import { loadSource as load } from './load-source.mjs';
import { z } from 'zod';

const staffId = (db, user) => one(db, `SELECT id FROM admin_users WHERE user_id=$1`, [user]).then((r) => r.id);
const assign = (db, admin, role, scope = { kind: 'all' }) =>
  one(db, `SELECT assign_admin_role($1,$2,$3,$4::jsonb,NULL,'test') a`, [IDS.superAdmin, admin, role, JSON.stringify(scope)]);
const auditCount = (db) => one(db, `SELECT count(*)::int c FROM admin_audit_logs`).then((r) => r.c);
const ROLES = 'app/api/admin/roles/route.ts';
const ROLE = 'app/api/admin/roles/[key]/route.ts';
const PREVIEW = 'app/api/admin/roles/[key]/impact-preview/route.ts';
const SITES = 'app/api/admin/sites/options/route.ts';

/** Finans kullanıcısına yalnız davet yetkisi (özel rol, tüm kayıtlar) verir; rol yönetimi yoktur. */
async function inviterOnly(db) {
  await one(db, `SELECT create_admin_role($1,'davetci','Davetçi','',ARRAY['staff.invite'],NULL) r`, [IDS.superAdmin]);
  await assign(db, await staffId(db, IDS.finance), 'davetci');
  const has = async (k) => (await one(db, `SELECT admin_has_permission($1,$2) h`, [IDS.finance, k])).h;
  assert.equal(await has('roles.manage'), false, 'ön koşul: finans rol yöneticisi değil');
  assert.equal(await has('staff.manage'), false, 'ön koşul: finans personel yöneticisi değil');
  return IDS.finance;
}
/** Hiçbir personel/rol izni olmayan kişi. */
async function outsider(db) {
  const has = async (k) => (await one(db, `SELECT admin_has_permission($1,$2) h`, [IDS.operations, k])).h;
  for (const k of ['roles.manage', 'staff.invite', 'staff.manage']) assert.equal(await has(k), false, `ön koşul: operasyonda ${k} yok`);
  return IDS.operations;
}

test('21: davet listesi staff.manage YA DA staff.invite ile okunur; MFA kuralı korunur', async () => {
  const db = await createDb();
  try {
    const inviter = await inviterOnly(db);
    const listed = [];
    const extra = {
      '@/lib/admin/staff-http': {
        failFrom: (e) => envelope.fail(e.status, e.code, e.message, e.details),
        isServiceError: (v) => v?.ok === false,
        readJson: async () => ({}),
        scopeSchema: z.object({ kind: z.literal('all') }).strict(),
        staffService: () => ({ invitations: async (q) => { listed.push(q); return []; } }),
      },
      '@/lib/admin/staff': { DEFAULT_INVITATION_DAYS: 7 },
      '@/lib/mail': {},
      'next/server': { after: () => {} },
    };
    const api = (userId, assurance = AAL1) => loadAdminRoute('app/api/admin/invitations/route.ts', { db, userId, assurance, extra });

    const res = await (await api(inviter)).GET(request());
    assert.equal(res.status, 200, 'yalnız staff.invite olan kişi davet listesini okur');
    assert.deepEqual(res.body.data, { items: [], nextCursor: null });
    assert.equal((await (await api(IDS.superAdmin)).GET(request())).status, 200, 'staff.manage de okur');

    const denied = await (await api(await outsider(db))).GET(request());
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error.code, 'forbidden');

    await withMfaEnforced(async () => {
      const mfa = await (await api(inviter)).GET(request());
      assert.equal(mfa.status, 403);
      assert.equal(mfa.body.error.code, 'mfa_required', 'davet listesi önceki gibi yeniden doğrulama ister');
      assert.equal((await (await api(inviter, AAL2_FRESH())).GET(request())).status, 200);
    });
    assert.equal(listed.length, 3);
  } finally { await db.close(); }
});

test('21: rol sözlüğü ve saha seçenekleri OKUMADIR: davet eden okur, MFA istemez; yetkisiz 403', async () => {
  const db = await createDb();
  try {
    const inviter = await inviterOnly(db);
    await withMfaEnforced(async () => {
      const dict = await (await loadAdminRoute(ROLES, { db, userId: inviter })).GET(request());
      assert.equal(dict.status, 200);
      assert.ok(dict.body.data.roles.some((r) => r.key === 'davetci'), 'sözlük DTO\'su değişmedi: { roles: RoleDto[] }');
      assert.deepEqual(Object.keys(dict.body.data.roles[0]).sort(), ['description', 'isSystem', 'key', 'label', 'permissions']);
      const sites = await (await loadAdminRoute(SITES, { db, userId: inviter })).GET(request());
      assert.equal(sites.status, 200);
    });
    const who = await outsider(db);
    for (const file of [ROLES, SITES]) {
      const res = await (await loadAdminRoute(file, { db, userId: who })).GET(request());
      assert.equal(res.status, 403, file);
      assert.equal(res.body.error.code, 'forbidden');
    }
  } finally { await db.close(); }
});

test('21: POST /roles — data doğrudan RoleDetailDto; ad 2–80; yükseltme ve MFA engeli', async () => {
  const db = await createDb();
  try {
    const api = async (userId, assurance) => (await loadAdminRoute(ROLES, { db, userId, assurance })).POST(request({
      body: { key: 'saha_sorumlusu', label: 'Saha sorumlusu', description: 'Sahalar', permissions: ['sites.read', 'roles.manage'] },
    }));
    const created = await api(IDS.superAdmin);
    assert.equal(created.status, 201);
    const dto = created.body.data;
    assert.equal(dto.key, 'saha_sorumlusu', 'zarfın data alanı doğrudan DTO (role sarmalayıcısı yok)');
    assert.equal(dto.role, undefined);
    assert.deepEqual(dto.permissions, ['roles.manage', 'sites.read']);
    assert.deepEqual(dto.sensitivePermissions, ['roles.manage']);
    assert.deepEqual(dto.globalOnlyPermissions, ['roles.manage']);
    assert.equal(dto.isSystem, false);
    assert.match(dto.version, /^\d{4}-\d{2}-\d{2}T.*Z$/);
    assert.deepEqual(Object.keys(dto.usage).sort(), ['activeAssignments', 'fingerprint', 'pendingInvitations', 'scheduledAssignments', 'staffCount']);

    const post = async (body, userId = IDS.superAdmin) => (await loadAdminRoute(ROLES, { db, userId })).POST(request({ body }));
    for (const label of ['A', 'x'.repeat(81), '   ']) {
      const bad = await post({ key: 'kisa_ad', label, permissions: ['sites.read'] });
      assert.equal(bad.status, 400, `ad reddedilmeli: ${JSON.stringify(label)}`);
      assert.deepEqual(bad.body.error.details.fields, ['label']);
    }
    assert.equal((await post({ key: 'iki_harf', label: 'Ab', permissions: ['sites.read'] })).status, 201, '2 karakter kabul');
    assert.equal((await post({ key: 'seksen', label: 'y'.repeat(80), permissions: ['sites.read'] })).status, 201, '80 karakter kabul');

    const dup = await post({ key: 'saha_sorumlusu', label: 'Tekrar', permissions: ['sites.read'] });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'role_exists');
    const unknown = await post({ key: 'uydurma', label: 'Uydurma', permissions: ['uydurma.izin'] });
    assert.equal(unknown.status, 422);
    assert.deepEqual(unknown.body.error.details, { unknown: ['uydurma.izin'] });

    // Rol yöneticisi olan ama finans izni olmayan kişi finans izni veremez
    await one(db, `SELECT create_admin_role($1,'rol_yon','Rol yöneticisi','',ARRAY['roles.manage','sites.read'],NULL) r`, [IDS.superAdmin]);
    await assign(db, await staffId(db, IDS.operations), 'rol_yon');
    const esc = await post({ key: 'finans_klonu', label: 'Finans klonu', copyFrom: 'finance' }, IDS.operations);
    assert.equal(esc.status, 403);
    assert.equal(esc.body.error.code, 'escalation_blocked');
    assert.ok(esc.body.error.details.missing.length > 0);

    await withMfaEnforced(async () => {
      const before = await auditCount(db);
      const mfa = await api(IDS.superAdmin, AAL1);
      assert.equal(mfa.status, 403);
      assert.equal(mfa.body.error.code, 'mfa_required');
      assert.equal(await auditCount(db), before, 'MFA reddinde hiçbir şey yazılmaz');
    });
  } finally { await db.close(); }
});

test('21: GET/PATCH /roles/{key} ve etki önizlemesi — zarf, sürüm, zorunlu parmak izi, çakışma', async () => {
  const db = await createDb();
  try {
    await one(db, `SELECT create_admin_role($1,'saha_ekibi','Saha ekibi','',ARRAY['sites.read','batches.read'],NULL) r`, [IDS.superAdmin]);
    await assign(db, await staffId(db, IDS.operations), 'saha_ekibi', { kind: 'sites', siteIds: [IDS.siteA] });
    await one(db, `SELECT create_admin_invitation($1,'yeni.kisi@example.invalid','saha_ekibi','{"kind":"all"}'::jsonb,NULL,$2,now() + interval '7 days') i`, [IDS.superAdmin, 'c'.repeat(64)]);
    const role = (name, userId = IDS.superAdmin, assurance) => loadAdminRoute(name, { db, userId, assurance });

    const detail = await (await role(ROLE)).GET(request(), params('saha_ekibi'));
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.key, 'saha_ekibi');
    assert.equal(detail.body.data.usage.activeAssignments, 1);
    assert.equal((await (await role(ROLE)).GET(request(), params('yok_boyle'))).body.error.code, 'role_missing');

    // Önizleme: yazmaz, MFA istemez, data doğrudan RoleImpactPreview
    const before = await auditCount(db);
    const pv = await withMfaEnforced(async () => (await role(PREVIEW, IDS.superAdmin, AAL1)).POST(request({ body: { permissions: ['sites.read'] } }), params('saha_ekibi')));
    assert.equal(pv.status, 200);
    const preview = pv.body.data;
    assert.deepEqual(preview.removed, ['batches.read']);
    assert.equal(preview.blocked, null);
    assert.equal(preview.affectedInvitations[0].email, 'y***@example.invalid');
    assert.deepEqual(Object.keys(preview.affectedStaff[0]).sort(), ['activeAssignments', 'fullName', 'id', 'scheduledAssignments'], 'iletişim bilgisi yok');
    assert.equal(await auditCount(db), before, 'önizleme denetim kaydı üretmez');

    const patch = (body) => role(ROLE).then((api) => api.PATCH(request({ body }), params('saha_ekibi')));
    const base = { permissions: ['sites.read'], expectedVersion: preview.role.version, reason: 'Parti okuma yetkisi kaldırıldı.' };

    const noUsage = await patch(base);
    assert.equal(noUsage.status, 400, 'parmak izi zorunlu');
    assert.deepEqual(noUsage.body.error.details.fields, ['expectedUsage']);
    const shortLabel = await patch({ ...base, expectedUsage: preview.usage, label: 'A' });
    assert.deepEqual(shortLabel.body.error.details.fields, ['label']);
    const stale = await patch({ ...base, expectedUsage: { ...preview.usage, fingerprint: '0'.repeat(32) } });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'usage_changed');
    const oldVersion = await patch({ ...base, expectedVersion: '2020-01-01T00:00:00.000Z', expectedUsage: preview.usage });
    assert.equal(oldVersion.body.error.code, 'version_changed');

    const saved = await patch({ ...base, expectedUsage: preview.usage });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.data.permissions, ['sites.read'], 'data doğrudan RoleDetailDto');
    assert.notEqual(saved.body.data.version, preview.role.version);
    const replay = await patch({ ...base, expectedUsage: preview.usage });
    assert.equal(replay.body.error.code, 'version_changed', 'aynı onay ikinci kez uygulanamaz');

    // Kapsamla sınırlanamayan izin + dar kapsamlı atama: önizleme ve kaydetme aynı engel
    const conflictPreview = (await (await role(PREVIEW)).POST(request({ body: { permissions: ['sites.read', 'staff.invite'] } }), params('saha_ekibi'))).body.data;
    assert.equal(conflictPreview.blocked.code, 'global_scope_conflict');
    assert.deepEqual(conflictPreview.blocked.details, { permissions: ['staff.invite'], assignments: 1, invitations: 0 });
    const conflict = await patch({ permissions: ['sites.read', 'staff.invite'], expectedVersion: conflictPreview.role.version,
      expectedUsage: conflictPreview.usage, reason: 'Davet yetkisi eklenmek isteniyor.' });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error.code, 'global_scope_conflict');
    assert.deepEqual(conflict.body.error.details, { permissions: ['staff.invite'], assignments: 1, invitations: 0 });

    const system = await role(ROLE).then((api) => api.PATCH(request({ body: { ...base, expectedUsage: preview.usage } }), params('owner')));
    assert.equal(system.status, 409);
    assert.equal(system.body.error.code, 'system_role_readonly');

    // Rol yöneticisi olmayan: ayrıntı ve önizleme 403 (kişi listesi görünmez)
    const inviter = await inviterOnly(db);
    assert.equal((await (await role(ROLE, inviter)).GET(request(), params('saha_ekibi'))).status, 403);
    assert.equal((await (await role(PREVIEW, inviter)).POST(request({ body: {} }), params('saha_ekibi'))).status, 403);
  } finally { await db.close(); }
});

test('21: saha seçenekleri — minimal alanlar, ids süzgeci, arama + imleç, hata ayrımı', async () => {
  const db = await createDb();
  try {
    const get = async (query) => (await (await loadAdminRoute(SITES, { db, userId: IDS.superAdmin })).GET(request({ query }))).body;

    const all = await get({});
    assert.deepEqual(all.data.items.map((s) => s.name), ['Ana Saha', 'Antalya Sahası', 'Muğla Sahası, Batı']);
    assert.deepEqual(Object.keys(all.data.items[0]).sort(), ['id', 'isPublic', 'name', 'slug', 'status'], 'kapasite/doluluk alanı yok');
    assert.equal(all.data.nextCursor, null);

    const byIds = await get({ ids: `${IDS.siteB},20000000-0000-0000-0000-0000000000ff,gecersiz`, q: 'antalya', limit: '1' });
    assert.deepEqual(byIds.data.items.map((s) => s.id), [IDS.siteB], 'ids verilince q/limit yok sayılır; bulunamayan yanıtta yok');
    assert.equal(byIds.data.items[0].isPublic, false);

    const search = await get({ q: 'sahası, b' });
    assert.deepEqual(search.data.items.map((s) => s.slug), ['mugla-sahasi'], 'virgüllü arama PostgREST süzgecini bozmaz');
    assert.deepEqual((await get({ q: '%' })).data.items.length, 3, 'joker karakter desen olarak işlenmez');

    const seen = [];
    let cursor = null;
    do {
      const page = await get({ limit: '1', ...(cursor ? { cursor } : {}) });
      seen.push(...page.data.items.map((s) => s.name));
      cursor = page.data.nextCursor;
    } while (cursor && seen.length < 10);
    assert.deepEqual(seen, ['Ana Saha', 'Antalya Sahası', 'Muğla Sahası, Batı'], 'imleç atlamadan ve tekrarsız ilerler');

    const first = await get({ q: 'saha', limit: '1' });
    const second = await get({ q: 'saha', limit: '1', cursor: first.data.nextCursor });
    assert.notEqual(second.data.items[0].id, first.data.items[0].id, 'arama + imleç birlikte çalışır');

    assert.deepEqual((await get({ q: 'olmayan saha' })).data, { items: [], nextCursor: null }, 'boş sonuç 200 + boş dizi');

    const broken = load(SITES, {
      '@/lib/admin/permissions': realGate({ db, userId: IDS.superAdmin }),
      '@/lib/admin/pagination': (await import('./admin-gate.mjs')).pagination,
      '@/lib/admin/roles-http': { rolesService: () => ({ siteOptions: async () => ({ ok: false, status: 503, code: 'unavailable', message: 'Veri alınamadı.' }) }) },
      '@/lib/admin/staff-http': { failFrom: (e) => envelope.fail(e.status, e.code, e.message), isServiceError: (v) => v?.ok === false, UUID_RE: /^[0-9a-f-]{36}$/i },
      '@/lib/api/envelope': envelope,
    });
    const failed = await broken.GET(request());
    assert.equal(failed.status, 503, 'okuma hatası boş liste değil 503');
    assert.equal(failed.body.error.code, 'unavailable');
  } finally { await db.close(); }
});

test('21: "herhangi biri" kapısı — izin dar kapsamdaysa scope_unsupported, hiç yoksa forbidden', async () => {
  const narrow = { adminId: 'a', roles: [], limits: { refundKurus: null, enforced: false },
    permissions: [{ key: 'staff.invite', scopes: [{ kind: 'sites', siteIds: [IDS.siteA] }] }] };
  const gate = realGate({ userId: 'u', access: narrow });
  const res = await gate.requireAnyPermission(request(), ['roles.manage', 'staff.invite'], { mfa: false });
  assert.equal(res.error.status, 403);
  assert.equal(res.error.body.error.code, 'scope_unsupported');
  const none = await realGate({ userId: 'u', access: { ...narrow, permissions: [] } }).requireAnyPermission(request(), ['roles.manage'], { mfa: false });
  assert.equal(none.error.body.error.code, 'forbidden');
  const full = await realGate({ userId: 'u', access: { ...narrow, permissions: [{ key: 'staff.invite', scopes: [{ kind: 'all' }] }] } })
    .requireAnyPermission(request(), ['roles.manage', 'staff.invite'], { mfa: false });
  assert.equal(full.error, null);
  assert.equal(full.matched, 'staff.invite');
});

test('20 madde 7: personel listesi/ayrıntısı roles.manage ile okunur; aktiflik ve MFA sıfırlama yalnız staff.manage', async () => {
  const db = await createDb();
  try {
    await one(db, `SELECT create_admin_role($1,'atama_yon','Atama yöneticisi','',ARRAY['roles.manage','sites.read'],NULL) r`, [IDS.superAdmin]);
    await assign(db, await staffId(db, IDS.operations), 'atama_yon');
    assert.equal((await one(db, `SELECT admin_has_permission($1,'staff.manage') h`, [IDS.operations])).h, false, 'ön koşul');

    const target = await staffId(db, IDS.finance);
    const calls = [];
    const detail = { id: target, userId: IDS.finance, fullName: 'Finans', email: 'finans@example.invalid', isActive: true,
      legacyRole: 'FINANCE', createdAt: '2026-09-01T00:00:00.000Z', assignments: [], mfa: { enrolled: false } };
    const staffHttp = {
      UUID_RE: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      failFrom: (e) => envelope.fail(e.status, e.code, e.message, e.details),
      isServiceError: (v) => v?.ok === false,
      readJson: async (r) => JSON.parse((await r.text()) || '{}'),
      reasonSchema: z.string().trim().min(3).max(500).optional(),
      staffService: () => ({
        list: async () => { calls.push('list'); return [detail]; },
        detail: async () => { calls.push('detail'); return detail; },
        setActive: async () => { calls.push('setActive'); return { ok: true }; },
      }),
    };
    const extra = { '@/lib/admin/staff-http': staffHttp };
    const idParams = { params: Promise.resolve({ id: target }) };
    const api = (file, userId) => loadAdminRoute(file, { db, userId, extra });

    const list = await (await api('app/api/admin/staff/route.ts', IDS.operations)).GET(request());
    assert.equal(list.status, 200, 'atama yöneticisi personeli listeler');
    assert.equal(list.body.data.items[0].id, target);
    const one_ = await (await api('app/api/admin/staff/[id]/route.ts', IDS.operations)).GET(request(), idParams);
    assert.equal(one_.status, 200, 'atama yöneticisi personel ayrıntısını okur');

    const deactivate = await (await api('app/api/admin/staff/[id]/route.ts', IDS.operations)).PATCH(request({ body: { isActive: false, reason: 'deneme' } }), idParams);
    assert.equal(deactivate.status, 403, 'aktiflik yazması staff.manage ister');
    assert.equal(deactivate.body.error.code, 'forbidden');
    const reset = await (await loadAdminRoute('app/api/admin/staff/[id]/mfa-reset/route.ts', { db, userId: IDS.operations, extra })).POST(request(), idParams);
    assert.equal(reset.status, 403, 'MFA sıfırlama staff.manage ister');
    assert.deepEqual(calls, ['list', 'detail'], 'reddedilen yazmalar servise hiç ulaşmaz');

    const outsiderList = await (await api('app/api/admin/staff/route.ts', IDS.finance)).GET(request());
    assert.equal(outsiderList.status, 403, 'ne staff.manage ne roles.manage: okuyamaz');
    assert.equal((await (await api('app/api/admin/staff/route.ts', IDS.superAdmin)).GET(request())).status, 200, 'staff.manage okumaya devam eder');
  } finally { await db.close(); }
});

test('21 P1 regresyonu: mikro saniyeli sürüm API → servis → SQL döngüsünde kayıpsız (.123456)', async () => {
  const db = await createDb();
  try {
    await one(db, `SELECT create_admin_role($1,'surum_rolu','Sürüm rolü','',ARRAY['sites.read','batches.read'],NULL) r`, [IDS.superAdmin]);
    // Postgres zamanı mikro saniyelidir; milisaniyeye kırpılan sürüm geri geldiğinde eşleşmez.
    await db.query(`UPDATE admin_roles SET updated_at = '2026-09-23T14:00:00.123456+03:00' WHERE key = 'surum_rolu'`);
    const api = (file) => loadAdminRoute(file, { db, userId: IDS.superAdmin });

    const detail = (await (await api(ROLE)).GET(request(), params('surum_rolu'))).body.data;
    assert.equal(detail.version, '2026-09-23T11:00:00.123456Z', 'ayrıntı sürümü kayıpsız ve UTC');
    const preview = (await (await api(PREVIEW)).POST(request({ body: { permissions: ['sites.read'] } }), params('surum_rolu'))).body.data;
    assert.equal(preview.role.version, '2026-09-23T11:00:00.123456Z', 'önizleme sürümü kayıpsız');

    const truncated = await (await api(ROLE)).PATCH(request({ body: {
      permissions: ['sites.read'], expectedVersion: '2026-09-23T11:00:00.123Z', expectedUsage: preview.usage, reason: 'Milisaniyeye kırpılmış sürüm.' } }), params('surum_rolu'));
    assert.equal(truncated.body.error.code, 'version_changed', 'kırpılmış sürüm gerçekten farklı sayılır (kanıt)');

    const saved = await (await api(ROLE)).PATCH(request({ body: {
      permissions: ['sites.read'], expectedVersion: preview.role.version, expectedUsage: preview.usage, reason: 'Ham sürümle kaydetme.' } }), params('surum_rolu'));
    assert.equal(saved.status, 200, 'API\'nin verdiği sürümle kaydetme başarılı');
    assert.match(saved.body.data.version, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/, 'yeni sürüm de mikro saniyeli');
    const again = (await (await api(PREVIEW)).POST(request({ body: { permissions: ['sites.read', 'batches.read'] } }), params('surum_rolu'))).body.data;
    assert.equal(again.role.version, saved.body.data.version, 'kaydetme yanıtındaki sürüm sonraki önizlemeyle aynı');
  } finally { await db.close(); }
});
