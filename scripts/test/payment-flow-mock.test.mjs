// Ödeme akışı — taklit sağlayıcıyla sınanabilen senaryolar (35 §2 madde 7). Gerçek lib/orders/payment-flow.ts ve
// lib/orders/store.ts, gerçek 016/019/020 SQL'i (PGlite; reserve_release_capacity dahil); sağlayıcı bellek içi taklit.
// Dönüş ve yeniden ödeme uçları gerçek kaynaktan yüklenir, bağımlılıkları taklittir. iyzico, ağ, e-posta ve canlı
// veritabanı çağrılmaz; korunan dosyalar yalnız OKUNUR (değiştirilmez). Gerçek 3DS, iptal edilen ödeme sayfası ve
// sağlayıcının gerçek yanıt biçimleri ayrıca iyzico deneme ortamı ister (YAYIN-ADIMLARI.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadSource as load } from './load-source.mjs';
import { createDb, insertOrder, one, rows, restClient, IDS } from './pglite-db.mjs';
import { adminClient } from './admin-rest-client.mjs';

process.env.ORDER_LINK_SECRET = 'test-odeme-anahtari';
const server = createRequire(import.meta.url)('next/server');
const State = load('lib/orders/state.ts');
const Schedule = load('lib/orders/schedule.ts');
const Access = await import('../../lib/orders/access.ts');
const INVOICE = { type: 'individual', address: { line: 'Deneme Sk. 1', district: 'Çankaya', province: 'Ankara', postalCode: '06000' } };
const tokenHash = (t) => createHash('sha256').update(t).digest('hex').slice(0, 40);

async function setup({ settings = {} } = {}) {
  const db = await createDb();
  const client = adminClient(db, { rpc: (name, args) => restClient(db).rpc(name, args) });
  const store = load('lib/orders/store.ts', { '@/lib/supabase/server': { createServiceRoleClient: () => client }, './state': State });
  const flow = load('lib/orders/payment-flow.ts', {
    './schedule': Schedule,
    './settings': { getSalesSettings: async () => ({ prepDays: 21, invoiceTiming: 'on_performance', ordersPaused: false, ...settings }) },
    './store': store,
  });
  return { db, client, flow };
}
/** Ödeme oturumu açılmış sipariş (varsayılan awaiting_payment). */
async function openOrder(db, over = {}) {
  const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null, payment_id: null, ...over });
  const token = `oturum-${id.slice(-6)}`;
  await db.query('UPDATE release_orders SET payment_token = $1, invoice = $2::jsonb WHERE id = $3', [token, JSON.stringify(INVOICE), id]);
  const o = await one(db, 'SELECT order_no, total_kurus, quantity FROM release_orders WHERE id = $1', [id]);
  return { id, token, orderNo: o.order_no, total: Number(o.total_kurus), quantity: o.quantity };
}
function provider({ name = 'mock', isTest = false, init, retrieve } = {}) {
  const calls = { init: [], retrieve: [] };
  return {
    name, isTest, calls,
    async init(input) { calls.init.push(input); return init ? init(input) : { ok: true, token: `yeni-oturum-${calls.init.length}`, redirectUrl: '/odeme/deneme/yeni' }; },
    async retrieve(token) { calls.retrieve.push(token); return retrieve(token); },
    async refund() { throw new Error('bu sınamada iade çağrılmaz'); },
  };
}
const success = (o, extra = {}) => ({ ok: true, status: 'success', paymentId: 'PAY-OK-1', paidKurus: o.total, reference: o.orderNo, meta: { last4: '0000' }, ...extra });
const order = (db, id) => one(db, 'SELECT status, paid_at, payment_id, payment_token, withdrawal_deadline, payment_meta FROM release_orders WHERE id = $1', [id]);
const events = (db, id) => rows(db, 'SELECT type, data FROM order_events WHERE order_id = $1 ORDER BY id', [id]);
const reserved = async (db) => (await one(db, 'SELECT reserved_seeds FROM lands WHERE id = $1', [IDS.land])).reserved_seeds;
const quiet = (t) => { t.mock.method(console, 'error', () => {}); t.mock.method(console, 'log', () => {}); };

// ── startPayment ────────────────────────────────────────────────────────────
test('ödeme başlatma: taslak → awaiting_payment; oturum belirteci saklanır, denetim izine yalnız özeti yazılır', async (t) => {
  quiet(t);
  const { db, flow } = await setup();
  try {
    const o = await openOrder(db, { status: 'draft' });
    const p = provider();
    const row = await one(db, 'SELECT * FROM release_orders WHERE id = $1', [o.id]);
    const r = await flow.startPayment(row, p, { origin: 'https://skytechgreen.com', ip: '203.0.113.5' });
    assert.deepEqual(r, { ok: true, redirectUrl: '/odeme/deneme/yeni' });
    assert.deepEqual([p.calls.init[0].amountKurus, p.calls.init[0].orderNo, p.calls.init[0].callbackUrl], [o.total, o.orderNo, 'https://skytechgreen.com/api/payment/donus']);
    const after = await order(db, o.id);
    assert.deepEqual([after.status, after.payment_token], ['awaiting_payment', 'yeni-oturum-1']);
    const ev = await events(db, o.id);
    assert.deepEqual(ev.map((e) => e.type), ['payment_started']);
    assert.equal(ev[0].data.tokenHash, tokenHash('yeni-oturum-1'));
    assert.ok(!JSON.stringify(ev).includes('yeni-oturum-1'), 'belirtecin kendisi olaya yazılmaz');
  } finally { await db.close(); }
});

test('ödeme başlatma: sağlayıcı oturum açamazsa "unavailable"; durum değişmez, hata denetim izinde', async (t) => {
  quiet(t);
  const { db, flow } = await setup();
  try {
    const o = await openOrder(db, { status: 'draft' });
    const row = await one(db, 'SELECT * FROM release_orders WHERE id = $1', [o.id]);
    const r = await flow.startPayment(row, provider({ init: () => ({ ok: false, error: 'sağlayıcı 5xx' }) }), { origin: 'https://skytechgreen.com', ip: null });
    assert.deepEqual(r, { ok: false, error: 'unavailable' });
    assert.equal((await order(db, o.id)).status, 'draft');
    assert.deepEqual((await events(db, o.id)).map((e) => [e.type, e.data.stage]), [['payment_failed', 'init']]);
  } finally { await db.close(); }
});

// ── completePayment ─────────────────────────────────────────────────────────
test('ödeme dönüşü: başarı → paid; cayma son anı ödeme anından; tutar ve referans eşleşti; fatura kuyruğu ayara göre', async (t) => {
  quiet(t);
  for (const invoiceTiming of ['on_performance', 'on_payment']) {
    const { db, client, flow } = await setup({ settings: { invoiceTiming } });
    try {
      const o = await openOrder(db);
      const p = provider({ retrieve: () => success(o) });
      const r = await flow.completePayment(o.token, p, client);
      assert.deepEqual([r.ok, r.outcome], [true, 'paid']);
      const after = await order(db, o.id);
      assert.equal(after.status, 'paid');
      assert.equal(after.payment_id, 'PAY-OK-1');
      assert.ok(after.paid_at && after.withdrawal_deadline && new Date(after.withdrawal_deadline) > new Date(after.paid_at));
      const ev = await events(db, o.id);
      assert.deepEqual(ev.map((e) => e.type), ['payment_succeeded']);
      assert.equal(ev[0].data.tokenHash, tokenHash(o.token));
      const invoices = await rows(db, 'SELECT kind, status, provider FROM order_invoices WHERE order_id = $1', [o.id]);
      assert.deepEqual(invoices, invoiceTiming === 'on_payment' ? [{ kind: 'sale', status: 'pending', provider: 'manual' }] : [], invoiceTiming);
    } finally { await db.close(); }
  }
});

test('ödeme dönüşü: başarısız ödeme → payment_failed; sipariş ödenmiş sayılmaz', async (t) => {
  quiet(t);
  const { db, client, flow } = await setup();
  try {
    const o = await openOrder(db);
    const r = await flow.completePayment(o.token, provider({ retrieve: () => ({ ok: true, status: 'failure', reason: 'kart reddedildi', meta: {} }) }), client);
    assert.deepEqual([r.ok, r.outcome], [true, 'failed']);
    const after = await order(db, o.id);
    assert.deepEqual([after.status, after.paid_at], ['payment_failed', null]);
    assert.deepEqual((await events(db, o.id)).map((e) => [e.type, e.data.reason]), [['payment_failed', 'kart reddedildi']]);
  } finally { await db.close(); }
});

test('ödeme dönüşü: aynı dönüş iki kez gelirse ikincisi "already_paid"; sağlayıcı yeniden sorgulanmaz, olay tek', async (t) => {
  quiet(t);
  const { db, client, flow } = await setup();
  try {
    const o = await openOrder(db);
    const p = provider({ retrieve: () => success(o) });
    assert.equal((await flow.completePayment(o.token, p, client)).outcome, 'paid');
    const again = await flow.completePayment(o.token, p, client);
    assert.deepEqual([again.ok, again.outcome], [true, 'already_paid']);
    assert.equal(p.calls.retrieve.length, 1, 'ikinci dönüşte sağlayıcı sorgusu yok');
    assert.deepEqual((await events(db, o.id)).map((e) => e.type), ['payment_succeeded']);
  } finally { await db.close(); }
});

test('ödeme dönüşü: iki sekmede iki ayrı tahsilat → ikincisi "duplicate" olarak denetim izine düşer (iade edilecek)', async (t) => {
  quiet(t);
  const { db, client, flow } = await setup();
  try {
    const o = await openOrder(db);
    // Eski sekmenin oturumu: yeniden başlatmada siparişte yalnız son belirteç kalır; eskisi olay özetinden bulunur.
    const eski = 'eski-sekme-oturumu';
    await db.query(`INSERT INTO order_events (order_id, type, actor, data) VALUES ($1, 'payment_started', 'customer', $2::jsonb)`, [o.id, JSON.stringify({ provider: 'mock', tokenHash: tokenHash(eski) })]);
    const p = provider({ retrieve: (tok) => success(o, { paymentId: tok === eski ? 'PAY-IKINCI' : 'PAY-OK-1' }) });
    assert.equal((await flow.completePayment(o.token, p, client)).outcome, 'paid');
    const second = await flow.completePayment(eski, p, client);
    assert.deepEqual([second.ok, second.outcome], [true, 'already_paid']);
    const dup = (await events(db, o.id)).filter((e) => e.type === 'payment_succeeded');
    assert.deepEqual(dup.map((e) => [e.data.paymentId, e.data.duplicate ?? false]), [['PAY-OK-1', false], ['PAY-IKINCI', true]]);
    assert.equal((await order(db, o.id)).payment_id, 'PAY-OK-1', 'siparişin ödemesi ilk tahsilat kalır');
  } finally { await db.close(); }
});

test('ödeme dönüşü: eksik tutar ya da başka siparişin referansı ödenmiş SAYILMAZ; sipariş bekler, olay yazılır', async (t) => {
  quiet(t);
  for (const [ad, bozuk] of [['tutar', (o) => ({ paidKurus: o.total - 100 })], ['referans', () => ({ reference: 'SG-2026-BASKAA' })]]) {
    const { db, client, flow } = await setup();
    try {
      const o = await openOrder(db);
      const r = await flow.completePayment(o.token, provider({ retrieve: () => success(o, bozuk(o)) }), client);
      assert.deepEqual(r, { ok: false, error: 'amount_mismatch' }, ad);
      const after = await order(db, o.id);
      assert.deepEqual([after.status, after.paid_at], ['awaiting_payment', null], ad);
      assert.deepEqual((await events(db, o.id)).map((e) => [e.type, e.data.reason]), [['payment_failed', 'amount_mismatch']], ad);
    } finally { await db.close(); }
  }
});

test('ödeme dönüşü: bilinmeyen belirteç ve başka sağlayıcının siparişi "not_found"; hiçbir şey yazılmaz', async (t) => {
  quiet(t);
  const { db, client, flow } = await setup();
  try {
    const o = await openOrder(db);
    const p = provider({ retrieve: () => success(o) });
    assert.deepEqual(await flow.completePayment('hic-acilmamis-oturum', p, client), { ok: false, error: 'not_found' });
    assert.deepEqual(await flow.completePayment(o.token, provider({ name: 'iyzico', retrieve: () => success(o) }), client), { ok: false, error: 'not_found' });
    assert.equal(p.calls.retrieve.length, 0);
    assert.deepEqual(await events(db, o.id), []);
  } finally { await db.close(); }
});

test('ödeme dönüşü: sağlayıcı sorgusu zaman aşımı/5xx → "provider_error"; durum değişmez, yeniden dönüş sonra işlenebilir', async (t) => {
  quiet(t);
  const { db, client, flow } = await setup();
  try {
    const o = await openOrder(db);
    let fail = true;
    const p = provider({ retrieve: () => (fail ? { ok: false, error: 'timeout' } : success(o)) });
    assert.deepEqual(await flow.completePayment(o.token, p, client), { ok: false, error: 'provider_error' });
    assert.equal((await order(db, o.id)).status, 'awaiting_payment');
    assert.deepEqual((await events(db, o.id)).map((e) => [e.type, e.data.stage]), [['payment_failed', 'retrieve']]);
    fail = false;
    assert.equal((await flow.completePayment(o.token, p, client)).outcome, 'paid', 'aynı belirteçle sonraki dönüş başarıyı işler');
  } finally { await db.close(); }
});

test('ödeme dönüşü: süresi dolduktan sonra gelen başarılı ödeme → paid ve kapasite yeniden ayrılır', async (t) => {
  quiet(t);
  const { db, client, flow } = await setup();
  try {
    const o = await openOrder(db, { status: 'expired' });
    const before = await reserved(db);
    const r = await flow.completePayment(o.token, provider({ retrieve: () => success(o) }), client);
    assert.deepEqual([r.ok, r.outcome], [true, 'paid']);
    assert.equal(await reserved(db), before + o.quantity);
    const late = (await events(db, o.id)).find((e) => e.data.note === 'late_payment');
    assert.equal(late.data.capacityReserved, true);
  } finally { await db.close(); }
});

test('ödeme dönüşü: geç ödemede saha dolmuşsa sipariş ödenmiş olur ama "kapasitesiz" işaretlenir (yönetim görür)', async (t) => {
  quiet(t);
  const { db, client, flow } = await setup();
  try {
    const o = await openOrder(db, { status: 'expired' });
    await db.query('UPDATE lands SET reserved_seeds = capacity_seeds WHERE id = $1', [IDS.land]);
    const before = await reserved(db);
    const r = await flow.completePayment(o.token, provider({ retrieve: () => success(o) }), client);
    assert.equal(r.outcome, 'paid');
    assert.equal(await reserved(db), before, 'dolu sahada kapasite ayrılmaz');
    assert.equal((await order(db, o.id)).payment_meta.capacityHeld, false);
    assert.equal((await events(db, o.id)).find((e) => e.data.note === 'late_payment').data.capacityReserved, false);
  } finally { await db.close(); }
});

test('ödeme dönüşü: ödeme oturumu olmayan durumdaki sipariş (taslak) işlenmez; "unexpected_status" kaydı', async (t) => {
  quiet(t);
  const { db, client, flow } = await setup();
  try {
    const o = await openOrder(db, { status: 'draft' });
    assert.deepEqual(await flow.completePayment(o.token, provider({ retrieve: () => success(o) }), client), { ok: false, error: 'provider_error' });
    assert.equal((await order(db, o.id)).status, 'draft');
    assert.deepEqual((await events(db, o.id)).map((e) => [e.type, e.data.reason]), [['payment_failed', 'unexpected_status']]);
  } finally { await db.close(); }
});

// ── Dönüş ucu (/api/payment/donus) ───────────────────────────────────────────
function donusRoute({ prov = { name: 'iyzico', isTest: true }, complete, afterCalls = [], completeCalls = [] } = {}) {
  return load('app/api/payment/donus/route.ts', {
    'next/server': { ...server, after: (fn) => afterCalls.push(fn) },
    '@/lib/admin-auth': { getClientIP: () => '203.0.113.9', rateLimit: () => null },
    '@/lib/orders/access': Access,
    '@/lib/orders/after-payment': { sendPaidOrderEmails: async () => {} },
    '@/lib/orders/payment-flow': { completePayment: async (tok) => { completeCalls.push(tok); return complete(tok); } },
    '@/lib/payments': { getPaymentProvider: () => prov },
  });
}
const donusPost = (route, token) => route.POST(new server.NextRequest('https://skytechgreen.com/api/payment/donus', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(token === null ? {} : { token }),
}));
const paidOrder = { id: '30000000-0000-4000-8000-00000000abcd', order_no: 'SG-2026-ABCDEF', locale: 'en' };

test('dönüş ucu: yanlış sağlayıcı, bozuk ya da eksik belirteç, işlenemeyen dönüş ve hata genel hata sayfasına 303', async (t) => {
  const logs = [];
  t.mock.method(console, 'error', (...a) => logs.push(a.join(' ')));
  const completeCalls = [];
  assert.equal((await donusPost(donusRoute({ prov: null, complete: () => ({}) }), 'gecerli-bicimde-belirtec')).headers.get('location'), 'https://skytechgreen.com/odeme/hata');
  assert.equal((await donusPost(donusRoute({ prov: { name: 'mock' }, complete: () => ({}) }), 'gecerli-bicimde-belirtec')).headers.get('location'), 'https://skytechgreen.com/odeme/hata');
  for (const bad of [null, 'x', 'bosluklu belirtec', '<script>']) {
    const r = await donusPost(donusRoute({ complete: () => ({}), completeCalls }), bad);
    assert.deepEqual([r.status, r.headers.get('location')], [303, 'https://skytechgreen.com/odeme/hata'], String(bad));
  }
  assert.equal(completeCalls.length, 0, 'bozuk belirteçle sağlayıcıya gidilmez');
  const failed = await donusPost(donusRoute({ complete: () => ({ ok: false, error: 'amount_mismatch' }) }), 'belirtec-12345678');
  assert.equal(failed.headers.get('location'), 'https://skytechgreen.com/odeme/hata');
  assert.equal(failed.headers.get('set-cookie'), null);
  const thrown = await donusPost(donusRoute({ complete: () => { throw new Error('ağ'); } }), 'belirtec-12345678');
  assert.equal(thrown.headers.get('location'), 'https://skytechgreen.com/odeme/hata');
  assert.ok(logs.every((l) => !l.includes('belirtec-12345678')), 'ödeme belirteci günlüğe yazılmaz');
  const get = donusRoute({ complete: () => ({}) }).GET(new server.NextRequest('https://skytechgreen.com/api/payment/donus'));
  assert.equal(get.headers.get('location'), 'https://skytechgreen.com/sahalar');
});

test('dönüş ucu: ödendi → sonuç sayfasına 303 + HttpOnly erişim çerezi + e-posta işi; başarısızda e-posta yok', async (t) => {
  t.mock.method(console, 'error', () => {});
  const afterCalls = [];
  const ok = await donusPost(donusRoute({ afterCalls, complete: () => ({ ok: true, outcome: 'paid', order: paidOrder }) }), 'belirtec-12345678');
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get('location'), `https://skytechgreen.com${Access.paymentResultPath(paidOrder.order_no, paidOrder.id, 'en')}`);
  assert.match(ok.headers.get('set-cookie'), /^sgo_SG-2026-ABCDEF=[A-Za-z0-9_-]{32}; Path=\/; .*HttpOnly; SameSite=lax/i);
  assert.equal(afterCalls.length, 1, 'ödeme e-postası yanıttan sonra');
  const fail = await donusPost(donusRoute({ afterCalls, complete: () => ({ ok: true, outcome: 'failed', order: paidOrder }) }), 'belirtec-12345678');
  assert.equal(fail.status, 303);
  assert.equal(afterCalls.length, 1, 'başarısız ödemede e-posta yok');
  const dup = await donusPost(donusRoute({ afterCalls, complete: () => ({ ok: true, outcome: 'already_paid', order: paidOrder }) }), 'belirtec-12345678');
  assert.equal(dup.status, 303);
  assert.equal(afterCalls.length, 1, 'yinelenen dönüşte ikinci e-posta yok');
});

// ── Yeniden ödeme ucu (/api/public/siparis/[no]/odeme) ──────────────────────
function odemeRoute({ prov = { name: 'mock', isTest: true }, closed = false, accept = true, found, start = async () => ({ ok: true, redirectUrl: '/odeme/deneme/tekrar' }), startCalls = [] } = {}) {
  return load('app/api/public/siparis/[no]/odeme/route.ts', {
    'next/server': server,
    '@/lib/admin-auth': { getClientIP: () => '203.0.113.9', rateLimit: () => null },
    '@/lib/supabase/server': { createSupabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
    '@/lib/orders/access': Access,
    '@/lib/orders/gate': { ordersClosed: () => closed, canAcceptOrders: () => accept },
    '@/lib/orders/settings': { getSalesSettings: async () => ({ ordersPaused: !accept }) },
    '@/lib/orders/payment-flow': { startPayment: async (...a) => { startCalls.push(a); return start(...a); } },
    '@/lib/orders/store': { db: () => ({}) },
    '@/lib/orders/view-data': { getAuthorizedOrder: async (_no, access) => (access.token === 'cerez-belirteci' ? found : null) },
    '@/lib/payments': { getPaymentProvider: () => prov },
  });
}
const odemePost = (route, cookie = 'cerez-belirteci') => route.POST(new server.NextRequest('https://skytechgreen.com/api/public/siparis/SG-2026-ABCDEF/odeme', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie: `sgo_SG-2026-ABCDEF=${cookie}` } : {}) }, body: '{}',
}), { params: Promise.resolve({ no: 'SG-2026-ABCDEF' }) });
const unpaid = (over = {}) => ({ id: paidOrder.id, order_no: 'SG-2026-ABCDEF', locale: 'tr', status: 'payment_failed', paid_at: null, is_test: true, payment_expires_at: new Date(Date.now() + 3600_000).toISOString(), ...over });
const body = async (r) => [r.status, await r.json()];

test('yeniden ödeme: kapalı satış 503; erişimsiz 404; ödenmiş siparişte sipariş sayfası; süre dolmuş/ödenemez/kip uyuşmazlığı 409', async () => {
  assert.deepEqual(await body(await odemePost(odemeRoute({ prov: null, found: unpaid() }))), [503, { error: 'closed' }]);
  assert.deepEqual(await body(await odemePost(odemeRoute({ closed: true, found: unpaid() }))), [503, { error: 'closed' }]);
  assert.deepEqual(await body(await odemePost(odemeRoute({ accept: false, found: unpaid() }))), [503, { error: 'closed' }]);
  assert.deepEqual(await body(await odemePost(odemeRoute({ found: unpaid() }), null)), [404, { error: 'not_found' }], 'numara tek başına yetmez');
  const paid = await body(await odemePost(odemeRoute({ found: unpaid({ paid_at: '2026-09-01T00:00:00Z', status: 'paid' }) })));
  assert.deepEqual(paid, [200, { ok: true, redirectUrl: Access.orderPagePath('SG-2026-ABCDEF', paidOrder.id, 'tr') }]);
  assert.deepEqual(await body(await odemePost(odemeRoute({ found: unpaid({ status: 'expired' }) }))), [409, { error: 'expired' }]);
  assert.deepEqual(await body(await odemePost(odemeRoute({ found: unpaid({ payment_expires_at: new Date(Date.now() - 1000).toISOString() }) }))), [409, { error: 'expired' }]);
  assert.deepEqual(await body(await odemePost(odemeRoute({ found: unpaid({ status: 'cancelled' }) }))), [409, { error: 'not_payable' }]);
  assert.deepEqual(await body(await odemePost(odemeRoute({ prov: { name: 'mock', isTest: false }, found: unpaid() }))), [409, { error: 'not_payable' }], 'deneme siparişi gerçek sağlayıcıyla ödenmez');
});

test('yeniden ödeme: aynı siparişte yeni oturum açılır (yeni sipariş yok); sağlayıcı açamazsa 503', async () => {
  const startCalls = [];
  const ok = await body(await odemePost(odemeRoute({ found: unpaid(), startCalls })));
  assert.deepEqual(ok, [200, { ok: true, redirectUrl: '/odeme/deneme/tekrar' }]);
  assert.equal(startCalls.length, 1);
  assert.equal(startCalls[0][0].id, paidOrder.id, 'aynı sipariş');
  assert.deepEqual(startCalls[0][2], { origin: 'https://skytechgreen.com', ip: '203.0.113.9' });
  assert.deepEqual(await body(await odemePost(odemeRoute({ found: unpaid(), start: async () => ({ ok: false, error: 'unavailable' }) }))), [503, { error: 'unavailable' }]);
});
