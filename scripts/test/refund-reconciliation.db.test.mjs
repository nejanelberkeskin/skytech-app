// 020 iade mutabakatı — gerçek SQL, PGlite (tek bağlantı; canlı DB/sağlayıcı/e-posta yok).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb, insertOrder, one, rows, sqlError, IDS } from './pglite-db.mjs';

// Sipariş iadesinde ödeme kimliği siparişin kendi kimliğidir (019 bunu denetler); çift tahsilatta verilen kimlik.
const claim = async (db, order, payment, amount = 20000, duplicate = false, actor = IDS.finance) => {
  const paymentId = duplicate ? payment : (await one(db, `SELECT payment_id FROM release_orders WHERE id=$1`, [order])).payment_id;
  return (await one(db, `SELECT claim_refund_operation($1,'mock',$2,$3,$4,$5) op`, [order, paymentId, amount, duplicate, actor])).op;
};
const record = (db, id, attempt, result) =>
  one(db, `SELECT record_refund_result($1,$2,$3::jsonb) r`, [id, attempt, JSON.stringify(result)]).then((r) => r.r);
const retry = (db, id, expected, actor = IDS.finance) =>
  one(db, `SELECT retry_refund_operation($1,$2,$3) r`, [id, actor, expected]).then((r) => r.r);
const resolve = (db, id, expected, outcome, { refundId = null, source = 'provider_panel', reference = null, note = 'iyzico panelinde kontrol edildi.', actor = IDS.finance } = {}) =>
  one(db, `SELECT resolve_refund_operation($1,$2,$3,$4,$5,$6,$7,$8) r`, [id, actor, expected, outcome, refundId, source, reference, note]).then((r) => r.r);
const finish = (db, id) => one(db, `SELECT finish_refund_operation($1) r`, [id]).then((r) => r.r);
const age = (db, id, minutes) => db.query(`UPDATE refund_operations SET attempt_started_at = now() - make_interval(mins => $2) WHERE id = $1`, [id, minutes]);
const events = (db, order, type) => rows(db, `SELECT data FROM order_events WHERE order_id=$1 AND type=$2 ORDER BY id`, [order, type]);

test('020: deneme sonucu sınıfına göre durum; yalnız başarı tamamlanabilir', async () => {
  const db = await createDb();
  try {
    for (const [outcome, state] of [['succeeded', 'provider_succeeded'], ['rejected', 'failed'], ['not_sent', 'failed'], ['unknown', 'needs_review']]) {
      const order = await insertOrder(db);
      const op = await claim(db, order, `P-${outcome}`);
      const r = await record(db, op.id, 1, { outcome, ...(outcome === 'succeeded' ? { refundId: 'R-1', method: 'refund' } : { errorCode: 'X', error: 'e'.repeat(400) }) });
      assert.equal(r.state, state);
      assert.equal(r.late, false);
      const [ev] = await events(db, order, 'refund_attempt_result');
      assert.equal(ev.data.outcome, outcome);
      if (outcome !== 'succeeded') assert.equal(ev.data.error.length, 300, 'hata metni 300 karakterde kesilir');
    }
    assert.match(await sqlError(record(db, (await claim(db, await insertOrder(db), 'P-x')).id, 1, { outcome: 'succeeded' })), /invalid_refund_id/);
    assert.match(await sqlError(record(db, (await claim(db, await insertOrder(db), 'P-y')).id, 1, { outcome: 'maybe' })), /invalid_outcome/);
  } finally { await db.close(); }
});

test('020: geç sonuç durumu değiştirmez, dikkat işareti koyar ve yeniden denemeyi engeller', async () => {
  const db = await createDb();
  try {
    const order = await insertOrder(db);
    const op = await claim(db, order, 'P-late');
    await record(db, op.id, 1, { outcome: 'rejected', errorCode: 'MOCK' });
    const late = await record(db, op.id, 1, { outcome: 'succeeded', refundId: 'R-late', method: 'refund' });
    assert.equal(late.state, 'failed');
    assert.equal(late.late, true);
    assert.equal(late.attention, true);
    assert.equal((await events(db, order, 'refund_late_result')).length, 1);
    assert.match(await sqlError(retry(db, op.id, 1)), /attention_required/);
    // Dikkat gerektiren başarısız işlem mutabakatla "iade yapıldı" olarak çözülür ve tamamlanır.
    const resolved = await resolve(db, op.id, 1, 'provider_succeeded', { refundId: 'R-late' });
    assert.equal(resolved.state, 'provider_succeeded');
    assert.equal(resolved.attention, false);
    assert.equal((await finish(db, op.id)).status, 'refunded');
  } finally { await db.close(); }
});

test('020: yeniden deneme yalnız kesin retten, beklenen deneme numarasıyla ve yetkili kişiyle', async () => {
  const db = await createDb();
  try {
    const order = await insertOrder(db);
    const op = await claim(db, order, 'P-retry');
    assert.match(await sqlError(retry(db, op.id, 1)), /invalid_state/, 'started iken yeniden deneme yok');
    await record(db, op.id, 1, { outcome: 'not_sent', errorCode: 'config' });
    assert.match(await sqlError(retry(db, op.id, 1, IDS.operations)), /forbidden/);
    assert.match(await sqlError(retry(db, op.id, 2)), /attempt_changed/);
    const again = await retry(db, op.id, 1);
    assert.equal(again.state, 'started');
    assert.equal(again.attempt_no, 2);
    assert.equal(again.fresh, true);
    assert.equal(again.result, null);
    assert.match(await sqlError(retry(db, op.id, 1)), /attempt_changed/, 'çift tıklama ikinci denemeyi açmaz');
    // Eski denemenin geç sonucu yeni denemeyi değiştirmez.
    const stale = await record(db, op.id, 1, { outcome: 'succeeded', refundId: 'R-old', method: 'refund' });
    assert.equal(stale.late, true);
    assert.equal(stale.state, 'started');
    const done = await record(db, op.id, 2, { outcome: 'succeeded', refundId: 'R-2', method: 'refund' });
    assert.equal(done.state, 'provider_succeeded');
    assert.equal((await rows(db, `SELECT 1 FROM order_events WHERE order_id=$1 AND type='refund_retry'`, [order])).length, 1);
    assert.equal((await rows(db, `SELECT 1 FROM admin_audit_logs WHERE entity='refund_operation' AND details->>'action'='retry'`)).length, 1);
    // Sipariş artık iade beklemiyorsa (ör. başka yoldan iade edildi) yeniden deneme yok.
    const order2 = await insertOrder(db);
    const op2 = await claim(db, order2, 'P-gone');
    await record(db, op2.id, 1, { outcome: 'rejected', errorCode: 'X' });
    await db.query(`UPDATE release_orders SET status='refunded', refunded_at=now() WHERE id=$1`, [order2]);
    assert.match(await sqlError(retry(db, op2.id, 1)), /order_not_refundable/);
  } finally { await db.close(); }
});

test('020: mutabakat kuralları — durum, erken karar, kimlik, not, kanıt, yetki', async () => {
  const db = await createDb();
  try {
    const order = await insertOrder(db);
    const op = await claim(db, order, 'P-res');
    assert.match(await sqlError(resolve(db, op.id, 1, 'provider_succeeded', { refundId: 'R' })), /invalid_state/, 'taze started çözülemez');
    await age(db, op.id, 16);
    assert.match(await sqlError(resolve(db, op.id, 1, 'failed')), /too_early/, '30 dk dolmadan "iade yapılmadı" yok');
    const early = await resolve(db, op.id, 1, 'failed').catch((e) => e);
    assert.match(early.message, /too_early/);
    assert.match(String(early.detail), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'DETAIL: ne zaman karar verilebileceği (UTC ISO)');
    assert.match(await sqlError(resolve(db, op.id, 1, 'provider_succeeded', { refundId: 'bad id!' })), /invalid_refund_id/);
    assert.match(await sqlError(resolve(db, op.id, 1, 'provider_succeeded', { refundId: 'R', note: 'kısa' })), /note_required/);
    assert.match(await sqlError(resolve(db, op.id, 1, 'provider_succeeded', { refundId: 'R', source: 'telefon' })), /evidence_required/);
    assert.match(await sqlError(resolve(db, op.id, 1, 'provider_succeeded', { refundId: 'R', actor: IDS.operations })), /forbidden/);
    assert.match(await sqlError(resolve(db, op.id, 7, 'provider_succeeded', { refundId: 'R' })), /attempt_changed/);
    await age(db, op.id, 31);
    const failed = await resolve(db, op.id, 1, 'failed', { source: 'bank_statement', reference: 'ekstre 22.09' });
    assert.equal(failed.state, 'failed');
    assert.equal(failed.resolution.outcome, 'failed');
    assert.equal(failed.resolution.previousState, 'started');
    const [ev] = await events(db, order, 'refund_resolved');
    assert.equal(ev.data.outcome, 'failed');
    assert.equal(ev.data.by, undefined, 'olay verisinde yönetici kimliği ayrıca tutulmaz (actor alanında)');
    assert.equal((await rows(db, `SELECT 1 FROM admin_audit_logs WHERE details->>'action'='resolve'`)).length, 1);
    // "iade yapılmadı" sonrası yeniden deneme mümkün.
    assert.equal((await retry(db, op.id, 1)).attempt_no, 2);
  } finally { await db.close(); }
});

test('020: belirsiz sonuç → "iade yapıldı" mutabakatı → tek tamamlama (kapasite bir kez, fatura, sertifika)', async () => {
  const db = await createDb();
  try {
    const order = await insertOrder(db, { quantity: 30 });
    await db.query(`UPDATE release_orders SET certificate_code='SG-ABCD-EFGH' WHERE id=$1`, [order]);
    await db.query(`INSERT INTO order_invoices(order_id, kind, provider, status, created_by) VALUES ($1,'sale','manual','issued','system')`, [order]);
    const op = await claim(db, order, 'P-rec', 30000);
    await record(db, op.id, 1, { outcome: 'unknown', errorCode: 'timeout' });
    const resolved = await resolve(db, op.id, 1, 'provider_succeeded', { refundId: 'IYZ-778', note: 'iyzico panelinde 14:05 iadesi görüldü.' });
    assert.equal(resolved.result.method, 'reconciled');
    const before = (await one(db, `SELECT reserved_seeds FROM lands WHERE id=$1`, [IDS.land])).reserved_seeds;
    const done = await finish(db, op.id);
    assert.equal(done.status, 'refunded');
    await finish(db, op.id);
    assert.equal((await one(db, `SELECT reserved_seeds FROM lands WHERE id=$1`, [IDS.land])).reserved_seeds, before - 30, 'kapasite bir kez bırakılır');
    assert.equal((await rows(db, `SELECT 1 FROM order_invoices WHERE order_id=$1 AND kind='refund'`, [order])).length, 1);
    assert.ok((await one(db, `SELECT certificate_cancelled_at FROM release_orders WHERE id=$1`, [order])).certificate_cancelled_at);
    const [succeeded] = await events(db, order, 'refund_succeeded');
    assert.equal(succeeded.data.refundId, 'IYZ-778');
    assert.equal(succeeded.data.method, 'reconciled');
  } finally { await db.close(); }
});

test('020: çift tahsilat iadesi siparişin durumunu değiştirmez; mutabakat ve yeniden deneme aynı kurallarla', async () => {
  const db = await createDb();
  try {
    const order = await insertOrder(db, { status: 'confirmed', withdrawal_requested_at: null });
    await db.query(`INSERT INTO order_events(order_id,type,actor,data) VALUES ($1,'payment_succeeded','system',$2::jsonb)`,
      [order, JSON.stringify({ duplicate: true, paymentId: 'DUP-1', paidKurus: 20000, provider: 'mock' })]);
    const op = await claim(db, order, 'DUP-1', 20000, true);
    await record(db, op.id, 1, { outcome: 'rejected', errorCode: 'X' });
    const again = await retry(db, op.id, 1);
    assert.equal(again.attempt_no, 2);
    await record(db, op.id, 2, { outcome: 'succeeded', refundId: 'R-DUP', method: 'refund' });
    const done = await finish(db, op.id);
    assert.equal(done.status, 'confirmed');
    assert.equal((await one(db, `SELECT count(*)::int n FROM order_refunds WHERE order_id=$1`, [order])).n, 0);
  } finally { await db.close(); }
});

test('020: deneme siparişi temizliği iade kayıtlarını da kaldırır', async () => {
  const db = await createDb();
  try {
    const order = await insertOrder(db, { is_test: true });
    const op = await claim(db, order, 'P-test');
    await record(db, op.id, 1, { outcome: 'unknown', errorCode: 'timeout' });
    assert.equal((await one(db, `SELECT purge_test_orders() n`)).n, 1);
    assert.equal((await one(db, `SELECT count(*)::int n FROM refund_operations`)).n, 0);
  } finally { await db.close(); }
});
