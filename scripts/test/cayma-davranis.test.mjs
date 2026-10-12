// Cayma akışının GERÇEK davranışı (Astra hukuk paketi madde 5 / uygulama işi 4). Gerçek lib/orders/withdrawal.ts,
// state.ts, schedule.ts, withdrawal-period.ts, store.ts ve payment-flow.ts; gerçek 016–038 SQL'i (PGlite). Canlı
// veritabanı, iyzico, e-posta ve ağ çağrılmaz; e-posta kuyruğu yalnız veritabanında birikir, gönderilmez.
//
// Takvim İstanbul saatidir (UTC+3): "GG Ay 23:59 TR" = aynı günün 20:59Z'si.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSource as load } from './load-source.mjs';
import { createDb, insertOrder, one, rows, restClient } from './pglite-db.mjs';
import { adminClient } from './admin-rest-client.mjs';
import { withdrawalRequestSchema } from '../../lib/orders/schema.ts';
import { ORDER_VIEW_FIXTURES } from '../../lib/orders/view.ts';

const Period = load('lib/orders/withdrawal-period.ts');
const State = load('lib/orders/state.ts', { './withdrawal-period': Period });
const Schedule = load('lib/orders/schedule.ts');
const Dates = load('lib/orders/withdrawal-dates.ts', { './schedule': Schedule });

/** İstanbul yerel saati → Date ("2026-11-02T23:59" gibi, saniyesiz/saniyeli). */
const tr = (local) => new Date(`${local}${local.length === 16 ? ':00' : ''}+03:00`);
/** Ödeme anına göre sözleşmede gösterilen (ön hesap) son an. */
const deadlineFor = (paidAt) => Schedule.scheduleFor(paidAt).withdrawalDeadline;
const META = { channel: 'form', note: null, ipHash: null, userAgent: null };
const quiet = (t) => { t.mock.method(console, 'error', () => {}); t.mock.method(console, 'log', () => {}); };

async function setup({ failTables = [] } = {}) {
  const db = await createDb();
  const client = adminClient(db, { failTables, rpc: (name, args) => restClient(db).rpc(name, args) });
  const store = load('lib/orders/store.ts', { '@/lib/supabase/server': { createServiceRoleClient: () => client }, './state': State });
  const withdrawal = load('lib/orders/withdrawal.ts', {
    '@/lib/mail': { publicOrigin: () => { throw new Error('e-posta kökü bu sınamada kullanılmaz'); } },
    './notification-outbox': { runNotificationOutbox: async () => { throw new Error('e-posta gönderilmez'); } },
    './state': State, './store': store, './withdrawal-dates': Dates,
  });
  return { db, client, store, withdrawal };
}
/** Ödenmiş sipariş; `withdrawal_deadline` gerçek ödeme akışının yazdığı değerle (scheduleFor) aynı. */
async function paidOrder(db, paidAt, over = {}) {
  const id = await insertOrder(db, { status: 'paid', withdrawal_requested_at: null, paid_at: `'${paidAt.toISOString()}'`, ...over });
  await db.query('UPDATE release_orders SET withdrawal_deadline = $1 WHERE id = $2', [deadlineFor(paidAt), id]);
  const o = await one(db, 'SELECT order_no, buyer_email FROM release_orders WHERE id = $1', [id]);
  return { id, orderNo: o.order_no, email: o.buyer_email };
}
const state = (db, id) => one(db, 'SELECT status, withdrawal_requested_at, withdrawal_channel FROM release_orders WHERE id = $1', [id]);
const refunds = (db, id) => rows(db, 'SELECT reason, status, requested_by FROM order_refunds WHERE order_id = $1', [id]);
const events = (db, id) => rows(db, 'SELECT type, actor, data FROM order_events WHERE order_id = $1 ORDER BY id', [id]);

// ── (a) Gerekçe, üyelik, dosya, imza şartı yok ──────────────────────────────
test('cayma (a): yalnız sipariş no + e-posta yeterli; gerekçe, oturum, dosya ve imza alanı yok', () => {
  const parsed = withdrawalRequestSchema.safeParse({ orderNo: ' sg-2026-abcdef ', email: ' Ayse@Example.COM ' });
  assert.equal(parsed.success, true, 'gerekçe/not, dil, bot alanları olmadan da geçerli');
  assert.equal(parsed.data.note ?? null, null, 'not boş kalabilir');
  assert.deepEqual(Object.keys(withdrawalRequestSchema.shape).sort(), ['elapsedMs', 'email', 'locale', 'note', 'orderNo', 'website'],
    'şemada dosya, imza, kimlik ya da gerekçe zorunluluğu yok');
  const form = readFileSync(new URL('../../components/vitrin/cayma/WithdrawalForm.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(form, /type="file"|signature|imza/i, 'formda dosya yükleme / imza yok');
  const route = readFileSync(new URL('../../app/api/public/cayma/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /getUser|getSession|supabase\/server|cookies\(/, 'uç oturum/üyelik denetlemez');
});

test('cayma (a): gerekçesiz, oturumsuz, dosyasız elektronik bildirim kabul edilir; e-posta büyük/küçük harf duyarsız', async (t) => {
  quiet(t);
  const { db, client, withdrawal } = await setup();
  try {
    const paidAt = tr('2026-11-02T10:00');
    const o = await paidOrder(db, paidAt);
    const r = await withdrawal.recordWithdrawal(o.orderNo, o.email.toUpperCase(), META, client, tr('2026-11-05T12:00'));
    assert.equal(r.ok, true);
    assert.equal(r.refundDueOn, '2026-11-19', 'iade son günü bildirimden 14 gün sonra');
    const row = await state(db, o.id);
    assert.equal(row.status, 'withdrawal_requested');
    assert.equal(row.withdrawal_channel, 'form');
    assert.equal(new Date(row.withdrawal_requested_at).toISOString(), r.receivedAt);
    assert.deepEqual(await refunds(db, o.id), [{ reason: 'withdrawal', status: 'pending', requested_by: 'customer' }]);
    const ev = (await events(db, o.id)).find((e) => e.type === 'withdrawal_requested');
    assert.equal(ev.actor, 'customer');
    assert.equal('note' in ev.data, false, 'gerekçe yazılmadı, istenmedi');
  } finally { await db.close(); }
});

test('cayma (a): uç gerekçesiz/oturumsuz isteği kaydeder (bellek içi, HTTP yok)', async () => {
  const seen = [];
  const route = load('app/api/public/cayma/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) }, after: () => {} },
    '@/lib/admin-auth': { getClientIP: () => 'local', rateLimit: () => null },
    '@/lib/requests/schema': { issuesToFieldErrors: () => ({}), MIN_FILL_MS: 3000 },
    '@/lib/requests/server': { hashIp: () => null, sanitizeUserAgent: () => null },
    '@/lib/orders/schema': { withdrawalRequestSchema }, '@/lib/orders/view': { ORDER_VIEW_FIXTURES },
    '@/lib/orders/withdrawal': {
      recordWithdrawal: async (no, email, meta) => { seen.push({ no, email, meta }); return { ok: true, order: { order_no: no }, receivedAt: '2026-11-05T09:00:00.000Z', refundDueOn: '2026-11-19' }; },
      refundDueDay: () => '2026-11-19', sendWithdrawalEmails: async () => {},
    },
  });
  const res = await route.POST({ text: async () => JSON.stringify({ orderNo: 'SG-2026-ABCDEF', email: 'kisi@example.com' }), headers: new Headers() });
  assert.equal(res.status, 200);
  assert.deepEqual(seen, [{ no: 'SG-2026-ABCDEF', email: 'kisi@example.com', meta: { channel: 'form', note: null, ipHash: null, userAgent: null } }]);
});

// ── (b) Gece yarısı ─────────────────────────────────────────────────────────
test('cayma (b): 23:59 ödemede son gün o günden, 00:01 ödemede ertesi günden sayılır (İstanbul)', () => {
  assert.equal(deadlineFor(tr('2026-11-02T23:59')), '2026-11-16T20:59:59.999Z', '2 Kasım 23:59 → 16 Kasım 23:59:59.999 TR');
  assert.equal(deadlineFor(tr('2026-11-03T00:01')), '2026-11-17T20:59:59.999Z', '3 Kasım 00:01 → 17 Kasım 23:59:59.999 TR');
  // Sunucu saat diliminden bağımsız: UTC'de hâlâ 2 Kasım olan 00:01 TR ödemesi 3 Kasım sayılır.
  assert.equal(tr('2026-11-03T00:01').toISOString().slice(0, 10), '2026-11-02');
});

// ── (c) Geç ödeme / geç kuruluş ─────────────────────────────────────────────
test('cayma (c): önizlemeden sonra kurulan sözleşmede son gün kuruluşa göre ileri kayar, kısalmaz', async (t) => {
  quiet(t);
  const preview = Schedule.scheduleFor(tr('2026-11-02T10:00')).withdrawalDeadline;
  const late = Schedule.scheduleFor(tr('2026-11-04T09:00')).withdrawalDeadline;
  assert.equal(preview, '2026-11-16T20:59:59.999Z');
  assert.equal(late, '2026-11-18T20:59:59.999Z');

  // Gerçek ödeme akışı: süresi dolmuş siparişe 4 Kasım'da gelen ödeme son anı ödeme anına göre yazar.
  const { db, client, store } = await setup();
  try {
    const flow = load('lib/orders/payment-flow.ts', {
      './schedule': Schedule,
      './settings': { getSalesSettings: async () => ({ prepDays: 21, invoiceTiming: 'on_performance', ordersPaused: false }) },
      './store': store,
    });
    const id = await insertOrder(db, { status: 'expired', paid_at: null, withdrawal_requested_at: null, payment_id: null, created_at: `'${tr('2026-11-02T10:00').toISOString()}'` });
    await db.query("UPDATE release_orders SET payment_token = 'gec-odeme', invoice = $1::jsonb WHERE id = $2",
      [JSON.stringify({ type: 'individual', address: { line: 'Deneme Sk. 1', district: 'Çankaya', province: 'Ankara', postalCode: '06000' } }), id]);
    const o = await one(db, 'SELECT order_no, total_kurus FROM release_orders WHERE id = $1', [id]);
    const provider = { name: 'mock', isTest: false, async retrieve() { return { ok: true, status: 'success', paymentId: 'PAY-GEC', paidKurus: Number(o.total_kurus), reference: o.order_no, meta: {} }; } };
    t.mock.timers.enable({ apis: ['Date'], now: tr('2026-11-04T09:00').getTime() });
    const r = await flow.completePayment('gec-odeme', provider, client);
    t.mock.timers.reset();
    assert.equal(r.outcome, 'paid');
    const row = await one(db, 'SELECT withdrawal_deadline FROM release_orders WHERE id = $1', [id]);
    assert.equal(new Date(row.withdrawal_deadline).toISOString(), late, 'son an önizlemeye değil ödeme (kuruluş) anına göre');
    assert.ok(new Date(row.withdrawal_deadline) > new Date(preview), 'alıcı aleyhine kısalmadı');

    // Önizlemedeki son günden sonra (17 Kasım) gelen bildirim olağan cayma olarak kabul edilir.
    const withdrawal = load('lib/orders/withdrawal.ts', {
      '@/lib/mail': { publicOrigin: () => '' }, './notification-outbox': { runNotificationOutbox: async () => {} },
      './state': State, './store': store, './withdrawal-dates': Dates,
    });
    const w = await withdrawal.recordWithdrawal(o.order_no, 'test@example.com', META, client, tr('2026-11-17T15:00'));
    assert.equal(w.ok, true);
  } finally { t.mock.timers.reset(); await db.close(); }
});

// ── (d) Son an sınırı ───────────────────────────────────────────────────────
test('cayma (d): son anın 1 ms öncesi ve tam son an kabul; 1 ms sonrası olağan cayma olarak işlenmez', async (t) => {
  quiet(t);
  const paidAt = tr('2026-11-02T10:00'); // son gün 16 Kasım Pazartesi (iş günü)
  const end = new Date(deadlineFor(paidAt)).getTime();
  assert.equal(State.canWithdraw('paid', deadlineFor(paidAt), new Date(end - 1)), true);
  assert.equal(State.canWithdraw('paid', deadlineFor(paidAt), new Date(end)), true);
  assert.equal(State.canWithdraw('paid', deadlineFor(paidAt), new Date(end + 1)), false);

  const { db, client, withdrawal } = await setup();
  try {
    const before = await paidOrder(db, paidAt);
    assert.equal((await withdrawal.recordWithdrawal(before.orderNo, before.email, META, client, new Date(end - 1))).ok, true);
    const after = await paidOrder(db, paidAt);
    const r = await withdrawal.recordWithdrawal(after.orderNo, after.email, META, client, new Date(end + 1));
    assert.equal(r.ok, false);
    assert.equal(r.error, 'recorded_as_claim', 'reddedilmez; süre sonrası başvuru olarak kaydedilir');
    assert.equal((await state(db, after.id)).status, 'paid', 'durum değişmez');
    assert.deepEqual(await refunds(db, after.id), [], 'iade kaydı / kararı otomatik açılmaz');
  } finally { await db.close(); }
});

// ── (e) 14 gün sonrası ayıplı / geç / hiç ifa edilmeme ──────────────────────
test('cayma (e): olağan süre sonrası her ifa aşamasında bildirim kaydedilir, yönetime düşer; finans değişmez', async (t) => {
  quiet(t);
  const { db, client, withdrawal } = await setup();
  try {
    const paidAt = tr('2026-11-02T10:00');
    for (const status of ['paid', 'confirmed', 'scheduled', 'released', 'monitoring', 'completed']) {
      const o = await paidOrder(db, paidAt, { status });
      const note = `${status}: bırakma yapılmadı`;
      const r = await withdrawal.recordWithdrawal(o.orderNo, o.email, { ...META, note }, client, tr('2027-04-20T10:00'));
      assert.deepEqual([r.ok, r.error], [false, 'recorded_as_claim'], status);
      assert.equal(r.receivedAt, tr('2027-04-20T10:00').toISOString());
      assert.equal((await state(db, o.id)).status, status, `${status}: durum aynı`);
      assert.deepEqual(await refunds(db, o.id), [], `${status}: iade kaydı yok`);
      const claim = (await events(db, o.id)).filter((e) => e.type === 'post_period_claim');
      assert.equal(claim.length, 1, status);
      assert.equal(claim[0].actor, 'customer');
      assert.equal(claim[0].data.note, note);
      assert.equal(claim[0].data.status, status);
    }
    // Zaten cayılmış / iade edilmiş siparişte eski yanıtlar korunur.
    const done = await paidOrder(db, paidAt, { status: 'refunded' });
    assert.equal((await withdrawal.recordWithdrawal(done.orderNo, done.email, META, client, tr('2027-04-20T10:00'))).error, 'already_refunded');
    // E-posta eşleşmezse hiçbir şey yazılmaz.
    const other = await paidOrder(db, paidAt, { status: 'confirmed' });
    assert.equal((await withdrawal.recordWithdrawal(other.orderNo, 'baska@example.com', META, client, tr('2027-04-20T10:00'))).error, 'not_found');
    assert.deepEqual((await events(db, other.id)).filter((e) => e.type === 'post_period_claim'), []);
  } finally { await db.close(); }
});

test('cayma (e): kayıt yazılamazsa müşteriye "kaydedildi" denmez (not_eligible → e-posta adresi iletisi)', async (t) => {
  quiet(t);
  const { db, client, withdrawal } = await setup({ failTables: ['order_events'] });
  try {
    const o = await paidOrder(db, tr('2026-11-02T10:00'), { status: 'confirmed' });
    assert.equal((await withdrawal.recordWithdrawal(o.orderNo, o.email, META, client, tr('2027-01-20T10:00'))).error, 'not_eligible');
  } finally { await db.close(); }
});

test('cayma (e): uç süre sonrası başvuruyu 202 ile döndürür, e-posta/iade tetiklemez; istemci kodu tanır', async () => {
  let afterCalls = 0;
  const route = load('app/api/public/cayma/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) }, after: () => { afterCalls++; } },
    '@/lib/admin-auth': { getClientIP: () => 'local', rateLimit: () => null },
    '@/lib/requests/schema': { issuesToFieldErrors: () => ({}), MIN_FILL_MS: 3000 },
    '@/lib/requests/server': { hashIp: () => null, sanitizeUserAgent: () => null },
    '@/lib/orders/schema': { withdrawalRequestSchema }, '@/lib/orders/view': { ORDER_VIEW_FIXTURES },
    '@/lib/orders/withdrawal': {
      recordWithdrawal: async () => ({ ok: false, error: 'recorded_as_claim', order: { order_no: 'SG-2026-ABCDEF' }, receivedAt: '2027-04-20T07:00:00.000Z' }),
      refundDueDay: () => '', sendWithdrawalEmails: async () => {},
    },
  });
  const res = await route.POST({ text: async () => JSON.stringify({ orderNo: 'SG-2026-ABCDEF', email: 'kisi@example.com', note: 'ifa edilmedi' }), headers: new Headers() });
  assert.equal(res.status, 202);
  assert.deepEqual(res.body, { ok: false, error: 'recorded_as_claim', orderNo: 'SG-2026-ABCDEF', receivedAt: '2027-04-20T07:00:00.000Z' });
  assert.equal(afterCalls, 0, 'cayma teyidi / iade e-postası kuyruğu uyandırılmaz');
  const client = readFileSync(new URL('../../lib/orders/client.ts', import.meta.url), 'utf8');
  assert.match(client, /"recorded_as_claim",\n\s+"rate_limited"/, 'istemci kodu bilinen kodlar listesinde');
  for (const lang of ['tr', 'en', 'ru']) {
    const m = JSON.parse(readFileSync(new URL(`../../messages/${lang}.json`, import.meta.url), 'utf8'));
    assert.ok(m.withdrawalPage.errors.recorded_as_claim?.includes('{email}'), lang);
  }
});

// ── (f) Son gün tatil ───────────────────────────────────────────────────────
test('cayma (f): son gün tatile denk gelirse kabul izleyen iş gününün sonuna uzar; sözleşmedeki tarih değişmez', () => {
  const cases = [
    // [ödeme (TR), sözleşmedeki son gün, kabulün uzadığı son gün]
    ['2026-10-15T10:00', '2026-10-29', '2026-10-30'], // 29 Ekim Perşembe → Cuma
    ['2026-10-14T10:00', '2026-10-28', '2026-10-30'], // 28 Ekim arife + 29 Ekim
    ['2026-12-18T10:00', '2027-01-01', '2027-01-04'], // 1 Ocak Cuma + hafta sonu → Pazartesi
    ['2027-04-09T10:00', '2027-04-23', '2027-04-26'], // 23 Nisan Cuma
    ['2027-05-01T10:00', '2027-05-15', '2027-05-20'], // Kurban arifesi + bayram + 19 Mayıs
    ['2027-07-01T10:00', '2027-07-15', '2027-07-16'], // 15 Temmuz Perşembe
    ['2027-08-16T10:00', '2027-08-30', '2027-08-31'], // 30 Ağustos Pazartesi
    ['2027-02-22T10:00', '2027-03-08', '2027-03-12'], // Ramazan arifesi + bayram
    ['2026-11-01T10:00', '2026-11-15', '2026-11-16'], // Pazar → Pazartesi
    ['2026-11-02T10:00', '2026-11-16', '2026-11-16'], // iş günü: uzama yok
  ];
  const endOf = (day) => new Date(`${day}T23:59:59.999+03:00`).getTime();
  for (const [paid, contractDay, acceptDay] of cases) {
    const deadline = deadlineFor(tr(paid));
    assert.equal(deadline, new Date(endOf(contractDay)).toISOString(), `${paid}: sözleşmedeki ön hesap aynen kalır`);
    assert.equal(Period.effectiveWithdrawalDeadline(deadline).getTime(), endOf(acceptDay), `${paid}: kabul son günü ${acceptDay}`);
    assert.equal(State.canWithdraw('paid', deadline, new Date(endOf(acceptDay))), true, `${paid}: ${acceptDay} sonu kabul`);
    assert.equal(State.canWithdraw('paid', deadline, new Date(endOf(acceptDay) + 1)), false, `${paid}: ertesi gün olağan süre dışı`);
  }
  assert.equal(Period.effectiveWithdrawalDeadline(null), null);
  assert.equal(Period.effectiveWithdrawalDeadline('bozuk'), null);
  assert.deepEqual(Object.keys(Period.RELIGIOUS_HOLIDAYS).map(Number), [2026, 2027], 'dinî bayram listesi bu yılları kapsar (2028+ eklenmeli)');
});

test('cayma (f): tatil uzamasındaki sipariş zamanlanmış işte onaylanmaz, uzayan günde bildirim kabul edilir', async (t) => {
  quiet(t);
  const { db, client, store, withdrawal } = await setup();
  try {
    const actions = load('lib/orders/admin-actions.ts', {
      '@/lib/payments': { getProviderByName: () => null }, '@/lib/refunds/service': {}, './duplicates': {},
      './withdrawal-period': Period, './store': store,
    });
    const holiday = await paidOrder(db, tr('2026-10-15T10:00')); // son gün 29 Ekim → 30 Ekim
    const ordinary = await paidOrder(db, tr('2026-10-13T10:00')); // son gün 27 Ekim Salı
    assert.equal(await actions.confirmDueOrders(client, 100, tr('2026-10-30T12:00')), 1, 'yalnız süresi gerçekten dolan onaylanır');
    assert.equal((await state(db, ordinary.id)).status, 'confirmed');
    assert.equal((await state(db, holiday.id)).status, 'paid', '29 Ekim tatil: 30 Ekim boyunca cayılabilir');
    const r = await withdrawal.recordWithdrawal(holiday.orderNo, holiday.email, META, client, tr('2026-10-30T23:59:59'));
    assert.equal(r.ok, true, 'uzayan günde olağan cayma');
    const late = await paidOrder(db, tr('2026-10-15T11:00'));
    assert.equal(await actions.confirmDueOrders(client, 100, tr('2026-10-31T00:00:01')), 1);
    assert.equal((await state(db, late.id)).status, 'confirmed');
  } finally { await db.close(); }
});
