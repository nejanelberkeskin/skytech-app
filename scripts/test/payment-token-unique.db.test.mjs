import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDb, insertOrder, one } from './pglite-db.mjs';
const migration = await readFile(new URL('../../supabase/migrations/033_payment_token_uniqueness.sql', import.meta.url), 'utf8');

test('ödeme tokenı: farklı sipariş aynı tokenı alamaz; NULL değerler ve mevcut tekil tokenlar korunur', async () => {
  const db = await createDb();
  try {
    const a = await insertOrder(db), b = await insertOrder(db), c = await insertOrder(db);
    await db.query('UPDATE release_orders SET payment_token=$1 WHERE id=$2', ['local-token-1', a]);
    await db.exec('BEGIN;\n' + migration + '\nCOMMIT;');
    await assert.rejects(db.query('UPDATE release_orders SET payment_token=$1 WHERE id=$2', ['local-token-1', b]), e => e.code === '23505');
    assert.equal((await one(db, 'SELECT payment_token FROM release_orders WHERE id=$1', [a])).payment_token, 'local-token-1');
    for (const id of [b, c]) assert.equal((await one(db, 'SELECT payment_token FROM release_orders WHERE id=$1', [id])).payment_token, null);
    await db.query('UPDATE release_orders SET payment_token=$1 WHERE id=$2', ['local-token-2', b]);
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM release_orders')).n, 3);
  } finally { await db.close(); }
});

test('önceden çift token: migration durur, gizli token hata metninde yok; veri ve indeksler değişmez', async () => {
  const db = await createDb();
  try {
    const a = await insertOrder(db), b = await insertOrder(db);
    await db.query('UPDATE release_orders SET payment_token=$1 WHERE id IN ($2,$3)', ['DO-NOT-LOG-THIS-TOKEN', a, b]);
    await assert.rejects(db.exec('BEGIN;\n' + migration + '\nCOMMIT;'), e => e.message.includes('payment_token_duplicates_require_reconciliation') && !e.message.includes('DO-NOT-LOG-THIS-TOKEN'));
    await db.exec('ROLLBACK');
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM release_orders WHERE payment_token IS NOT NULL')).n, 2);
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM pg_indexes WHERE indexname IN ('release_orders_payment_token_key','order_events_payment_token_hash_idx')")).n, 0);
  } finally { await db.close(); }
});

test('migration veri yazmaz: ödeme durumu/tutarı/olayları korunur, eski oturum arama indeksi oluşur', async () => {
  const db = await createDb();
  try {
    const id = await insertOrder(db);
    const before = await one(db, 'SELECT * FROM release_orders WHERE id=$1', [id]);
    await db.query("INSERT INTO order_events(order_id,type,actor,data) VALUES ($1,'payment_started','system',$2::jsonb)", [id, JSON.stringify({ tokenHash: 'local-hash' })]);
    await db.exec('BEGIN;\n' + migration + '\nCOMMIT;');
    assert.deepEqual(await one(db, 'SELECT * FROM release_orders WHERE id=$1', [id]), before);
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM order_events WHERE data->>'tokenHash'='local-hash'")).n, 1);
    assert.ok((await one(db, "SELECT indexdef FROM pg_indexes WHERE indexname='order_events_payment_token_hash_idx'")).indexdef.includes('tokenHash'));
  } finally { await db.close(); }
});
