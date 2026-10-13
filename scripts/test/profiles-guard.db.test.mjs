// 044 profil sütun koruması — gerçek SQL (PGlite). Canlı DB yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = '0000000a-0000-0000-0000-00000000000a';
const B = '0000000b-0000-0000-0000-00000000000b';

async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text, email text, phone text, avatar_url text, address text, city text,
      referral_code text, earned_seeds integer DEFAULT 0, total_seeds integer DEFAULT 0, updated_at timestamptz);
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON public.profiles TO anon, authenticated;
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    INSERT INTO public.profiles(id, full_name, email, earned_seeds) VALUES ('${A}', 'A', 'a@x.com', 0), ('${B}', 'B', 'b@x.com', 0);`);
  await db.exec(`BEGIN;\n${await readFile(new URL('../../supabase/migrations/044_profiles_column_guard.sql', import.meta.url), 'utf8')}\nCOMMIT;`);
  const as = async (role, user, sql) => {
    await db.exec(`SET test.uid = '${user ?? ''}'; SET ROLE ${role};`);
    try { return await db.query(sql); } finally { await db.exec('RESET ROLE; RESET test.uid;'); }
  };
  const err = async (p) => { try { await p; return null; } catch (e) { return e.message; } };
  return { db, as, err };
}

test('044: üye yalnız izinli alanları günceller; puan, e-posta ve satır ekleme kapalı', async () => {
  const { db, as, err } = await setup();
  try {
    await as('authenticated', A, `UPDATE profiles SET full_name='Yeni', phone='1', address='Adres', city='Ankara' WHERE id='${A}'`);
    assert.equal((await db.query(`SELECT full_name FROM profiles WHERE id='${A}'`)).rows[0].full_name, 'Yeni');
    assert.match(await err(as('authenticated', A, `UPDATE profiles SET earned_seeds=999 WHERE id='${A}'`)), /permission denied/);
    assert.match(await err(as('authenticated', A, `UPDATE profiles SET email='z@x.com' WHERE id='${A}'`)), /permission denied/);
    assert.match(await err(as('authenticated', A, `INSERT INTO profiles(id, email) VALUES ('${'c'.repeat(8)}-0000-0000-0000-000000000000', 'c@x.com')`)), /permission denied/);
    assert.match(await err(as('authenticated', A, `DELETE FROM profiles WHERE id='${A}'`)), /permission denied/);
    await as('authenticated', A, `UPDATE profiles SET full_name='Ele geçir' WHERE id='${B}'`);
    assert.equal((await db.query(`SELECT full_name FROM profiles WHERE id='${B}'`)).rows[0].full_name, 'B', 'başkasının satırı değişmez');
    assert.deepEqual((await as('authenticated', A, 'SELECT id FROM profiles')).rows.map((r) => r.id), [A]);
  } finally { await db.close(); }
});

test('044: anon profil tablosuna hiç erişemez', async () => {
  const { db, as, err } = await setup();
  try {
    assert.match(await err(as('anon', null, 'SELECT * FROM profiles')), /permission denied/);
    assert.match(await err(as('anon', null, `UPDATE profiles SET full_name='x'`)), /permission denied/);
  } finally { await db.close(); }
});
