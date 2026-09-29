// 31: bırakma partileri — gerçek izin kapısı + gerçek route/okuma + gerçek lib/orders/batches.ts (değişmeden)
// + PGlite (016 sipariş/parti tabloları ve kapasite işlevleri, 021–023 roller). Taklit: oturum/MFA, audit,
// e-posta ve video yayını (yalnız çağrı sayacı). Her sorgu, yazma ve iş servisi çağrısı kaydedilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { loadSource as load } from './load-source.mjs';
import { createDb, IDS } from './pglite-db.mjs';
import { AAL1, aal2, customRole, envelope, gate, orderAt, permissionKeys, request, staffWithRole, USERS, withMfaEnforced } from './order-admin-helpers.mjs';
import { adminClient } from './admin-rest-client.mjs';

const scopeMod = load('lib/admin/record-scope.ts', { '@/lib/admin/permissions': permissionKeys });
const orderAccess = load('lib/orders/admin-access.ts', { '@/lib/admin/permissions': permissionKeys });
const schedule = load('lib/orders/schedule.ts');
const dto = load('lib/batches/admin-dto.ts');
const read = load('lib/batches/admin-read.ts', {
  '@/lib/admin/record-scope': scopeMod, '@/lib/orders/admin-access': orderAccess, '@/lib/orders/schedule': schedule, './admin-dto': dto,
});
const state = load('lib/orders/state.ts');

/** Gerçek parti servisi; her çağrı sayılır. Sertifika üretimi taklit (ayrı sahiplikte). */
function batchService(calls) {
  const store = load('lib/orders/store.ts', {
    '@/lib/supabase/server': { createServiceRoleClient: () => { throw new Error('servis istemcisi route’tan gelmeli'); } }, './state': state,
  });
  const real = load('lib/orders/batches.ts', {
    './certificates': { issueCertificate: async () => { calls.push(['issueCertificate']); } }, './schedule': schedule, './store': store,
  });
  const spy = (name) => async (...args) => { calls.push([name]); return real[name](...args); };
  return Object.fromEntries(['createBatch', 'updateBatch', 'deleteBatch', 'assignOrders', 'unassignOrder', 'completeRelease'].map((n) => [n, spy(n)]));
}
const SERVICE = new Set(['createBatch', 'updateBatch', 'deleteBatch', 'assignOrders', 'unassignOrder', 'completeRelease', 'publishBatchVideo',
  'sendPendingCertificateEmails', 'sendPendingVideoEmails', 'issueCertificate']);

function api(db, who, { role = 'NONE', assurance = AAL1, failTables = [] } = {}) {
  const log = []; const writes = []; const audits = []; const calls = []; const afters = [];
  const permissions = gate({ db, userId: who, role, assurance });
  const client = () => adminClient(db, {
    failTables, log, writes,
    rpc: async (name, args) => {
      assert.equal(name, 'commit_reserved_capacity');
      await db.query('SELECT commit_reserved_capacity($1, $2)', [args.p_land_id, args.p_quantity]);
      return { data: null, error: null };
    },
  });
  const common = {
    zod: { z },
    '@/lib/supabase/server': { createServiceRoleClient: client },
    '@/lib/admin-auth': { getClientIP: () => '127.0.0.1' },
    '@/lib/admin/permissions': permissions,
    '@/lib/admin/record-scope': scopeMod,
    '@/lib/admin/permission-set': load('lib/admin/permission-set.ts', {
      '@/lib/api/envelope': envelope, '@/lib/admin/permissions': permissions, '@/lib/admin/permission-keys': permissionKeys, './record-scope': scopeMod,
    }),
    '@/lib/admin/audit': { auditLog: async (_db, rec) => { audits.push(rec); return []; } },
    '@/lib/api/envelope': envelope,
    '@/lib/batches/admin-read': read,
    '@/lib/orders/batches': batchService(calls),
  };
  const listRoute = load('app/api/admin/release-batches/route.ts', common);
  const oneRoute = load('app/api/admin/release-batches/[id]/route.ts', {
    ...common,
    'next/server': { after: (fn) => afters.push(fn) },
    '@/lib/mail': { publicOrigin: (o) => o },
    '@/lib/orders/certificates': { sendPendingCertificateEmails: async () => { calls.push(['sendPendingCertificateEmails']); } },
    '@/lib/orders/jobs': {
      publishBatchVideo: async () => { calls.push(['publishBatchVideo']); return { ok: true, firstPublication: true }; },
      sendPendingVideoEmails: async () => { calls.push(['sendPendingVideoEmails']); },
    },
  });
  const url = 'https://skytechgreen.com/api/admin/release-batches';
  const ctx = (id) => ({ params: Promise.resolve({ id }) });
  return {
    log, writes, audits, calls, afters,
    serviceCalls: () => calls.filter(([n]) => SERVICE.has(n)).map(([n]) => n),
    list: () => listRoute.GET(request({ url })),
    create: (body) => listRoute.POST(request({ body, url })),
    detail: (id) => oneRoute.GET(request({ url: `${url}/${id}` }), ctx(id)),
    patch: (id, body) => oneRoute.PATCH(request({ body, url: `${url}/${id}` }), ctx(id)),
    act: (id, body) => oneRoute.POST(request({ body, url: `${url}/${id}` }), ctx(id)),
    remove: (id) => oneRoute.DELETE(request({ url: `${url}/${id}` }), ctx(id)),
  };
}

async function confirmedAt(db, landId, over = {}) {
  const id = await orderAt(db, landId, over);
  await db.query(`UPDATE release_orders SET status='confirmed', confirmed_at=now() - interval '1 day', withdrawal_deadline=now() - interval '20 days',
    payment_meta='{"capacityHeld":true,"provider":"GIZLI-ODEME"}'::jsonb WHERE id=$1`, [id]);
  return id;
}
const batchAt = async (db, landId, season = '2026-2027') =>
  (await db.query(`INSERT INTO release_batches(land_id, season_label, title) VALUES ($1, $2, 'Kasım bırakması') RETURNING id`, [landId, season])).rows[0].id;
const scheduleInto = (db, orderId, batchId) =>
  db.query(`UPDATE release_orders SET status='scheduled', batch_id=$2, scheduled_at=now() WHERE id=$1`, [orderId, batchId]);
const statusOf = async (db, id) => (await db.query('SELECT status, batch_id FROM release_orders WHERE id=$1', [id])).rows[0];
const OPS = { role: 'OPERATIONS' };
const OWNER = { role: 'SUPER_ADMIN' };

test('31: liste GET yan etkisiz — cayma süresi dolan sipariş kesinleşmez, sayısı raporlanır; yetenekler izne göre', async () => {
  const db = await createDb();
  try {
    const due = await orderAt(db, IDS.land);
    await db.query(`UPDATE release_orders SET status='paid', withdrawal_deadline=now() - interval '1 hour' WHERE id=$1`, [due]);
    const b = await batchAt(db, IDS.land);
    await scheduleInto(db, await confirmedAt(db, IDS.land), b);
    await confirmedAt(db, IDS.land);

    const ops = api(db, IDS.operations, OPS);
    const r = await ops.list();
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const d = r.body.data;
    assert.equal((await statusOf(db, due)).status, 'paid', 'okuma siparişi kesinleştirmedi');
    assert.deepEqual(ops.writes, []); assert.deepEqual(ops.serviceCalls(), []);
    assert.equal(d.dueForConfirmation, 1);
    assert.deepEqual(d.batches.map((x) => [x.orders, x.quantity, x.landName]), [[1, 20, 'Ana Saha']]);
    assert.deepEqual(d.batches[0].capabilities, { plan: true, assign: true, release: true, publish: false });
    assert.deepEqual(d.waiting, [{ landId: IDS.land, seasonLabel: '2026-2027', orders: 1, quantity: 20, landName: 'Ana Saha' }]);
    assert.deepEqual(d.capabilities, { create: true });
    assert.ok(d.lands.every((l) => l.canPlan));

    await staffWithRole(db, USERS.scoped, 'read_only');
    const ro = (await api(db, USERS.scoped).list()).body.data;
    assert.deepEqual(ro.batches[0].capabilities, { plan: false, assign: false, release: false, publish: false });
    assert.deepEqual(ro.capabilities, { create: false });
  } finally { await db.close(); }
});

test('31: saha kapsamı — liste, saha seçenekleri, bekleyenler ve sayaçlar kapsamda; kapsam dışı parti 404', async () => {
  const db = await createDb();
  try {
    const a = await batchAt(db, IDS.siteA);
    const bB = await batchAt(db, IDS.siteB);
    await scheduleInto(db, await confirmedAt(db, IDS.siteB), bB);
    await confirmedAt(db, IDS.siteB);
    await customRole(db, 'antalya_parti', ['batches.read', 'batches.plan']);
    await staffWithRole(db, USERS.scoped, 'antalya_parti', { kind: 'sites', siteIds: [IDS.siteA] });
    const s = api(db, USERS.scoped);
    const d = (await s.list()).body.data;
    assert.deepEqual(d.batches.map((x) => x.id), [a]);
    assert.deepEqual(d.lands.map((l) => l.id), [IDS.siteA]);
    assert.deepEqual(d.waiting, []);
    assert.deepEqual(d.scope, { kind: 'sites', siteIds: [IDS.siteA] });
    assert.equal((await s.detail(bB)).status, 404);
    assert.equal((await s.create({ landId: IDS.siteB, seasonLabel: '2026-2027' })).status, 404, 'kapsam dışı sahada parti açılmaz');
    assert.deepEqual(s.serviceCalls(), []);
    const made = await s.create({ landId: IDS.siteA, seasonLabel: '2026-2027', title: 'Antalya Kasım' });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    assert.equal(made.body.data.batch.landName, 'Antalya Sahası');

    await customRole(db, 'atanmis_parti', ['batches.read']);
    await staffWithRole(db, USERS.noter, 'atanmis_parti', { kind: 'assigned' });
    const assigned = api(db, USERS.noter);
    assert.equal((await assigned.list()).body.error.code, 'scope_unsupported');
    assert.equal((await assigned.act(a, { action: 'release', releasedOn: '2026-09-01' })).body.error.code, 'scope_unsupported');
    assert.equal((await api(db, '10000000-0000-0000-0000-0000000000ff').list()).body.error.code, 'forbidden');
  } finally { await db.close(); }
});

test('31: parti ayrıntısı — parti izni alıcı/tutar/sertifika açmaz ve sorgulamaz; gruplar 27 kuralıyla, sertifika MFA ister', async () => {
  const db = await createDb();
  try {
    const b = await batchAt(db, IDS.land);
    await scheduleInto(db, await confirmedAt(db, IDS.land), b);
    await confirmedAt(db, IDS.land);
    const ops = api(db, IDS.operations, OPS);
    const d = (await ops.detail(b)).body.data;
    assert.deepEqual(d.groups, ['order']);
    assert.equal(d.orders.length, 1); assert.equal(d.candidates.length, 1);
    for (const row of [...d.orders, ...d.candidates]) {
      for (const k of ['buyer', 'finance', 'certificateName']) assert.ok(!(k in row), `${k} yok`);
      assert.equal(row.capacityHeld, true);
    }
    const cols = ops.log.filter((q) => q.table === 'release_orders').map((q) => String(q.cols)).join(' | ');
    for (const c of ['buyer_', 'total_kurus', 'paid_at', 'certificate_name', 'payment_meta,', 'buyer_email']) assert.ok(!cols.includes(c), `${c} sorgulanmadı`);
    assert.ok(!JSON.stringify(d).includes('GIZLI-ODEME'), 'ödeme ayrıntısı dönmez');
    assert.deepEqual(d.land.capacity, { total: 100000, filled: 0, reserved: 1000 }, 'operasyon sites.read ile kapasiteyi görür');

    // İletişim izni var ama orders.read yok → alıcı adı yine kapalı.
    await customRole(db, 'parti_iletisim', ['batches.read', 'customers.contact.read']);
    await staffWithRole(db, USERS.scoped, 'parti_iletisim');
    const noOrders = (await api(db, USERS.scoped).detail(b)).body.data;
    assert.deepEqual(noOrders.groups, ['order']);
    assert.ok(!('capacity' in noOrders.land), 'sites.read yoksa kapasite yok');

    await withMfaEnforced(async () => {
      const owner = (await api(db, IDS.superAdmin, OWNER).detail(b)).body.data;
      assert.deepEqual(owner.groups, ['order', 'contact', 'finance']);
      assert.deepEqual(owner.mfaRequiredGroups, ['certificate']);
      assert.deepEqual(owner.orders[0].buyer, { firstName: 'Test', lastName: 'Kişi' });
      assert.equal(owner.orders[0].finance.totalKurus, 20000);
      assert.ok(!('certificateName' in owner.orders[0]));
      const fresh = (await api(db, IDS.superAdmin, { ...OWNER, assurance: aal2(1) }).detail(b)).body.data;
      assert.equal(fresh.orders[0].certificateName, 'Test Kişi');
      assert.deepEqual(fresh.mfaRequiredGroups, []);
    });
  } finally { await db.close(); }
});

test('31: plan izni — parti açar ve başlığı düzeltir; atama, bırakma, yayın ve rapor adresi reddedilir, sıfır iş çağrısı', async () => {
  const db = await createDb();
  try {
    const b = await batchAt(db, IDS.land);
    const order = await confirmedAt(db, IDS.land);
    await customRole(db, 'parti_plan', ['batches.read', 'batches.plan']);
    await staffWithRole(db, USERS.scoped, 'parti_plan');
    const p = api(db, USERS.scoped);
    const cases = [
      [{ action: 'assign', orderIds: [order] }, 'batches.assign'],
      [{ action: 'release', releasedOn: '2026-09-01' }, 'batches.release'],
      [{ action: 'publish_video', videoUrl: 'https://youtu.be/abcdefghijk' }, 'monitoring.publish'],
    ];
    for (const [body, permission] of cases) {
      const r = await p.act(b, body);
      assert.equal(r.status, 403, body.action);
      assert.deepEqual(r.body.error.details, { reason: 'missing_permission', permissions: [permission] });
    }
    await db.query(`UPDATE release_batches SET released_on=current_date - 1 WHERE id=$1`, [b]);
    const report = await p.patch(b, { title: 'Kasım bırakması', plannedOn: null, notes: null, monitoringReportUrl: 'https://rapor.example.invalid/1' });
    assert.equal(report.status, 403, 'izleme raporu herkese açık: yayın izni ister');
    assert.deepEqual(report.body.error.details.permissions, ['monitoring.publish']);
    assert.deepEqual(p.serviceCalls(), []); assert.deepEqual(p.writes, []); assert.deepEqual(p.afters, []); assert.deepEqual(p.audits, []);

    // Panel formu rapor adresini değişmeden gönderir: yalnız başlık değiştiği için plan izni yeter.
    const titled = await p.patch(b, { title: 'Kasım bırakması (1)', plannedOn: null, notes: null, monitoringReportUrl: null });
    assert.equal(titled.status, 200, JSON.stringify(titled.body));
    assert.deepEqual(titled.body.data.changed, ['title']);
    assert.equal(titled.body.data.batch.title, 'Kasım bırakması (1)');
    assert.deepEqual(p.serviceCalls(), ['updateBatch']);
  } finally { await db.close(); }
});

test('31: atama — hedef parti ve her kaynak sipariş kapsamda olmalı; karışık saha tümüyle reddedilir, kısmi işlem yok', async () => {
  const db = await createDb();
  try {
    const bA = await batchAt(db, IDS.siteA);
    const a1 = await confirmedAt(db, IDS.siteA);
    const a2 = await confirmedAt(db, IDS.siteA);
    const b1 = await confirmedAt(db, IDS.siteB);
    await customRole(db, 'parti_okur', ['batches.read']);
    await customRole(db, 'antalya_atama', ['batches.assign']);
    await staffWithRole(db, USERS.scoped, 'parti_okur');
    const staff = (await db.query('SELECT id FROM admin_users WHERE user_id=$1', [USERS.scoped])).rows[0].id;
    await db.query(`SELECT assign_admin_role($1,$2,'antalya_atama',$3::jsonb,NULL,'test')`, [IDS.superAdmin, staff, JSON.stringify({ kind: 'sites', siteIds: [IDS.siteA] })]);
    const s = api(db, USERS.scoped);

    const mixed = await s.act(bA, { action: 'assign', orderIds: [a1, b1] });
    assert.equal(mixed.status, 403);
    assert.deepEqual(mixed.body.error.details, { reason: 'out_of_scope', permissions: ['batches.assign'] });
    const ghost = await s.act(bA, { action: 'assign', orderIds: [a1, '30000000-0000-4000-8000-00000000ffff'] });
    assert.equal(ghost.status, 404);
    assert.deepEqual(s.serviceCalls(), []);
    assert.deepEqual([await statusOf(db, a1), await statusOf(db, b1)].map((o) => o.status), ['confirmed', 'confirmed'], 'kısmi atama yok');

    const done = await s.act(bA, { action: 'assign', orderIds: [a1, a2] });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.deepEqual(done.body.data, { assigned: 2 });
    assert.deepEqual((await statusOf(db, a1)), { status: 'scheduled', batch_id: bA });
    assert.equal(s.audits.at(-1).details.action, 'assign');

    // Kapsamdaki ama başka sezona ait sipariş: servis bütünüyle reddeder (mismatch), hiçbiri alınmaz.
    const a3 = await confirmedAt(db, IDS.siteA);
    const other = await confirmedAt(db, IDS.siteA);
    await db.query(`UPDATE release_orders SET season_label='2027-2028' WHERE id=$1`, [other]);
    const mism = await s.act(bA, { action: 'assign', orderIds: [a3, other] });
    assert.equal(mism.status, 409);
    assert.equal(mism.body.error.code, 'mismatch');
    assert.equal((await statusOf(db, a3)).status, 'confirmed');
  } finally { await db.close(); }
});

test('31: partiden çıkarma — yanlış parti adresinden başka partinin siparişi çıkarılamaz', async () => {
  const db = await createDb();
  try {
    const bA = await batchAt(db, IDS.land);
    const bB = await batchAt(db, IDS.land);
    const inB = await confirmedAt(db, IDS.land);
    await scheduleInto(db, inB, bB);
    const ops = api(db, IDS.operations, OPS);
    const wrong = await ops.act(bA, { action: 'unassign', orderId: inB });
    assert.equal(wrong.status, 409);
    assert.deepEqual(wrong.body.error.details, { reason: 'order_not_in_batch' });
    assert.deepEqual(ops.serviceCalls(), []);
    assert.deepEqual(await statusOf(db, inB), { status: 'scheduled', batch_id: bB });
    const right = await ops.act(bB, { action: 'unassign', orderId: inB });
    assert.equal(right.status, 200, JSON.stringify(right.body));
    assert.deepEqual(await statusOf(db, inB), { status: 'confirmed', batch_id: null });
  } finally { await db.close(); }
});

test('31: bırakma — batches.release + taze MFA; ret durumunda iş, e-posta ve kapasite çağrısı sıfır', async () => {
  const db = await createDb();
  try {
    const b = await batchAt(db, IDS.land);
    const o = await confirmedAt(db, IDS.land);
    await scheduleInto(db, o, b);
    await withMfaEnforced(async () => {
      const aal1 = api(db, IDS.operations, OPS);
      const today = new Date().toISOString().slice(0, 10);
      const denied = await aal1.act(b, { action: 'release', releasedOn: today });
      assert.equal(denied.status, 403);
      assert.equal(denied.body.error.code, 'mfa_required');
      assert.deepEqual(denied.body.error.details.permissions, ['batches.release']);
      assert.deepEqual(aal1.serviceCalls(), []); assert.deepEqual(aal1.afters, []); assert.deepEqual(aal1.writes, []);
      assert.equal((await statusOf(db, o)).status, 'scheduled');

      const fresh = api(db, IDS.operations, { ...OPS, assurance: aal2(2) });
      const r = await fresh.act(b, { action: 'release', releasedOn: today });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body.data, { released: 1, skipped: [] });
      assert.equal(fresh.afters.length, 1, 'sertifika e-postası yanıt sonrasına bırakıldı');
      assert.deepEqual(fresh.serviceCalls(), ['completeRelease', 'issueCertificate']);
      assert.equal((await statusOf(db, o)).status, 'released');
      assert.deepEqual(fresh.writes.filter((w) => w.rpc).map((w) => w.rpc), ['commit_reserved_capacity']);
    });
  } finally { await db.close(); }
});

test('31: video yayını — monitoring.publish + MFA; operasyon şablonunda yok', async () => {
  const db = await createDb();
  try {
    const b = await batchAt(db, IDS.land);
    await db.query(`UPDATE release_batches SET released_on=current_date - 1 WHERE id=$1`, [b]);
    const ops = api(db, IDS.operations, OPS);
    const denied = await ops.act(b, { action: 'publish_video', videoUrl: 'https://youtu.be/abcdefghijk' });
    assert.equal(denied.status, 403);
    assert.deepEqual(denied.body.error.details.permissions, ['monitoring.publish']);
    await withMfaEnforced(async () => {
      const ownerAal1 = api(db, IDS.superAdmin, OWNER);
      assert.equal((await ownerAal1.act(b, { action: 'publish_video', videoUrl: 'https://youtu.be/abcdefghijk' })).body.error.code, 'mfa_required');
      const owner = api(db, IDS.superAdmin, { ...OWNER, assurance: aal2(1) });
      const r = await owner.act(b, { action: 'publish_video', videoUrl: 'https://youtu.be/abcdefghijk' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.data, { published: true, firstPublication: true });
      assert.equal(owner.afters.length, 1);
      assert.deepEqual([...ops.serviceCalls(), ...ownerAal1.serviceCalls()], []);
    });
  } finally { await db.close(); }
});

test('31: silme — boş parti batches.plan ile; dolu parti servis kuralıyla 409; plan izni olmayan 403', async () => {
  const db = await createDb();
  try {
    const empty = await batchAt(db, IDS.land);
    const used = await batchAt(db, IDS.land);
    await scheduleInto(db, await confirmedAt(db, IDS.land), used);
    await customRole(db, 'parti_atama', ['batches.read', 'batches.assign']);
    await staffWithRole(db, USERS.scoped, 'parti_atama');
    const assignOnly = api(db, USERS.scoped);
    assert.equal((await assignOnly.remove(empty)).status, 403);
    assert.deepEqual(assignOnly.serviceCalls(), []);
    const ops = api(db, IDS.operations, OPS);
    const full = await ops.remove(used);
    assert.equal(full.status, 409);
    assert.equal(full.body.error.code, 'invalid_state');
    const ok = await ops.remove(empty);
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.data, { deleted: true, id: empty });
  } finally { await db.close(); }
});

test('31: hatalar — veri kaynağı 503 (sahte boş liste yok); geçersiz kimlik ve gövde 400', async () => {
  const db = await createDb();
  try {
    const b = await batchAt(db, IDS.land);
    for (const table of ['release_batches', 'lands', 'release_orders']) {
      assert.equal((await api(db, IDS.operations, { ...OPS, failTables: [table] }).list()).status, 503, `${table} liste`);
    }
    assert.equal((await api(db, IDS.operations, { ...OPS, failTables: ['release_orders'] }).detail(b)).status, 503);
    const ops = api(db, IDS.operations, OPS);
    assert.equal((await ops.detail('x')).status, 400);
    assert.equal((await ops.act(b, { action: 'uydur' })).status, 400);
    assert.equal((await ops.act(b, { action: 'assign', orderIds: [] })).status, 400);
    assert.equal((await ops.create({ landId: IDS.land, seasonLabel: '2026' })).status, 400);
    assert.deepEqual(ops.serviceCalls(), []);
  } finally { await db.close(); }
});
