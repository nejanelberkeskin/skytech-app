// Sipariş bağlantısı kapısı (91-4): e-postadaki `?t=` belirteci sayfa render edilmeden sunucuda doğrulanır, erişim
// çerezine çevrilir ve belirteçsiz, sabit adrese 303 ile yönlendirilir. Gerçek middleware, gerçek kapı rotası, gerçek
// belge rotası ve gerçek imza (lib/orders/access.ts); veritabanı yerine bellek içi sipariş listesi. Ağ yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadSource } from './load-source.mjs';

process.env.ORDER_LINK_SECRET = 'test-baglanti-anahtari';
const server = createRequire(import.meta.url)('next/server');
const { NextRequest } = server;
const Access = await import('../../lib/orders/access.ts');
const Gate = await import('../../lib/orders/link-gate.ts');
const SiteConfig = await import('../../lib/site-config.ts');

const ORDERS = {
  'SG-2026-ABCDEF': { id: '2f1c1e0a-5b7d-4c55-9a70-3a1f0c9d8e11', order_no: 'SG-2026-ABCDEF', paid_at: '2026-09-01T10:00:00Z' },
  'SG-2026-BCDEFG': { id: '2f1c1e0a-5b7d-4c55-9a70-3a1f0c9d8e12', order_no: 'SG-2026-BCDEFG', paid_at: '2026-09-01T10:00:00Z' },
  'SG-2026-CDEFGH': { id: '2f1c1e0a-5b7d-4c55-9a70-3a1f0c9d8e13', order_no: 'SG-2026-CDEFGH', paid_at: null },
};
const tokenOf = (no) => Access.signOrderToken(ORDERS[no].id);
const TOKEN = tokenOf('SG-2026-ABCDEF');

/** Gerçek sözleşmeyle aynı: numara + imza doğrulaması (view-data.getAuthorizedOrder'ın bellek içi karşılığı). */
function authorizedOrder(calls = []) {
  return async (no, access) => {
    calls.push(no);
    const order = ORDERS[String(no).trim().toUpperCase()];
    return order && Access.verifyOrderToken(order.id, access.token) ? order : null;
  };
}

function loadGateRoute({ limited = false, fail = false, calls = [] } = {}) {
  return loadSource('app/api/public/siparis/[no]/baglanti/route.ts', {
    'next/server': server,
    '@/lib/admin-auth': { getClientIP: () => '203.0.113.9', rateLimit: () => (limited ? { status: 429 } : null) },
    '@/lib/orders/access': Access,
    '@/lib/orders/link-gate': Gate,
    '@/lib/orders/view-data': { getAuthorizedOrder: fail ? async () => { throw new Error('siparis okunamadı: 57014'); } : authorizedOrder(calls) },
  });
}
// Doğrudan çağrı: sorgu dizisi. middleware'den gelen çağrı: iç istek başlıkları (bkz. gateViaHeaders).
const gateGet = (route, no, query) =>
  route.GET(new NextRequest(`http://localhost:3000/api/public/siparis/${encodeURIComponent(no)}/baglanti?${new URLSearchParams(query)}`), { params: Promise.resolve({ no }) });
const gateViaHeaders = (route, no, { token, target, originalQuery = '' }) =>
  route.GET(new NextRequest(`http://localhost:3000/api/public/siparis/${encodeURIComponent(no)}/baglanti${originalQuery}`, {
    headers: { [Gate.ORDER_LINK_TOKEN_HEADER]: token, [Gate.ORDER_LINK_TARGET_HEADER]: target },
  }), { params: Promise.resolve({ no }) });

// `x-middleware-set-cookie`: NextResponse'un Set-Cookie'yi Next çalışma zamanına ilettiği iç başlık (istemciye gitmez;
// derlemede HTTP düzeyinde ayrıca doğrulanır). Çerez karşılaştırmaları Set-Cookie üzerinden yapılır.
const COOKIE_HEADERS = new Set(['set-cookie', 'x-middleware-set-cookie']);
const headersOf = (res) => Object.fromEntries([...res.headers].filter(([k]) => !COOKIE_HEADERS.has(k)));

test('orderLinkRewrite: yalnız belirteçli sipariş ve ödeme sonucu sayfaları kapıya gider (dil öneki korunur)', () => {
  const r = (path) => {
    const u = new URL(`http://localhost${path}`);
    return Gate.orderLinkRewrite(u.pathname, u.searchParams);
  };
  const gate = (target, token = TOKEN) => ({ path: '/api/public/siparis/SG-2026-ABCDEF/baglanti', token, target });
  assert.deepEqual(r(`/siparis/SG-2026-ABCDEF?t=${TOKEN}`), gate('siparis:tr'));
  assert.deepEqual(r(`/en/siparis/SG-2026-ABCDEF?t=${TOKEN}`), gate('siparis:en'));
  assert.deepEqual(r(`/ru/odeme/sonuc/SG-2026-ABCDEF/?t=${TOKEN}&x=1`), gate('sonuc:ru'));
  assert.deepEqual(r(`/tr/odeme/sonuc/SG-2026-ABCDEF?t=${TOKEN}`), gate('sonuc:tr'));
  assert.deepEqual(r('/siparis/SG-2026-ABCDEF?t='), gate('siparis:tr', ''), 'boş belirteç de sayfaya ulaşmaz');
  for (const path of ['/siparis/SG-2026-ABCDEF', '/siparis/SG-2026-ABCDEF?T=x', '/sahalar?t=x', '/siparis?t=x', '/siparis/a/b?t=x', '/de/siparis/SG-2026-ABCDEF?t=x', '/odeme/deneme/x?t=y', '/cayma?t=x']) {
    assert.equal(r(path), null, path);
  }
});

test('orderLinkTarget: sabit ve izinli adres; açık yönlendirme yok, numara büyük harfe çevrilir', () => {
  assert.deepEqual(Gate.orderLinkTarget('sg-2026-abcdef', 'siparis', 'en'), { orderNo: 'SG-2026-ABCDEF', path: '/en/siparis/SG-2026-ABCDEF' });
  assert.deepEqual(Gate.orderLinkTarget('SG-2026-ABCDEF', 'sonuc', 'tr'), { orderNo: 'SG-2026-ABCDEF', path: '/odeme/sonuc/SG-2026-ABCDEF' });
  assert.deepEqual(Gate.orderLinkTarget('SG-2026-ABCDEF', 'https://evil.example/', '//evil.example'), { orderNo: 'SG-2026-ABCDEF', path: '/siparis/SG-2026-ABCDEF' });
  for (const no of ['//evil.example', '/\\evil.example', 'https://evil.example', '..%2F..%2Fadmin', '../admin', 'SG-2026-ABCDE0']) {
    const target = Gate.orderLinkTarget(no, 'siparis', 'tr');
    assert.equal(target.orderNo, null, no);
    assert.match(target.path, /^\/siparis\/[^/]+$/, `tek parçalı göreli yol: ${no}`);
    assert.ok(!target.path.startsWith('//') && !target.path.includes('\\'), no);
  }
});

test('kapı: geçerli belirteç → HttpOnly çerez + belirteçsiz adrese 303; Referer ve önbellek başlıkları', async () => {
  const route = loadGateRoute();
  const res = await gateGet(route, 'SG-2026-ABCDEF', { t: TOKEN, hedef: 'siparis', dil: 'ru' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/ru/siparis/SG-2026-ABCDEF');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, new RegExp(`^sgo_SG-2026-ABCDEF=${TOKEN};`));
  assert.match(cookie, /; Path=\/(;|$)/);
  assert.match(cookie, /; Max-Age=2592000(;|$)/);
  assert.match(cookie, /; HttpOnly(;|$)/i);
  assert.match(cookie, /; SameSite=lax(;|$)/i);
  assert.equal(await res.text(), '', 'gövde yok');
  for (const [name, value] of res.headers) if (!COOKIE_HEADERS.has(name)) assert.ok(!value.includes(TOKEN), `başlıkta belirteç yok: ${name}`);

  const paid = await gateGet(route, 'SG-2026-ABCDEF', { t: TOKEN, hedef: 'sonuc', dil: 'en' });
  assert.equal(paid.headers.get('location'), '/en/odeme/sonuc/SG-2026-ABCDEF');
});

test('kapı: middleware yolunda belirteç ve hedef iç başlıklardan okunur; orijinal sorgu hedefi değiştiremez', async () => {
  const route = loadGateRoute();
  const res = await gateViaHeaders(route, 'SG-2026-ABCDEF', { token: TOKEN, target: 'sonuc:en', originalQuery: '?t=baska&hedef=siparis&dil=ru' });
  assert.equal(res.headers.get('location'), '/en/odeme/sonuc/SG-2026-ABCDEF');
  assert.match(res.headers.get('set-cookie'), new RegExp(`^sgo_SG-2026-ABCDEF=${TOKEN};`));
  const bad = await gateViaHeaders(route, 'SG-2026-ABCDEF', { token: 'yanlis', target: 'https://evil.example:tr' });
  assert.equal(bad.headers.get('location'), '/siparis/SG-2026-ABCDEF');
  assert.equal(bad.headers.get('set-cookie'), null);
});

test('kapı: üretimde çerez Secure; geliştirmede localhost için değil', async () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const res = await gateGet(loadGateRoute(), 'SG-2026-ABCDEF', { t: TOKEN });
    assert.match(res.headers.get('set-cookie'), /; Secure(;|$)/i);
    process.env.NODE_ENV = 'development';
    const dev = await gateGet(loadGateRoute(), 'SG-2026-ABCDEF', { t: TOKEN });
    assert.doesNotMatch(dev.headers.get('set-cookie'), /Secure/i);
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test('kapı: geçersiz, başka siparişin, olmayan siparişin belirteci ve bozuk numara AYNI yanıtı alır; çerez yazılmaz', async () => {
  const calls = [];
  const route = loadGateRoute({ calls });
  const valid = await gateGet(route, 'SG-2026-ABCDEF', { t: TOKEN, hedef: 'siparis', dil: 'tr' });
  const cases = {
    gecersiz: ['SG-2026-ABCDEF', { t: TOKEN.slice(0, 31) + (TOKEN.endsWith('A') ? 'B' : 'A') }],
    baskaSiparis: ['SG-2026-ABCDEF', { t: tokenOf('SG-2026-BCDEFG') }],
    olmayan: ['SG-2026-ZZZZZZ', { t: TOKEN }],
    bos: ['SG-2026-ABCDEF', { t: '' }],
    eskiAnahtar: ['SG-2026-ABCDEF', { t: 'x'.repeat(32) }],
  };
  for (const [name, [no, query]] of Object.entries(cases)) {
    const res = await gateGet(route, no, { ...query, hedef: 'siparis', dil: 'tr' });
    assert.equal(res.status, 303, name);
    assert.equal(res.headers.get('set-cookie'), null, `${name}: çerez yok`);
    assert.equal(res.headers.get('location'), `/siparis/${no}`, name);
    assert.deepEqual(headersOf(res), { ...headersOf(valid), location: `/siparis/${no}` }, `${name}: başlıklar geçerli belirteçle aynı`);
  }
  // Başka siparişin belirteci kendi siparişini açar ama istenen siparişe çerez yazmaz.
  const other = await gateGet(route, 'SG-2026-ABCDEF', { t: tokenOf('SG-2026-BCDEFG') });
  assert.equal(other.headers.get('set-cookie'), null);
  // Bozuk numarada veritabanına hiç gidilmez; yönlendirme tek parçalı göreli yol.
  const before = calls.length;
  const bad = await gateGet(route, '//evil.example', { t: TOKEN });
  assert.equal(calls.length, before, 'bozuk numarada okuma yok');
  assert.equal(bad.headers.get('location'), '/siparis/%2F%2Fevil.example');
  assert.equal(bad.headers.get('set-cookie'), null);
});

test('kapı: hız sınırı ve geçici okuma hatası çerezsiz aynı yönlendirmeyi verir; günlüğe numara/belirteç yazılmaz', async () => {
  const limited = await gateGet(loadGateRoute({ limited: true }), 'SG-2026-ABCDEF', { t: TOKEN });
  assert.equal(limited.status, 303);
  assert.equal(limited.headers.get('location'), '/siparis/SG-2026-ABCDEF');
  assert.equal(limited.headers.get('set-cookie'), null);

  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.map(String).join(' '));
  try {
    const failed = await gateGet(loadGateRoute({ fail: true }), 'SG-2026-ABCDEF', { t: TOKEN });
    assert.equal(failed.status, 303);
    assert.equal(failed.headers.get('set-cookie'), null);
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 1);
  assert.ok(!logged[0].includes(TOKEN) && !logged[0].includes('SG-2026-ABCDEF'), logged[0]);
});

test('kapı: HEAD aynı yanıtı verir; ödenmemiş siparişin belirteci de çereze çevrilir (ödeme sonucu için)', async () => {
  const route = loadGateRoute();
  assert.equal(route.HEAD, route.GET);
  const unpaid = await gateGet(route, 'SG-2026-CDEFGH', { t: tokenOf('SG-2026-CDEFGH'), hedef: 'sonuc' });
  assert.equal(unpaid.headers.get('location'), '/odeme/sonuc/SG-2026-CDEFGH');
  assert.match(unpaid.headers.get('set-cookie'), /^sgo_SG-2026-CDEFGH=/);
});

function loadMiddleware(intlCalls) {
  return loadSource('middleware.ts', {
    'next/server': server,
    'next-intl/middleware': { __esModule: true, default: () => (req) => { intlCalls.push(req.nextUrl.pathname); return server.NextResponse.next(); } },
    '@/i18n/routing': { routing: {} },
    '@/lib/supabase/middleware': { updateSession: async () => ({ user: null, response: server.NextResponse.next() }) },
    '@/lib/site-config': SiteConfig,
    '@/lib/orders/link-gate': Gate,
  });
}

test('middleware: belirteçli sayfa isteği dil yönlendirmesinden ve sayfa render edilmeden ÖNCE kapıya yeniden yazılır (her yöntem)', async () => {
  const intlCalls = [];
  const mw = loadMiddleware(intlCalls);
  for (const [method, path, target] of [
    ['GET', `/siparis/SG-2026-ABCDEF?t=${TOKEN}`, 'siparis:tr'],
    ['GET', `/en/odeme/sonuc/SG-2026-ABCDEF?t=${TOKEN}&utm_source=mail`, 'sonuc:en'],
    ['HEAD', `/ru/siparis/SG-2026-ABCDEF?t=${TOKEN}`, 'siparis:ru'],
    ['POST', `/siparis/SG-2026-ABCDEF?t=${TOKEN}`, 'siparis:tr'],
  ]) {
    const res = await mw.middleware(new NextRequest(`http://localhost:3000${path}`, { method, headers: { [Gate.ORDER_LINK_TOKEN_HEADER]: 'istemciden-sahte' } }));
    // Yeniden yazma adresi (Next bunu yanıt başlığında geri yansıtır) sorgusuz: belirteç içermez.
    assert.equal(res.headers.get('x-middleware-rewrite'), 'http://localhost:3000/api/public/siparis/SG-2026-ABCDEF/baglanti', `${method} ${path}`);
    assert.equal(res.headers.get(`x-middleware-request-${Gate.ORDER_LINK_TOKEN_HEADER}`), TOKEN, 'belirteç iç istek başlığında; istemcinin gönderdiği değer ezilir');
    assert.equal(res.headers.get(`x-middleware-request-${Gate.ORDER_LINK_TARGET_HEADER}`), target);
  }
  assert.deepEqual(intlCalls, [], 'dil katmanı belirteçli isteği hiç görmez');

  await mw.middleware(new NextRequest('http://localhost:3000/siparis/SG-2026-ABCDEF'));
  assert.deepEqual(intlCalls, ['/siparis/SG-2026-ABCDEF'], 'belirteçsiz istek olağan yoldan geçer');
});

// Astra #104 P2: ham `t` değeri doğrulanmadan başlığa konuyordu; ASCII dışı ve gömülü kontrol karakterli değerde
// `Headers.set` hata fırlatıyor (303 yerine 500) ve hata iletisi değeri — imzalı belirteç dahil — günlüğe taşıyordu.
const BOZUK = {
  unicode: 'ş',
  emoji: '💚',
  gomuluSatirSonu: 'a\r\nb',
  imzaliArtiSatirSonu: `${TOKEN}\nX`,
  imzaliArtiKontrol: `${TOKEN}\u0000`,
  uzun: `${TOKEN}${TOKEN}`,
  kisa: TOKEN.slice(1),
  bosluklu: ` ${TOKEN}`,
};

test('P2: orderLinkToken yalnız imza biçimini (32 karakter base64url) geçirir; gerisi boş', () => {
  assert.equal(Gate.orderLinkToken(TOKEN), TOKEN);
  for (const [ad, deger] of Object.entries(BOZUK)) assert.equal(Gate.orderLinkToken(deger), '', ad);
  assert.equal(Gate.orderLinkToken(null), '');
  assert.equal(Gate.orderLinkToken(undefined), '');
});

test('P2: middleware bozuk belirteçte hata fırlatmaz; ham değer hiçbir başlığa yazılmaz, istek yine kapıya gider', async () => {
  const intlCalls = [];
  const mw = loadMiddleware(intlCalls);
  for (const [ad, deger] of Object.entries(BOZUK)) {
    const res = await mw.middleware(new NextRequest(`http://localhost:3000/siparis/SG-2026-ABCDEF?t=${encodeURIComponent(deger)}`));
    assert.equal(res.headers.get('x-middleware-rewrite'), 'http://localhost:3000/api/public/siparis/SG-2026-ABCDEF/baglanti', ad);
    assert.equal(res.headers.get(`x-middleware-request-${Gate.ORDER_LINK_TOKEN_HEADER}`), '', `${ad}: iç başlık boş`);
    for (const [name, value] of res.headers) {
      assert.ok(!value.includes(TOKEN), `${ad}: imzalı belirteç başlıkta yok (${name})`);
      assert.ok(!/[\r\n\u0000]/.test(value), `${ad}: kontrol karakteri başlıkta yok (${name})`);
    }
  }
  assert.deepEqual(intlCalls, []);
});

test('P2: kapı bozuk belirteçte (iç başlık ya da doğrudan sorgu) çerezsiz aynı 303; veritabanına gidilmez, günlük boş', async (t) => {
  const logged = [];
  for (const m of ['error', 'warn', 'log']) t.mock.method(console, m, (...a) => logged.push(a.map(String).join(' ')));
  const calls = [];
  const route = loadGateRoute({ calls });
  const valid = await gateGet(route, 'SG-2026-ABCDEF', { t: TOKEN, hedef: 'siparis', dil: 'tr' });
  calls.length = 0;
  for (const [ad, deger] of Object.entries(BOZUK)) {
    for (const res of [
      await gateGet(route, 'SG-2026-ABCDEF', { t: deger, hedef: 'siparis', dil: 'tr' }),
      await route.GET(new NextRequest('http://localhost:3000/api/public/siparis/SG-2026-ABCDEF/baglanti', {
        headers: { [Gate.ORDER_LINK_TOKEN_HEADER]: Gate.orderLinkToken(deger), [Gate.ORDER_LINK_TARGET_HEADER]: 'siparis:tr' },
      }), { params: Promise.resolve({ no: 'SG-2026-ABCDEF' }) }),
    ]) {
      assert.equal(res.status, 303, ad);
      assert.equal(res.headers.get('set-cookie'), null, ad);
      assert.deepEqual(headersOf(res), headersOf(valid), `${ad}: yanıt geçerli belirteçle aynı biçimde`);
    }
  }
  assert.deepEqual(calls, [], 'bozuk belirteçle sipariş okunmaz');
  assert.deepEqual(logged, [], 'günlüğe hiçbir şey yazılmaz');
});

function loadDocumentRoute() {
  return loadSource('app/api/public/siparis/[no]/belge/[kind]/route.ts', {
    'next/server': server,
    '@/lib/admin-auth': { getClientIP: () => '203.0.113.9', rateLimit: () => null },
    '@/lib/supabase/server': { createSupabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
    '@/lib/orders/access': Access,
    '@/lib/orders/link-gate': Gate,
    '@/lib/orders/after-payment': { documentFileName: () => 'belge.html', loadStoredDocuments: async () => null, storedDocumentToPdf: () => new Uint8Array() },
    '@/lib/orders/store': {
      db: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { html: '<p>belge</p>' }, error: null }) }) }) }) }) }),
    },
    '@/lib/orders/types': { DOCUMENT_KINDS: ['pre_info', 'contract', 'withdrawal_form', 'kvkk_notice'] },
    '@/lib/orders/view-data': { getAuthorizedOrder: authorizedOrder() },
  });
}
const docGet = (route, no, kind, query, cookie) =>
  route.GET(new NextRequest(`http://localhost:3000/api/public/siparis/${no}/belge/${kind}?${new URLSearchParams(query)}`, { headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ no, kind }) });

test('belge: eski ?t= bağlantısı çereze çevrilip belirteçsiz belge adresine 303; belirteçsiz belge çerezle açılır', async () => {
  const route = loadDocumentRoute();
  const res = await docGet(route, 'SG-2026-ABCDEF', 'contract', { t: TOKEN, bicim: 'pdf' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/api/public/siparis/SG-2026-ABCDEF/belge/contract?bicim=pdf');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.match(res.headers.get('set-cookie'), new RegExp(`^sgo_SG-2026-ABCDEF=${TOKEN};.*HttpOnly`, 'i'));

  for (const [no, t] of [['SG-2026-ABCDEF', 'x'.repeat(32)], ['SG-2026-ABCDEF', tokenOf('SG-2026-BCDEFG')], ['SG-2026-CDEFGH', tokenOf('SG-2026-CDEFGH')], ['SG-2026-ABCDEF', ''], ...Object.values(BOZUK).map((b) => ['SG-2026-ABCDEF', b])]) {
    const denied = await docGet(route, no, 'contract', { t });
    assert.equal(denied.status, 404, `${no} ${t.slice(0, 4)}`);
    assert.equal(denied.headers.get('set-cookie'), null);
  }

  const withCookie = await docGet(route, 'SG-2026-ABCDEF', 'contract', { bicim: 'html' }, `sgo_SG-2026-ABCDEF=${TOKEN}`);
  assert.equal(withCookie.status, 200);
  assert.equal(await withCookie.text(), '<p>belge</p>');
  const noCookie = await docGet(route, 'SG-2026-ABCDEF', 'contract', { bicim: 'html' });
  assert.equal(noCookie.status, 404, 'numara tek başına erişim vermez');
});

test('sayfalar ve bileşenler belirteci adresten okumaz, bağlantıya ya da istemciye taşımaz', async () => {
  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  for (const page of ['app/[locale]/(vitrin)/siparis/[no]/page.tsx', 'app/[locale]/(vitrin)/odeme/sonuc/[no]/page.tsx']) {
    const src = read(page);
    assert.doesNotMatch(src, /searchParams/, `${page}: adres sorgusu okunmaz`);
    assert.doesNotMatch(src, /signOrderToken|orderPagePath|paymentResultPath|OrderAccessPrivacy/, page);
  }
  const retry = read('components/vitrin/odeme/RetryPaymentButton.tsx');
  assert.doesNotMatch(retry, /token/, 'yeniden ödeme düğmesi belirteç almaz ve göndermez');
  assert.doesNotMatch(read('components/vitrin/siparis-durumu/OrderControls.tsx'), /erisim|replaceState|token/);
  const ViewData = loadSource('lib/orders/view-data.ts', {
    './access': Access, '@/lib/certificates/publication': {}, './schedule': {}, './state': {}, './store': {}, './types': { ORDER_NO_RE: /./ }, './view': {},
  });
  assert.equal(ViewData.orderDocumentUrl({ id: ORDERS['SG-2026-ABCDEF'].id, order_no: 'SG-2026-ABCDEF' }, 'contract', 'pdf'), '/api/public/siparis/SG-2026-ABCDEF/belge/contract?bicim=pdf');
  // E-posta bağlantıları belirteçli kalır (eski ve yeni e-postalar kapıdan geçer).
  assert.equal(Access.orderPagePath('SG-2026-ABCDEF', ORDERS['SG-2026-ABCDEF'].id, 'en'), `/en/siparis/SG-2026-ABCDEF?t=${TOKEN}`);
});
