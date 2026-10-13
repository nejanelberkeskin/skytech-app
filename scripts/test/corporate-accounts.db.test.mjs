// 043 kurumsal hesap onayı — gerçek SQL (PGlite). Canlı DB, e-posta ya da gerçek hesap yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDb, one, rows, sqlError } from './pglite-db.mjs';
import { corporateApplicationSchema } from '../../lib/corporate/accounts.ts';

const A = '0000000a-0000-0000-0000-00000000000a';
const B = '0000000b-0000-0000-0000-00000000000b';

async function setup() {
  const db = await createDb();
  await db.exec(`
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
    INSERT INTO auth.users(id) VALUES ('${A}'), ('${B}');
    CREATE TABLE public.corporate_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, company_name text, status text);
    ALTER TABLE public.corporate_quotes ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT SELECT, INSERT ON public.corporate_quotes TO authenticated;
    CREATE POLICY "Insert own pending quote" ON public.corporate_quotes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'PENDING');`);
  await db.exec(`BEGIN;\n${await readFile(new URL('../../supabase/migrations/043_corporate_accounts.sql', import.meta.url), 'utf8')}\nCOMMIT;`);
  const apply = (user, status = 'pending') => db.query(
    `INSERT INTO corporate_accounts(user_id, company_title, tax_id, tax_office, address, authorized_person, contact_email, phone, status, reviewed_by, reviewed_at)
     VALUES ($1, 'Örnek A.Ş.', '1234567890', 'Çankaya', 'Atatürk Bulvarı No 1 Çankaya', 'Ali Veli', 'a@ornek.com', '+905321234567', $2,
             CASE WHEN $2 = 'pending' THEN NULL ELSE $1::uuid END, CASE WHEN $2 = 'pending' THEN NULL ELSE now() END)`, [user, status]);
  const as = async (user, sql, params) => {
    await db.exec(`SET test.uid = '${user}'; SET ROLE authenticated;`);
    try { return await db.query(sql, params); } finally { await db.exec('RESET ROLE; RESET test.uid;'); }
  };
  return { db, apply, as };
}

test('043: onaysız ya da başvurusuz hesap teklif ekleyemez; onaylı hesap ekler', async () => {
  const { db, apply, as } = await setup();
  try {
    const quote = (user) => as(user, `INSERT INTO corporate_quotes(user_id, company_name, status) VALUES ($1, 'X', 'PENDING')`, [user]);
    assert.match(await sqlError(quote(A)), /row-level security/i, 'başvurusuz');
    await apply(A);
    assert.match(await sqlError(quote(A)), /row-level security/i, 'bekleyen');
    await db.query(`UPDATE corporate_accounts SET status='approved', reviewed_by=$1, reviewed_at=now() WHERE user_id=$1`, [A]);
    await quote(A);
    assert.equal((await one(db, `SELECT count(*)::int n FROM corporate_quotes WHERE user_id=$1`, [A])).n, 1);
    assert.match(await sqlError(as(B, `INSERT INTO corporate_quotes(user_id, company_name, status) VALUES ($1, 'X', 'PENDING')`, [A])), /row-level security/i, 'başkası adına');
  } finally { await db.close(); }
});

test('043: kullanıcı yalnız kendi başvurusunu okur, yazamaz; durum kuralları', async () => {
  const { db, apply, as } = await setup();
  try {
    await apply(A);
    await apply(B, 'approved');
    assert.deepEqual((await as(A, 'SELECT user_id FROM corporate_accounts')).rows.map((r) => r.user_id), [A]);
    assert.match(await sqlError(as(A, `UPDATE corporate_accounts SET status='approved' WHERE user_id=$1`, [A])), /permission denied/i);
    assert.match(await sqlError(as(A, `INSERT INTO corporate_accounts(user_id, company_title, tax_id, tax_office, address, authorized_person, contact_email, phone) VALUES ($1,'X A.Ş.','1234567890','Y','Uzun bir adres satırı','Z','z@z.com','+905321234567')`, [A])), /permission denied/i);
    assert.match(await sqlError(db.query(`UPDATE corporate_accounts SET status='approved' WHERE user_id=$1`, [A])), /review_complete/i, 'karar kim/ne zaman olmadan verilemez');
    assert.match(await sqlError(db.query(`UPDATE corporate_accounts SET tax_id='12' WHERE user_id=$1`, [A])), /check/i);
    assert.equal((await rows(db, `SELECT 1 FROM corporate_accounts`)).length, 2);
  } finally { await db.close(); }
});

test('başvuru şeması: geçerli VKN, telefon ve yetki onayı ister', () => {
  const ok = { companyTitle: 'Örnek A.Ş.', taxId: '1234567890', taxOffice: 'Çankaya', address: 'Atatürk Bulvarı No 1', authorizedPerson: 'Ali Veli',
    email: 'A@Ornek.com', phone: '0532 123 45 67', authority: true };
  const r = corporateApplicationSchema.safeParse(ok);
  assert.equal(r.success, true);
  assert.equal(r.data.email, 'a@ornek.com');
  assert.equal(corporateApplicationSchema.safeParse({ ...ok, taxId: '123' }).success, false);
  assert.equal(corporateApplicationSchema.safeParse({ ...ok, authority: false }).success, false);
  assert.equal(corporateApplicationSchema.safeParse({ ...ok, phone: 'abc' }).success, false);
});
