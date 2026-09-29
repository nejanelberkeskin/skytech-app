// 33 §2: B2B teklif onay/ret yarışı — gerçek route + PGlite. Tablo canlıdakine benzer kurulur (29 Eylül salt okuma
// doğrulaması): 004 kolonları eklenmiş ama durum kısıtı yok, varsayılan küçük harf 'pending'. E-posta yalnız sayaçlı
// taklit; ağ çağrısı yasak. Eşzamanlılık belirlenimli: birinci isteğin okumasından hemen sonra ikinci istek tamamlanır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { loadSource as load } from './load-source.mjs';
import { adminClient } from './admin-rest-client.mjs';

const ADMIN_A = { user_id: '10000000-0000-4000-8000-00000000000a', email: 'a@example.invalid', role: 'FINANCE' };
const ADMIN_B = { user_id: '10000000-0000-4000-8000-00000000000b', email: 'b@example.invalid', role: 'SUPER_ADMIN' };

async function quotesDb() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE corporate_quotes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, company_name text, tax_office text, tax_no text,
      contact_person text, corporate_email text, phone text, need_types text[], need_details jsonb, seed_count int,
      budget_range text, timeline text, notes text, status text DEFAULT 'pending', created_at timestamptz DEFAULT now(),
      approved_price numeric(12,2), approved_seed_count int, admin_note text, quoted_at timestamptz, quoted_by uuid,
      paid_at timestamptz, payment_id uuid, order_id uuid, updated_at timestamptz DEFAULT now());`);
  return db;
}
const insertQuote = async (db, status) => (await db.query(
  `INSERT INTO corporate_quotes(company_name, contact_person, corporate_email, seed_count, status) VALUES ('Örnek A.Ş.', 'Deneme Kişi', 'kurum@example.invalid', 100, $1) RETURNING id`,
  [status])).rows[0].id;
const insertLegacy = async (db) => (await db.query(
  `INSERT INTO corporate_quotes(company_name, contact_person, corporate_email, seed_count) VALUES ('Eski Ltd.', 'Eski Kişi', 'eski@example.invalid', 50) RETURNING id, status`)).rows[0];
const quoteRow = async (db, id) => (await db.query('SELECT status, approved_price::float8 AS price, quoted_by FROM corporate_quotes WHERE id=$1', [id])).rows[0];

function api(db, admin, shared, { afterQuery = null } = {}) {
  const route = load('app/api/admin/b2b/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/supabase/server': { createServiceRoleClient: () => adminClient(db, { afterQuery, log: shared.log, writes: shared.writes }) },
    '@/lib/admin-auth': { requireAdmin: async () => ({ admin, error: null }), getClientIP: () => '127.0.0.1' },
    '@/lib/admin/audit': { auditLog: async (_db, entry) => { shared.audits.push(entry); return []; } },
    '@/lib/mail': { SKIPPED_ID: 'skipped-no-api-key', sendB2BQuoteReadyEmail: async (input) => { shared.mails.push(input); return { id: `re_${shared.mails.length}` }; } },
  });
  return async (body) => {
    const res = await route.PUT(new Request('http://test.invalid/api/admin/b2b', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
    return { status: res.status, body: await res.json() };
  };
}
const shared = () => ({ log: [], writes: [], audits: [], mails: [] });
/** Birinci isteğin teklif okumasından hemen sonra bir kez çalışır (araya giren ikinci yönetici). */
const onFirstRead = (fn) => {
  let done = false;
  return async (q) => { if (!done && q.table === 'corporate_quotes' && q.mode === 'select') { done = true; await fn(); } };
};

test('33: eşzamanlı iki onay — yalnız biri uygulanır, müşteriye tek e-posta; ikinci fiyatın üzerine yazamaz', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  const db = await quotesDb();
  try {
    const id = await insertQuote(db, 'PENDING');
    const s = shared();
    let second;
    const first = api(db, ADMIN_A, s, {
      afterQuery: onFirstRead(async () => {
        second = await api(db, ADMIN_B, s)({ quoteId: id, action: 'approve', approvedPrice: 1500, approvedSeedCount: 100 });
      }),
    });
    const r = await first({ quoteId: id, action: 'approve', approvedPrice: 1200, approvedSeedCount: 100 });
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.code, 'already_processed');
    assert.match(r.body.error, /yeniden onaylamayın/i);
    assert.equal(s.mails.length, 1, 'müşteriye tek bildirim');
    assert.equal(s.mails[0].approvedPrice, 1500);
    assert.equal(s.audits.length, 1, 'uygulanmayan onay için audit yok');
    assert.deepEqual(await quoteRow(db, id), { status: 'QUOTED', price: 1500, quoted_by: ADMIN_B.user_id });
    const update = s.log.filter((q) => q.mode === 'update');
    assert.equal(update.length, 2);
    assert.ok(update.every((q) => /status::text = ANY/.test(q.where)), 'bekleme koşulu UPDATE içinde');
  } finally { await db.close(); }
});

test('33: onay ile ret yarışı — sonra gelen işlem uygulanmaz, sonuç ve fiyat korunur', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  const db = await quotesDb();
  try {
    const id = await insertQuote(db, 'PENDING');
    const s = shared();
    const reject = api(db, ADMIN_A, s, {
      afterQuery: onFirstRead(async () => { await api(db, ADMIN_B, s)({ quoteId: id, action: 'approve', approvedPrice: 900, approvedSeedCount: 60 }); }),
    });
    const r = await reject({ quoteId: id, action: 'reject', adminNote: 'uygun değil' });
    assert.equal(r.status, 409);
    assert.deepEqual(await quoteRow(db, id), { status: 'QUOTED', price: 900, quoted_by: ADMIN_B.user_id });
    assert.equal(s.mails.length, 1); assert.equal(s.audits.length, 1);
  } finally { await db.close(); }
});

test('33: küçük harf "pending" (canlı varsayılanı) bekliyor sayılır; onaylanınca büyük harf yazılır', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  const db = await quotesDb();
  try {
    const legacy = await insertLegacy(db);
    assert.equal(legacy.status, 'pending', 'kolon varsayılanı canlıdaki gibi küçük harf');
    const s = shared();
    const r = await api(db, ADMIN_A, s)({ quoteId: legacy.id, action: 'approve', approvedPrice: 600, approvedSeedCount: 50 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await quoteRow(db, legacy.id)).status, 'QUOTED');
    const other = await insertLegacy(db);
    assert.equal((await api(db, ADMIN_A, s)({ quoteId: other.id, action: 'reject' })).status, 200);
    assert.equal((await quoteRow(db, other.id)).status, 'REJECTED');
  } finally { await db.close(); }
});

test('33: geçersiz tutar ya da bekliyor olmayan teklif — yazma ve e-posta yok', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  const db = await quotesDb();
  try {
    const id = await insertQuote(db, 'PENDING');
    const s = shared();
    const put = api(db, ADMIN_A, s);
    for (const [price, count] of [[-5, 100], [1200, 10.5], ['1200', 100], [1200, -1]]) {
      const r = await put({ quoteId: id, action: 'approve', approvedPrice: price, approvedSeedCount: count });
      assert.equal(r.status, 400, `${price}/${count}`);
    }
    const quoted = await insertQuote(db, 'QUOTED');
    assert.equal((await put({ quoteId: quoted, action: 'approve', approvedPrice: 1, approvedSeedCount: 1 })).status, 400);
    assert.equal((await put({ quoteId: quoted, action: 'reject' })).status, 400);
    assert.deepEqual(s.writes, []); assert.deepEqual(s.mails, []); assert.deepEqual(s.audits, []);
  } finally { await db.close(); }
});
