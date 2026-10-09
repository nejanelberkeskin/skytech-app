// Regression coverage based on Claude review D1/D2 and T3-T6. Real SQL/worker, synthetic provider only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDb, insertOrder, one, restClient } from './pglite-db.mjs';
import { loadSource as load } from './load-source.mjs';

const forbidden = () => { throw new Error('live_dependency_forbidden'); };
class DeliveryError extends Error { constructor(code, permanent = false) { super(code); this.code = code; this.permanent = permanent; } }
const worker = load('lib/orders/notification-outbox.ts', { '@/lib/mail': { NotificationDeliveryError: DeliveryError, notificationSenderConfigured: forbidden, sendFrozenNotification: forbidden }, './notification-payload': { prepareNotification: forbidden } });
const sql = await readFile(new URL('../../supabase/migrations/036_notification_outbox.sql', import.meta.url), 'utf8');
const body = JSON.stringify({ from: 'test@example.invalid', to: ['buyer@example.invalid'], subject: 'Yerel deneme', html: '<p>donmuş</p>' });
async function setup() {
  const db = await createDb();
  await db.exec('CREATE TABLE IF NOT EXISTS email_logs(id uuid DEFAULT gen_random_uuid(),template text,recipient_email text,subject text,related_id text,resend_id text,status text);');
  await db.exec(sql);
  return db;
}
const claim = async (db) => (await restClient(db).rpc('claim_order_notification', { p_templates: ['release_order_confirm'], p_order: null })).data;
const step = async (db, j, action, extra = {}) => { const r = await restClient(db).rpc('advance_order_notification', { p_id: j.id, p_claim: j.claim_token, p_action: action, ...extra }); if (r.error) throw new Error(r.error.message); return r.data; };
const run = (db, deps) => worker.runNotificationOutbox('https://example.invalid', restClient(db), { templates: ['release_order_confirm'] }, { configured: () => true, prepare: async () => body, send: async () => ({ id: 'saglayici-yeni' }), ...deps });

test('D1: eski kodun gönderdiği bildirim yeni kuyrukta tekrar gönderilmez', async () => {
  const db = await setup();
  try {
    // 036 uygulandı, kod hâlâ eski: ödeme güncellemesi tetikleyiciyle kuyruğa yazar; eski kod e-postayı doğrudan gönderip
    // olayını kaydeder (eski recordEmailResults: email_sent + sağlayıcı kimliği).
    const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
    await db.query("INSERT INTO order_events(order_id,type,actor,data) VALUES($1,'email_sent','system',$2::jsonb)", [id, JSON.stringify({ template: 'release_order_confirm', id: 'eski-kod-saglayici-id' })]);
    // Yeni kod üç gün sonra dağıtılır; ağa hiç çıkmamış kuyruk kaydının süresi dolmaz (23 saat sınırı yalnız first_network_at'ten sonra).
    await db.exec("UPDATE order_notification_outbox SET created_at=now()-interval '3 days', next_attempt_at=now()-interval '3 days'");
    const gonderilen = [];
    const rapor = await run(db, { send: async (b, k) => { gonderilen.push(k); return { id: 'saglayici-yeni' }; } });
    const satir = await one(db, "SELECT state, provider_id FROM order_notification_outbox WHERE order_id=$1 AND template='release_order_confirm'", [id]);
    const olay = await one(db, "SELECT count(*)::int AS n FROM order_events WHERE order_id=$1 AND type='email_sent' AND data->>'template'='release_order_confirm'", [id]);
    console.log(JSON.stringify({ rapor: { sent: rapor.sent }, gonderim: gonderilen.length, satir, emailSentOlayi: olay.n }));
    assert.equal(gonderilen.length, 0, 'eski gönderim varken ikinci gönderim yapılmamalı');
    assert.equal(satir.state, 'needs_review');
    assert.equal(olay.n, 1, 'ilk gönderim kanıtı korunmalı');
  } finally { await db.close(); }
});

test('D2: ağ öncesi hata 24 denemeden sonra incelemeye düşer', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = await setup();
  try {
    const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
    for (let i = 0; i < 30; i++) {
      await db.exec("UPDATE order_notification_outbox SET next_attempt_at=now()-interval '1 second' WHERE state='pending'");
      await run(db, { prepare: async () => { throw new Error('render_bug'); }, send: forbidden });
    }
    const satir = await one(db, "SELECT state, attempt_count, last_error, first_network_at FROM order_notification_outbox WHERE order_id=$1 AND template='release_order_confirm'", [id]);
    const olay = await one(db, "SELECT count(*)::int AS n FROM order_events WHERE order_id=$1 AND type='email_failed'", [id]);
    console.log(JSON.stringify({ satir, emailFailedOlayi: olay.n }));
    assert.deepEqual({ state: satir.state, attempt_count: satir.attempt_count, first_network_at: satir.first_network_at }, { state: 'needs_review', attempt_count: 24, first_network_at: null });
    assert.equal(olay.n, 24);
    assert.equal(satir.last_error, 'preparation_attempts_exhausted');
  } finally { await db.close(); }
});

// Permanent regressions for existing lease, settlement, evidence and integrity guards.
test('BOŞLUK K2: süresi geçen kiralama, kimse yeniden almamış olsa da ilerletemez', async () => {
  const db = await setup();
  try {
    const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
    const j = await claim(db);
    await step(db, j, 'freeze', { p_body: body });
    await db.query("UPDATE order_notification_outbox SET lease_until=now()-interval '1 second' WHERE id=$1", [j.id]);
    assert.equal(await step(db, j, 'begin'), null);
    assert.equal((await one(db, 'SELECT first_network_at FROM order_notification_outbox WHERE id=$1', [j.id])).first_network_at, null);
  } finally { await db.close(); }
});

test('BOŞLUK K7: begin olmadan sent kaydedilemez', async () => {
  const db = await setup();
  try {
    const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
    const j = await claim(db);
    await step(db, j, 'freeze', { p_body: body });
    await assert.rejects(() => step(db, j, 'sent', { p_provider_id: 'saglayici-x' }), /notification_not_started/);
  } finally { await db.close(); }
});

test('BOŞLUK K10: elle incelemede kısa ya da boş kanıt reddedilir', async () => {
  const db = await setup();
  try {
    const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
    const j = await claim(db);
    await step(db, j, 'review', { p_error: 'yerel' });
    for (const kanit of ['', 'kısa', null]) {
      const r = await restClient(db).rpc('review_order_notification', { p_id: j.id, p_action: 'dismiss', p_evidence: kanit });
      assert.ok(r.error, `kanıt ${JSON.stringify(kanit)} kabul edildi`);
    }
    assert.equal((await one(db, 'SELECT state FROM order_notification_outbox WHERE id=$1', [j.id])).state, 'needs_review');
  } finally { await db.close(); }
});

test('BOŞLUK K13: dondurulduktan sonra veritabanında değiştirilmiş gövde gönderilmez', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = await setup();
  try {
    const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
    const j = await claim(db);
    await step(db, j, 'freeze', { p_body: body });
    await step(db, j, 'retry', { p_error: 'yerel' });
    // İşlevler dışından doğrudan değişiklik (ör. elle SQL): içerik değişir, özet aynı kalır.
    await db.query("UPDATE order_notification_outbox SET body=replace(body,'donmuş','DEĞİŞTİ'), next_attempt_at=now()-interval '1 second' WHERE id=$1", [j.id]);
    const gonderilen = [];
    await run(db, { send: async (b) => { gonderilen.push(b); return { id: 'x' }; } });
    assert.deepEqual(gonderilen, []);
    assert.equal((await one(db, 'SELECT state FROM order_notification_outbox WHERE id=$1', [j.id])).state, 'needs_review');
  } finally { await db.close(); }
});

test('D1: claim sonrası gelen eski teslim kanıtı begin öncesinde gönderimi durdurur', async () => {
  const db = await setup();
  try {
    const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
    const j = await claim(db);
    await step(db, j, 'freeze', { p_body: body });
    await db.query("INSERT INTO order_events(order_id,type,actor,data) VALUES($1,'email_sent','system',$2::jsonb)", [id, JSON.stringify({template:'release_order_confirm',id:'old-sender-accepted'})]);
    assert.equal(await step(db, j, 'begin'), null);
    assert.deepEqual(await one(db, 'SELECT state,last_error,first_network_at FROM order_notification_outbox WHERE id=$1', [j.id]), {
      state:'needs_review', last_error:'existing_delivery_evidence', first_network_at:null,
    });
  } finally { await db.close(); }
});

test('D1: başka şablon veya geçersiz eski gönderim kaydı geçerli işi engellemez', async () => {
  const db = await setup();
  try {
    const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
    for (const data of [
      {template:'release_order_notify',id:'other-template'},
      {template:'release_order_confirm',id:''},
      {template:'release_order_confirm',id:'skipped-no-api-key'},
    ]) await db.query("INSERT INTO order_events(order_id,type,actor,data) VALUES($1,'email_sent','system',$2::jsonb)", [id, JSON.stringify(data)]);
    let sends=0;
    assert.equal((await run(db,{send:async()=>{sends++;return{id:'new-valid'};}})).sent,1);
    assert.equal(sends,1);
  } finally { await db.close(); }
});

test('D2: ağ başlamadan 24. sahip çökerse süresi dolan iş yeniden alınmaz', async () => {
  const db = await setup();
  try {
    const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
    let j;
    for(let i=1;i<=24;i++) {
      j=await claim(db); assert.equal(j.attempt_count,i);
      await db.query("UPDATE order_notification_outbox SET lease_until=now()-interval '1 second' WHERE id=$1",[j.id]);
    }
    assert.equal(await claim(db),null);
    assert.equal(await step(db,j,'begin'),null);
    assert.deepEqual(await one(db,'SELECT state,attempt_count,last_error FROM order_notification_outbox WHERE id=$1',[j.id]), {
      state:'needs_review',attempt_count:24,last_error:'preparation_attempts_exhausted',
    });
  } finally { await db.close(); }
});

test('D2: ağ başladıysa hazırlık sınırı aynı anahtarla kurtarmayı kesmez', async () => {
  const db = await setup();
  try {
    const id = await insertOrder(db, { status: 'awaiting_payment', paid_at: null, withdrawal_requested_at: null });
    await db.query("UPDATE release_orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
    const j=await claim(db);
    await step(db,j,'freeze',{p_body:body});
    await step(db,j,'begin');
    await db.query('UPDATE order_notification_outbox SET attempt_count=24 WHERE id=$1',[j.id]);
    await step(db,j,'retry',{p_error:'response_lost'});
    await db.query("UPDATE order_notification_outbox SET next_attempt_at=now()-interval '1 second' WHERE id=$1",[j.id]);
    const calls=[];
    assert.equal((await run(db,{prepare:forbidden,send:async(b,k)=>{calls.push({b,k});return{id:'same-provider'};}})).sent,1);
    assert.deepEqual(calls,[{b:body,k:`sg-outbox/${j.id}`}]);
    assert.equal((await one(db,'SELECT attempt_count FROM order_notification_outbox WHERE id=$1',[j.id])).attempt_count,25);
  } finally { await db.close(); }
});
