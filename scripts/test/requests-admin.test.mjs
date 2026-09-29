// 29: talep yönetimi — gerçek izin kapısı + gerçek route + gerçek servis/DTO + PGlite (014 talepler tablosu, 021–023 roller).
// Yalnız oturum/MFA durumu ve audit yazımı taklit. Her sorgu koşul ve parametreleriyle kaydedilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { loadSource as load } from './load-source.mjs';
import { createDb, IDS } from './pglite-db.mjs';
import { AAL1, customRole, envelope, gate, permissionKeys, request, staffWithRole, USERS } from './order-admin-helpers.mjs';
import { adminClient } from './admin-rest-client.mjs';

const schema = await import('../../lib/requests/schema.ts');
const CUSTOMER = '30000000-0000-4000-8000-0000000000c1';
const scopeMod = load('lib/admin/record-scope.ts', { '@/lib/admin/permissions': permissionKeys });
const dto = load('lib/requests/admin-dto.ts');
const read = load('lib/requests/admin-read.ts', { '@/lib/admin/record-scope': scopeMod, './admin-dto': dto, './schema': schema });

async function requestsDb() {
  const db = await createDb();
  const sql = await readFile(new URL('../../supabase/migrations/014_service_requests.sql', import.meta.url), 'utf8');
  // Yalnız 1. bölüm (talepler tablosu, indeksler, RLS, updated_at tetikleyicisi); e-posta/profil bölümleri gerekmez.
  await db.exec(sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS public.service_requests'), sql.indexOf('-- ── 2. email_logs')));
  for (const u of [IDS.superAdmin, IDS.finance, IDS.operations, CUSTOMER]) await db.query('INSERT INTO auth.users(id) VALUES ($1) ON CONFLICT DO NOTHING', [u]);
  // Gerçek lands tablosunda bölge vardır (011/015); ortak harness'e dokunmadan bu dosyada eklenir.
  await db.exec(`ALTER TABLE lands ADD COLUMN IF NOT EXISTS region text; UPDATE lands SET region = 'Antalya' WHERE id = '${IDS.siteA}';`);
  const insert = async (r) => (await db.query(`INSERT INTO service_requests(request_no, type, status, contact_name, email, phone, company, land_id,
      total_seeds, details, message, ip_hash, user_agent, client_token, source_path, created_at, user_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,'GIZLI-IPHASH','GIZLI-UA',gen_random_uuid(),'/tr/talep',$12,$13) RETURNING id`,
    [r.no, r.type, r.status ?? 'new', r.name, r.email, r.phone ?? null, r.company ?? null, r.land ?? null, r.seeds ?? null,
      JSON.stringify(r.details), r.message ?? null, r.at, r.user ?? null])).rows[0].id;
  const ids = {
    a: await insert({ no: 'TLP-AAAAA1', type: 'open_land_seeding', name: 'Ayşe Antalya', email: 'ayse@example.invalid', phone: '+905550000001',
      land: IDS.siteA, seeds: 500, details: { type: 'open_land_seeding', landId: IDS.siteA, quantity: 500, certificateName: 'Ayşe A' }, message: 'Antalya mesajı',
      at: '2026-09-28T10:00:00Z', user: CUSTOMER }),
    b: await insert({ no: 'TLP-BBBBB2', type: 'open_land_seeding', name: 'Bora Mugla', email: 'bora@example.invalid',
      land: IDS.siteB, seeds: 300, details: { type: 'open_land_seeding', landId: IDS.siteB, quantity: 300 }, message: 'Muğla mesajı', at: '2026-09-28T09:00:00Z' }),
    c: await insert({ no: 'TLP-CCCCC3', type: 'land_application', name: 'Cem Arazi', email: 'cem@example.invalid', company: 'Cem Tarım',
      details: { type: 'land_application', province: '07', district: 'Manavgat', areaValue: 12, areaUnit: 'dekar', conditions: ['burnt'],
        ownership: 'own', timing: 'this_season', mapLink: 'https://maps.example.invalid/?q=GIZLI-KONUM', accessNotes: 'Köy yolu GIZLI-NOT' }, at: '2026-09-28T08:00:00Z' }),
    d: await insert({ no: 'TLP-DDDDD4', type: 'open_land_seeding', status: 'contacted', name: 'Deniz Ana', email: 'deniz@example.invalid',
      land: IDS.land, seeds: 100, details: { type: 'open_land_seeding', landId: IDS.land, quantity: 100 }, at: '2026-09-28T07:00:00Z' }),
  };
  return { db, ids };
}

function api(db, who, { role = 'NONE', failTables = [], failWhen = null, afterQuery = null, auditWarnings = [] } = {}) {
  const log = []; const writes = []; const audits = [];
  const route = load('app/api/admin/requests/route.ts', {
    zod: { z },
    '@/lib/supabase/server': { createServiceRoleClient: () => adminClient(db, { failTables, failWhen, log, writes, afterQuery }) },
    '@/lib/admin-auth': { getClientIP: () => '127.0.0.1' },
    '@/lib/admin/permissions': gate({ db, userId: who, role, assurance: AAL1 }),
    '@/lib/admin/record-scope': scopeMod,
    '@/lib/admin/audit': { auditLog: async (_db, rec) => { audits.push(rec); return auditWarnings; } },
    '@/lib/api/envelope': envelope,
    '@/lib/requests/admin-read': read,
    '@/lib/requests/schema': schema,
  });
  return {
    log, writes, audits,
    list: (query = {}) => route.GET(request({ query, url: 'https://skytechgreen.com/api/admin/requests' })),
    patch: (body) => route.PATCH(request({ body })),
  };
}
const SECRETS = ['GIZLI-IPHASH', 'GIZLI-UA', 'client_token', 'ip_hash', 'user_agent', 'user_id', CUSTOMER];
const noSecrets = (body, label) => { const s = JSON.stringify(body); for (const x of SECRETS) assert.ok(!s.includes(x), `${label}: ${x}`); };
const contactQueried = (log) => log.some((e) => String(e.cols ?? '').includes('contact_name'));

test('29: yalnız requests.read/update (operasyon) — iletişim yok ve sorgulanmıyor; ayrıntının kimlik içermeyen kısmı var', async () => {
  const { db, ids } = await requestsDb();
  try {
    const ops = api(db, IDS.operations, { role: 'OPERATIONS' });
    const r = await ops.list();
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const d = r.body.data;
    assert.deepEqual(d.groups, ['request']);
    assert.equal(d.search.contactFields, false);
    assert.equal(d.total, 4);
    assert.deepEqual(d.capabilities, { update: true });
    for (const item of d.items) assert.ok(!('contact' in item), 'iletişim yok');
    assert.equal(contactQueried(ops.log), false, 'iletişim kolonları hiç sorgulanmadı');
    const land = d.items.find((i) => i.id === ids.c);
    assert.deepEqual(land.details, { type: 'land_application', province: '07', district: 'Manavgat', areaValue: 12, areaUnit: 'dekar',
      conditions: ['burnt'], ownership: 'own', timing: 'this_season' });
    assert.equal(land.site, null, 'sahasız talep');
    assert.ok(!JSON.stringify(d).includes('GIZLI-KONUM') && !JSON.stringify(d).includes('GIZLI-NOT') && !JSON.stringify(d).includes('mesajı'),
      'harita bağlantısı, erişim notu ve mesaj yok');
    assert.deepEqual(d.items.find((i) => i.id === ids.a).site, { id: IDS.siteA, name: 'Antalya Sahası', region: 'Antalya' });
    noSecrets(r.body, 'operasyon listesi');
  } finally { await db.close(); }
});

test('29: finans şablonu — iletişim ve iletişimle arama açık; güncelleme izni yok, PATCH hiçbir şey yazmaz', async () => {
  const { db, ids } = await requestsDb();
  try {
    const fin = api(db, IDS.finance, { role: 'FINANCE' });
    const d = (await fin.list()).body.data;
    assert.deepEqual(d.groups, ['request', 'contact']);
    assert.equal(d.search.contactFields, true);
    assert.deepEqual(d.capabilities, { update: false });
    const land = d.items.find((i) => i.id === ids.c);
    assert.equal(land.contact.mapLink, 'https://maps.example.invalid/?q=GIZLI-KONUM');
    assert.equal(land.contact.company, 'Cem Tarım');
    assert.equal(d.items.find((i) => i.id === ids.a).contact.message, 'Antalya mesajı');
    assert.deepEqual(d.items.map((i) => [i.requestNo, i.contact.hasAccount]), [['TLP-AAAAA1', true], ['TLP-BBBBB2', false], ['TLP-CCCCC3', false], ['TLP-DDDDD4', false]],
      'üyelik yalnız bayrak; hesap kimliği dönmez');
    assert.ok(d.items.every((i) => i.canUpdate === false));
    assert.deepEqual((await fin.list({ q: 'bora@example' })).body.data.items.map((i) => i.id), [ids.b]);
    const denied = await fin.patch({ id: ids.a, status: 'contacted' });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error.code, 'forbidden');
    assert.deepEqual(fin.writes, []); assert.deepEqual(fin.audits, []);
    noSecrets(d, 'finans listesi');
  } finally { await db.close(); }
});

test('29: saha kapsamı — liste, toplam, sayaç, arama, güncelleme yalnız kapsamda; sahasız talep saha yetkisiyle açılmaz', async () => {
  const { db, ids } = await requestsDb();
  try {
    await customRole(db, 'antalya_talep', ['requests.read', 'requests.update', 'customers.contact.read']);
    await staffWithRole(db, USERS.scoped, 'antalya_talep', { kind: 'sites', siteIds: [IDS.siteA] });
    const s = api(db, USERS.scoped);
    const d = (await s.list()).body.data;
    assert.deepEqual(d.scope, { kind: 'sites', siteIds: [IDS.siteA] });
    assert.deepEqual(d.items.map((i) => i.id), [ids.a]);
    assert.equal(d.total, 1);
    assert.equal(Object.values(d.counts).reduce((x, y) => x + y, 0), 1, 'sayaçlar kapsam dışını saymaz');
    for (const q of ['Bora', 'Cem', 'TLP-BBBBB2', 'cem@example']) assert.deepEqual((await s.list({ q })).body.data.items, [], `arama kapsam dışını bulmaz: ${q}`);
    const ok = await s.patch({ id: ids.a, status: 'contacted', adminNote: 'Arandı' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.data.status, 'contacted');
    assert.equal(ok.body.data.lastHandled.adminId, USERS.scoped, 'son işlem yapan (atama değil)');
    assert.equal(s.audits.length, 1);
    for (const id of [ids.b, ids.c]) {
      const r = await s.patch({ id, status: 'contacted' });
      assert.equal(r.status, 404, 'okuma kapsamı dışı (sahasız dahil) varlık sızdırmaz');
    }
    assert.equal(s.writes.filter((w) => w.mode === 'update').length, 1, 'yalnız kapsamdaki kayıt güncellendi');
    const row = (await db.query('SELECT handled_by, admin_note FROM service_requests WHERE id=$1', [ids.a])).rows[0];
    assert.deepEqual(row, { handled_by: USERS.scoped, admin_note: 'Arandı' });
  } finally { await db.close(); }
});

test('29: okuma tüm kayıtlarda, güncelleme yalnız Antalya — kapsam dışı güncelleme 403 ve UPDATE gönderilmez', async () => {
  const { db, ids } = await requestsDb();
  try {
    await customRole(db, 'talep_okur', ['requests.read']);
    await customRole(db, 'antalya_guncel', ['requests.update']);
    await staffWithRole(db, USERS.scoped, 'talep_okur');
    const staff = (await db.query('SELECT id FROM admin_users WHERE user_id=$1', [USERS.scoped])).rows[0].id;
    await db.query(`SELECT assign_admin_role($1,$2,'antalya_guncel',$3::jsonb,NULL,'test')`, [IDS.superAdmin, staff, JSON.stringify({ kind: 'sites', siteIds: [IDS.siteA] })]);
    const s = api(db, USERS.scoped);
    const d = (await s.list()).body.data;
    assert.deepEqual(Object.fromEntries(d.items.map((i) => [i.id, i.canUpdate])), { [ids.a]: true, [ids.b]: false, [ids.c]: false, [ids.d]: false });
    for (const id of [ids.b, ids.c]) {
      const r = await s.patch({ id, adminNote: 'deneme' });
      assert.equal(r.status, 403);
      assert.deepEqual(r.body.error.details, { reason: 'out_of_scope' });
    }
    assert.deepEqual(s.writes, [], 'kapsam dışında UPDATE hiç gönderilmedi');
    assert.deepEqual(s.audits, []);
    const done = await s.patch({ id: ids.a, adminNote: 'tamam' });
    assert.equal(done.status, 200);
    assert.ok(!('contact' in done.body.data), 'PATCH yanıtı iletişim iznini aşmaz');
    assert.equal(contactQueried(s.log), false);
  } finally { await db.close(); }
});

test('29: güncelleme uygulandı ama yeniden okunamadı → audit yazılır, 503 applied:true; audit yazılamazsa uyarı döner', async () => {
  const { db, ids } = await requestsDb();
  try {
    let updated = false;
    const s = api(db, IDS.superAdmin, {
      role: 'SUPER_ADMIN',
      afterQuery: async (e) => { if (e.mode === 'update') updated = true; },
      failWhen: (e) => updated && e.table === 'service_requests' && e.mode === 'select',
    });
    const r = await s.patch({ id: ids.b, status: 'quoted' });
    assert.equal(r.status, 503);
    assert.deepEqual(r.body.error.details, { applied: true });
    assert.equal(s.audits.length, 1, 'uygulanan güncellemenin audit kaydı atlanmaz');
    assert.equal((await db.query('SELECT status FROM service_requests WHERE id=$1', [ids.b])).rows[0].status, 'quoted');

    const warn = api(db, IDS.superAdmin, { role: 'SUPER_ADMIN', auditWarnings: [{ code: 'audit_unavailable', message: 'x' }] });
    const w = await warn.patch({ id: ids.b, adminNote: 'not' });
    assert.equal(w.status, 200);
    assert.deepEqual(w.body.warnings.map((x) => x.code), ['audit_unavailable']);
  } finally { await db.close(); }
});

test('29: güncelleme yarışı — kayıt arada kapsam dışına taşınırsa güncelleme uygulanmaz', async () => {
  const { db, ids } = await requestsDb();
  try {
    await customRole(db, 'antalya_talep', ['requests.read', 'requests.update']);
    await staffWithRole(db, USERS.scoped, 'antalya_talep', { kind: 'sites', siteIds: [IDS.siteA] });
    let moved = false;
    const s = api(db, USERS.scoped, { afterQuery: async (e) => {
      if (!moved && e.table === 'service_requests' && e.mode === 'select' && e.cols === 'id, land_id') {
        moved = true; await db.query('UPDATE service_requests SET land_id=$2 WHERE id=$1', [ids.a, IDS.siteB]);
      }
    } });
    const r = await s.patch({ id: ids.a, status: 'closed' });
    assert.equal(r.status, 404);
    assert.deepEqual(s.audits, [], 'uygulanmayan güncelleme için audit yok');
    assert.equal((await db.query('SELECT status FROM service_requests WHERE id=$1', [ids.a])).rows[0].status, 'new', 'kayıt değişmedi');
    const update = s.log.find((e) => e.mode === 'update');
    assert.match(update.where, /land_id::text = ANY/, 'kapsam koşulu UPDATE içinde');
  } finally { await db.close(); }
});

test('29: kısmi iletişim kapsamı — iletişim yalnız kapsamdaki satır için ayrı sorgu; iletişimle arama kapalı', async () => {
  const { db, ids } = await requestsDb();
  try {
    await customRole(db, 'talep_okur', ['requests.read']);
    await customRole(db, 'antalya_iletisim', ['customers.contact.read']);
    await staffWithRole(db, USERS.scoped, 'talep_okur');
    const staff = (await db.query('SELECT id FROM admin_users WHERE user_id=$1', [USERS.scoped])).rows[0].id;
    await db.query(`SELECT assign_admin_role($1,$2,'antalya_iletisim',$3::jsonb,NULL,'test')`, [IDS.superAdmin, staff, JSON.stringify({ kind: 'sites', siteIds: [IDS.siteA] })]);
    const s = api(db, USERS.scoped);
    const d = (await s.list()).body.data;
    assert.equal(d.search.contactFields, false);
    assert.deepEqual(d.items.filter((i) => 'contact' in i).map((i) => i.id), [ids.a]);
    const main = s.log.find((e) => e.table === 'service_requests' && String(e.cols).includes('request_no') && !e.head);
    assert.ok(!String(main.cols).includes('contact_name'), 'ana sorgu iletişim seçmez');
    const contactQ = s.log.find((e) => String(e.cols ?? '').startsWith('id, contact_name'));
    assert.ok(contactQ.params.some((p) => Array.isArray(p) && p.length === 1 && p[0] === IDS.siteA), 'yalnız Antalya');
    assert.ok(contactQ.params.some((p) => Array.isArray(p) && p.length === d.items.length), 'yalnız sayfadaki kimlikler');
    assert.deepEqual((await s.list({ q: 'Ayşe' })).body.data.items, [], 'kısmi kapsamda adla arama çalışmaz');
    assert.deepEqual((await s.list({ q: 'TLP-AAAAA1' })).body.data.items.map((i) => i.id), [ids.a], 'talep no araması çalışır');
  } finally { await db.close(); }
});

test('29: yalnız assigned → scope_unsupported; izinsiz → forbidden; hatalar 503/400; gizli alanlar hiçbir izinle dönmez', async () => {
  const { db, ids } = await requestsDb();
  try {
    await customRole(db, 'atanmis', ['requests.read', 'requests.update']);
    await staffWithRole(db, USERS.scoped, 'atanmis', { kind: 'assigned' });
    const assigned = api(db, USERS.scoped);
    for (const r of [await assigned.list(), await assigned.patch({ id: ids.a, status: 'closed' })]) {
      assert.equal(r.status, 403); assert.equal(r.body.error.code, 'scope_unsupported');
    }
    assert.deepEqual(assigned.writes, []);
    const outsider = api(db, '10000000-0000-0000-0000-0000000000ff');
    assert.equal((await outsider.list()).body.error.code, 'forbidden');

    const owner = (opts = {}) => api(db, IDS.superAdmin, { role: 'SUPER_ADMIN', ...opts });
    for (const table of ['service_requests', 'lands']) assert.equal((await owner({ failTables: [table] }).list()).status, 503, `${table} hatası 503`);
    assert.equal((await owner().list({ status: 'uydurma' })).body.error.details.param, 'status');
    assert.equal((await owner().list({ type: 'uydurma' })).body.error.details.param, 'type');
    const empty = await owner().patch({ id: ids.a });
    assert.equal(empty.status, 400); assert.equal(empty.body.error.code, 'invalid_body');
    assert.equal((await owner().patch({ id: 'x', status: 'closed' })).status, 400);
    assert.equal((await owner().patch({ id: ids.a, status: 'uydurma' })).status, 400);
    const full = (await owner().list()).body.data;
    assert.equal(full.items.find((i) => i.id === ids.c).contact.accessNotes, 'Köy yolu GIZLI-NOT');
    noSecrets(full, 'sahip listesi');
  } finally { await db.close(); }
});
