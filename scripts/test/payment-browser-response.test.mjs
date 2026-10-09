import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadSource as load } from './load-source.mjs';
import * as Access from '../../lib/orders/access.ts';
import * as LinkGate from '../../lib/orders/link-gate.ts';
const server = createRequire(import.meta.url)('next/server');
process.env.ORDER_LINK_SECRET = 'local-response-proof';
const order = { id: '30000000-0000-4000-8000-00000000abcd', order_no: 'SG-2026-ABCDEF', locale: 'en', paid_at: '2026-10-01T00:00:00Z' };
const post = (url, body) => new server.NextRequest('https://local.test' + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const auth = { getClientIP: () => '127.0.0.1', rateLimit: () => null };
const provider = { name: 'mock', isTest: true };
const check = async (r, path) => {
  assert.equal((await r.json()).redirectUrl, path);
  assert.equal(r.cookies.get(Access.orderCookieName(order.order_no)).value, Access.signOrderToken(order.id));
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
};

test('deneme dönüşü: paid/failed/already_paid, üç dilde belirteçsiz JSON ve erişim çerezi', async () => {
  for (const outcome of ['paid', 'failed', 'already_paid']) for (const locale of ['tr', 'en', 'ru']) {
    const after = [];
    const route = load('app/api/public/odeme/deneme/route.ts', {
      'next/server': { ...server, after: f => after.push(f) }, '@/lib/admin-auth': auth,
      '@/lib/orders/payment-flow': { completePayment: async () => ({ ok: true, outcome, order: { ...order, locale } }) },
      '@/lib/orders/after-payment': { sendPaidOrderEmails: () => { throw new Error('mail forbidden'); } },
      '@/lib/orders/access': Access, '@/lib/orders/link-gate': LinkGate,
      '@/lib/payments': { getPaymentProvider: () => provider },
      '@/lib/payments/mock': { recordMockOutcome: () => {}, verifyMockOutcome: () => true },
    });
    const r = await route.POST(post('/api/public/odeme/deneme', { token: 'fake', outcome, signature: 'fake' }));
    await check(r, LinkGate.orderLinkPath('sonuc', order.order_no, locale));
    assert.equal(after.length, outcome === 'paid' ? 1 : 0);
  }
});

test('aynı oluşturma isteği ödenmiş siparişi döndürürse belirteç yalnız çerezde; yeniden ödeme yok', async () => {
  let start = 0;
  const route = load('app/api/public/siparis/route.ts', {
    'next/server': server, '@/lib/admin-auth': auth,
    '@/lib/supabase/server': { createSupabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
    '@/lib/requests/schema': { MIN_FILL_MS: 3000 }, '@/lib/requests/server': { hashIp: () => 'hash', sanitizeUserAgent: () => null },
    '@/lib/orders/schema': { orderPayloadSchema: { safeParse: data => ({ success: true, data }) } },
    '@/lib/orders/create': { createOrder: async () => ({ ok: true, order }) },
    '@/lib/orders/gate': { canAcceptOrders: () => true, ordersClosed: () => false },
    '@/lib/orders/payment-flow': { startPayment: async () => { start++; } },
    '@/lib/orders/access': Access, '@/lib/orders/link-gate': LinkGate,
    '@/lib/orders/settings': { getSalesSettings: async () => ({}), quoteVersion: () => 'v1' },
    '@/lib/payments': { getPaymentProvider: () => provider },
  });
  const r = await route.POST(post('/api/public/siparis', { documentsVersion: 'v1', elapsedMs: 9000 }));
  assert.equal(r.status, 201);
  await check(r, '/en/siparis/' + order.order_no);
  assert.equal(start, 0);
});

test('Next yapılandırması: ödeme API başlıkları genel Referrer-Policy kuralından sonra gelir', async () => {
  const config = load('next.config.ts', { 'next-intl/plugin': { default: () => c => c }, '@next/bundle-analyzer': { default: () => c => c } }).default;
  const rules = await config.headers();
  const general = rules.findIndex(r => r.source === '/(.*)');
  for (const pattern of ['/api/payment/:path*', '/api/public/odeme/:path*', '/api/public/siparis/:path*']) {
    const index = rules.findIndex(r => r.source === pattern);
    assert.ok(index > general, pattern);
    assert.deepEqual(rules[index].headers.find(h => h.key === 'Referrer-Policy'), { key: 'Referrer-Policy', value: 'no-referrer' });
  }
});
