// 27 §2–3: sipariş eylem izinleri ve belge okuma. Gerçek izin kapısı + gerçek route + PGlite rol şablonları.
// İş servisi, e-posta ve audit sayaçlı taklit: reddedilen istekte hiçbiri çağrılmamalı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { loadSource as load } from './load-source.mjs';
import { createDb, restClient, IDS } from './pglite-db.mjs';
import { AAL1, aal2, customRole, envelope, gate, orderAt, request, staffWithRole, USERS, withMfaEnforced } from './order-admin-helpers.mjs';

const ACTIONS = {
  note: { action: 'note', note: 'Deneme notu' },
  cancel_by_seller: { action: 'cancel_by_seller', reason: 'İfa edilemiyor.' },
  refund: { action: 'refund' },
  refund_duplicate: { action: 'refund_duplicate', paymentId: 'PAY-2' },
  invoice_now: { action: 'invoice_now' },
  invoice_issued: { action: 'invoice_issued', invoiceId: '5b2f8f3e-8c1a-4d5e-9f00-000000000001', invoiceNo: 'SGA2026000001', issuedOn: '2026-09-29' },
  reserve_capacity: { action: 'reserve_capacity' },
};

function orderRoute(db, who, { role = 'NONE', assurance = AAL1, unauthenticated = false } = {}) {
  const calls = { service: [], mail: [], audit: 0, events: 0 };
  const done = (name) => async (...args) => { calls.service.push(name); return { ok: true, order: { id: args[0], status: 'paid', total_kurus: 1000 } }; };
  const route = load('app/api/admin/release-orders/[id]/route.ts', {
    'next/server': { after: (fn) => calls.mail.push(fn), NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200, headers: init?.headers ?? {} }) } },
    zod: { z },
    '@/lib/supabase/server': { createServiceRoleClient: () => ({
      from: () => ({ update: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => { calls.service.push('note'); return { data: { id: 'x', status: 'paid' }, error: null }; } }) }) }) }),
    }) },
    '@/lib/admin-auth': {
      requireAdmin: async () => unauthenticated
        ? { admin: null, error: { body: { error: 'unauthorized' }, status: 401 } }
        : { admin: { user_id: who, role, full_name: 'Deneme', email: 'deneme@example.invalid' }, error: null },
      getClientIP: () => '127.0.0.1',
    },
    '@/lib/admin/permissions': gate({ db, userId: who, role, assurance, unauthenticated }),
    '@/lib/orders/admin-access': load('lib/orders/admin-access.ts', { '@/lib/admin/permissions': gate({ db, userId: who, role, assurance }) }),
    '@/lib/admin/audit': { auditLog: async () => { calls.audit++; return []; } },
    '@/lib/orders/admin-actions': {
      cancelBySeller: done('cancel_by_seller'), executeRefund: done('refund'), refundDuplicate: done('refund_duplicate'),
      queueInvoice: done('invoice_now'), markInvoiceIssued: done('invoice_issued'), reserveCapacityNow: done('reserve_capacity'),
    },
    '@/lib/orders/admin-detail': { loadOrderDetail: async () => ({ ok: false, error: 'not_found' }) },
    '@/lib/orders/admin-mails': { sendRefundCompletedEmail: async () => {}, sendSellerCancellationEmail: async () => {} },
    '@/lib/orders/store': { addOrderEvent: async () => { calls.events++; } },
    '@/lib/api/envelope': envelope,
  });
  const post = async (orderId, body) => route.POST(request({ body }), { params: Promise.resolve({ id: orderId }) });
  return { post, calls };
}

const codeOf = (res) => res.body?.error?.code ?? res.body?.error;

async function expectRejected(db, who, action, code, opts = {}) {
  const orderId = await orderAt(db);
  const { post, calls } = orderRoute(db, who, opts);
  const res = await post(orderId, ACTIONS[action]);
  assert.equal(res.status, code === 'unauthorized' ? 401 : 403, `${action} → ${code} (${JSON.stringify(res.body)})`);
  assert.equal(codeOf(res), code, `${action} kodu`);
  assert.deepEqual(calls.service, [], `${action}: reddedilen istekte iş servisi çağrılmaz`);
  assert.equal(calls.audit, 0, `${action}: reddedilen istekte audit yazılmaz`);
  assert.equal(calls.mail.length, 0, `${action}: reddedilen istekte e-posta yok`);
}

async function expectAllowed(db, who, action, opts = {}) {
  const orderId = await orderAt(db);
  const { post, calls } = orderRoute(db, who, opts);
  const res = await post(orderId, ACTIONS[action]);
  assert.equal(res.status, 200, `${action} izinli olmalı (${JSON.stringify(res.body)})`);
  assert.deepEqual(calls.service, [action]);
  assert.equal(calls.audit, 1);
}

test('27 §2: sahip bütün eylemleri yapar; eylem başına tek iş servisi çağrısı ve tek audit', async () => {
  const db = await createDb();
  try {
    for (const action of Object.keys(ACTIONS)) await expectAllowed(db, IDS.superAdmin, action, { role: 'SUPER_ADMIN' });
  } finally { await db.close(); }
});

test('27 §2: şablon farkları — finans not/iptal/kapasite yapamaz, fatura ve iade yapar; operasyon yalnız not', async () => {
  const db = await createDb();
  try {
    for (const action of ['note', 'cancel_by_seller', 'reserve_capacity']) await expectRejected(db, IDS.finance, action, 'forbidden', { role: 'FINANCE' });
    for (const action of ['invoice_now', 'invoice_issued', 'refund', 'refund_duplicate']) await expectAllowed(db, IDS.finance, action, { role: 'FINANCE' });

    await expectAllowed(db, IDS.operations, 'note', { role: 'OPERATIONS' });
    for (const action of ['cancel_by_seller', 'refund', 'refund_duplicate', 'invoice_now', 'invoice_issued', 'reserve_capacity']) {
      await expectRejected(db, IDS.operations, action, 'forbidden', { role: 'OPERATIONS' });
    }

    await staffWithRole(db, USERS.engineer, 'engineer', { kind: 'all' }, 'ENGINEER');
    await expectAllowed(db, USERS.engineer, 'reserve_capacity', { role: 'ENGINEER' });
    await expectRejected(db, USERS.engineer, 'note', 'forbidden', { role: 'ENGINEER' });
  } finally { await db.close(); }
});

test('27 §2: yalnız not izinli özel rol not yazar; iade, kapasite ve iptal yapamaz', async () => {
  const db = await createDb();
  try {
    await customRole(db, 'not_yazar', ['orders.read', 'orders.note']);
    await staffWithRole(db, USERS.noter, 'not_yazar');
    await expectAllowed(db, USERS.noter, 'note');
    for (const action of ['refund', 'refund_duplicate', 'reserve_capacity', 'cancel_by_seller', 'invoice_now']) {
      await expectRejected(db, USERS.noter, action, 'forbidden');
    }
  } finally { await db.close(); }
});

test('27 §2: iade izinli özel rol eski rol yoksa reddedilir (SQL 019 bağımlılığı, rol yükseltmesi yok)', async () => {
  const db = await createDb();
  try {
    await customRole(db, 'iadeci', ['orders.read', 'refunds.execute']);
    await staffWithRole(db, USERS.refunder, 'iadeci');
    for (const action of ['refund', 'refund_duplicate']) await expectRejected(db, USERS.refunder, action, 'forbidden', { role: 'NONE' });
  } finally { await db.close(); }
});

test('27 §2: dar kapsamlı izin tam kapsam yerine geçmez (scope_unsupported)', async () => {
  const db = await createDb();
  try {
    await customRole(db, 'saha_notcu', ['orders.read', 'orders.note', 'sites.capacity.manage']);
    await staffWithRole(db, USERS.scoped, 'saha_notcu', { kind: 'sites', siteIds: [IDS.land] });
    for (const action of ['note', 'reserve_capacity']) await expectRejected(db, USERS.scoped, action, 'scope_unsupported');
  } finally { await db.close(); }
});

test('27 §2: MFA zorlaması açıkken hassas eylemler aal1 ve bayat aal2 ile reddedilir; not ve fatura MFA istemez', async () => {
  const db = await createDb();
  try {
    await withMfaEnforced(async () => {
      for (const assurance of [AAL1, aal2(20)]) {
        for (const action of ['cancel_by_seller', 'refund', 'refund_duplicate', 'reserve_capacity']) {
          await expectRejected(db, IDS.superAdmin, action, 'mfa_required', { role: 'SUPER_ADMIN', assurance });
        }
      }
      for (const action of ['note', 'invoice_now', 'invoice_issued']) await expectAllowed(db, IDS.superAdmin, action, { role: 'SUPER_ADMIN', assurance: AAL1 });
      for (const action of ['cancel_by_seller', 'reserve_capacity', 'refund']) await expectAllowed(db, IDS.superAdmin, action, { role: 'SUPER_ADMIN', assurance: aal2(1) });
    });
  } finally { await db.close(); }
});

test('27 §2: oturum yoksa 401; geçersiz kimlik ve gövde iş servisine ulaşmaz', async () => {
  const db = await createDb();
  try {
    await expectRejected(db, IDS.superAdmin, 'note', 'unauthorized', { unauthenticated: true });
    const { post, calls } = orderRoute(db, IDS.superAdmin, { role: 'SUPER_ADMIN' });
    assert.equal((await post('gecersiz', ACTIONS.note)).status, 400);
    assert.equal((await post(await orderAt(db), { action: 'uydurma' })).status, 400);
    assert.equal((await post(await orderAt(db), { action: 'cancel_by_seller', reason: 'x' })).status, 400);
    assert.deepEqual(calls.service, []);
    assert.equal(calls.audit, 0);
  } finally { await db.close(); }
});

// ── Belge okuma (27 §3) ─────────────────────────────────────────────────────
function documentRoute(db, who, { role = 'NONE', assurance = AAL1 } = {}) {
  const route = load('app/api/admin/release-orders/[id]/belge/[kind]/route.ts', {
    'next/server': {},
    '@/lib/supabase/server': { createServiceRoleClient: () => restClient(db) },
    '@/lib/admin/permissions': gate({ db, userId: who, role, assurance }),
    '@/lib/api/envelope': envelope,
    '@/lib/orders/admin-access': load('lib/orders/admin-access.ts', { '@/lib/admin/permissions': gate({ db, userId: who, role, assurance }) }),
    '@/lib/orders/after-payment': { documentFileName: () => 'belge.pdf', loadStoredDocuments: async () => null, storedDocumentToPdf: () => new Uint8Array() },
    '@/lib/orders/types': { DOCUMENT_KINDS: ['pre_info', 'contract', 'withdrawal_form', 'kvkk_notice'] },
  });
  return (orderId, kind = 'contract') => route.GET(request({ url: `https://skytechgreen.com/api/admin/release-orders/${orderId}/belge/${kind}?bicim=html` }), { params: Promise.resolve({ id: orderId, kind }) });
}

async function withDocument(db) {
  const orderId = await orderAt(db);
  await db.query(`INSERT INTO order_documents(order_id, kind, title, html, sha256, template_version, locale) VALUES ($1,'contract','Sözleşme','<p>VKN 1234567890</p>',repeat('a',64),'test','tr')`, [orderId]);
  return orderId;
}

test('27 §3: belge üç izni (belge + iletişim + vergi) birlikte ister; başlıklar ve sandbox korunur', async () => {
  const db = await createDb();
  try {
    const orderId = await withDocument(db);
    const ok = await documentRoute(db, IDS.finance, { role: 'FINANCE' })(orderId);
    assert.equal(ok.status, 200, 'finans şablonu üç izne de sahip');
    assert.equal(ok.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(ok.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.equal(ok.headers.get('Referrer-Policy'), 'no-referrer');
    assert.match(ok.headers.get('Content-Security-Policy'), /^sandbox;/);

    await customRole(db, 'belge_okur', ['orders.read', 'orders.documents.read']);
    await staffWithRole(db, USERS.docsOnly, 'belge_okur');
    const docsOnly = await documentRoute(db, USERS.docsOnly)(orderId);
    assert.equal(docsOnly.status, 403, 'belge izni iletişim/vergi bilgisini dolaylı açmaz');
    assert.equal(docsOnly.body.error.code, 'forbidden');
    assert.equal(docsOnly.body.error.details.permission, 'customers.contact.read');

    const ops = await documentRoute(db, IDS.operations, { role: 'OPERATIONS' })(orderId);
    assert.equal(ops.status, 403);

    await withMfaEnforced(async () => {
      const mfa = await documentRoute(db, IDS.finance, { role: 'FINANCE', assurance: AAL1 })(orderId);
      assert.equal(mfa.body.error.code, 'mfa_required');
      assert.equal((await documentRoute(db, IDS.finance, { role: 'FINANCE', assurance: aal2(2) })(orderId)).status, 200);
    });

    const missing = await documentRoute(db, IDS.finance, { role: 'FINANCE' })(orderId, 'kvkk_notice');
    assert.equal(missing.status, 404, 'belge yoksa boş 404');
  } finally { await db.close(); }
});
