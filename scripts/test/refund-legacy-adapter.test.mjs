// Sipariş ayrıntısındaki eski `refund` / `refund_duplicate` eylemleri (lib/orders/admin-actions.ts) artık tek iade
// servisini (lib/refunds/service.ts) kullanır. #62'deki taklit testlerin güvenceleri burada gerçek 019/020 SQL'i ile
// (PGlite) sınanır. Canlı veritabanı, iyzico ve e-posta çağrılmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
import { createDb, insertOrder, one, restClient, IDS } from './pglite-db.mjs';

const duplicates = load('lib/orders/duplicates.ts');
const model = load('lib/refunds/model.ts', { '@/lib/orders/duplicates': duplicates });
const service = load('lib/refunds/service.ts', { '@/lib/orders/duplicates': duplicates, './model': model });

function setup(db, { providerResult = { ok: true, refundId: 'fake', method: 'refund' }, rpcHook } = {}) {
  let calls = 0;
  const provider = { name: 'mock', isTest: true, refund: async () => { calls++; await Promise.resolve(); return providerResult; } };
  const api = load('lib/orders/admin-actions.ts', {
    '@/lib/payments': { getProviderByName: (name) => (name === 'mock' ? provider : null) },
    '@/lib/refunds/service': service,
    './duplicates': duplicates,
    './store': { db: () => { throw new Error('varsayılan istemci kullanılmamalı'); }, transitionOrder: async () => null, addOrderEvent: async () => {} },
  });
  return { api, client: restClient(db, { rpc: rpcHook }), get calls() { return calls; } };
}
const reserved = async (db) => (await one(db, `SELECT reserved_seeds FROM lands WHERE id=$1`, [IDS.land])).reserved_seeds;
const opState = async (db) => (await one(db, `SELECT state FROM refund_operations`)).state;

test('eski eylem: aynı anda iki çift tahsilat iadesi sağlayıcıyı bir kez çağırır', async () => {
  const db = await createDb();
  try {
    const order = await insertOrder(db, { status: 'confirmed', withdrawal_requested_at: null });
    await db.query(`INSERT INTO order_events(order_id,type,actor,data) VALUES ($1,'payment_succeeded','system',$2::jsonb)`,
      [order, JSON.stringify({ duplicate: true, paymentId: 'extra', paidKurus: 20000, provider: 'mock' })]);
    const x = setup(db);
    const results = await Promise.all([
      x.api.refundDuplicate(order, 'extra', IDS.finance, null, x.client),
      x.api.refundDuplicate(order, 'extra', IDS.finance, null, x.client),
    ]);
    assert.equal(x.calls, 1);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.ok(['in_progress', 'already_done'].includes(results.find((r) => !r.ok).error));
    assert.equal(results.find((r) => r.ok).order.status, 'confirmed', 'çift tahsilat iadesi siparişi değiştirmez');
  } finally { await db.close(); }
});

test('eski eylem: sonuç kaydedilemezse başarı bildirilmez, sağlayıcı tekrar çağrılmaz, kapasite yerinde', async () => {
  const db = await createDb();
  try {
    const order = await insertOrder(db);
    const before = await reserved(db);
    const x = setup(db, { rpcHook: (name) => (name === 'record_refund_result' ? { message: 'write_failure' } : null) });
    const first = await x.api.executeRefund(order, IDS.finance, null, x.client);
    assert.equal(first.error, 'unavailable');
    assert.match(first.detail, /iade no fake/);
    assert.equal((await x.api.executeRefund(order, IDS.finance, null, x.client)).error, 'in_progress');
    assert.equal(x.calls, 1);
    assert.equal(await reserved(db), before);
  } finally { await db.close(); }
});

test('eski eylem: geçici kayıt hatası ya da yanıtı kaybolan kayıt sağlayıcıyı tekrarlamaz', async () => {
  for (const mode of ['transient', 'lost-response']) {
    const db = await createDb();
    try {
      const order = await insertOrder(db);
      const before = await reserved(db);
      let failures = 0;
      const direct = restClient(db);
      const x = setup(db, {
        rpcHook: (name, args) => {
          if (name !== 'record_refund_result' || failures > 0) return null;
          failures++;
          if (mode === 'lost-response') direct.rpc(name, args); // yazılır ama yanıt kaybolur
          return { message: 'timeout' };
        },
      });
      const result = await x.api.executeRefund(order, IDS.finance, null, x.client);
      assert.equal(result.ok, true, mode);
      assert.equal(result.order.status, 'refunded');
      assert.equal(x.calls, 1);
      assert.equal(await reserved(db), before - 20, 'kapasite bir kez bırakılır');
      assert.equal((await one(db, `SELECT count(*)::int n FROM order_events WHERE type='refund_late_result'`)).n, 0);
    } finally { await db.close(); }
  }
});

test('eski eylem: yerel tamamlama başarısızsa yalnız veritabanı yeniden denenir', async () => {
  const db = await createDb();
  try {
    const order = await insertOrder(db);
    const before = await reserved(db);
    let failFinish = true;
    const x = setup(db, { rpcHook: (name) => (name === 'finish_refund_operation' && failFinish ? { message: 'write_failure' } : null) });
    for (let i = 0; i < 2; i++) assert.equal((await x.api.executeRefund(order, IDS.finance, null, x.client)).error, 'unavailable');
    assert.equal(await opState(db), 'provider_succeeded');
    assert.equal(await reserved(db), before);
    failFinish = false;
    const done = await x.api.executeRefund(order, IDS.finance, null, x.client);
    assert.equal(done.ok, true);
    assert.equal(x.calls, 1);
    assert.equal(await reserved(db), before - 20);
  } finally { await db.close(); }
});

test('eski eylem: belirsiz sonuç kendiliğinden yeniden alınmaz; kesin ret yeniden denemeye bırakılır', async () => {
  const db = await createDb();
  try {
    const order = await insertOrder(db);
    const x = setup(db, { providerResult: { ok: false, outcome: 'unknown', errorCode: 'timeout', error: 'iyzico yanıt vermedi' } });
    const first = await x.api.executeRefund(order, IDS.finance, null, x.client);
    assert.equal(first.error, 'provider_error');
    assert.match(first.detail, /Mutabakat gerekli/);
    assert.equal((await x.api.executeRefund(order, IDS.finance, null, x.client)).error, 'invalid_state');
    assert.equal(x.calls, 1);
    assert.equal(await opState(db), 'needs_review');

    const order2 = await insertOrder(db);
    const y = setup(db, { providerResult: { ok: false, outcome: 'rejected', errorCode: 'X', error: 'red' } });
    assert.equal((await y.api.executeRefund(order2, IDS.finance, null, y.client)).error, 'provider_error');
    assert.equal((await one(db, `SELECT state FROM refund_operations WHERE order_id=$1`, [order2])).state, 'failed');
  } finally { await db.close(); }
});
