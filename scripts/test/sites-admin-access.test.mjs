// 30: saha yönetimi — gerçek izin kapısı + gerçek route/servis/kurallar + PGlite (015 saha kolonları, 016 kapasite,
// 021–023 roller). Yalnız oturum/MFA durumu ve audit yazımı taklit. Her sorgu ve yazma kaydedilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSource as load } from './load-source.mjs';
import { createDb, IDS } from './pglite-db.mjs';
import { AAL1, aal2, customRole, envelope, gate, orderAt, permissionKeys, request, staffWithRole, USERS, withMfaEnforced } from './order-admin-helpers.mjs';
import { adminClient } from './admin-rest-client.mjs';

const siteSchema = await import('../../lib/sites/admin.ts');
const slugMod = await import('../../lib/sites/slug.ts');
const scopeMod = load('lib/admin/record-scope.ts', { '@/lib/admin/permissions': permissionKeys });
const rules = load('lib/sites/admin-access.ts');
const dto = load('lib/sites/admin-dto.ts', { './admin-access': rules });
const service = load('lib/sites/admin-service.ts', { '@/lib/admin/record-scope': scopeMod, './admin-dto': dto });

async function sitesDb() {
  const db = await createDb();
  // Gerçek lands tablosunun 015 öncesi kolonları ve kimlik varsayılanı; ortak harness'e dokunmadan bu dosyada eklenir.
  await db.exec(`ALTER TABLE lands ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ALTER TABLE lands ADD COLUMN IF NOT EXISTS region text, ADD COLUMN IF NOT EXISTS lat numeric, ADD COLUMN IF NOT EXISTS lng numeric,
      ADD COLUMN IF NOT EXISTS is_corporate boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    UPDATE lands SET status = 'scheduled' WHERE status NOT IN ('open','full','scheduled','seeded','monitoring','closed');`);
  const sql = await readFile(new URL('../../supabase/migrations/015_project_sites.sql', import.meta.url), 'utf8');
  await db.exec(sql.slice(sql.indexOf('-- ── 1. Sütunlar'), sql.indexOf('-- ── 4. Yetkiler')));
  // 040: teslim ayları (tek işlemde uygulanır; SET LOCAL için BEGIN/COMMIT).
  await db.exec(`BEGIN;\n${await readFile(new URL('../../supabase/migrations/040_site_delivery_months.sql', import.meta.url), 'utf8')}\nCOMMIT;`);
  await db.exec(`CREATE TABLE seed_catalog(slug text PRIMARY KEY, name text NOT NULL, latin_name text, sort_order int NOT NULL DEFAULT 0);
    INSERT INTO seed_catalog VALUES ('kizilcam','Kızılçam','Pinus brutia',1), ('karacam','Karaçam','Pinus nigra',2), ('sedir','Sedir','Cedrus libani',3);
    UPDATE lands SET region='Antalya', province='Antalya', district='Manavgat', filled_seeds=1000, reserved_seeds=500, capacity_seeds=50000,
      is_public=true, status='open', species_slugs='{kizilcam}', summary_i18n='{"tr":"Yangından etkilenen saha."}', sort_order=1 WHERE id='${IDS.siteA}';
    UPDATE lands SET region='Muğla', province='Muğla', filled_seeds=0, reserved_seeds=0, capacity_seeds=40000, is_public=false,
      status='scheduled', sort_order=2 WHERE id='${IDS.siteB}';
    UPDATE lands SET sort_order=3 WHERE id='${IDS.land}';`);
  return db;
}

function api(db, who, { role = 'NONE', assurance = AAL1, failTables = [], afterQuery = null } = {}) {
  const log = []; const writes = []; const audits = [];
  const permissions = gate({ db, userId: who, role, assurance });
  const route = load('app/api/admin/lands/route.ts', {
    '@/lib/supabase/server': { createServiceRoleClient: () => adminClient(db, { failTables, log, writes, afterQuery }) },
    '@/lib/admin-auth': { getClientIP: () => '127.0.0.1' },
    '@/lib/admin/permissions': permissions,
    '@/lib/admin/record-scope': scopeMod,
    '@/lib/admin/permission-set': load('lib/admin/permission-set.ts', {
      '@/lib/api/envelope': envelope, '@/lib/admin/permissions': permissions, '@/lib/admin/permission-keys': permissionKeys, './record-scope': scopeMod,
    }),
    '@/lib/admin/audit': { auditLog: async (_db, rec) => { audits.push(rec); return []; } },
    '@/lib/api/envelope': envelope,
    '@/lib/sites/admin': siteSchema,
    '@/lib/sites/admin-access': rules,
    '@/lib/sites/admin-dto': dto,
    '@/lib/sites/admin-service': service,
    '@/lib/sites/slug': slugMod,
  });
  const url = 'https://skytechgreen.com/api/admin/lands';
  return {
    log, writes, audits,
    list: (query = {}) => route.GET(request({ query, url })),
    create: (body) => route.POST(request({ body, url })),
    put: (body) => route.PUT(request({ body, url })),
    remove: (body) => route.DELETE(request({ body, url })),
  };
}

/** Paneldeki formun gönderdiği tam gövde: mevcut kaydın değerleri + istenen değişiklik. */
function formOf(item, patch = {}) {
  return {
    id: item.id, name: item.name, slug: item.slug ?? '', province: item.province ?? '', district: item.district ?? '',
    area_hectares: item.areaHectares, is_fire_affected: item.isFireAffected, fire_year: item.fireYear, work_type: item.workType,
    species_slugs: item.speciesSlugs, name_en: item.nameI18n.en ?? '', name_ru: item.nameI18n.ru ?? '',
    summary_tr: item.summaryI18n.tr ?? '', summary_en: item.summaryI18n.en ?? '', summary_ru: item.summaryI18n.ru ?? '',
    cover_image: item.coverImage ?? '', video_url: item.videoUrl ?? '', sort_order: item.sortOrder, status: item.status,
    is_public: item.isPublic, capacity_seeds: item.capacity.total, ...patch,
  };
}
const siteOf = async (db, id) => (await api(db, IDS.superAdmin, { role: 'SUPER_ADMIN' }).list()).body.data.items.find((s) => s.id === id);
const row = async (db, id) => (await db.query('SELECT name, status, is_public, capacity_seeds, summary_i18n FROM lands WHERE id=$1', [id])).rows[0];
const ENGINEER = USERS.engineer;
const engineer = async (db, scope) => staffWithRole(db, ENGINEER, 'engineer', scope, 'ENGINEER');

test('30: okuma — açık kolon listesi, kayıt bazında yetenekler; salt okuyucu hiçbir eylem görmez; tür seçenekleri izinle', async () => {
  const db = await sitesDb();
  try {
    await staffWithRole(db, USERS.scoped, 'read_only');
    const ro = api(db, USERS.scoped);
    const r = await ro.list({ include: 'species' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const d = r.body.data;
    assert.deepEqual(d.items.map((s) => s.name), ['Antalya Sahası', 'Muğla Sahası, Batı', 'Ana Saha'], 'sıra: sort_order');
    assert.ok(d.items.every((s) => !s.capabilities.edit && !s.capabilities.publish && !s.capabilities.capacity));
    assert.deepEqual(d.capabilities, { create: false, createPublic: false, delete: false });
    assert.deepEqual(d.species.map((s) => s.slug), ['kizilcam', 'karacam', 'sedir']);
    const a = d.items[0];
    assert.deepEqual(a.capacity, { total: 50000, filled: 1000, reserved: 500, available: 48500 });
    assert.deepEqual(a.visibility, { listed: true, acceptsOrders: true });
    assert.deepEqual(d.items[1].visibility, { listed: false, acceptsOrders: false });
    const select = ro.log.find((e) => e.table === 'lands');
    assert.ok(!String(select.cols).includes('*') && !String(select.cols).includes('lat') && !String(select.cols).includes('gallery'), 'açık kolon listesi');
    for (const k of ['lat', 'lng', 'gallery', 'is_corporate', 'filled_seeds']) assert.ok(!(k in a), `${k} dönmez`);

    await engineer(db);
    const eng = (await api(db, ENGINEER, { role: 'ENGINEER' }).list()).body.data;
    assert.ok(eng.items.every((s) => s.capabilities.edit && !s.capabilities.publish && s.capabilities.capacity));
    assert.deepEqual(eng.capabilities, { create: true, createPublic: false, delete: false });
    const owner = (await api(db, IDS.superAdmin, { role: 'SUPER_ADMIN' }).list()).body.data;
    assert.deepEqual(owner.capabilities, { create: true, createPublic: true, delete: true });
    assert.equal(owner.species, undefined, 'tür listesi yalnız istenince');
  } finally { await db.close(); }
});

test('30: saha kapsamı — liste yalnız kapsamdaki sahalar; kapsam dışı PUT 404; yalnız assigned → scope_unsupported; izinsiz → forbidden', async () => {
  const db = await sitesDb();
  try {
    await customRole(db, 'antalya_saha', ['sites.read', 'sites.edit']);
    await staffWithRole(db, USERS.scoped, 'antalya_saha', { kind: 'sites', siteIds: [IDS.siteA] });
    const s = api(db, USERS.scoped);
    const d = (await s.list()).body.data;
    assert.deepEqual(d.items.map((x) => x.id), [IDS.siteA]);
    assert.deepEqual(d.scope, { kind: 'sites', siteIds: [IDS.siteA] });
    assert.deepEqual(d.capabilities, { create: false, createPublic: false, delete: false });
    const b = await siteOf(db, IDS.siteB);
    const hidden = await s.put(formOf(b, { name: 'Başka Ad' }));
    assert.equal(hidden.status, 404, 'kapsam dışı saha varlığı sızmaz');
    assert.deepEqual(s.writes, []);

    await customRole(db, 'atanmis_saha', ['sites.read']);
    await staffWithRole(db, USERS.noter, 'atanmis_saha', { kind: 'assigned' });
    const assigned = api(db, USERS.noter);
    assert.equal((await assigned.list()).body.error.code, 'scope_unsupported');
    assert.equal((await assigned.put({ id: IDS.siteA, maintenance: true })).body.error.code, 'scope_unsupported');
    const outsider = api(db, '10000000-0000-0000-0000-0000000000ff');
    assert.equal((await outsider.list()).body.error.code, 'forbidden');
    assert.equal((await outsider.put({ id: IDS.siteA, maintenance: true })).body.error.code, 'forbidden');
    assert.deepEqual([...assigned.writes, ...outsider.writes], []);
  } finally { await db.close(); }
});

test('30: mühendis — metin değişikliği yalnız değişen kolonu yazar; yayın alanı ve hızlı yayın düğmesi publish ister, sıfır yazma', async () => {
  const db = await sitesDb();
  try {
    await engineer(db);
    const e = api(db, ENGINEER, { role: 'ENGINEER' });
    const a = await siteOf(db, IDS.siteA);
    const ok = await e.put(formOf(a, { summary_tr: 'Yangından etkilenen saha; ilk bırakma Kasım’da.' }));
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual(ok.body.data.changed, ['summary_i18n']);
    assert.deepEqual(e.writes.map((w) => Object.keys(w.values)), [['summary_i18n']], 'yalnız değişen kolon yazıldı');
    assert.deepEqual(e.audits[0].details, { changed: ['summary_i18n'] });

    const before = await row(db, IDS.siteA);
    const writesBefore = e.writes.length;
    for (const body of [formOf(a, { is_public: false }), { id: IDS.siteA, maintenance: true }]) {
      const r = await e.put(body);
      assert.equal(r.status, 403);
      assert.deepEqual(r.body.error.details, { reason: 'missing_permission', permissions: ['sites.publish'] });
    }
    // Karma değişiklik (metin + yayın): bütünüyle reddedilir, metin de yazılmaz.
    const mixed = await e.put(formOf(a, { name: 'Yeni Ad', is_public: false }));
    assert.equal(mixed.status, 403);
    assert.equal(e.writes.length, writesBefore, 'reddedilen isteklerde hiç yazma yok');
    assert.equal(e.audits.length, 1);
    assert.deepEqual(await row(db, IDS.siteA), before);
  } finally { await db.close(); }
});

test('30: durum geçişi — vitrini ya da sipariş kabulünü değiştiren geçiş publish ister; yayında olmayan sahada edit yeter', async () => {
  const db = await sitesDb();
  try {
    await engineer(db);
    const e = api(db, ENGINEER, { role: 'ENGINEER' });
    const a = await siteOf(db, IDS.siteA); // yayında, open
    for (const status of ['full', 'closed']) {
      const r = await e.put(formOf(a, { status }));
      assert.equal(r.status, 403, `open → ${status} sipariş kabulünü/listelenmeyi değiştirir`);
      assert.deepEqual(r.body.error.details.permissions, ['sites.publish']);
    }
    await db.query(`UPDATE lands SET status='full' WHERE id=$1`, [IDS.siteA]);
    const full = await siteOf(db, IDS.siteA);
    const phase = await e.put(formOf(full, { status: 'scheduled' }));
    assert.equal(phase.status, 200, 'full → scheduled: listelenmeye devam, sipariş yok → edit');
    assert.deepEqual(phase.body.data.changed, ['status']);
    const scheduled = phase.body.data.site;
    assert.equal((await e.put(formOf(scheduled, { status: 'open' }))).status, 403, 'scheduled → open sipariş kabulünü açar');
    assert.equal((await e.put(formOf(scheduled, { status: 'closed' }))).status, 403, 'scheduled → closed listeden kaldırır');

    const b = await siteOf(db, IDS.siteB); // yayında değil
    const hiddenOpen = await e.put(formOf(b, { status: 'open' }));
    assert.equal(hiddenOpen.status, 200, 'yayında olmayan sahada durum vitrini etkilemez');
    assert.deepEqual(hiddenOpen.body.data.site.visibility, { listed: false, acceptsOrders: false });
    assert.equal((await e.put(formOf(hiddenOpen.body.data.site, { is_public: true }))).status, 403, 'yayına alma yine publish ister');

    const owner = api(db, IDS.superAdmin, { role: 'SUPER_ADMIN' });
    const pub = await owner.put({ id: IDS.siteB, maintenance: false });
    assert.equal(pub.status, 200);
    assert.deepEqual(pub.body.data.site.visibility, { listed: true, acceptsOrders: true });
    assert.deepEqual(owner.audits[0].details, { changed: ['is_public'], is_public: { from: false, to: true } });
  } finally { await db.close(); }
});

test('30: kapasite — yalnız düzenleme izniyle kapasite değişmez; karma istek bütünüyle reddedilir; alt sınır korunur', async () => {
  const db = await sitesDb();
  try {
    await customRole(db, 'saha_editor', ['sites.read', 'sites.edit']);
    await staffWithRole(db, USERS.scoped, 'saha_editor');
    const ed = api(db, USERS.scoped);
    const a = await siteOf(db, IDS.siteA);
    const cap = await ed.put(formOf(a, { capacity_seeds: 60000 }));
    assert.equal(cap.status, 403);
    assert.deepEqual(cap.body.error.details, { reason: 'missing_permission', permissions: ['sites.capacity.manage'] });
    const mixed = await ed.put(formOf(a, { name: 'Yeni Antalya', capacity_seeds: 60000 }));
    assert.equal(mixed.status, 403);
    assert.deepEqual(ed.writes, []);
    assert.equal((await row(db, IDS.siteA)).name, 'Antalya Sahası', 'metin de uygulanmadı');
    assert.equal((await ed.put(formOf(a, { name: 'Yeni Antalya' }))).status, 200, 'kapasite gönderilse de değişmediyse edit yeter');

    await engineer(db);
    const e = api(db, ENGINEER, { role: 'ENGINEER' });
    const low = await e.put(formOf(await siteOf(db, IDS.siteA), { capacity_seeds: 1499 }));
    assert.equal(low.status, 400);
    assert.match(low.body.error.details.fields.capacity_seeds, /1\.500/);
    const okCap = await e.put(formOf(await siteOf(db, IDS.siteA), { capacity_seeds: 1500 }));
    assert.equal(okCap.status, 200, JSON.stringify(okCap.body));
    assert.deepEqual(okCap.body.data.site.capacity, { total: 1500, filled: 1000, reserved: 500, available: 0 });
    assert.deepEqual(e.audits.at(-1).details, { changed: ['capacity_seeds'], capacity_seeds: { from: 50000, to: 1500 } });
  } finally { await db.close(); }
});

test('30: MFA — kapasite ve yayın taze aal2 ister, düzenleme istemez; ret durumunda yazma yok', async () => {
  const db = await sitesDb();
  try {
    await engineer(db);
    await withMfaEnforced(async () => {
      const a = await siteOf(db, IDS.siteA);
      const aal1 = api(db, ENGINEER, { role: 'ENGINEER' });
      const denied = await aal1.put(formOf(a, { capacity_seeds: 55000 }));
      assert.equal(denied.status, 403);
      assert.equal(denied.body.error.code, 'mfa_required');
      assert.deepEqual(denied.body.error.details.permissions, ['sites.capacity.manage']);
      assert.equal(denied.body.error.details.reason, 'enrollment');
      const stale = await api(db, ENGINEER, { role: 'ENGINEER', assurance: aal2(16) }).put(formOf(a, { capacity_seeds: 55000 }));
      assert.equal(stale.body.error.details.reason, 'stale');
      assert.deepEqual(aal1.writes, []);
      assert.equal((await aal1.put(formOf(a, { district: 'Serik' }))).status, 200, 'düzenleme MFA istemez');
      const fresh = api(db, ENGINEER, { role: 'ENGINEER', assurance: aal2(1) });
      assert.equal((await fresh.put(formOf(await siteOf(db, IDS.siteA), { capacity_seeds: 55000 }))).status, 200);
      const list = (await fresh.list()).body.data;
      assert.deepEqual(list.mfa, { enforced: true, satisfied: true, enrolled: true });
      const ownerAal1 = api(db, IDS.superAdmin, { role: 'SUPER_ADMIN' });
      const pub = await ownerAal1.put({ id: IDS.siteB, maintenance: false });
      assert.equal(pub.body.error.code, 'mfa_required', 'sahip de yayın için yeniden doğrular');
      assert.deepEqual(pub.body.error.details.permissions, ['sites.publish']);
      assert.deepEqual(ownerAal1.writes, []);
    });
  } finally { await db.close(); }
});

test('30: yazma kapsamı — okuma tümü, düzenleme yalnız Antalya: Muğla değişikliği 403 out_of_scope ve yazma yok', async () => {
  const db = await sitesDb();
  try {
    await customRole(db, 'saha_okur', ['sites.read']);
    await customRole(db, 'antalya_editor', ['sites.edit']);
    await staffWithRole(db, USERS.scoped, 'saha_okur');
    const staff = (await db.query('SELECT id FROM admin_users WHERE user_id=$1', [USERS.scoped])).rows[0].id;
    await db.query(`SELECT assign_admin_role($1,$2,'antalya_editor',$3::jsonb,NULL,'test')`, [IDS.superAdmin, staff, JSON.stringify({ kind: 'sites', siteIds: [IDS.siteA] })]);
    const s = api(db, USERS.scoped);
    const d = (await s.list()).body.data;
    assert.deepEqual(Object.fromEntries(d.items.map((x) => [x.id, x.capabilities.edit])), { [IDS.siteA]: true, [IDS.siteB]: false, [IDS.land]: false });
    const r = await s.put(formOf(d.items.find((x) => x.id === IDS.siteB), { name: 'Muğla Yeni' }));
    assert.equal(r.status, 403);
    assert.deepEqual(r.body.error.details, { reason: 'out_of_scope', permissions: ['sites.edit'] });
    assert.deepEqual(s.writes, []);
    assert.equal((await s.put(formOf(d.items.find((x) => x.id === IDS.siteA), { name: 'Antalya Yeni' }))).status, 200);
    // Değişiklik yok: yazma yok; salt okuyucuya "kaydedildi" dönmez.
    const same = await s.put(formOf(await siteOf(db, IDS.siteA)));
    assert.deepEqual(same.body.data.changed, []);
    await staffWithRole(db, USERS.noter, 'read_only');
    const ro = await api(db, USERS.noter).put(formOf(await siteOf(db, IDS.siteA)));
    assert.equal(ro.status, 403);
    assert.equal(s.writes.length, 1);
  } finally { await db.close(); }
});

test('30: yarış — izin kararından sonra yayın ya da kapasite sayaçları değişirse güncelleme uygulanmaz (409)', async () => {
  const db = await sitesDb();
  try {
    await engineer(db);
    // Yayında olmayan sahada durum geçişi edit ile izinli; okuma ile yazma arasında sahip sahayı yayına alıyor.
    let flipped = false;
    const e = api(db, ENGINEER, { role: 'ENGINEER', afterQuery: async (q) => {
      if (!flipped && q.table === 'lands' && q.mode === 'select' && String(q.cols).includes('capacity_seeds')) {
        flipped = true; await db.query(`UPDATE lands SET is_public=true WHERE id=$1`, [IDS.siteB]);
      }
    } });
    const b = await siteOf(db, IDS.siteB);
    const r = await e.put(formOf(b, { status: 'open' }));
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'conflict');
    assert.equal((await row(db, IDS.siteB)).status, 'scheduled', 'yetkisiz sipariş kabulü açılmadı');
    assert.deepEqual(e.audits, []);

    // Kapasite: okuma ile yazma arasında yeni ayırma yapılıyor.
    let reserved = false;
    const c = api(db, ENGINEER, { role: 'ENGINEER', afterQuery: async (q) => {
      if (!reserved && q.table === 'lands' && q.mode === 'select' && String(q.cols).includes('capacity_seeds')) {
        reserved = true; await db.query(`SELECT reserve_release_capacity($1, 600)`, [IDS.siteA]);
      }
    } });
    const a = await siteOf(db, IDS.siteA);
    const cap = await c.put(formOf(a, { capacity_seeds: 1600 }));
    assert.equal(cap.status, 409, 'eski sayaçlarla alt sınır denetimi geçersiz');
    const now = await db.query('SELECT capacity_seeds, reserved_seeds FROM lands WHERE id=$1', [IDS.siteA]);
    assert.deepEqual(now.rows[0], { capacity_seeds: 50000, reserved_seeds: 1100 });
    const update = c.log.find((q) => q.mode === 'update');
    assert.match(update.where, /filled_seeds::text = .*reserved_seeds::text = /, 'sayaç koşulu UPDATE içinde');
  } finally { await db.close(); }
});

test('30: yeni saha — bütün kayıt kapsamı ister; yayında açmak publish ister; adres ve tür kuralları', async () => {
  const db = await sitesDb();
  try {
    const base = {
      name: 'Çanakkale Proje Uygulama Sahası', slug: '', province: 'Çanakkale', district: 'Eceabat', area_hectares: 12.5,
      is_fire_affected: false, fire_year: null, work_type: 'ormanlastirma', species_slugs: ['karacam'], name_en: '', name_ru: '',
      summary_tr: '', summary_en: '', summary_ru: '', cover_image: '', video_url: '', sort_order: 5, status: 'scheduled',
      is_public: true, capacity_seeds: 20000,
    };
    await engineer(db);
    const e = api(db, ENGINEER, { role: 'ENGINEER' });
    const pub = await e.create(base);
    assert.equal(pub.status, 403);
    assert.deepEqual(pub.body.error.details, { reason: 'missing_permission', permissions: ['sites.publish'] });
    const draft = await e.create({ ...base, is_public: false });
    assert.equal(draft.status, 201, JSON.stringify(draft.body));
    assert.equal(draft.body.data.site.slug, 'canakkale-proje-uygulama-sahasi');
    assert.deepEqual(draft.body.data.site.capacity, { total: 20000, filled: 0, reserved: 0, available: 20000 });
    assert.equal(e.audits.length, 1);
    const again = await e.create({ ...base, is_public: false });
    assert.equal(again.body.data.site.slug, 'canakkale-proje-uygulama-sahasi-2');
    assert.equal((await e.create({ ...base, is_public: false, slug: 'antalya-sahasi' })).body.error.code, 'slug_taken');
    const bad = await e.create({ ...base, is_public: false, species_slugs: ['yok-boyle'] });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.error.details.unknown, ['yok-boyle']);

    await customRole(db, 'antalya_tam', ['sites.read', 'sites.edit', 'sites.capacity.manage', 'sites.publish']);
    await staffWithRole(db, USERS.scoped, 'antalya_tam', { kind: 'sites', siteIds: [IDS.siteA] });
    const scoped = api(db, USERS.scoped);
    const r = await scoped.create({ ...base, is_public: false });
    assert.equal(r.status, 403);
    assert.equal(r.body.error.details.reason, 'all_scope_required');
    assert.deepEqual(scoped.writes, []);
  } finally { await db.close(); }
});

test('30: silme — sınır genişlemedi (yalnız eski SUPER_ADMIN); boş olmayan, bağlı ve yarışan saha silinmez', async () => {
  const db = await sitesDb();
  try {
    await engineer(db);
    const e = api(db, ENGINEER, { role: 'ENGINEER' });
    const denied = await e.remove({ id: IDS.siteB });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error.details.reason, 'legacy_role_required');
    assert.deepEqual(e.writes, []);

    const owner = api(db, IDS.superAdmin, { role: 'SUPER_ADMIN' });
    assert.equal((await owner.remove({ id: 'x' })).status, 400);
    assert.equal((await owner.remove({ id: '20000000-0000-4000-8000-00000000ffff' })).status, 404);
    const full = await owner.remove({ id: IDS.siteA });
    assert.equal(full.body.error.code, 'not_empty');
    assert.deepEqual(full.body.error.details, { filled: 1000, reserved: 500 });
    await orderAt(db, IDS.siteB);
    assert.equal((await owner.remove({ id: IDS.siteB })).body.error.code, 'in_use', 'sipariş bağı (FK) silmeyi engeller');

    const draft = await owner.create({
      name: 'Silinecek Saha', slug: '', province: '', district: '', area_hectares: null, is_fire_affected: false, fire_year: null,
      work_type: 'ormanlastirma', species_slugs: [], name_en: '', name_ru: '', summary_tr: '', summary_en: '', summary_ru: '',
      cover_image: '', video_url: '', sort_order: 0, status: 'scheduled', is_public: false, capacity_seeds: 100,
    });
    const id = draft.body.data.site.id;
    let raced = false;
    const racing = api(db, IDS.superAdmin, { role: 'SUPER_ADMIN', afterQuery: async (q) => {
      if (!raced && q.table === 'lands' && q.mode === 'select') { raced = true; await db.query('UPDATE lands SET reserved_seeds=5 WHERE id=$1', [id]); }
    } });
    assert.equal((await racing.remove({ id })).body.error.code, 'conflict');
    await db.query('UPDATE lands SET reserved_seeds=0 WHERE id=$1', [id]);
    const done = await owner.remove({ id });
    assert.equal(done.status, 200);
    assert.deepEqual(done.body.data, { deleted: true, id });
    assert.equal((await db.query('SELECT count(*)::int c FROM lands WHERE id=$1', [id])).rows[0].c, 0);
  } finally { await db.close(); }
});

test('30: hatalar — veri kaynağı 503 (sahte boş liste yok); geçersiz kimlik/gövde 400; boş değişiklikte yazma yok', async () => {
  const db = await sitesDb();
  try {
    const owner = (opts = {}) => api(db, IDS.superAdmin, { role: 'SUPER_ADMIN', ...opts });
    assert.equal((await owner({ failTables: ['lands'] }).list()).status, 503);
    assert.equal((await owner({ failTables: ['seed_catalog'] }).list({ include: 'species' })).status, 503);
    assert.equal((await owner().list()).status, 200, 'tür istenmezse katalog hatası listeyi düşürmez');
    assert.equal((await owner().put({ id: 'yok', maintenance: true })).body.error.code, 'invalid_id');
    const bad = await owner().put({ id: IDS.siteA, name: 'A' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'invalid_body');
    assert.ok(bad.body.error.details.fields.name);
    const o = owner();
    const same = await o.put(formOf(await siteOf(db, IDS.siteA)));
    assert.equal(same.status, 200);
    assert.deepEqual(same.body.data.changed, []);
    assert.deepEqual(o.writes, []); assert.deepEqual(o.audits, []);
    assert.equal((await owner({ failTables: ['lands'] }).put({ id: IDS.siteA, maintenance: true })).status, 503);
  } finally { await db.close(); }
});
