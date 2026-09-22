// 020 tek finans hesabı ve zamanlanmış iş kayıtları — gerçek SQL, PGlite (canlı DB yok).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb, insertOrder, one, sqlError } from './pglite-db.mjs';

const NOW = '2026-09-22T12:00:00Z';
const overview = (db, now = NOW) => one(db, `SELECT admin_finance_overview($1::timestamptz, 6) f`, [now]).then((r) => r.f);
const dupCharge = (db, order, paymentId, kurus, at) =>
  db.query(`INSERT INTO order_events(order_id,type,actor,data,created_at) VALUES ($1,'payment_succeeded','system',$2::jsonb,$3)`,
    [order, JSON.stringify({ duplicate: true, paymentId, paidKurus: kurus, provider: 'mock' }), at]);

test('020 finans: kuruş toplamları, İstanbul ay sınırı, deneme hariç, çift tahsilat ve iadeler', async () => {
  const db = await createDb();
  try {
    // Eylül (İstanbul): 1 Eylül 00:30 TSİ = 31 Ağustos 21:30 UTC → Eylül'e sayılır.
    const a = await insertOrder(db, { status: 'confirmed', paid_at: '2026-08-31T21:30:00Z', withdrawal_requested_at: null });
    // Ağustos: 31 Ağustos 20:59 UTC = 23:59 TSİ.
    await insertOrder(db, { status: 'completed', paid_at: '2026-08-31T20:59:00Z', withdrawal_requested_at: null, quantity: 50 });
    // Eylül'de ödenmiş, cayma istenmiş (iade yükümlülüğü), 10 gün önce.
    await insertOrder(db, { status: 'withdrawal_requested', paid_at: '2026-09-05T10:00:00Z', withdrawal_requested_at: '2026-09-12T10:00:00Z', quantity: 30 });
    // Süresi geçmiş satıcı iptali (overdue).
    await insertOrder(db, { status: 'cancelled_by_seller', paid_at: '2026-08-01T10:00:00Z', withdrawal_requested_at: null, cancelled_at: '2026-09-01T10:00:00Z' });
    // Eylül'de iadesi tamamlanmış sipariş (Ağustos'ta ödenmiş).
    const refunded = await insertOrder(db, { status: 'refunded', paid_at: '2026-08-10T10:00:00Z' });
    await db.query(`UPDATE release_orders SET refunded_at='2026-09-03T10:00:00Z' WHERE id=$1`, [refunded]);
    await db.query(`INSERT INTO order_refunds(order_id,amount_kurus,reason,status,provider,requested_by,completed_at) VALUES ($1,20000,'withdrawal','succeeded','mock','system','2026-09-03T10:00:00Z')`, [refunded]);
    // Deneme siparişi (hariç).
    await insertOrder(db, { status: 'confirmed', is_test: true, paid_at: '2026-09-10T10:00:00Z', withdrawal_requested_at: null, quantity: 999 });
    // Ödenebilir bekleyen: biri süresi dolmamış, biri dolmuş (terk edilmiş sepet).
    await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null, payment_expires_at: '2026-09-22T12:30:00Z', payment_id: null });
    await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null, payment_expires_at: '2026-09-22T11:00:00Z', payment_id: null });
    // Çift tahsilat: biri Eylül'de gelmiş ve iade edilmemiş, biri Ağustos'ta gelmiş ve Eylül'de iade edilmiş.
    await dupCharge(db, a, 'DUP-OPEN', 20000, '2026-09-02T10:00:00Z');
    await dupCharge(db, a, 'DUP-DONE', 20000, '2026-08-20T10:00:00Z');
    await db.query(`INSERT INTO order_events(order_id,type,actor,data,created_at) VALUES ($1,'refund_succeeded','system',$2::jsonb,'2026-09-04T10:00:00Z')`,
      [a, JSON.stringify({ duplicate: true, paymentId: 'DUP-DONE', amountKurus: 20000 })]);

    const f = await overview(db);
    const cm = f.currentMonth;
    assert.equal(cm.key, '2026-09');
    assert.equal(cm.orderCollectionsKurus, 20000 + 30000, 'Eylül ödemeleri: 1 Eylül 00:30 TSİ + 5 Eylül');
    assert.equal(cm.paidOrderCount, 2);
    assert.equal(cm.duplicateChargesKurus, 20000);
    assert.equal(cm.orderRefundsKurus, 20000);
    assert.equal(cm.duplicateRefundsKurus, 20000);
    assert.equal(cm.netCashKurus, 50000 + 20000 - 20000 - 20000);
    assert.equal(f.allTime.heldOrderValueKurus, 20000 + 50000, 'confirmed + completed; iade sürecindekiler hariç; deneme hariç');
    assert.equal(f.allTime.heldOrderCount, 2);
    assert.equal(f.allTime.releasedQuantity, 50);
    assert.equal(f.allTime.refundedOrderCount, 1);
    assert.equal(f.liabilities.orderRefundLiabilityKurus, 30000 + 20000);
    assert.equal(f.liabilities.orderRefundLiabilityCount, 2);
    assert.equal(f.liabilities.duplicateLiabilityKurus, 20000);
    assert.equal(f.liabilities.duplicateLiabilityCount, 1);
    assert.equal(f.liabilities.overdueRefundCount, 1, 'satıcı iptalinden 21 gün geçmiş');
    assert.equal(f.pending.payableKurus, 20000, 'süresi dolmuş sepet sayılmaz');
    assert.equal(f.pending.payableCount, 1);
    assert.equal(f.operations.awaitingBatchCount, 1);
    assert.deepEqual(f.months.map((m) => m.key), ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    const aug = f.months.find((m) => m.key === '2026-08');
    assert.equal(aug.orderCollectionsKurus, 50000 + 20000 + 20000, 'Ağustos: 23:59 TSİ + iade edilen + satıcı iptali');
    assert.equal(aug.duplicateChargesKurus, 20000);
    assert.equal(aug.paidQuantity, 50 + 20 + 20);
  } finally { await db.close(); }
});

test('020 finans: bozuk olay verisi hesabı düşürmez; boş veritabanında sıfırlar', async () => {
  const db = await createDb();
  try {
    const empty = await overview(db);
    assert.equal(empty.currentMonth.netCashKurus, 0);
    assert.equal(empty.months.length, 6);
    const o = await insertOrder(db, { status: 'confirmed', withdrawal_requested_at: null });
    await db.query(`INSERT INTO order_events(order_id,type,actor,data) VALUES ($1,'payment_succeeded','system',$2::jsonb)`,
      [o, JSON.stringify({ duplicate: true, paymentId: 'BAD', paidKurus: '12.5' })]);
    const f = await overview(db);
    assert.equal(f.liabilities.duplicateLiabilityCount, 1);
    assert.equal(f.liabilities.duplicateLiabilityKurus, 0, 'tam sayı olmayan tutar 0 sayılır, hata vermez');
  } finally { await db.close(); }
});

test('020 iş kayıtları: tek çalışma kilidi, yarıda kalan çalışma kilidi bırakır, sonuç yazılır', async () => {
  const db = await createDb();
  try {
    const first = (await one(db, `SELECT start_job_run('siparis-isleri','cron','all',NULL) id`)).id;
    assert.match(await sqlError(one(db, `SELECT start_job_run('siparis-isleri','admin','status',NULL) id`)), /job_running/);
    await db.query(`SELECT finish_job_run($1, true, '{"expired":1}'::jsonb, NULL)`, [first]);
    await db.query(`SELECT finish_job_run($1, false, NULL, 'ikinci kez')`, [first]);
    const row = await one(db, `SELECT ok, report, error FROM job_runs WHERE id=$1`, [first]);
    assert.equal(row.ok, true, 'bitmiş çalışma ikinci kez yazılmaz');
    assert.deepEqual(row.report, { expired: 1 });
    const second = (await one(db, `SELECT start_job_run('siparis-isleri','admin','status',NULL) id`)).id;
    await db.query(`UPDATE job_runs SET started_at = now() - interval '11 minutes' WHERE id=$1`, [second]);
    const third = (await one(db, `SELECT start_job_run('siparis-isleri','cron','all',NULL) id`)).id;
    assert.ok(third);
    assert.equal((await one(db, `SELECT error FROM job_runs WHERE id=$1`, [second])).error, 'abandoned');
    assert.match(await sqlError(one(db, `SELECT start_job_run('Geçersiz İş','cron','all',NULL) id`)), /check/i);
  } finally { await db.close(); }
});
