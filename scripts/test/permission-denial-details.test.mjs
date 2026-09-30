// 403 gövdelerinde izin listesi (web-brifler/16, #94 arayüz sözleşmesi): sipariş, talep ve iade uçları.
// Gerçek izin kapısı + gerçek route; etkili yetki taklit RPC'den (birim) ya da PGlite'taki gerçek SQL'den gelir.
// Her retde iş servisi çağrılmaz; arayüzün errorText'i eksik izni kendi sözlüğündeki Türkçe adıyla gösterir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { loadSource as load } from './load-source.mjs';
import { createDb, restClient, IDS } from './pglite-db.mjs';
import { AAL1, customRole, envelope, gate, orderAt, orderClient, permissionKeys, readModules, request, staffWithRole, USERS, withMfaEnforced } from './order-admin-helpers.mjs';

const labels = load('components/admin/access/labels.ts');
const ui = load('components/admin/operations/client.ts', { '@/components/admin/access/labels': labels });
/** Arayüzün göstereceği metin: yanıt → AdminApiError → errorText (components/admin/operations/client.ts). */
const shown = (res) => ui.errorText(new ui.AdminApiError(res.body.error.code, res.body.error.message, res.status, res.body.error.details));
const TAIL = 'Erişiminizi yetkili yöneticinizle kontrol edin.';

const SPLIT = '10000000-0000-0000-0000-0000000000d2';
const DOCS = '10000000-0000-0000-0000-0000000000d3';
const UPDATER = '10000000-0000-0000-0000-0000000000d4';
const FIN_SITE = '10000000-0000-0000-0000-0000000000d5';
const ORDER_ID = '30000000-0000-4000-8000-000000000001';

// ── Merkezi kapı (lib/admin/permissions.ts), taklit etkili yetki ─────────────
function unitGate(permissions, { assurance = AAL1, staff = true } = {}) {
  return load('lib/admin/permissions.ts', {
    '@/lib/admin-auth': {
      requireAdmin: async () => staff
        ? { admin: { user_id: 'kisi', role: 'NONE', full_name: 'Deneme', email: 'deneme@example.invalid' }, error: null }
        : { admin: null, error: { status: 403 } },
    },
    '@/lib/api/envelope': envelope,
    '@/lib/supabase/server': { createServiceRoleClient: () => ({ rpc: async () => ({ data: { adminId: 'kisi', permissions, roles: [] }, error: null }) }) },
    './mfa': { sessionAssurance: async () => assurance },
    './permission-keys': permissionKeys,
  });
}
const all = (...keys) => keys.map((key) => ({ key, scopes: [{ kind: 'all' }] }));

test('403 kapı: eksik izin, dar kapsam ve MFA gövdesi izin listesini taşır; personel olmayan kişiye izin adı verilmez', async () => {
  const missing = (await unitGate([]).requirePermission(request(), 'finance.read')).error;
  assert.equal(missing.status, 403);
  assert.deepEqual(missing.body.error, { code: 'forbidden', message: 'Bu işlem için yetkiniz yok.', details: { reason: 'missing_permission', permissions: ['finance.read'] } });
  assert.equal(shown(missing), `Bu işlem için yetkiniz yok. Eksik yetki: Finans özetini görme (finance.read). ${TAIL}`);

  const outsider = (await unitGate([], { staff: false }).requirePermission(request(), 'finance.read')).error;
  assert.deepEqual(outsider.body.error, { code: 'forbidden', message: 'Bu işlem için yetkiniz yok.' }, 'tek izin vermek yetmez: ad yanıltıcı olurdu');
  assert.equal(shown(outsider), 'Bu işlem için yetkiniz yok.');

  const sites = [{ key: 'refunds.execute', scopes: [{ kind: 'sites', siteIds: [IDS.siteA] }] }];
  const narrow = (await unitGate(sites).requirePermission(request(), 'refunds.execute')).error;
  assert.equal(narrow.body.error.code, 'scope_unsupported');
  assert.deepEqual(narrow.body.error.details, { permission: 'refunds.execute', permissions: ['refunds.execute'], scopes: [{ kind: 'sites', siteIds: [IDS.siteA] }] });

  await withMfaEnforced(async () => {
    const mfa = (await unitGate(all('refunds.execute')).requirePermission(request(), 'refunds.execute')).error;
    assert.equal(mfa.body.error.code, 'mfa_required');
    assert.deepEqual(mfa.body.error.details, { permissions: ['refunds.execute'], enrolled: false, reason: 'enrollment', freshnessMinutes: 15 });
    assert.equal(shown(mfa), 'Bu işlem iki aşamalı doğrulama ister.', 'MFA yönergesi izin açıklamasıyla karışmaz');
  });
});

test('403 kapı (birden çok izin): hiçbiri yoksa hepsi listelenir; dar kapsam ve MFA eşleşen izni söyler', async () => {
  const none = (await unitGate([]).requireAnyPermission(request(), ['staff.manage', 'staff.invite'])).error;
  assert.deepEqual(none.body.error, {
    code: 'forbidden', message: 'Bu işlem için yetkiniz yok; şu yetkilerden biri yeterlidir.',
    details: { reason: 'missing_permission', permissions: ['staff.manage', 'staff.invite'] },
  });
  assert.equal(shown(none), `Bu işlem için yetkiniz yok; şu yetkilerden biri yeterlidir. Eksik yetki: Personel davet etme (staff.invite), Personel yönetme (staff.manage). ${TAIL}`);

  const single = (await unitGate([]).requireAnyPermission(request(), ['roles.manage'], { mfa: false })).error;
  assert.equal(single.body.error.message, 'Bu işlem için yetkiniz yok.');
  assert.deepEqual(single.body.error.details, { reason: 'missing_permission', permissions: ['roles.manage'] });

  const assigned = [{ key: 'staff.invite', scopes: [{ kind: 'assigned' }] }];
  const narrow = (await unitGate(assigned).requireAnyPermission(request(), ['staff.manage', 'staff.invite'])).error;
  assert.equal(narrow.body.error.code, 'scope_unsupported');
  assert.deepEqual(narrow.body.error.details, { permission: 'staff.invite', permissions: ['staff.invite'], scopes: [{ kind: 'assigned' }] });

  await withMfaEnforced(async () => {
    const mfa = (await unitGate(all('staff.invite')).requireAnyPermission(request(), ['staff.manage', 'staff.invite'])).error;
    assert.equal(mfa.body.error.code, 'mfa_required');
    assert.deepEqual(mfa.body.error.details.permissions, ['staff.invite']);
  });
});

// ── Sipariş uçları (27): gerçek route + PGlite ────────────────────────────────
const mods = readModules();
function orderRoutes(db, who, { role = 'NONE', assurance = AAL1 } = {}) {
  const log = [];
  const writes = [];
  const shared = {
    '@/lib/supabase/server': { createServiceRoleClient: () => orderClient(db, { log, writes }) },
    '@/lib/admin/permissions': gate({ db, userId: who, role, assurance }),
    '@/lib/api/envelope': envelope,
    '@/lib/orders/admin-access': mods.access,
  };
  const list = load('app/api/admin/release-orders/route.ts', { ...shared, '@/lib/orders/admin-read': mods.read, '@/lib/orders/types': mods.types });
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
    list: (query = {}) => list.GET(request({ query })),
    detail: (id) => detail.GET(request(), { params: Promise.resolve({ id }) }),
  };
}

test('27: sipariş süzgeci izni — eksik izin ve kapsam dışı ayrılır, gerekli izin adıyla; hiçbir kayıt sorgulanmaz', async () => {
  const db = await createDb();
  try {
    const ops = orderRoutes(db, IDS.operations, { role: 'OPERATIONS' });
    for (const [flag, permission] of [['refund_pending', 'finance.read'], ['duplicate', 'finance.read'], ['invoice_pending', 'invoices.read']]) {
      const r = await ops.list({ flag });
      assert.equal(r.status, 403, flag);
      assert.deepEqual(r.body.error.details, { flag, reason: 'missing_permission', permissions: [permission] }, flag);
      assert.equal(shown(r), `Bu süzgeç için yetkiniz yok. Eksik yetki: ${labels.permissionLabels[permission]} (${permission}). ${TAIL}`);
    }
    assert.deepEqual(ops.log, [], 'reddedilen süzgeçte sipariş tablosu sorgulanmaz');

    // Okuma Antalya'da, finans Muğla'da: izin var ama okunabilen hiçbir siparişi kapsamıyor.
    await customRole(db, 'antalya_siparis', ['orders.read']);
    await customRole(db, 'mugla_finans', ['finance.read']);
    await staffWithRole(db, SPLIT, 'antalya_siparis', { kind: 'sites', siteIds: [IDS.siteA] });
    await staffWithRole(db, SPLIT, 'mugla_finans', { kind: 'sites', siteIds: [IDS.siteB] });
    const split = orderRoutes(db, SPLIT);
    assert.equal((await split.list()).status, 200, 'süzgeçsiz liste açık');
    const r = await split.list({ flag: 'refund_pending' });
    assert.deepEqual(r.body.error.details, { flag: 'refund_pending', reason: 'out_of_scope', permissions: ['finance.read'] });
    assert.equal(shown(r), `Bu süzgeç için yetkiniz yok. Bu kayıt için kapsamı yetersiz olan yetki: Finans özetini görme (finance.read). ${TAIL}`);
    assert.equal((await split.list({ flag: 'capacity' })).status, 200, 'sipariş grubu süzgeci okuma iznine bağlı');
  } finally { await db.close(); }
});

test('27: yalnız atanmış işleri kapsayan okuma izni liste ve ayrıntıda izin adıyla scope_unsupported döner', async () => {
  const db = await createDb();
  try {
    const orderId = await orderAt(db);
    await customRole(db, 'atanmis_okur', ['orders.read']);
    await staffWithRole(db, USERS.scoped, 'atanmis_okur', { kind: 'assigned' });
    const api = orderRoutes(db, USERS.scoped);
    for (const r of [await api.list(), await api.detail(orderId)]) {
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, 'scope_unsupported');
      assert.deepEqual(r.body.error.details, { permission: 'orders.read', permissions: ['orders.read'] });
    }
    assert.deepEqual(api.log, []);
  } finally { await db.close(); }
});

function documentRoute(db, who, { role = 'NONE', assurance = AAL1 } = {}) {
  const calls = [];
  const route = load('app/api/admin/release-orders/[id]/belge/[kind]/route.ts', {
    'next/server': {},
    '@/lib/supabase/server': { createServiceRoleClient: () => { calls.push('db'); return restClient(db); } },
    '@/lib/admin/permissions': gate({ db, userId: who, role, assurance }),
    '@/lib/api/envelope': envelope,
    '@/lib/orders/admin-access': mods.access,
    '@/lib/orders/after-payment': { documentFileName: () => 'belge.pdf', loadStoredDocuments: async () => { calls.push('belge'); return null; }, storedDocumentToPdf: () => new Uint8Array() },
    '@/lib/orders/types': { DOCUMENT_KINDS: ['pre_info', 'contract', 'withdrawal_form', 'kvkk_notice'] },
  });
  const get = (orderId) => route.GET(request({ url: `https://skytechgreen.com/api/admin/release-orders/${orderId}/belge/contract?bicim=html` }), { params: Promise.resolve({ id: orderId, kind: 'contract' }) });
  return { calls, get };
}

test('27 §3: belge — eksik iletişim ve vergi izinlerinin ikisi de listelenir; dar kapsam ayrı; belge okunmaz', async () => {
  const db = await createDb();
  try {
    const orderId = await orderAt(db);
    await customRole(db, 'belge_okur', ['orders.read', 'orders.documents.read']);
    await staffWithRole(db, USERS.docsOnly, 'belge_okur');
    const docsOnly = documentRoute(db, USERS.docsOnly);
    const r = await docsOnly.get(orderId);
    assert.equal(r.status, 403);
    assert.deepEqual(r.body.error.details, {
      reason: 'missing_permission', permissions: ['customers.contact.read', 'customers.tax.read'], permission: 'customers.contact.read',
    }, 'ilk eksik izin geriye uyum için `permission` alanında kalır');
    assert.equal(shown(r), `Bu belgeyi görüntüleme yetkiniz yok. Eksik yetki: Müşteri iletişim bilgilerini görme (customers.contact.read), Kimlik ve vergi bilgilerini görme (customers.tax.read). ${TAIL}`);

    // Vergi tüm kayıtlarda, iletişim yalnız Antalya'da: eksik izin yok, kapsam yetersiz.
    await customRole(db, 'belge_vergi', ['orders.read', 'orders.documents.read', 'customers.tax.read']);
    await customRole(db, 'antalya_iletisim', ['customers.contact.read']);
    await staffWithRole(db, DOCS, 'belge_vergi');
    await staffWithRole(db, DOCS, 'antalya_iletisim', { kind: 'sites', siteIds: [IDS.siteA] });
    const narrow = documentRoute(db, DOCS);
    const s = await narrow.get(orderId);
    assert.equal(s.body.error.code, 'scope_unsupported');
    assert.deepEqual(s.body.error.details, { permissions: ['customers.contact.read'], permission: 'customers.contact.read' });

    const ops = documentRoute(db, IDS.operations, { role: 'OPERATIONS' });
    const o = await ops.get(orderId);
    assert.deepEqual(o.body.error.details, { reason: 'missing_permission', permissions: ['orders.documents.read'] }, 'ilk kapı belge izni');
    assert.deepEqual([...docsOnly.calls, ...narrow.calls, ...ops.calls], [], 'reddedilen istekte belge ve veritabanı okunmaz');
  } finally { await db.close(); }
});

// ── Talep uçları (29) ─────────────────────────────────────────────────────────
const schema = await import('../../lib/requests/schema.ts');
const scopeMod = load('lib/admin/record-scope.ts', { '@/lib/admin/permissions': permissionKeys });
function requestRoute(db, who, { role = 'NONE' } = {}) {
  const calls = [];
  const route = load('app/api/admin/requests/route.ts', {
    zod: { z },
    '@/lib/supabase/server': { createServiceRoleClient: () => { calls.push('db'); return {}; } },
    '@/lib/admin-auth': { getClientIP: () => '127.0.0.1' },
    '@/lib/admin/permissions': gate({ db, userId: who, role }),
    '@/lib/admin/record-scope': scopeMod,
    '@/lib/admin/audit': { auditLog: async () => { calls.push('audit'); return []; } },
    '@/lib/api/envelope': envelope,
    '@/lib/requests/admin-read': {
      loadRequestList: async () => { calls.push('liste'); return null; },
      sanitizeRequestSearch: (q) => q,
      updateRequest: async () => { calls.push('güncelleme'); return { ok: false, error: 'unavailable' }; },
    },
    '@/lib/requests/schema': schema,
  });
  const url = 'https://skytechgreen.com/api/admin/requests';
  return { calls, list: () => route.GET(request({ url })), patch: (body) => route.PATCH(request({ url, body })) };
}

test('29: talep okuma ve güncelleme retleri eksik izni adıyla söyler; iş servisi, veritabanı ve audit çağrılmaz', async () => {
  const db = await createDb();
  try {
    await staffWithRole(db, USERS.engineer, 'engineer');
    const engineer = requestRoute(db, USERS.engineer);
    const read = await engineer.list();
    assert.deepEqual(read.body.error.details, { reason: 'missing_permission', permissions: ['requests.read'] });
    assert.equal(shown(read), `Bu işlem için yetkiniz yok. Eksik yetki: Talepleri görme (requests.read). ${TAIL}`);

    const body = { id: ORDER_ID, status: 'contacted' };
    const finance = requestRoute(db, IDS.finance, { role: 'FINANCE' });
    const update = await finance.patch(body);
    assert.deepEqual(update.body.error.details, { reason: 'missing_permission', permissions: ['requests.update'] });
    assert.equal(shown(update), `Bu işlem için yetkiniz yok. Eksik yetki: Talep güncelleme (requests.update). ${TAIL}`);

    // Güncelleyebilir ama okuyamaz: yanıt aynı kaydın DTO'su olduğundan okuma izni de gerekir.
    await customRole(db, 'talep_guncelle', ['requests.update']);
    await staffWithRole(db, UPDATER, 'talep_guncelle');
    const updater = requestRoute(db, UPDATER);
    const blind = await updater.patch(body);
    assert.equal(blind.body.error.message, 'Talepleri okuma yetkiniz yok.');
    assert.deepEqual(blind.body.error.details, { reason: 'missing_permission', permissions: ['requests.read'], permission: 'requests.read' });
    assert.equal(shown(blind), `Talepleri okuma yetkiniz yok. Eksik yetki: Talepleri görme (requests.read). ${TAIL}`);

    await customRole(db, 'atanmis_talep', ['requests.read']);
    await staffWithRole(db, USERS.scoped, 'atanmis_talep', { kind: 'assigned' });
    const assigned = await requestRoute(db, USERS.scoped).list();
    assert.equal(assigned.body.error.code, 'scope_unsupported');
    assert.deepEqual(assigned.body.error.details, { permission: 'requests.read', permissions: ['requests.read'] });

    assert.deepEqual([...engineer.calls, ...finance.calls, ...updater.calls], []);
  } finally { await db.close(); }
});

// ── İade uçları (17): gerçek route + gerçek lib/refunds/http.ts, servis sayaçlı taklit ─────
const refundModel = load('lib/refunds/model.ts', { '@/lib/orders/duplicates': load('lib/orders/duplicates.ts') });
function refundRoutes(db, who, { role = 'NONE', assurance = AAL1 } = {}) {
  const calls = [];
  const service = new Proxy({}, { get: (_t, name) => async () => { calls.push(`servis.${String(name)}`); return { ok: false, status: 503, code: 'unavailable', message: 'taklit' }; } });
  const http = load('lib/refunds/http.ts', {
    'next/server': { after: () => calls.push('sonra') },
    '@/lib/admin-auth': { getClientIP: () => '127.0.0.1' },
    '@/lib/api/envelope': envelope,
    '@/lib/orders/admin-mails': { sendRefundCompletedEmail: () => { throw new Error('gerçek e-posta yasak'); } },
    '@/lib/payments': { getProviderByName: () => { throw new Error('sağlayıcı yasak'); } },
    '@/lib/supabase/server': { createServiceRoleClient: () => { calls.push('db'); return {}; } },
    './service': { createRefundService: () => { calls.push('servis'); return service; } },
  });
  const common = { zod: { z }, '@/lib/admin/permissions': gate({ db, userId: who, role, assurance }), '@/lib/api/envelope': envelope, '@/lib/refunds/http': http, '@/lib/refunds/model': refundModel };
  const route = (file) => load(`app/api/admin/refunds/${file}/route.ts`.replace('/./', '/'), common);
  const [queue, view, execute, retry, resolve, finalize] = ['.', 'orders/[orderId]', 'orders/[orderId]/execute',
    'operations/[operationId]/retry', 'operations/[operationId]/resolve', 'operations/[operationId]/finalize'].map(route);
  const req = (body) => request({ url: 'https://skytechgreen.com/api/admin/refunds', body });
  const op = { params: Promise.resolve({ operationId: ORDER_ID }) };
  const ord = { params: Promise.resolve({ orderId: ORDER_ID }) };
  return {
    calls,
    reads: () => Promise.all([queue.GET(req()), view.GET(req(), ord)]),
    actions: () => Promise.all([
      execute.POST(req({ kind: 'order' }), ord),
      retry.POST(req({ expectedAttempt: 1 }), op),
      resolve.POST(req({ expectedAttempt: 1, outcome: 'failed', source: 'provider_panel', note: 'Sağlayıcı panelinde başarısız görünüyor.' }), op),
      finalize.POST(req({}), op),
    ]),
  };
}

test('17: iade retleri gerekli izni adıyla söyler (okuma finance.read, eylem refunds.execute); servis kurulmaz', async () => {
  const db = await createDb();
  try {
    const ops = refundRoutes(db, IDS.operations, { role: 'OPERATIONS' });
    for (const r of await ops.reads()) {
      assert.equal(r.status, 403);
      assert.deepEqual(r.body.error.details, { reason: 'missing_permission', permissions: ['finance.read'] });
      assert.equal(shown(r), `Bu işlem için yetkiniz yok. Eksik yetki: Finans özetini görme (finance.read). ${TAIL}`);
    }
    for (const r of await ops.actions()) {
      assert.equal(r.status, 403);
      assert.deepEqual(r.body.error.details, { reason: 'missing_permission', permissions: ['refunds.execute'] });
      assert.equal(shown(r), `Bu işlem için yetkiniz yok. Eksik yetki: İade gerçekleştirme ve mutabakat (refunds.execute). ${TAIL}`);
    }
    assert.deepEqual(ops.calls, []);

    await customRole(db, 'finans_saha', ['finance.read', 'refunds.execute']);
    await staffWithRole(db, FIN_SITE, 'finans_saha', { kind: 'sites', siteIds: [IDS.siteA] });
    const site = refundRoutes(db, FIN_SITE);
    for (const r of [...await site.reads(), ...await site.actions()]) {
      assert.equal(r.body.error.code, 'scope_unsupported');
      assert.equal(r.body.error.details.permissions.length, 1);
      assert.ok(['finance.read', 'refunds.execute'].includes(r.body.error.details.permissions[0]));
    }
    assert.deepEqual(site.calls, []);

    await withMfaEnforced(async () => {
      const fin = refundRoutes(db, IDS.finance, { role: 'FINANCE' });
      for (const r of await fin.actions()) {
        assert.equal(r.body.error.code, 'mfa_required');
        assert.deepEqual(r.body.error.details.permissions, ['refunds.execute']);
      }
      assert.deepEqual(fin.calls, [], 'MFA reddi sağlayıcıya ve servise ulaşmaz');
    });
  } finally { await db.close(); }
});
