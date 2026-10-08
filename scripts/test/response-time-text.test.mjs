// K16 (outputs/claude-toplu-kapanis/METIN-GORSEL-SIRKET.md §5): bilgi formu ve talep teyit e-postası teyitsiz yanıt süresi
// ("en kısa sürede", "as soon as possible", "в кратчайшие сроки") vaat etmez; yalnız inceleyip yanıtlayacağımızı söyler.
// Bilerek kapsam dışı: şifre sıfırlama e-postasının ulaşma süresi (hizmet taahhüdü değil), hız sınırı iletileri, hukuk
// metinleri ve yasal süreler (14 gün cayma, 30 gün KVKK).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const messages = (l) => JSON.parse(readFileSync(new URL(`../../messages/${l}.json`, import.meta.url), 'utf8'));
const MAIL = readFileSync(new URL('../../lib/mail.ts', import.meta.url), 'utf8');
const SURE = /en kısa sürede|en kısa zamanda|as soon as possible|shortly|в кратчайшие сроки|в ближайшее время|вскоре/i;
// Bilinçli istisna: şifre sıfırlama bağlantısının e-postaya ulaşma süresi.
const ISTISNA = new Set(['authPages.sentMessage']);
const yaprak = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? yaprak(v, `${p}${k}.`) : [[`${p}${k}`, v]]));

test('bilgi formu: alt başlık ve başarı metni süre vaadi içermez, e-postayla yanıtlanacağını söyler', () => {
  const yanit = { tr: /e-postayla yanıtlayacağız/, en: /reply by email/, ru: /ответим по электронной почте/ };
  for (const l of ['tr', 'en', 'ru']) {
    const f = messages(l).infoPage.form;
    for (const [k, v] of [['subheading', f.subheading], ['success.desc', f.success.desc]]) {
      assert.doesNotMatch(v, SURE, `${l}.infoPage.form.${k}`);
      assert.match(v, yanit[l], `${l}.infoPage.form.${k}`);
    }
  }
});

test('iletilerde yanıt süresi vaadi yalnız belgelenmiş istisnada kalır', () => {
  for (const l of ['tr', 'en', 'ru']) {
    const bulunan = yaprak(messages(l)).filter(([k, v]) => typeof v === 'string' && SURE.test(v) && !ISTISNA.has(k)).map(([k]) => k);
    assert.deepEqual(bulunan, [], l);
  }
});

test('talep teyit e-postası: alt başlıkta süre vaadi yok, talebin kayda alındığını söyler', () => {
  const confirm = MAIL.slice(MAIL.indexOf('const CONFIRM_TEXT'), MAIL.indexOf('type MailLocale'));
  assert.ok(confirm.length > 200, 'CONFIRM_TEXT bulundu');
  const subs = [...confirm.matchAll(/^\s+sub: "([^"]+)",$/gm)].map((m) => m[1]);
  assert.equal(subs.length, 2, 'tr + en (ru talepler en e-postası alır)');
  assert.doesNotMatch(confirm, SURE);
  assert.match(subs[0], /kayda alındı/);
  assert.match(subs[1], /is recorded/);
});
