// B2B'nin atomik ödeme/tutar/alıcı sözleşmesi bu testin konusu değildir; HTTP/SDK taşıma koruması.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadSource as load } from './load-source.mjs';
const server = createRequire(import.meta.url)('next/server');
const payment = { id: 'local-payment', order_id: 'local-order', status: 'pending', metadata: { checkout_type: 'b2b', quote_id: 'local-quote' } };
function setup({ record = payment, result = { status: 'failure', errorMessage: 'DO-NOT-EXPOSE-TOKEN' } } = {}) {
  const writes = [], calls = [], reads = [];
  const db = { from(table) { return {
    select() { reads.push(table); return this; }, eq() { return this; }, single: async () => ({ data: record }),
    update(data) { writes.push({ table, data }); return { eq: async () => ({ error: null }) }; },
  }; } };
  const route = load('app/api/payment/callback/route.ts', {
    'next/server': server, '@/lib/supabase/server': { createServiceRoleClient: () => db },
    '@/lib/payments/iyzico': { callIyzico: async (...args) => { calls.push(args); return result; } },
  });
  const post = token => route.POST(new server.NextRequest('https://local.test/api/payment/callback', { method: 'POST', body: new URLSearchParams({ token }) }));
  return { post, writes, reads, calls };
}

test('B2B dönüşü: bütün yollar 303; sağlayıcı hata metni Location’a konmaz', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const options of [{}, { record: null }, { record: { ...payment, status: 'success' } }, { result: { status: 'success', paymentStatus: 'SUCCESS' } }]) {
    const h = setup(options), r = await h.post('local-valid-token');
    assert.equal(r.status, 303);
    assert.ok(!r.headers.get('location').includes('DO-NOT-EXPOSE-TOKEN'));
    assert.ok(!new URL(r.headers.get('location')).searchParams.has('message'));
  }
});
test('B2B dönüşü: timeout/network/config ödemeyi failed yapmaz ve hiçbir tabloya yazmaz', async () => {
  for (const errorCode of ['timeout', 'network', 'config']) {
    const h = setup({ result: { status: 'failure', errorCode } });
    const r = await h.post('local-valid-token');
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), 'https://local.test/odeme/hata');
    assert.deepEqual(h.writes, []);
  }
});
test('B2B dönüşü: bozuk token sağlayıcıyı veya ödeme tablosunu sorgulamaz', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const token of ['', 'x', 'bad token', '<script>', 'ş'.repeat(20)]) {
    const h = setup();
    assert.equal((await h.post(token)).status, 303);
    assert.deepEqual(h.calls, []); assert.deepEqual(h.reads, []); assert.deepEqual(h.writes, []);
  }
});
test('ortak iyzico çağrısı: 15 saniyelik timeout sonrası gelen SDK başarısı sonucu değiştiremez', async (t) => {
  let late, delay;
  t.mock.method(globalThis, 'setTimeout', (fn, ms) => { delay = ms; queueMicrotask(fn); return 0; });
  const mod = load('lib/payments/iyzico.ts', {
    '@/lib/iyzico': { default: { checkoutForm: { retrieve: (_req, cb) => { late = cb; } } } },
    '@/lib/tr-iller': {}, './iyzico-config': { iyzicoConfig: () => ({ isTest: true }) },
  });
  const pending = mod.callIyzico('checkoutForm', 'retrieve', { token: 'fake' });
  const r = await pending;
  assert.equal(delay, 15000); assert.equal(r.errorCode, 'timeout');
  late(null, { status: 'success', paymentStatus: 'SUCCESS' });
  assert.equal((await pending).errorCode, 'timeout');
});


function checkout(result) {
  const writes = [], calls = [];
  const quote = { id: 'quote', user_id: 'customer', status: 'QUOTED', approved_price: 200, approved_seed_count: 20, contact_person: 'Local Buyer', company_name: 'Local Company', phone: '+905550000000', corporate_email: 'local@example.invalid' };
  const db = { from(table) { return {
    select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: quote }),
    insert(data) { writes.push({ table, data }); return this; },
    single: async () => ({ data: { id: table === 'orders' ? 'local-order' : 'local-payment' } }),
    update(data) { writes.push({ table, data }); return { eq: async () => ({ error: null }) }; },
  }; } };
  const route = load('app/api/payment/b2b-checkout/route.ts', {
    'next/server': server, '@/lib/supabase/server': { createServiceRoleClient: () => db, createSupabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'customer', email: 'local@example.invalid' } } }) } }) },
    iyzipay: { default: { LOCALE: { TR: 'tr' }, CURRENCY: { TRY: 'TRY' }, PAYMENT_GROUP: { PRODUCT: 'PRODUCT' }, BASKET_ITEM_TYPE: { VIRTUAL: 'VIRTUAL' } } },
    '@/lib/admin-auth': { rateLimit: () => null, getClientIP: () => '127.0.0.1' },
    '@/lib/payments/iyzico': { callIyzico: async (...args) => { calls.push(args); return result; } },
    '@/lib/utils/format': { formatDateForIyzico: () => '2026-10-01 12:00:00' },
  });
  return { writes, calls, post: () => route.POST(new server.NextRequest('https://local.test/api/payment/b2b-checkout', { method: 'POST', body: JSON.stringify({ quoteId: 'quote' }) })) };
}
test('B2B checkout: timeout/açık hata/eksik başarı yanıtı genel 503; sağlayıcı ayrıntısı açığa çıkmaz', async () => {
  for (const result of [{ status: 'failure', errorCode: 'timeout' }, { status: 'failure', errorMessage: 'PRIVATE-PROVIDER-DATA' }, { status: 'success' }, { status: 'success', token: '<script>', checkoutFormContent: 'html' }]) {
    const h = checkout(result), r = await h.post();
    assert.equal(r.status, 503);
    assert.deepEqual(await r.json(), { error: 'Ödeme başlatılamadı.' });
    assert.equal(h.calls.length, 1);
    assert.ok(!h.writes.some(w => w.data.metadata?.iyzico_token));
  }
});
test('B2B checkout: tam SDK yanıtında token kaydı ve mevcut form yanıt sözleşmesi korunur', async () => {
  const h = checkout({ status: 'success', token: 'valid-local-token', checkoutFormContent: '<div>Local mock</div>' });
  const r = await h.post();
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: 'success', paymentId: 'local-payment', orderId: 'local-order', checkoutFormContent: '<div>Local mock</div>' });
  assert.equal(h.writes.find(w => w.data.metadata?.iyzico_token)?.data.metadata.iyzico_token, 'valid-local-token');
});
