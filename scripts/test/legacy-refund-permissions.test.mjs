import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { loadSource as load } from './load-source.mjs';

const response = { json: (body, init) => ({ body, status: init?.status ?? 200, headers: init?.headers }) };
const keys = load('lib/admin/permission-keys.ts');
const envelope = load('lib/api/envelope.ts', { 'next/server': { NextResponse: response } });
const id = '11111111-1111-4111-8111-111111111111';
const full = [{ key: 'refunds.execute', scopes: [{ kind: 'all' }] }];
const fresh = () => ({ aal: 'aal2', enrolled: true, verifiedAt: new Date().toISOString() });
const actions = [{ action: 'refund' }, { action: 'refund_duplicate', paymentId: 'payment-duplicate' }];

function setup({ role = 'FINANCE', permissions = full, assurance = fresh(), accessError = false, authStatus } = {}) {
  const calls = [];
  const admin = { id: 'admin', user_id: 'actor', role, is_active: true };
  const auth = { requireAdmin: async (_request, roles) => authStatus || (roles && !roles.includes(role))
    ? { admin: null, error: response.json({ error: 'forbidden' }, { status: authStatus ?? 403 }) }
    : { admin, error: null }, getClientIP: () => '127.0.0.1' };
  const gate = load('lib/admin/permissions.ts', {
    '@/lib/admin-auth': auth, '@/lib/api/envelope': envelope,
    '@/lib/supabase/server': { createServiceRoleClient: () => ({ rpc: async (name) => {
      assert.equal(name, 'admin_effective_permissions'); calls.push('permission');
      return { data: { adminId: 'admin', permissions, roles: [] }, error: accessError ? { code: 'fixture' } : null };
    } }) },
    './mfa': { sessionAssurance: async () => assurance }, './permission-keys': keys,
  });
  const db = { fixture: true };
  const service = name => async (...args) => { calls.push({ service: name, args }); return { ok: true, order: { id, status: 'refunded', total_kurus: 12300 } }; };
  const route = load('app/api/admin/release-orders/[id]/route.ts', {
    'next/server': { NextResponse: response, after: fn => { assert.equal(typeof fn, 'function'); calls.push('deferred-email'); } }, zod: { z },
    '@/lib/supabase/server': { createServiceRoleClient: () => { calls.push('operational-db'); return db; } },
    '@/lib/admin-auth': auth, '@/lib/admin/permissions': gate,
    '@/lib/orders/admin-access': load('lib/orders/admin-access.ts', { '@/lib/admin/permissions': gate }),
    '@/lib/api/envelope': envelope,
    '@/lib/admin/audit': { auditLog: async (_db, record) => { calls.push({ audit: record }); return []; } },
    '@/lib/orders/admin-actions': Object.fromEntries(['executeRefund', 'refundDuplicate', 'queueInvoice', 'cancelBySeller', 'reserveCapacityNow', 'markInvoiceIssued'].map(name => [name, service(name)])),
    '@/lib/orders/admin-detail': { loadOrderDetail: () => { throw new Error('Unexpected detail'); } },
    '@/lib/orders/admin-mails': { sendRefundCompletedEmail: () => { throw new Error('Real mail forbidden'); }, sendSellerCancellationEmail: () => { throw new Error('Real mail forbidden'); } },
    '@/lib/orders/store': { addOrderEvent: () => { throw new Error('Unexpected event'); } },
  });
  return { calls, db, post: body => route.POST({ json: async () => body }, { params: Promise.resolve({ id }) }) };
}

async function enforced(fn, value = '1') {
  const before = process.env.ADMIN_MFA_ENFORCED;
  process.env.ADMIN_MFA_ENFORCED = value;
  try { await fn(); } finally { if (before === undefined) delete process.env.ADMIN_MFA_ENFORCED; else process.env.ADMIN_MFA_ENFORCED = before; }
}

test('Legacy refund + duplicate: FINANCE and owner need fresh MFA before any financial work', async () => enforced(async () => {
  for (const role of ['FINANCE', 'SUPER_ADMIN']) for (const body of actions) for (const assurance of [
    { aal: 'aal1', enrolled: false, verifiedAt: null },
    { aal: 'aal1', enrolled: true, verifiedAt: null },
    { aal: 'aal2', enrolled: true, verifiedAt: new Date(Date.now() - 16 * 60000).toISOString() },
  ]) {
    const app = setup({ role, assurance }); const result = await app.post(body);
    assert.equal(result.status, 403); assert.equal(result.body.error.code, 'mfa_required');
    assert.equal(result.headers['Cache-Control'], 'private, no-store');
    assert.deepEqual(app.calls, ['permission']);
  }
}));

test('Legacy refund: missing, malformed, sites and assigned permission scopes never run service', async () => enforced(async () => {
  for (const body of actions) for (const permissions of [[], [{ key: 'finance.read', scopes: [{ kind: 'all' }] }],
    [{ key: 'refunds.execute', scopes: [{ kind: 'sites', siteIds: ['site'] }] }],
    [{ key: 'refunds.execute', scopes: [{ kind: 'assigned' }] }],
    [{ key: 'refunds.execute', scopes: [{ kind: 'broken' }] }],
  ]) {
    const app = setup({ permissions }); const result = await app.post(body);
    assert.equal(result.status, 403); assert.ok(['forbidden', 'scope_unsupported'].includes(result.body.error.code));
    assert.deepEqual(app.calls, ['permission']);
  }
  const app = setup({ accessError: true }); assert.equal((await app.post(actions[0])).status, 403);
  assert.deepEqual(app.calls, ['permission']);
}));

test('Legacy route retains its old role/session limit even with full refund grant', async () => enforced(async () => {
  for (const body of actions) for (const options of [{ role: 'NONE' }, { role: 'OPERATIONS' }, { authStatus: 401 }, { authStatus: 403 }]) {
    const app = setup(options); const result = await app.post(body);
    assert.equal(result.status, options.authStatus ?? 403); assert.deepEqual(app.calls, []);
  }
}));

test('Authorized legacy refund requests preserve service arguments, money result and notification scheduling', async () => enforced(async () => {
  for (const body of actions) {
    const app = setup(); const result = await app.post(body);
    // 27 §5: bütün yanıtlar standart zarfta.
    assert.equal(result.status, 200); assert.deepEqual(result.body, { ok: true, data: { status: 'refunded' } });
    const service = app.calls.find(c => c?.service);
    assert.equal(service.service, body.action === 'refund' ? 'executeRefund' : 'refundDuplicate');
    assert.deepEqual(service.args, body.action === 'refund' ? [id, 'actor', '127.0.0.1', app.db] : [id, body.paymentId, 'actor', '127.0.0.1', app.db]);
    assert.equal(app.calls.filter(c => c?.service).length, 1);
    assert.equal(app.calls.includes('deferred-email'), body.action === 'refund');
    assert.equal(app.calls.find(c => c?.audit).audit.details.action, body.action);
  }
}));

test('Guard uses existing rollout setting; invoice action now needs invoices.manage (web-brifler/27 §2)', async () => {
  await enforced(async () => {
    const app = setup({ assurance: { aal: 'aal1', enrolled: false, verifiedAt: null } });
    assert.equal((await app.post(actions[0])).status, 200);
  }, '0');
  await enforced(async () => {
    const denied = setup({ permissions: [] }); const result = await denied.post({ action: 'invoice_now' });
    assert.equal(result.status, 403); assert.equal(result.body.error.code, 'forbidden');
    assert.equal(denied.calls.some(c => c?.service), false, 'izinsiz fatura isteği iş servisine ulaşmaz');
    // invoices.manage MFA setinde değil: aal1 ile izin verilir (27 §2, §8 karar notu).
    const app = setup({ permissions: [{ key: 'invoices.manage', scopes: [{ kind: 'all' }] }], assurance: { aal: 'aal1', enrolled: false, verifiedAt: null } });
    assert.equal((await app.post({ action: 'invoice_now' })).status, 200);
    assert.equal(app.calls.find(c => c?.service).service, 'queueInvoice');
  });
});

test('MFA denial is not retried by the actual browser transport (403 or 428)', async t => {
  const client = load('components/admin/operations/client.ts');
  for (const status of [403, 428]) {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ ok: false, error: { code: 'mfa_required', message: 'Doğrulama gerekli.' } }, { status }); });
    await assert.rejects(client.adminRequest('/fixture/execute', { kind: 'order' }), e => e.code === 'mfa_required' && e.status === status);
    assert.equal(calls, 1);
    t.mock.restoreAll();
  }
});
