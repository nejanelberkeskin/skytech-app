// Kurumsal teklif gönderimi: hesap ve teklif ayrı sonuç, yeniden denemede tek hesap ve tek teklif. Tamamen taklit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuoteSubmitter } from '../../lib/corporate/quote-submission.ts';

const QUOTE = {
  company_name: 'Örnek A.Ş.', tax_office: '', tax_no: '', contact_person: 'Deneme Kişi',
  corporate_email: 'yetkili@example.invalid', phone: '', need_types: ['orman'], need_details: '',
  seed_count: '1.000 – 10.000', budget_range: '', timeline: '', notes: '',
};
const SIGN_UP = { email: 'yetkili@example.invalid', password: 'gizli-parola-1', metadata: { company_name: 'Örnek A.Ş.' } };

// Sahte arka uç: auth kullanıcıları ve corporate_quotes satırları; birincil anahtar tekrarı 23505 verir.
function fakeBackend({ signUpErrors = [], insertPlan = [] } = {}) {
  const rows = new Map();
  const calls = { signUp: 0, insert: 0, sleep: 0, ids: [] };
  let seq = 0;
  const deps = {
    async signUp() {
      calls.signUp++;
      const error = signUpErrors.shift();
      return error ? { userId: null, error } : { userId: 'kullanici-1', error: null };
    },
    async insertQuote(row) {
      calls.insert++;
      calls.ids.push(row.id);
      const step = insertPlan.shift() ?? 'ok';
      if (step === 'reddet') return { error: { code: '42501', message: 'new row violates row-level security policy' } };
      if (step === 'fk') return { error: { code: '23503', message: 'insert or update violates foreign key constraint' } };
      if (rows.has(row.id)) return { error: { code: '23505', message: 'duplicate key value violates unique constraint "corporate_quotes_pkey"' } };
      rows.set(row.id, row);
      // Sunucu kaydetti ama yanıt istemciye ulaşmadı.
      if (step === 'yanit-kayboldu') return { error: { message: 'TypeError: Failed to fetch' } };
      return { error: null };
    },
    newId: () => `teklif-${++seq}`,
    async sleep() { calls.sleep++; },
  };
  return { deps, rows, calls };
}

const send = (submitter, existingUserId = null) => submitter.submit({ existingUserId, signUp: SIGN_UP, quote: QUOTE });

test('yeni kullanıcı: hesap oluşur, teklif kaydedilir; tek hesap, tek teklif', async () => {
  const b = fakeBackend();
  const s = createQuoteSubmitter(b.deps);
  assert.deepEqual(await send(s), { status: 'saved', accountCreated: true });
  assert.equal(b.calls.signUp, 1);
  assert.equal(b.rows.size, 1);
  const row = b.rows.get(s.quoteId);
  assert.equal(row.user_id, 'kullanici-1');
  assert.equal(row.status, 'PENDING');
});

test('hesap oluşup teklif kaydedilemezse başarı dönmez; yeniden denemede hesap tekrar oluşturulmaz', async () => {
  const b = fakeBackend({ insertPlan: ['reddet'] });
  const s = createQuoteSubmitter(b.deps);
  const first = await send(s);
  assert.equal(first.status, 'account_created_quote_failed');
  assert.equal(first.email, SIGN_UP.email);
  assert.equal(b.rows.size, 0, 'kaydedilmeyen teklif');
  assert.deepEqual(s.createdAccount, { userId: 'kullanici-1', email: SIGN_UP.email });
  assert.deepEqual(await send(s), { status: 'saved', accountCreated: true });
  assert.equal(b.calls.signUp, 1, 'signUp yalnız bir kez');
  assert.equal(b.rows.size, 1);
  assert.deepEqual(b.calls.ids, [s.quoteId, s.quoteId], 'her denemede aynı teklif kimliği');
});

test('ilk kayıt sunucuda oluşup yanıt kaybolursa yeniden deneme mükerrer teklif oluşturmaz', async () => {
  const b = fakeBackend({ insertPlan: ['yanit-kayboldu'] });
  const s = createQuoteSubmitter(b.deps);
  assert.equal((await send(s)).status, 'account_created_quote_failed', 'belirsiz sonuç başarı sayılmaz');
  assert.deepEqual(await send(s), { status: 'saved', accountCreated: true }, '23505 = zaten kaydedildi');
  assert.equal(b.rows.size, 1, 'tek satır');
  assert.equal(b.calls.signUp, 1);
});

test('geçici yabancı anahtar hatası aynı gönderimde beklenip yeniden denenir', async () => {
  const b = fakeBackend({ insertPlan: ['fk', 'fk', 'ok'] });
  const s = createQuoteSubmitter(b.deps);
  assert.deepEqual(await send(s), { status: 'saved', accountCreated: true });
  assert.equal(b.calls.insert, 3);
  assert.equal(b.calls.sleep, 2);
  assert.equal(b.rows.size, 1);
});

test('yabancı anahtar hatası sürerse üç denemeden sonra durur ve başarı dönmez', async () => {
  const b = fakeBackend({ insertPlan: ['fk', 'fk', 'fk'] });
  const s = createQuoteSubmitter(b.deps);
  assert.equal((await send(s)).status, 'account_created_quote_failed');
  assert.equal(b.calls.insert, 3);
  assert.equal(b.rows.size, 0);
});

test('oturumlu kullanıcı: signUp hiç çağrılmaz; kayıt hatası "quote_failed", yeniden deneme tek satır', async () => {
  const b = fakeBackend({ insertPlan: ['reddet'] });
  const s = createQuoteSubmitter(b.deps);
  assert.equal((await send(s, 'oturumlu-1')).status, 'quote_failed');
  assert.deepEqual(await send(s, 'oturumlu-1'), { status: 'saved', accountCreated: false });
  assert.equal(b.calls.signUp, 0);
  assert.equal(b.rows.size, 1);
  assert.equal(b.rows.get(s.quoteId).user_id, 'oturumlu-1');
});

test('hesap oluşturulamazsa teklif denenmez; düzeltip yeniden gönderince hesap o zaman oluşur', async () => {
  const b = fakeBackend({ signUpErrors: ['User already registered'] });
  const s = createQuoteSubmitter(b.deps);
  assert.deepEqual(await send(s), { status: 'signup_failed', error: 'User already registered' });
  assert.equal(b.calls.insert, 0);
  assert.equal(s.createdAccount, null);
  assert.deepEqual(await send(s), { status: 'saved', accountCreated: true });
  assert.equal(b.calls.signUp, 2);
  assert.equal(b.rows.size, 1);
});

test('aynı anda iki gönderim: ikincisi "busy", tek hesap ve tek teklif', async () => {
  const b = fakeBackend();
  const s = createQuoteSubmitter(b.deps);
  const [a, c] = await Promise.all([send(s), send(s)]);
  assert.deepEqual([a.status, c.status].sort(), ['busy', 'saved']);
  assert.equal(b.calls.signUp, 1);
  assert.equal(b.calls.insert, 1);
  assert.equal(b.rows.size, 1);
});

test('hiçbir deneme kaydetmezse sonuç hiçbir zaman "saved" olmaz', async () => {
  const b = fakeBackend({ insertPlan: Array(10).fill('reddet') });
  const s = createQuoteSubmitter(b.deps);
  for (let i = 0; i < 5; i++) assert.notEqual((await send(s)).status, 'saved');
  assert.equal(b.rows.size, 0);
  assert.equal(b.calls.signUp, 1);
});
