// 27 §4: izinli sipariş okuma DTO'su. Gerçek izin kapısı + gerçek route + gerçek servis/DTO + PGlite.
// Yalnız oturum, MFA durumu ve zamanlanmış iş fonksiyonları taklit. Her sorgu kaydedilir: yetkisiz
// kaynağın hiç sorgulanmadığı doğrudan ölçülür.
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { loadSource as load } from './load-source.mjs';
import { createDb, IDS } from './pglite-db.mjs';
import { customRole, envelope, gate, orderAt, orderClient, readModules, request, staffWithRole, USERS } from './order-admin-helpers.mjs';

const mods = readModules();
const OPS = { role: 'OPERATIONS' };
const FIN = { role: 'FINANCE' };
const OWNER = { role: 'SUPER_ADMIN' };

function routes(db, who, { role = 'NONE', failTables = [] } = {}) {
  const log = [];
  const jobs = [];
  const client = () => orderClient(db, { failTables, log });
  const shared = {
    '@/lib/supabase/server': { createServiceRoleClient: client },
    '@/lib/admin/permissions': gate({ db, userId: who, role }),
    '@/lib/api/envelope': envelope,
    '@/lib/orders/admin-access': mods.access,
  };
  const list = load('app/api/admin/release-orders/route.ts', {
    ...shared,
    '@/lib/orders/admin-actions': { confirmDueOrders: async () => { jobs.push('confirm'); return 0; } },
    '@/lib/orders/create': { expireStaleOrders: async () => { jobs.push('expire'); return 0; } },
    '@/lib/orders/admin-read': mods.read,
    '@/lib/orders/types': mods.types,
  });
  const detail = load('app/api/admin/release-orders/[id]/route.ts', {
    ...shared,
    'next/server': { after: () => {} },
    zod: { z },
    '@/lib/admin-auth': { requireAdmin: async () => ({ admin: null, error: { status: 401 } }), getClientIP: () => '127.0.0.1' },
    '@/lib/admin/audit': {},
    '@/lib/orders/admin-actions': {},
    '@/lib/orders/admin-detail': mods.detail,
    '@/lib/orders/admin-mails': {},
    '@/lib/orders/store': {},
  });
  return {
    log, jobs,
    list: async (query = {}) => (await list.GET(request({ query }))),
    detail: async (id) => (await detail.GET(request(), { params: Promise.resolve({ id }) })),
  };
}

/** Üç sahada dört sipariş; hassas veri, olay, iade, fatura ve belge kayıtlarıyla. */
async function seed(db) {
  const o1 = await orderAt(db, IDS.land);                       // withdrawal_requested
  const o2 = await orderAt(db, IDS.land, { status: 'paid' });
  const o3 = await orderAt(db, IDS.siteA, { status: 'paid' });
  const o4 = await orderAt(db, IDS.siteB, { status: 'paid' });
  const person = (id, first, last, email, phone, site) => db.query(
    `UPDATE release_orders SET buyer_first_name=$2, buyer_last_name=$3, buyer_email=$4, buyer_phone=$5,
       site_snapshot=jsonb_build_object('name', $6::text, 'province', 'Ankara', 'district', 'Kazan') WHERE id=$1`,
    [id, first, last, email, phone, site]);
  await person(o1, 'Ayşe', 'Ana', 'ayse@example.invalid', '5550001111', 'Ana Saha');
  await person(o2, 'Deniz', 'Ana', 'deniz@example.invalid', '5550002222', 'Ana Saha');
  await person(o3, 'Bora', 'Antalya', 'bora@example.invalid', '5550003333', 'Antalya Sahası');
  await person(o4, 'Cem', 'Mugla', 'cem@example.invalid', '5550004444', 'Muğla Sahası');
  await db.query(`UPDATE release_orders SET
      invoice='{"type":"individual","tckn":"12345678901","address":{"province":"06","district":"Çankaya","line":"Deneme sk. 1","postalCode":"06000"}}'::jsonb,
      consents='{"contract":{"granted":true,"at":"2026-09-01T10:00:00Z","version":"2026-09.5"},"marketing":{"granted":false,"at":"2026-09-01T10:00:00Z","version":"2026-09.5"}}'::jsonb,
      certificate_code='SG-ABCD-2345', admin_note='İç not',
      payment_meta='{"ipHash":"GIZLI-IP","userAgent":"GIZLI-UA","capacityHeld":true}'::jsonb
    WHERE id=$1`, [o1]);
  for (const id of [o3, o4]) await db.query(`UPDATE release_orders SET payment_meta='{"capacityHeld":false}'::jsonb WHERE id=$1`, [id]);
  const ev = (id, type, actor, data) => db.query(`INSERT INTO order_events(order_id, type, actor, data) VALUES ($1,$2,$3,$4::jsonb)`, [id, type, actor, JSON.stringify(data)]);
  await ev(o1, 'consent_recorded', 'customer', { consents: { contract: { granted: true }, marketing: { granted: false } }, ipHash: 'GIZLI-IP', userAgent: 'GIZLI-UA' });
  await ev(o1, 'payment_succeeded', 'system', { provider: 'mock', paymentId: 'PAY-A', paidKurus: 20000, tokenHash: 'GIZLI-TOKEN' });
  await ev(o1, 'payment_succeeded', 'system', { duplicate: true, provider: 'mock', paymentId: 'PAY-DUP', paidKurus: 20000, tokenHash: 'GIZLI-TOKEN' });
  await ev(o1, 'withdrawal_requested', 'customer', { channel: 'web', refundDueOn: '2026-10-10', note: 'Müşteri notu', ipHash: 'GIZLI-IP', userAgent: 'GIZLI-UA' });
  await ev(o1, 'certificate_issued', 'system', { code: 'SG-ABCD-2345' });
  await ev(o1, 'documents_generated', 'system', { version: '2026-09.5', documents: [{ kind: 'contract', title: 'Sözleşme', blocks: [{ type: 'paragraph', text: 'GIZLI-BLOK' }] }] });
  await ev(o4, 'payment_succeeded', 'system', { duplicate: true, provider: 'mock', paymentId: 'PAY-DUP-B', paidKurus: 20000 });
  await db.query(`INSERT INTO order_refunds(order_id, amount_kurus, reason, status, requested_by) VALUES ($1, 20000, 'withdrawal', 'pending', 'customer')`, [o1]);
  await db.query(`INSERT INTO order_refunds(order_id, amount_kurus, reason, status, requested_by) VALUES ($1, 20000, 'withdrawal', 'failed', 'customer')`, [o4]);
  await db.query(`INSERT INTO order_invoices(order_id, kind, status) VALUES ($1, 'sale', 'pending')`, [o2]);
  await db.query(`INSERT INTO order_documents(order_id, kind, title, html, sha256, template_version, locale) VALUES ($1,'contract','Sözleşme','<p>x</p>',repeat('b',64),'2026-09.5','tr')`, [o1]);
  return { o1, o2, o3, o4 };
}

const SECRETS = ['GIZLI-IP', 'GIZLI-UA', 'GIZLI-TOKEN', 'GIZLI-BLOK', 'ipHash', 'userAgent', 'tokenHash', 'payment_meta'];
const noSecrets = (body, label) => { const s = JSON.stringify(body); for (const x of SECRETS) assert.ok(!s.includes(x), `${label}: ${x} sızmamalı`); };
const touched = (log, table) => log.some((e) => e.table === table);
const selected = (log, column) => log.some((e) => e.table === 'release_orders' && String(e.cols).split(',').map((c) => c.trim()).includes(column));

test('27 §4: yalnız orders.read (operasyon) — hassas alan yok, kaynakları sorgulanmaz', async () => {
  const db = await createDb();
  try {
    const { o1 } = await seed(db);
    const api = routes(db, IDS.operations, OPS);
    const list = await api.list();
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const data = list.body.data;
    assert.deepEqual(data.groups, ['order']);
    assert.deepEqual(Object.keys(data.alerts), ['capacity']);
    assert.equal(data.search.contactFields, false);
    for (const item of data.items) assert.ok(!('contact' in item) && !('finance' in item), 'listede e-posta ve tutar yok');
    assert.equal(selected(api.log, 'buyer_email') || selected(api.log, 'total_kurus'), false, 'iletişim/tutar kolonu seçilmedi');
    assert.equal(touched(api.log, 'order_refunds') || touched(api.log, 'order_invoices') || touched(api.log, 'order_events'), false,
      'finans/fatura uyarı kaynakları sorgulanmadı');

    const log = routes(db, IDS.operations, OPS);
    const detail = await log.detail(o1);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    const d = detail.body.data;
    assert.deepEqual(d.groups, ['order']);
    for (const key of ['contact', 'tax', 'finance', 'invoices', 'legal', 'certificate']) assert.ok(!(key in d), `${key} yok`);
    for (const table of ['order_documents', 'order_refunds', 'order_invoices']) assert.equal(touched(log.log, table), false, `${table} sorgulanmadı`);
    assert.equal(log.log.filter((e) => e.table === 'release_orders').length, 1, 'ek kolon sorgusu yapılmadı');
    assert.equal(d.order.adminNote, 'İç not');
    assert.equal(d.order.capacity.held, true);
    const payment = d.events.find((e) => e.type === 'payment_succeeded');
    assert.deepEqual(payment.data, {}, 'ödeme olayı verisi finans izni olmadan boş');
    const withdrawal = d.events.find((e) => e.type === 'withdrawal_requested');
    assert.deepEqual(withdrawal.data, { channel: 'web', refundDueOn: '2026-10-10' }, 'müşteri notu iletişim grubunda');
    assert.deepEqual(d.events.find((e) => e.type === 'documents_generated').data, { version: '2026-09.5', kinds: ['contract'] });
    assert.deepEqual(d.capabilities, { note: true, cancel: false, refund: false, refundDuplicate: false, invoiceQueue: false, invoiceIssue: false, reserveCapacity: false, documents: false });
    noSecrets(list.body, 'liste'); noSecrets(detail.body, 'ayrıntı');
  } finally { await db.close(); }
});

test('27 §4: finans şablonu — iletişim, vergi, finans, fatura, hukuki gruplar; özel sertifika yok', async () => {
  const db = await createDb();
  try {
    const { o1 } = await seed(db);
    const api = routes(db, IDS.finance, FIN);
    const list = (await api.list()).body.data;
    assert.deepEqual(list.groups, ['order', 'contact', 'finance']);
    assert.equal(list.search.contactFields, true);
    assert.deepEqual(list.alerts, { capacity: 2, refundPending: 2, duplicate: 2, invoicePending: 1 });
    const ayse = list.items.find((i) => i.id === o1);
    assert.equal(ayse.contact.email, 'ayse@example.invalid');
    assert.equal(ayse.finance.totalKurus, 20000);

    const d = (await api.detail(o1)).body.data;
    assert.deepEqual(d.groups.sort(), ['contact', 'finance', 'invoices', 'legal', 'order', 'tax']);
    assert.ok(!('certificate' in d), 'finans şablonunda certificates.read_private yok');
    assert.equal(d.tax.tckn, '12345678901');
    assert.equal(d.contact.invoiceAddress.district, 'Çankaya');
    assert.equal(d.finance.refunds.length, 1);
    assert.deepEqual(d.finance.duplicates, [{ paymentId: 'PAY-DUP', paidKurus: 20000, refunded: false }]);
    assert.deepEqual(d.legal.consents.contract.granted, true);
    assert.equal(d.legal.documents[0].kind, 'contract');
    assert.deepEqual(d.events.find((e) => e.type === 'consent_recorded').data, { consents: ['contract'] });
    assert.deepEqual(d.events.find((e) => e.type === 'certificate_issued').data, {}, 'sertifika kodu olayda da gizli');
    assert.equal(d.capabilities.invoiceQueue, true);
    assert.equal(d.capabilities.refund, true);
    assert.equal(d.capabilities.documents, true);
    noSecrets(d, 'finans ayrıntısı');

    const owner = (await routes(db, IDS.superAdmin, OWNER).detail(o1)).body.data;
    assert.equal(owner.certificate.code, 'SG-ABCD-2345');
    assert.deepEqual(owner.events.find((e) => e.type === 'certificate_issued').data, { code: 'SG-ABCD-2345' });
    noSecrets(owner, 'sahip ayrıntısı');
  } finally { await db.close(); }
});

test('27 §4: saha kapsamı — liste, toplam, sayaç, uyarı, arama ve ayrıntı yalnız kapsamdaki sahada', async () => {
  const db = await createDb();
  try {
    const { o1, o3, o4 } = await seed(db);
    await customRole(db, 'antalya_okur', ['orders.read', 'customers.contact.read', 'finance.read']);
    await staffWithRole(db, USERS.scoped, 'antalya_okur', { kind: 'sites', siteIds: [IDS.siteA] });
    const api = routes(db, USERS.scoped);
    const list = (await api.list()).body.data;
    assert.deepEqual(list.scope, { kind: 'sites', siteIds: [IDS.siteA] });
    assert.deepEqual(list.items.map((i) => i.id), [o3]);
    assert.equal(list.total, 1);
    assert.equal(Object.values(list.counts).reduce((a, b) => a + b, 0), 1, 'durum sayaçları kapsam dışını saymaz');
    assert.equal(list.alerts.capacity, 1, 'kapasite uyarısı yalnız Antalya');
    assert.equal(list.alerts.refundPending, 0, 'başka sahanın iadesi sayılmaz');
    assert.equal(list.alerts.duplicate, 0, 'başka sahanın çift tahsilatı sayılmaz');
    assert.deepEqual(api.jobs, [], 'dar kapsamlı okuyucu küresel iş tetiklemez');

    assert.deepEqual((await api.list({ q: 'Mugla' })).body.data.items, [], 'başka sahadaki adla arama sonuç vermez');
    assert.deepEqual((await api.list({ q: 'cem@example' })).body.data.items, [], 'başka sahadaki e-postayla arama sonuç vermez');
    assert.deepEqual((await api.list({ flag: 'capacity' })).body.data.items.map((i) => i.id), [o3]);
    assert.deepEqual((await api.list({ flag: 'refund_pending' })).body.data.items, []);

    for (const id of [o1, o4]) {
      const r = await api.detail(id);
      assert.equal(r.status, 404, 'kapsam dışı kayıt olmayan kayıtla aynı');
      assert.equal(r.body.error.code, 'not_found');
    }
    assert.equal((await api.detail(o3)).status, 200);

    const full = routes(db, IDS.superAdmin, OWNER);
    await full.list();
    assert.deepEqual(full.jobs.sort(), ['confirm', 'expire'], 'tam kapsamlı okuyucuda tembel işler bugünkü gibi çalışır');
  } finally { await db.close(); }
});

test('27 §4.3: iletişim izni okuma kapsamını tamamen kapsamıyorsa e-posta/telefonla arama kapalı ve alan satır bazında', async () => {
  const db = await createDb();
  try {
    const { o1, o3 } = await seed(db);
    await customRole(db, 'genel_okur', ['orders.read']);
    await customRole(db, 'antalya_iletisim', ['customers.contact.read']);
    await staffWithRole(db, USERS.scoped, 'genel_okur');
    const staff = await db.query(`SELECT id FROM admin_users WHERE user_id=$1`, [USERS.scoped]);
    await db.query(`SELECT assign_admin_role($1,$2,'antalya_iletisim',$3::jsonb,NULL,'test')`, [IDS.superAdmin, staff.rows[0].id, JSON.stringify({ kind: 'sites', siteIds: [IDS.siteA] })]);
    const api = routes(db, USERS.scoped);
    const list = (await api.list()).body.data;
    assert.equal(list.search.contactFields, false);
    assert.equal(list.items.find((i) => i.id === o3).contact.email, 'bora@example.invalid', 'Antalya satırında e-posta var');
    assert.ok(!('contact' in list.items.find((i) => i.id === o1)), 'Ana Saha satırında e-posta yok');
    assert.deepEqual((await api.list({ q: 'ayse@example' })).body.data.items, [], 'kapsam dışı e-postayla arama sonuçtan çıkarılamaz');
    assert.deepEqual((await api.list({ q: 'bora@example' })).body.data.items, [], 'kısmi kapsamda e-posta araması hiç çalışmaz');
    const d3 = (await api.detail(o3)).body.data;
    assert.equal(d3.contact.email, 'bora@example.invalid');
    const d1 = (await api.detail(o1)).body.data;
    assert.ok(!('contact' in d1));
    assert.deepEqual(d1.events.find((e) => e.type === 'withdrawal_requested').data, { channel: 'web', refundDueOn: '2026-10-10' });
  } finally { await db.close(); }
});

test('27 §4.3/§5: süzgeç izni, yalnız assigned kapsamı, geçersiz sorgu ve alt sorgu hatası', async () => {
  const db = await createDb();
  try {
    const { o1 } = await seed(db);
    const ops = routes(db, IDS.operations, OPS);
    for (const flag of ['refund_pending', 'duplicate', 'invoice_pending']) {
      const r = await ops.list({ flag });
      assert.equal(r.status, 403, flag);
      assert.equal(r.body.error.code, 'forbidden');
      assert.equal(r.body.error.details.flag, flag);
    }
    assert.equal((await ops.list({ status: 'uydurma' })).body.error.code, 'invalid_query');
    assert.equal((await ops.list({ test: 'belki' })).body.error.details.param, 'test');

    await customRole(db, 'atanmis_okur', ['orders.read']);
    await staffWithRole(db, USERS.scoped, 'atanmis_okur', { kind: 'assigned' });
    const assigned = routes(db, USERS.scoped);
    for (const r of [await assigned.list(), await assigned.detail(o1)]) {
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, 'scope_unsupported', 'atanmış iş modeli yok: all’a yükseltilmez');
    }

    for (const table of ['order_refunds', 'order_events', 'release_orders']) {
      const r = await routes(db, IDS.finance, { ...FIN, failTables: [table] }).list();
      assert.equal(r.status, 503, `${table} hatası sahte 0 değil 503`);
      assert.equal(r.body.error.code, 'unavailable');
    }
    for (const table of ['order_events', 'order_refunds', 'order_documents']) {
      assert.equal((await routes(db, IDS.finance, { ...FIN, failTables: [table] }).detail(o1)).status, 503, `${table} ayrıntıda 503`);
    }
    assert.equal((await ops.detail('gecersiz')).body.error.code, 'invalid_id');
    const outsider = routes(db, '10000000-0000-0000-0000-0000000000ff');
    assert.equal((await outsider.list()).status, 403, 'izni olmayan kişi');
  } finally { await db.close(); }
});

test('27 §4.4: olay beyaz listesi — bilinmeyen tür ve anahtar hiçbir izinle dönmez', () => {
  const all = new Set(['order', 'contact', 'tax', 'finance', 'invoices', 'legal', 'certificate']);
  const e = mods.dto.sanitizeEvent({ id: 7, type: 'payment_failed', actor: 'admin:10000000-0000-0000-0000-000000000001', created_at: '2026-09-29T10:00:00Z',
    data: { reason: 'amount_mismatch', paymentId: 'P', tokenHash: 'GIZLI-TOKEN', nested: { a: 1 }, big: 'x'.repeat(5000) } }, all);
  assert.deepEqual(Object.keys(e.data).sort(), ['paymentId', 'reason']);
  assert.deepEqual(e.actor, { kind: 'admin', adminId: '10000000-0000-0000-0000-000000000001' });
  assert.deepEqual(mods.dto.sanitizeEvent({ id: 1, type: 'uydurma_olay', actor: 'system', data: { a: 1 } }, all).data, {});
  const note = mods.dto.sanitizeEvent({ id: 2, type: 'admin_note', actor: 'system', data: { note: 'y'.repeat(5000) } }, new Set(['order']));
  assert.equal(note.data.note.length, 1000, 'uzun metin kırpılır');
});
