// 27 §4: izinli sipariş okuma DTO'su. Gerçek izin kapısı + gerçek route + gerçek servis/DTO + PGlite.
// Yalnız oturum, MFA durumu ve zamanlanmış iş fonksiyonları taklit. Her sorgu kaydedilir: yetkisiz
// kaynağın hiç sorgulanmadığı doğrudan ölçülür.
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { loadSource as load } from './load-source.mjs';
import { createDb, IDS } from './pglite-db.mjs';
import { readFile } from 'node:fs/promises';
import { AAL1, aal2, bulkOrders, customRole, envelope, gate, orderAt, orderClient, readModules, request, staffWithRole, USERS, withMfaEnforced } from './order-admin-helpers.mjs';

const mods = readModules();
const OPS = { role: 'OPERATIONS' };
const FIN = { role: 'FINANCE' };
const OWNER = { role: 'SUPER_ADMIN' };

function routes(db, who, { role = 'NONE', failTables = [], assurance = AAL1 } = {}) {
  const log = [];
  const writes = [];
  const client = () => orderClient(db, { failTables, log, writes });
  const shared = {
    '@/lib/supabase/server': { createServiceRoleClient: client },
    '@/lib/admin/permissions': gate({ db, userId: who, role, assurance }),
    '@/lib/api/envelope': envelope,
    '@/lib/orders/admin-access': mods.access,
  };
  // Liste route'u iş fonksiyonlarını (admin-actions, create) İÇE AKTARMAMALI: taklitleri bilerek verilmedi;
  // içe aktarırsa yükleme "Unmocked dependency" ile başarısız olur (77-2).
  const list = load('app/api/admin/release-orders/route.ts', {
    ...shared,
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
    log, writes,
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
    assert.deepEqual(list.alerts, { capacity: 2, paymentReview: 0, refundPending: 2, duplicate: 2, invoicePending: 1 });
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

// ── #77 inceleme düzeltmeleri (Astra 77-1 … 77-5) ───────────────────────────

test('77-1: MFA zorlaması açıkken tazelenmemiş oturumda vergi, hukuki kayıt ve özel sertifika sorgulanmaz ve dönmez', async () => {
  const db = await createDb();
  try {
    const { o1 } = await seed(db);
    const aal1Enrolled = { aal: 'aal1', verifiedAt: null, enrolled: true };
    await withMfaEnforced(async () => {
      for (const [assurance, reason] of [[AAL1, 'enrollment'], [aal1Enrolled, 'challenge'], [aal2(20), 'stale']]) {
        const api = routes(db, IDS.superAdmin, { ...OWNER, assurance });
        const r = await api.detail(o1);
        assert.equal(r.status, 200, 'hassas olmayan özet kullanılabilir kalır');
        const d = r.body.data;
        assert.deepEqual([...d.mfaRequiredGroups].sort(), ['certificate', 'legal', 'tax']);
        assert.deepEqual(d.mfa, { enrolled: assurance.enrolled, reason, freshnessMinutes: 15 });
        for (const g of ['tax', 'legal', 'certificate']) assert.ok(!(g in d), `${g} dönmez`);
        assert.ok(d.contact && d.finance && d.invoices, 'MFA gerektirmeyen gruplar açık');
        assert.equal(touched(api.log, 'order_documents'), false, 'hukuki belge tablosu sorgulanmaz');
        const columns = api.log.filter((e) => e.table === 'release_orders').map((e) => String(e.cols)).join(',');
        for (const col of ['invoice->>tckn', 'invoice->>taxId', 'consents', 'certificate_code', 'documents_version']) {
          assert.ok(!columns.includes(col), `${col} sorgulanmaz`);
        }
        assert.ok(!/(^|[,\\s])invoice(\\s*,|\\s*$)/.test(columns), 'fatura JSON’u bütün hâlinde okunmaz');
        assert.deepEqual(d.events.find((e) => e.type === 'certificate_issued').data, {}, 'olayda sertifika kodu yok');
        assert.deepEqual(d.events.find((e) => e.type === 'consent_recorded').data, {}, 'olayda onaylar yok');
        const text = JSON.stringify(d);
        assert.ok(!text.includes('12345678901') && !text.includes('SG-ABCD-2345'), 'vergi no ve sertifika kodu yanıtta yok');
        noSecrets(d, 'MFA kapalı ayrıntı');
      }
      const fresh = (await routes(db, IDS.superAdmin, { ...OWNER, assurance: aal2(1) }).detail(o1)).body.data;
      assert.deepEqual(fresh.mfaRequiredGroups, []);
      assert.equal(fresh.mfa, null);
      assert.equal(fresh.tax.tckn, '12345678901');
      assert.equal(fresh.certificate.code, 'SG-ABCD-2345');
      assert.equal(fresh.legal.consents.contract.granted, true);
      assert.equal((await routes(db, IDS.superAdmin, { ...OWNER, assurance: AAL1 }).list()).status, 200, 'liste MFA grubu taşımaz');
    });
    const off = (await routes(db, IDS.superAdmin, { ...OWNER, assurance: AAL1 }).detail(o1)).body.data;
    assert.deepEqual(off.mfaRequiredGroups, [], 'zorlama kapalıyken politika değişmedi');
    assert.equal(off.tax.tckn, '12345678901');
  } finally { await db.close(); }
});

test('77-1: MFA kapısı saha kapsamı kesişimini korur — izin yoksa "doğrulama gerekli" de denmez', async () => {
  const db = await createDb();
  try {
    const { o1, o3 } = await seed(db);
    // Okuma bütün kayıtlarda; vergi izni yalnız Antalya'da (ayrı, saha kapsamlı rol).
    await customRole(db, 'tum_okur', ['orders.read']);
    await customRole(db, 'antalya_vergi', ['customers.tax.read']);
    await staffWithRole(db, USERS.scoped, 'tum_okur');
    const staff = (await db.query(`SELECT id FROM admin_users WHERE user_id=$1`, [USERS.scoped])).rows[0].id;
    await db.query(`SELECT assign_admin_role($1,$2,'antalya_vergi',$3::jsonb,NULL,'test')`, [IDS.superAdmin, staff, JSON.stringify({ kind: 'sites', siteIds: [IDS.siteA] })]);
    await withMfaEnforced(async () => {
      const stale = routes(db, USERS.scoped, { assurance: aal2(30) });
      assert.deepEqual((await stale.detail(o3)).body.data.mfaRequiredGroups, ['tax'], 'Antalya: izin var, doğrulama gerekli');
      assert.deepEqual((await stale.detail(o1)).body.data.mfaRequiredGroups, [], 'Ana Saha: izin yok, doğrulama da istenmez');
      const fresh = routes(db, USERS.scoped, { assurance: aal2(1) });
      assert.ok('tax' in (await fresh.detail(o3)).body.data);
      assert.ok(!('tax' in (await fresh.detail(o1)).body.data), 'taze oturum kapsam dışını açmaz');
    });
  } finally { await db.close(); }
});

test('77-2: liste ve ayrıntı GET’i hiçbir iş, RPC ya da yazma çalıştırmaz — tam kapsamlı okuyucu dahil', async () => {
  const db = await createDb();
  try {
    const { o1 } = await seed(db);
    for (const [who, opts] of [[IDS.superAdmin, OWNER], [IDS.operations, OPS], [IDS.finance, FIN]]) {
      const api = routes(db, who, opts);
      for (const query of [{}, { flag: 'capacity' }, { q: 'Ayşe' }, { status: 'paid', test: 'hide' }]) assert.equal((await api.list(query)).status, 200);
      assert.equal((await api.detail(o1)).status, 200);
      assert.deepEqual(api.writes, [], `${opts.role}: yazma ya da RPC yok`);
    }
    const source = await readFile(new URL('../../app/api/admin/release-orders/route.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /expireStaleOrders|confirmDueOrders|lib\/orders\/admin-actions|lib\/orders\/create/, 'liste route’u iş fonksiyonlarını içe aktarmaz');
  } finally { await db.close(); }
});

test('77-3: iletişim ve finans alanları yalnız grubun saha kapsamındaki kayıtlar için ayrı sorgulanır', async () => {
  const db = await createDb();
  try {
    const { o3 } = await seed(db);
    await customRole(db, 'genel_okur', ['orders.read']);
    await customRole(db, 'antalya_iletisim_finans', ['customers.contact.read', 'finance.read']);
    await staffWithRole(db, USERS.scoped, 'genel_okur');
    const staff = (await db.query(`SELECT id FROM admin_users WHERE user_id=$1`, [USERS.scoped])).rows[0].id;
    await db.query(`SELECT assign_admin_role($1,$2,'antalya_iletisim_finans',$3::jsonb,NULL,'test')`, [IDS.superAdmin, staff, JSON.stringify({ kind: 'sites', siteIds: [IDS.siteA] })]);
    const api = routes(db, USERS.scoped);
    const list = (await api.list()).body.data;
    assert.equal(list.total, 4, 'toplam ve sayfalama değişmez');
    assert.deepEqual(list.items.filter((i) => 'contact' in i).map((i) => i.id), [o3]);
    assert.deepEqual(list.items.filter((i) => 'finance' in i).map((i) => i.id), [o3]);

    const main = api.log.find((e) => e.table === 'release_orders' && String(e.cols).includes('order_no') && !e.head);
    assert.ok(!/buyer_email|total_kurus|payment_provider/.test(String(main.cols)), 'ana sorgu iletişim/finans kolonu seçmez');
    for (const cols of ['id, buyer_email', 'id, total_kurus, payment_provider']) {
      const q = api.log.find((e) => e.table === 'release_orders' && String(e.cols) === cols);
      assert.ok(q, `${cols} ayrı sorgusu var`);
      assert.match(q.where, /t\.land_id::text = ANY/, `${cols}: saha kapsamı sorguda`);
      assert.ok(q.params.some((p) => Array.isArray(p) && p.length === 1 && p[0] === IDS.siteA), `${cols}: yalnız Antalya`);
      assert.ok(q.params.some((p) => Array.isArray(p) && p.length === list.items.length), `${cols}: yalnız sayfadaki kimlikler`);
    }
  } finally { await db.close(); }
});

test('77-4: süzgeç ve uyarılar kırpılmaz — 2011 kapasite, 501 iade, 149 çift tahsilat; son sayfalar ve saha kesişimi', async () => {
  const db = await createDb();
  try {
    await bulkOrders(db, IDS.land, 1, 2001);
    await bulkOrders(db, IDS.siteB, 3001, 3010);
    await db.query(`INSERT INTO order_refunds(order_id, amount_kurus, reason, status, requested_by)
      SELECT id, 1000, 'withdrawal', 'pending', 'customer' FROM release_orders WHERE land_id=$1 ORDER BY created_at DESC LIMIT 501`, [IDS.land]);
    await db.query(`INSERT INTO order_events(order_id, type, actor, data)
      SELECT id, 'payment_succeeded', 'system', jsonb_build_object('duplicate', true, 'paymentId', 'DUP-' || id, 'paidKurus', 1000, 'provider', 'mock')
      FROM release_orders WHERE land_id=$1 ORDER BY created_at DESC LIMIT 150`, [IDS.land]);
    const refunded = (await db.query(`SELECT order_id FROM order_events WHERE type='payment_succeeded' ORDER BY id LIMIT 1`)).rows[0].order_id;
    await db.query(`INSERT INTO order_events(order_id, type, actor, data) VALUES ($1, 'refund_succeeded', 'system', jsonb_build_object('duplicate', true, 'paymentId', $2::text, 'amountKurus', 1000))`, [refunded, `DUP-${refunded}`]);

    const owner = routes(db, IDS.superAdmin, OWNER);
    const all = (await owner.list()).body.data;
    assert.deepEqual({ capacity: all.alerts.capacity, refundPending: all.alerts.refundPending, duplicate: all.alerts.duplicate }, { capacity: 2011, refundPending: 501, duplicate: 149 });

    const cap = (await owner.list({ flag: 'capacity', pageSize: '100', page: '21' })).body.data;
    assert.equal(cap.total, 2011, '2000 ve 500 sınırı yok');
    assert.equal(cap.items.length, 11, 'son sayfa erişilebilir');
    const ref = (await owner.list({ flag: 'refund_pending', pageSize: '100', page: '6' })).body.data;
    assert.deepEqual([ref.total, ref.items.length], [501, 1]);
    const dupFirst = (await owner.list({ flag: 'duplicate', pageSize: '100', page: '1' })).body.data;
    const dupLast = (await owner.list({ flag: 'duplicate', pageSize: '100', page: '2' })).body.data;
    assert.deepEqual([dupFirst.total, dupFirst.items.length, dupLast.items.length], [149, 100, 49], 'çift tahsilat 100’lük parçaları aşar');
    const seen = new Set([...dupFirst.items, ...dupLast.items].map((i) => i.id));
    assert.equal(seen.size, 149, 'sayfalar tekrarsız');
    assert.ok(!seen.has(refunded), 'iadesi yapılmış çift tahsilat süzgeçte yok');
    const sorted = [...dupFirst.items, ...dupLast.items].map((i) => i.createdAt);
    assert.deepEqual(sorted, [...sorted].sort().reverse(), 'yeniden eskiye sıralı');
    assert.equal((await owner.list({ flag: 'capacity', q: 'Toplu' })).body.data.total, 2011, 'arama ve süzgeç birlikte');

    await customRole(db, 'mugla_finans', ['orders.read', 'finance.read']);
    await staffWithRole(db, USERS.scoped, 'mugla_finans', { kind: 'sites', siteIds: [IDS.siteB] });
    const scoped = routes(db, USERS.scoped);
    const s = (await scoped.list()).body.data;
    assert.deepEqual({ capacity: s.alerts.capacity, refundPending: s.alerts.refundPending, duplicate: s.alerts.duplicate }, { capacity: 10, refundPending: 0, duplicate: 0 });
    assert.equal((await scoped.list({ flag: 'capacity' })).body.data.total, 10);
  } finally { await db.close(); }
});

test('77-5: şirket unvanıyla arama temel okuma kapsamında çalışır, kapsam dışını bulmaz', async () => {
  const db = await createDb();
  try {
    const { o2, o4 } = await seed(db);
    const corporate = (title) => JSON.stringify({ type: 'corporate', companyTitle: title, taxId: '1234567890', taxOffice: 'Kavaklıdere',
      address: { province: '06', district: 'Çankaya', line: 'Deneme sk. 2', postalCode: null }, authorizedPerson: 'Yetkili', mersis: null, kep: null, poNumber: null, eInvoiceUser: false });
    await db.query(`UPDATE release_orders SET buyer_type='corporate', invoice=$2::jsonb WHERE id=$1`, [o2, corporate('Zirve Benzersiz Teknoloji')]);
    await db.query(`UPDATE release_orders SET buyer_type='corporate', invoice=$2::jsonb WHERE id=$1`, [o4, corporate('Zirve Başka Ltd')]);

    const owner = routes(db, IDS.superAdmin, OWNER);
    const exact = (await owner.list({ q: 'Zirve Benzersiz' })).body.data;
    assert.deepEqual(exact.items.map((i) => i.id), [o2]);
    assert.equal(exact.items[0].buyer.companyTitle, 'Zirve Benzersiz Teknoloji');
    assert.equal((await owner.list({ q: 'Zirve' })).body.data.total, 2);
    assert.deepEqual((await routes(db, IDS.operations, OPS).list({ q: 'Zirve Benzersiz' })).body.data.items.map((i) => i.id), [o2],
      'yalnız orders.read yeterli; iletişim/vergi izni gerekmez');

    await customRole(db, 'antalya_okur', ['orders.read']);
    await staffWithRole(db, USERS.scoped, 'antalya_okur', { kind: 'sites', siteIds: [IDS.siteA] });
    assert.equal((await routes(db, USERS.scoped).list({ q: 'Zirve' })).body.data.total, 0, 'kapsam dışı şirket bulunmaz');
    const detail = (await owner.detail(o2)).body.data;
    assert.equal(detail.order.buyer.companyTitle, 'Zirve Benzersiz Teknoloji');
    assert.equal(detail.tax.taxId, '1234567890');
  } finally { await db.close(); }
});


test('payment review flag is projected only for finance readers; raw metadata remains private', async () => {
  const db=await createDb();
  try {
    const {o1,o3}=await seed(db);
    await db.query("UPDATE release_orders SET payment_meta=payment_meta || '{\"paymentReviewRequired\":true,\"providerRaw\":\"GIZLI-TOKEN\"}'::jsonb WHERE id=$1",[o1]);
    const finance=routes(db,IDS.finance,FIN);
    const yes=await finance.detail(o1);
    assert.equal(yes.status,200);
    assert.equal(yes.body.data.finance.payment.reviewRequired,true);
    noSecrets(yes.body,'finance');
    const filtered=await finance.list({flag:'payment_review'});
    assert.equal(filtered.body.data.alerts.paymentReview,1);
    assert.deepEqual(filtered.body.data.items.map(i=>i.id),[o1]);
    await db.query("UPDATE release_orders SET payment_meta=payment_meta || '{\"paymentReviewRequired\":true}'::jsonb WHERE id=$1",[o3]);
    await customRole(db,'review_scoped',['orders.read','finance.read']);
    await staffWithRole(db,USERS.scoped,'review_scoped',{kind:'sites',siteIds:[IDS.siteA]});
    const scoped=await routes(db,USERS.scoped).list({flag:'payment_review'});
    assert.equal(scoped.body.data.alerts.paymentReview,1);
    assert.deepEqual(scoped.body.data.items.map(i=>i.id),[o3]);
    const ops=routes(db,IDS.operations,OPS);
    const hidden=await ops.detail(o1);
    assert.equal(hidden.status,200);
    assert.ok(!('finance' in hidden.body.data));
    assert.equal((await ops.list({flag:'payment_review'})).status,403);
    assert.ok(!('paymentReview' in (await ops.list()).body.data.alerts));
    assert.ok(!selected(ops.log,'payment_review_required:payment_meta->>paymentReviewRequired'));
    assert.ok(!JSON.stringify(hidden.body).includes('reviewRequired'));
    await db.query("UPDATE release_orders SET payment_meta=payment_meta - 'paymentReviewRequired' WHERE id=$1",[o1]);
    assert.equal((await finance.detail(o1)).body.data.finance.payment.reviewRequired,false);
    assert.deepEqual(finance.writes,[]);
    assert.deepEqual(ops.writes,[]);
  } finally {await db.close();}
});
