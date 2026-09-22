// İade servisi (lib/refunds/service.ts) — gerçek 019/020 SQL'i PGlite'ta, sağlayıcı taklit.
// Canlı veritabanı, iyzico ve e-posta çağrılmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb, insertOrder, one, restClient, IDS } from './pglite-db.mjs';
import { createRefundService } from '../../lib/refunds/service.ts';

const FINANCE = { user_id: IDS.finance };

function setup(db, { outcomes = [{ ok: true }], rpcHook, providerName = 'mock', providerAvailable = true } = {}) {
  const calls = [];
  const logs = [];
  const queue = [...outcomes];
  const provider = {
    name: providerName,
    isTest: true,
    async refund(input) {
      calls.push(input);
      await Promise.resolve();
      const next = queue.length > 1 ? queue.shift() : queue[0];
      return next.ok ? { ok: true, refundId: `R-${calls.length}`, method: 'refund' } : next;
    },
  };
  const service = createRefundService({
    db: restClient(db, { rpc: rpcHook }),
    getProvider: (name) => (providerAvailable && name === providerName ? provider : null),
    now: () => new Date(),
    log: (message, data) => logs.push({ message, data }),
    pause: async () => {},
  });
  return { service, calls, logs };
}

const ageAttempt = (db, minutes) => db.query(`UPDATE refund_operations SET attempt_started_at = now() - make_interval(mins => $1)`, [minutes]);

test('servis: başarılı iade tek sağlayıcı çağrısıyla tamamlanır, müşteri bildirimi hazırlanır', async () => {
  const db = await createDb();
  try {
    const { service, calls } = setup(db);
    const order = await insertOrder(db);
    const r = await service.execute(order, { kind: 'order' }, FINANCE, '203.0.113.9');
    assert.equal(r.ok, true);
    assert.deepEqual(r.result, { action: 'execute', operationId: r.result.operationId, outcome: 'completed' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].amountKurus, 20000, 'tutar kayıttan gelir');
    assert.equal(calls[0].ip, '203.0.113.9');
    assert.equal(r.notify.status, 'refunded', 'tamamlanan sipariş iadesinde e-posta için sipariş döner');
    assert.equal(r.view.order.status, 'refunded');
    assert.equal(r.view.operations[0].state, 'completed');
    assert.deepEqual(r.view.operations[0].allowedActions, []);
    assert.ok(r.view.history.some((h) => h.type === 'refund_succeeded'));
    const again = await service.execute(order, { kind: 'order' }, FINANCE, null);
    assert.equal(again.code, 'already_done');
    assert.equal(calls.length, 1);
  } finally { await db.close(); }
});

test('servis: aynı anda iki istek sağlayıcıyı bir kez çağırır', async () => {
  const db = await createDb();
  try {
    const { service, calls } = setup(db);
    const order = await insertOrder(db);
    const results = await Promise.all([
      service.execute(order, { kind: 'order' }, FINANCE, null),
      service.execute(order, { kind: 'order' }, FINANCE, null),
    ]);
    assert.equal(calls.length, 1);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.ok(['in_progress', 'already_done'].includes(results.find((r) => !r.ok).code));
  } finally { await db.close(); }
});

test('servis: belirsiz sonuç mutabakata gider, tekrar çağrılmaz; "iade yapıldı" ile tamamlanır', async () => {
  const db = await createDb();
  try {
    const { service, calls } = setup(db, { outcomes: [{ ok: false, outcome: 'unknown', errorCode: 'timeout', error: 'iyzico yanıt vermedi' }] });
    const order = await insertOrder(db);
    const r = await service.execute(order, { kind: 'order' }, FINANCE, null);
    assert.equal(r.result.outcome, 'needs_review');
    const op = r.view.operations[0];
    assert.deepEqual(op.allowedActions, ['resolve_succeeded']);
    assert.equal(op.blockedActions[0].action, 'resolve_failed');
    assert.equal(op.blockedActions[0].reason, 'too_early');
    assert.equal(op.lastResult.errorCode, 'timeout');
    assert.equal((await service.execute(order, { kind: 'order' }, FINANCE, null)).code, 'invalid_state');
    const early = await service.resolve(op.id, { expectedAttempt: 1, outcome: 'failed', source: 'provider_panel', note: 'Panelde iade görünmüyor.' }, FINANCE);
    assert.equal(early.code, 'too_early');
    assert.match(String(early.details?.availableAt), /Z$/);
    const done = await service.resolve(op.id, { expectedAttempt: 1, outcome: 'provider_succeeded', refundId: 'IYZ-1', source: 'provider_panel', note: 'Panelde 14:05 iadesi görüldü.' }, FINANCE);
    assert.equal(done.result.outcome, 'completed');
    assert.equal(done.notify.status, 'refunded');
    assert.equal(done.view.operations[0].resolution.by.label, 'Finans');
    assert.equal(calls.length, 1, 'mutabakat sağlayıcıyı çağırmaz');
  } finally { await db.close(); }
});

test('servis: kesin ret → yeniden deneme → başarı; eski deneme numarasıyla ikinci yeniden deneme olmaz', async () => {
  const db = await createDb();
  try {
    const { service, calls } = setup(db, { outcomes: [{ ok: false, outcome: 'rejected', errorCode: 'X1', error: 'red' }, { ok: true }] });
    const order = await insertOrder(db);
    const first = await service.execute(order, { kind: 'order' }, FINANCE, null);
    assert.equal(first.result.outcome, 'failed');
    const op = first.view.operations[0];
    assert.deepEqual(op.allowedActions, ['retry']);
    const retried = await service.retry(op.id, 1, FINANCE, null);
    assert.equal(retried.result.outcome, 'completed');
    assert.equal(retried.view.operations[0].attempt, 2);
    assert.equal(calls.length, 2);
    assert.equal((await service.retry(op.id, 1, FINANCE, null)).code, 'attempt_changed');
    assert.equal(calls.length, 2);
  } finally { await db.close(); }
});

test('servis: sonuç kaydedilemezse sağlayıcı tekrar çağrılmaz; iade kimliği loga ve uyarıya yazılır', async () => {
  const db = await createDb();
  try {
    const { service, calls, logs } = setup(db, { rpcHook: (name) => (name === 'record_refund_result' ? { message: 'connection reset' } : null) });
    const order = await insertOrder(db);
    const r = await service.execute(order, { kind: 'order' }, FINANCE, null);
    assert.equal(r.ok, true);
    assert.equal(r.result.outcome, 'needs_review');
    assert.equal(r.warnings[0].code, 'result_not_recorded');
    assert.match(r.warnings[0].message, /R-1/);
    assert.equal(logs[0].data.refundId, 'R-1');
    assert.equal(logs[0].data.orderNo.startsWith('SG-'), true);
    assert.equal(JSON.stringify(logs).includes('test@example.com'), false, 'logda kişisel veri yok');
    assert.equal(r.view.operations[0].state, 'started');
    assert.equal((await service.execute(order, { kind: 'order' }, FINANCE, null)).code, 'in_progress');
    assert.equal(calls.length, 1);
    await ageAttempt(db, 16);
    const view = await service.orderView(order, true);
    assert.equal(view.operations[0].stale, true);
    assert.ok(view.operations[0].allowedActions.includes('resolve_succeeded'));
  } finally { await db.close(); }
});

test('servis: yanıtı kaybolan kayıt yeniden yazılmaz (geç sonuç sayılmaz)', async () => {
  const db = await createDb();
  try {
    let first = true;
    const client = restClient(db);
    const { service } = setup(db, {
      rpcHook: (name, args) => {
        if (name !== 'record_refund_result' || !first) return null;
        first = false;
        // Kayıt gerçekten yazılsın ama yanıt kaybolsun.
        client.rpc(name, args);
        return { message: 'timeout' };
      },
    });
    const order = await insertOrder(db);
    const r = await service.execute(order, { kind: 'order' }, FINANCE, null);
    assert.equal(r.result.outcome, 'completed');
    assert.equal((await one(db, `SELECT attention FROM refund_operations`)).attention, false);
    assert.equal((await one(db, `SELECT count(*)::int n FROM order_events WHERE type='refund_late_result'`)).n, 0);
  } finally { await db.close(); }
});

test('servis: yerel tamamlama başarısızsa uyarı; finalize sağlayıcısız tamamlar, ikinci kez noop', async () => {
  const db = await createDb();
  try {
    let failFinish = true;
    const { service, calls } = setup(db, { rpcHook: (name) => (name === 'finish_refund_operation' && failFinish ? { message: 'deadlock detected' } : null) });
    const order = await insertOrder(db);
    const r = await service.execute(order, { kind: 'order' }, FINANCE, null);
    assert.equal(r.result.outcome, 'provider_succeeded');
    assert.equal(r.warnings[0].code, 'finalize_pending');
    assert.equal(r.notify, null);
    assert.deepEqual(r.view.operations[0].allowedActions, ['finalize']);
    failFinish = false;
    const fin = await service.finalize(r.result.operationId);
    assert.equal(fin.result.outcome, 'completed');
    assert.equal(fin.notify.status, 'refunded');
    assert.equal((await service.finalize(r.result.operationId)).result.outcome, 'noop');
    assert.equal(calls.length, 1);
  } finally { await db.close(); }
});

test('servis: çift tahsilat iadesi siparişi değiştirmez ve müşteri bildirimi hazırlamaz', async () => {
  const db = await createDb();
  try {
    const { service, calls } = setup(db);
    const order = await insertOrder(db, { status: 'confirmed', withdrawal_requested_at: null });
    await db.query(`INSERT INTO order_events(order_id,type,actor,data) VALUES ($1,'payment_succeeded','system',$2::jsonb)`,
      [order, JSON.stringify({ duplicate: true, paymentId: 'DUP-9', paidKurus: 20000, provider: 'mock' })]);
    const before = await service.orderView(order, true);
    const dup = before.operations.find((o) => o.kind === 'duplicate');
    assert.deepEqual([dup.state, dup.allowedActions], ['none', ['execute']]);
    assert.equal(before.operations.some((o) => o.kind === 'order'), false, 'iade beklemeyen siparişte sipariş iadesi yok');
    const orderPayment = (await one(db, `SELECT payment_id FROM release_orders WHERE id=$1`, [order])).payment_id;
    assert.equal((await service.execute(order, { kind: 'duplicate', paymentId: orderPayment }, FINANCE, null)).code, 'invalid_state');
    assert.equal((await service.execute(order, { kind: 'duplicate', paymentId: 'YOK' }, FINANCE, null)).code, 'not_found');
    const r = await service.execute(order, { kind: 'duplicate', paymentId: 'DUP-9' }, FINANCE, null);
    assert.equal(r.result.outcome, 'completed');
    assert.equal(r.notify, null);
    assert.equal(r.view.order.status, 'confirmed');
    assert.equal(calls[0].meta, null, 'çift tahsilatta ödeme özeti gönderilmez');
    assert.equal((await service.execute(order, { kind: 'duplicate', paymentId: 'DUP-9' }, FINANCE, null)).code, 'already_done');
  } finally { await db.close(); }
});

test('servis: sağlayıcı tanımsızsa işlem açılmaz; yetkisiz kişi reddedilir; olmayan sipariş 404', async () => {
  const db = await createDb();
  try {
    const order = await insertOrder(db);
    const missing = setup(db, { providerAvailable: false });
    assert.equal((await missing.service.execute(order, { kind: 'order' }, FINANCE, null)).code, 'provider_unavailable');
    assert.equal((await one(db, `SELECT count(*)::int n FROM refund_operations`)).n, 0);
    const { service, calls } = setup(db);
    assert.equal((await service.execute(order, { kind: 'order' }, { user_id: IDS.operations }, null)).code, 'forbidden');
    assert.equal(calls.length, 0);
    assert.equal((await service.orderView('30000000-0000-0000-0000-00000000ffff', true)).code, 'not_found');
    assert.equal((await service.finalize('40000000-0000-0000-0000-00000000ffff')).code, 'not_found');
  } finally { await db.close(); }
});
