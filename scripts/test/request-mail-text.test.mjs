// Talep teyit e-postası: teyitsiz dönüş süresi vaadi yok, metin ekrandaki başarı kartıyla aynı, gönderim mantığı aynı.
// Gerçek e-posta gönderilmez: Resend REST çağrısı taklit fetch ile yakalanır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSource } from './load-source.mjs';
import * as labels from '../../lib/requests/labels.ts';

const messages = (locale) => JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), 'utf8'));
const MAIL_SOURCE = readFileSync(new URL('../../lib/mail.ts', import.meta.url), 'utf8');
const PROMISE = /iş günü|24 saat|saat içinde|pazartesi|business day|24 hours|within one|рабоч|в течение 24/i;

function loadMail(logs) {
  return loadSource('lib/mail.ts', {
    '@/lib/supabase/server': {
      createServiceRoleClient: () => ({
        from: (table) => ({ insert: async (row) => { logs.push({ table, row }); return { error: null }; } }),
      }),
    },
    '@/lib/requests/labels': labels,
  });
}

const request = (locale) => ({
  id: '5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', request_no: 'TLP-PROVA1', type: 'land_application', status: 'new',
  user_id: null, contact_name: 'Deneme Kişi', email: 'deneme@example.invalid', phone: null, company: null, locale,
  land_id: null, total_seeds: null, seed_items: [], message: null, consent_at: '2026-09-30T08:00:00Z',
  consent_version: 'v1', ip_hash: null, user_agent: null, source_path: '/kendi-arazim', admin_note: null,
  handled_by: null, handled_at: null, created_at: '2026-09-30T08:00:00Z', updated_at: '2026-09-30T08:00:00Z',
  details: { province: '07', district: 'Manavgat', areaValue: 12.5, areaUnit: 'hectare', conditions: ['burned'], ownership: 'owner', timing: 'next_season' },
});

// Resend'e giden isteği yakalar; ağ çağrısı yapılmaz.
async function capture(send, input) {
  const realFetch = globalThis.fetch;
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM_EMAIL };
  const calls = [];
  process.env.RESEND_API_KEY = 'test-anahtari-gonderilmez';
  delete process.env.RESEND_FROM_EMAIL;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ id: 'taklit-eposta-kimligi' }) };
  };
  try {
    const result = await send(input);
    return { result, calls };
  } finally {
    globalThis.fetch = realFetch;
    if (saved.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = saved.key;
    if (saved.from !== undefined) process.env.RESEND_FROM_EMAIL = saved.from;
  }
}

test('kaynakta talep teyidi için teyitsiz dönüş süresi vaadi kalmadı; yasal 14 günlük iade süresi duruyor', () => {
  const confirm = MAIL_SOURCE.slice(MAIL_SOURCE.indexOf('const CONFIRM_TEXT'), MAIL_SOURCE.indexOf('type MailLocale'));
  assert.ok(confirm.length > 200, 'CONFIRM_TEXT bulundu');
  assert.doesNotMatch(confirm, PROMISE);
  assert.match(MAIL_SOURCE, /14 gün içinde/, 'cayma iadesi yasal süresi değişmedi');
  assert.match(MAIL_SOURCE, /within 14 days/);
});

for (const [locale, mailLang] of [['tr', 'tr'], ['en', 'en'], ['ru', 'en']]) {
  test(`teyit e-postası (${locale} → ${mailLang}): süre vaadi yok, ilk cümle ekrandaki kartla aynı, gönderim aynı`, async () => {
    const logs = [];
    const mail = loadMail(logs);
    const { result, calls } = await capture(mail.sendServiceRequestConfirmation, { request: request(locale), landName: null, accountLink: true });
    assert.equal(result.id, 'taklit-eposta-kimligi');
    assert.equal(calls.length, 1, 'tek gönderim');
    const [call] = calls;
    assert.equal(call.url, 'https://api.resend.com/emails');
    assert.equal(call.init.method, 'POST');
    assert.deepEqual(call.body.to, ['deneme@example.invalid']);
    assert.equal(call.body.from, 'Skytech Green <noreply@skytechgreen.com>');
    assert.equal(call.body.subject, mailLang === 'tr' ? 'Talebiniz alındı — TLP-PROVA1' : 'We received your request — TLP-PROVA1');
    assert.equal(call.body.reply_to, undefined);
    const html = call.body.html;
    assert.doesNotMatch(html, PROMISE);
    const cardDesc = messages(mailLang).requestForms.common.success.desc;
    assert.ok(html.includes(cardDesc), `ekrandaki başarı kartı cümlesi e-postada: "${cardDesc}"`);
    assert.ok(html.includes('TLP-PROVA1'));
    assert.equal(logs.length, 1);
    assert.equal(logs[0].table, 'email_logs');
    assert.deepEqual(logs[0].row, {
      template: 'service_request_confirm', recipient_email: 'deneme@example.invalid', subject: call.body.subject,
      related_id: '5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', resend_id: 'taklit-eposta-kimligi', status: 'sent', error_message: null,
    });
  });
}

test('e-posta adresi yoksa gönderim yapılmaz', async () => {
  const logs = [];
  const mail = loadMail(logs);
  const { result, calls } = await capture(mail.sendServiceRequestConfirmation, { request: { ...request('tr'), email: null } });
  assert.equal(result.id, 'skipped-no-email');
  assert.equal(calls.length, 0);
  assert.equal(logs.length, 0);
});
