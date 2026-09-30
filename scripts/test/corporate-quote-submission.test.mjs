// Kurumsal teklif gönderimi: hesap ve teklif ayrı sonuç; tek hesap, tek teklif; aynı kimlik ⇒ aynı içerik. Tamamen taklit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuoteSubmitter } from '../../lib/corporate/quote-submission.ts';

const QUOTE = {
  company_name: 'Örnek A.Ş.', tax_office: '', tax_no: '', contact_person: 'Deneme Kişi',
  corporate_email: 'yetkili@example.invalid', phone: '', need_types: ['orman'], need_details: '',
  seed_count: '1.000 – 10.000', budget_range: '', timeline: '', notes: 'İlk sürüm',
};
const EDITED = { ...QUOTE, seed_count: '100.000+', notes: 'Yanıt kaybından sonra değişti' };
const SIGN_UP = { email: 'yetkili@example.invalid', password: 'gizli-parola-1', metadata: { company_name: 'Örnek A.Ş.' } };
const RLS = { code: '42501', message: 'new row violates row-level security policy' };
const content = (row) => { const { id, user_id, status, ...rest } = row; return rest; };

// Sahte arka uç: auth kullanıcıları ve corporate_quotes satırları; birincil anahtar tekrarı 23505 verir.
function fakeBackend({ signUpErrors = [], insertPlan = [], existingIds = [] } = {}) {
  const rows = new Map(existingIds.map((id) => [id, { id, notes: 'başkasının içeriği' }]));
  const calls = { signUp: 0, insert: 0, sleep: 0, ids: [], payloads: [] };
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
      calls.payloads.push(content(row));
      const step = insertPlan.shift() ?? 'ok';
      if (step === 'reddet') return { error: RLS };
      if (step === 'fk') return { error: { code: '23503', message: 'insert or update violates foreign key constraint' } };
      if (step === 'gecit') return { error: { message: '<html>502 Bad Gateway</html>' } }; // kodsuz: belirsiz
      if (rows.has(row.id)) return { error: { code: '23505', message: 'duplicate key value violates unique constraint "corporate_quotes_pkey"' } };
      rows.set(row.id, structuredClone(row));
      // Sunucu kaydetti ama yanıt istemciye ulaşmadı.
      if (step === 'yanit-kayboldu') return { error: { message: 'TypeError: Failed to fetch' } };
      return { error: null };
    },
    newId: () => `teklif-${++seq}`,
    async sleep() { calls.sleep++; },
  };
  return { deps, rows, calls };
}

const send = (submitter, quote = QUOTE, existingUserId = null) => submitter.submit({ existingUserId, signUp: SIGN_UP, quote });

test('yeni kullanıcı: hesap oluşur, teklif kaydedilir; sonuç kaydedilen içeriği taşır', async () => {
  const b = fakeBackend();
  const s = createQuoteSubmitter(b.deps);
  assert.deepEqual(await send(s), { status: 'saved', accountCreated: true, quote: QUOTE, editsDiscarded: false });
  assert.equal(b.calls.signUp, 1);
  assert.equal(b.rows.size, 1);
  const row = b.rows.get(s.quoteId);
  assert.equal(row.user_id, 'kullanici-1');
  assert.equal(row.status, 'PENDING');
  assert.equal(s.pinnedQuote, null);
});

test('kesin ret (RLS): başarı yok, içerik sabitlenmez; yeniden denemede hesap tekrar oluşturulmaz', async () => {
  const b = fakeBackend({ insertPlan: ['reddet'] });
  const s = createQuoteSubmitter(b.deps);
  const first = await send(s);
  assert.equal(first.status, 'account_created_quote_failed');
  assert.equal(first.uncertain, false);
  assert.equal(first.email, SIGN_UP.email);
  assert.equal(b.rows.size, 0, 'kaydedilmeyen teklif');
  assert.equal(s.pinnedQuote, null);
  assert.deepEqual(await send(s), { status: 'saved', accountCreated: true, quote: QUOTE, editsDiscarded: false });
  assert.equal(b.calls.signUp, 1, 'signUp yalnız bir kez');
  assert.deepEqual(b.calls.ids, [s.quoteId, s.quoteId], 'her denemede aynı teklif kimliği');
});

test('kesin retten sonra düzeltilen içerik aynı kimlikle gönderilir ve kaydedilen odur', async () => {
  const b = fakeBackend({ insertPlan: ['reddet'] });
  const s = createQuoteSubmitter(b.deps);
  assert.equal((await send(s)).status, 'account_created_quote_failed');
  assert.deepEqual(await send(s, EDITED), { status: 'saved', accountCreated: true, quote: EDITED, editsDiscarded: false });
  assert.deepEqual(content(b.rows.get(s.quoteId)), EDITED);
  assert.equal(b.rows.size, 1);
});

test('yanıt kaybı: belirsiz sonuç başarı sayılmaz, içerik sabitlenir; yeniden deneme mükerrer oluşturmaz', async () => {
  const b = fakeBackend({ insertPlan: ['yanit-kayboldu'] });
  const s = createQuoteSubmitter(b.deps);
  const first = await send(s);
  assert.equal(first.status, 'account_created_quote_failed');
  assert.equal(first.uncertain, true);
  assert.deepEqual(s.pinnedQuote, QUOTE);
  assert.deepEqual(await send(s), { status: 'saved', accountCreated: true, quote: QUOTE, editsDiscarded: false }, '23505 = sabit içerik zaten kaydedildi');
  assert.equal(b.rows.size, 1, 'tek satır');
  assert.equal(b.calls.signUp, 1);
});

test('REGRESYON (#99 Astra P2): yanıt kaybından sonra alanlar değişse de yeniden deneme ilk içeriği gönderir; sonuç düzenlemeleri kaydedilmiş göstermez', async () => {
  const b = fakeBackend({ insertPlan: ['yanit-kayboldu'] });
  const s = createQuoteSubmitter(b.deps);
  assert.equal((await send(s)).uncertain, true);
  const second = await send(s, EDITED);
  assert.deepEqual(second, { status: 'saved', accountCreated: true, quote: QUOTE, editsDiscarded: true });
  assert.deepEqual(b.calls.payloads, [QUOTE, QUOTE], 'ikinci deneme de ilk içeriği gönderdi');
  assert.deepEqual(content(b.rows.get(s.quoteId)), QUOTE, 'kayıtlı içerik = sonucun bildirdiği içerik');
  assert.equal(b.rows.size, 1, 'mükerrer yok');
});

test('belirsizlikten sonra gelen kesin ret sabitlemeyi kaldırmaz; değişen alanlar yine gönderilmez', async () => {
  // Kayıt yanıtı kaybolur (satır oluştu), sonra RLS reddi (ret, önceki kaydın varlığını söylemez), sonra 23505.
  const b = fakeBackend({ insertPlan: ['yanit-kayboldu', 'reddet', 'ok'] });
  const s = createQuoteSubmitter(b.deps);
  assert.equal((await send(s)).uncertain, true);
  const rejected = await send(s, EDITED);
  assert.equal(rejected.status, 'account_created_quote_failed');
  assert.equal(rejected.uncertain, true, 'durum hâlâ belirsiz');
  const third = await send(s, EDITED);
  assert.deepEqual(third, { status: 'saved', accountCreated: true, quote: QUOTE, editsDiscarded: true });
  assert.deepEqual(b.calls.payloads, [QUOTE, QUOTE, QUOTE]);
  assert.equal(b.rows.size, 1);
});

test('ağ geçidi hatası (kodsuz 5xx) belirsiz sayılır ve içeriği sabitler', async () => {
  const b = fakeBackend({ insertPlan: ['gecit'] });
  const s = createQuoteSubmitter(b.deps);
  const first = await send(s);
  assert.equal(first.uncertain, true);
  assert.deepEqual(s.pinnedQuote, QUOTE);
  const second = await send(s, EDITED);
  assert.deepEqual(second, { status: 'saved', accountCreated: true, quote: QUOTE, editsDiscarded: true });
  assert.deepEqual(content(b.rows.get(s.quoteId)), QUOTE);
});

test('önceden belirsiz deneme yokken 23505: içeriğe kefil olunamaz, başarı dönmez', async () => {
  const b = fakeBackend({ existingIds: ['teklif-1'] });
  const s = createQuoteSubmitter(b.deps);
  assert.equal(s.quoteId, 'teklif-1');
  assert.deepEqual(await send(s), { status: 'quote_unverifiable', accountCreated: true });
  assert.equal(b.rows.get('teklif-1').notes, 'başkasının içeriği', 'var olan kayda dokunulmadı');
});

test('geçici yabancı anahtar hatası aynı gönderimde beklenip yeniden denenir; sürerse kesin ret', async () => {
  const ok = fakeBackend({ insertPlan: ['fk', 'fk', 'ok'] });
  const s1 = createQuoteSubmitter(ok.deps);
  assert.equal((await send(s1)).status, 'saved');
  assert.equal(ok.calls.insert, 3);
  assert.equal(ok.calls.sleep, 2);
  const kalici = fakeBackend({ insertPlan: ['fk', 'fk', 'fk'] });
  const s2 = createQuoteSubmitter(kalici.deps);
  const out = await send(s2);
  assert.equal(out.status, 'account_created_quote_failed');
  assert.equal(out.uncertain, false);
  assert.equal(kalici.calls.insert, 3);
  assert.equal(kalici.rows.size, 0);
});

test('oturumlu kullanıcı: signUp yok; kesin ret "quote_failed", belirsizlikte aynı içerik kuralı geçerli', async () => {
  const b = fakeBackend({ insertPlan: ['reddet', 'yanit-kayboldu'] });
  const s = createQuoteSubmitter(b.deps);
  const first = await send(s, QUOTE, 'oturumlu-1');
  assert.deepEqual([first.status, first.uncertain], ['quote_failed', false]);
  const second = await send(s, EDITED, 'oturumlu-1');
  assert.deepEqual([second.status, second.uncertain], ['quote_failed', true], 'kesin retten sonra düzeltilen içerik gitti, yanıt kayboldu');
  assert.deepEqual(await send(s, QUOTE, 'oturumlu-1'), { status: 'saved', accountCreated: false, quote: EDITED, editsDiscarded: true });
  assert.equal(b.calls.signUp, 0);
  assert.deepEqual(content(b.rows.get(s.quoteId)), EDITED);
});

test('hesap oluşturulamazsa teklif denenmez; düzeltip yeniden gönderince hesap o zaman oluşur', async () => {
  const b = fakeBackend({ signUpErrors: ['User already registered'] });
  const s = createQuoteSubmitter(b.deps);
  assert.deepEqual(await send(s), { status: 'signup_failed', error: 'User already registered' });
  assert.equal(b.calls.insert, 0);
  assert.equal(s.createdAccount, null);
  assert.equal((await send(s)).status, 'saved');
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
