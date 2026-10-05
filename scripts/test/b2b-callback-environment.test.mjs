// Regression for Claude review T2: mismatched payment environment must stop before the provider call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadSource as load } from './load-source.mjs';

const server = createRequire(import.meta.url)('next/server');

function kur(odeme) {
  const saglayici = [], rpc = [];
  const db = {
    from() { return { select() { return this; }, eq() { return this; }, single: async () => ({ data: odeme }) }; },
    rpc: async (ad) => { rpc.push(ad); return { data: { status: 'rejected' } }; },
  };
  const route = load('app/api/payment/callback/route.ts', {
    'next/server': server,
    '@/lib/supabase/server': { createServiceRoleClient: () => db },
    '@/lib/payments/iyzico-config': { iyzicoConfig: () => ({ isTest: true }) },
    '@/lib/b2b/payment-result': { b2bPaymentResult: (r) => r },
    '@/lib/payments/iyzico': { callIyzico: async (...a) => { saglayici.push(a); return { status: 'success', paymentStatus: 'SUCCESS' }; } },
  });
  const post = () => route.POST(new server.NextRequest('https://local.test/api/payment/callback?locale=en', { method: 'POST', body: new URLSearchParams({ token: 'yerel-belirtec-0001' }) }));
  return { post, saglayici, rpc };
}

test('B2B dönüşü: ortam ya da sağlayıcı uyuşmazlığında sağlayıcı sorgusu ve kayıt RPC çağrısı sıfır', async (t) => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', () => { throw new Error('external calls forbidden'); });
  const temel = { id: 'yerel-odeme', order_id: 'yerel-siparis', status: 'pending', provider: 'iyzico', metadata: { checkout_type: 'b2b', quote_id: 'yerel-teklif', ui_locale: 'en', iyzico_token: 'yerel-belirtec-0001' } };
  for (const odeme of [
    { ...temel, metadata: { ...temel.metadata, is_test: false } },     // canlı kayıt, sandbox yapılandırma
    { ...temel, metadata: { ...temel.metadata } },                     // ortam etiketi olmayan eski kayıt
    { ...temel, provider: 'mock', metadata: { ...temel.metadata, is_test: true } },
  ]) {
    const h = kur(odeme);
    const r = await h.post();
    assert.equal(r.status, 303);
    assert.equal(new URL(r.headers.get('location')).pathname, '/en/kurumsal/panel/odeme');
    assert.deepEqual(h.saglayici, [], JSON.stringify(odeme.metadata));
    assert.deepEqual(h.rpc, []);
  }
});
