// Bilgi formu (#96 L1): istemci sunucuyla AYNI kuralları uygular; sunucu 400'de hatalı alanı bildirir.
// Gerçek rota taklit bağımlılıklarla yüklenir; kota RPC'si ve e-posta ret durumunda hiç çağrılmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './load-source.mjs';

const contact = loadSource('lib/contact-form.ts');
const { validateContact, problemsFromResponse } = contact;
const VALID = { name: 'Deneme Kişi', email: 'deneme@example.com', phone: '', company: '', subject: 'Diğer', message: 'Merhaba', noticeRead: true };

test('istemci: yalnız boşluktan oluşan ad ve mesaj, noktasız alan adı ve eksik onay yakalanır', () => {
  assert.deepEqual(validateContact(VALID), {});
  assert.deepEqual(validateContact({ ...VALID, name: '   ', message: ' \n\t ' }), { name: 'required', message: 'required' });
  assert.deepEqual(validateContact({ ...VALID, email: 'ad@alanadi' }), { email: 'invalid_email' });
  assert.deepEqual(validateContact({ ...VALID, email: ' ad@alanadi.com ' }), {}, 'kırpılmış geçerli adres');
  assert.deepEqual(validateContact({ ...VALID, email: '' }), { email: 'required' });
  assert.deepEqual(validateContact({ ...VALID, subject: '' }), { subject: 'required' });
  assert.deepEqual(validateContact({ ...VALID, noticeRead: false }), { noticeRead: 'notice_required' });
  assert.deepEqual(validateContact({ ...VALID, name: 'a'.repeat(201), phone: '1'.repeat(41) }), { name: 'too_long', phone: 'too_long' });
});

test('sunucu yanıtındaki alanlar okunur; tanınmayan alan ve biçim yok sayılır', () => {
  assert.deepEqual(problemsFromResponse({ error: 'x', reason: 'invalid_email', fields: ['email'] }), { email: 'invalid_email' });
  assert.deepEqual(problemsFromResponse({ fields: ['name', 'message'] }), { name: 'required', message: 'required' });
  assert.deepEqual(problemsFromResponse({ reason: 'required', fields: ['uydurma', 'name'] }), { name: 'required' });
  for (const body of [null, [], 'metin', { fields: 'name' }, { error: 'notice_required' }]) assert.deepEqual(problemsFromResponse(body), {});
});

function route() {
  const calls = { quota: 0, mail: 0 };
  const json = (body, init) => ({ status: init?.status ?? 200, body });
  const mod = loadSource('app/api/public/bilgi-al/route.ts', {
    'next/server': { NextResponse: { json } },
    '@/lib/mail': { SKIPPED_ID: 'skipped', sendContactFormNotification: async () => { calls.mail++; return { id: 'taklit' }; } },
    '@/lib/admin-auth': { getClientIP: () => '127.0.0.1' },
    '@/lib/requests/server': { hashIp: () => 'iz' },
    '@/lib/supabase/server': { createServiceRoleClient: () => ({ rpc: async () => { calls.quota++; return { data: 0, error: null }; } }) },
    '@/lib/contact-form': contact,
  });
  const post = (body) => mod.POST({ text: async () => JSON.stringify(body) });
  return { post, calls };
}

test('sunucu: aynı girdiler 400 ile reddedilir, alan ve neden döner; kota ve e-posta çağrılmaz', async () => {
  const r = route();
  for (const [input, reason, fields] of [
    [{ ...VALID, name: '   ', message: '  ' }, 'required', ['name', 'message']],
    [{ ...VALID, email: 'ad@alanadi' }, 'invalid_email', ['email']],
    [{ ...VALID, subject: 'a'.repeat(201) }, 'too_long', ['subject']],
    [{ ...VALID, noticeRead: false }, 'notice_required', ['noticeRead']],
  ]) {
    const res = await r.post(input);
    assert.equal(res.status, 400, JSON.stringify(input));
    assert.equal(res.body.reason, reason);
    assert.deepEqual(res.body.fields, fields);
    // İstemci aynı girdide aynı alanları ve nedeni bulur (tek kural kaynağı).
    assert.deepEqual(problemsFromResponse(res.body), validateContact(input));
  }
  assert.deepEqual(r.calls, { quota: 0, mail: 0 });
  const ok = await r.post(VALID);
  assert.deepEqual([ok.status, ok.body], [200, { ok: true }]);
  assert.deepEqual(r.calls, { quota: 1, mail: 1 });
});
