// Kurumsal ödeme istemci sözleşmesi (C1 tasarımı §10: outputs/claude-c1-tasarim/C1-TASARIM.md). Sunucu tarafı C1
// uygulamasıyla gelir; bu dosya istemcinin kod/durum → ileti eşlemesini ve iletilerin vaadini sınar. Bugünkü sunucu
// yanıtları (`checkout_unavailable`, `status=success|error`) aynı iletileri seçmeye devam eder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paymentReturnStatus, paymentStartErrorKey } from '../../lib/corporate/api-responses.ts';

const ROOT = new URL('../../', import.meta.url).pathname;
const messages = Object.fromEntries(['tr', 'en', 'ru'].map((l) => [l, JSON.parse(readFileSync(join(ROOT, `messages/${l}.json`), 'utf8'))]));

test('ödeme başlatma: C1 kodları kendi iletisini seçer; tanınmayan kod ve biçim genel hatadır', () => {
  assert.equal(paymentStartErrorKey({ code: 'checkout_unavailable' }), 'checkoutUnavailable');
  assert.equal(paymentStartErrorKey({ error: 'ham', code: 'checkout_pending' }), 'checkoutPending');
  assert.equal(paymentStartErrorKey({ error: 'ham', code: 'checkout_limit' }), 'checkoutLimit');
  // Nesne öntür adları, büyük/küçük harf farkı, boşluk ve dize olmayan kodlar eşleşmez (Object.hasOwn + typeof).
  for (const body of [{ code: 'CHECKOUT_PENDING' }, { code: 'checkout_pending ' }, { code: 'toString' }, { code: 'constructor' },
    { code: '__proto__' }, { code: 'hasOwnProperty' }, { code: ['checkout_pending'] }, { code: 409 }, { error: 'checkout_limit' }, 'checkout_pending', null]) {
    assert.equal(paymentStartErrorKey(body), 'startError', JSON.stringify(body));
  }
});

test('ödeme dönüşü: yalnız tanınan dört durum gösterilir', () => {
  for (const s of ['success', 'error', 'declined', 'pending']) assert.equal(paymentReturnStatus(s), s);
  for (const s of [null, '', 'SUCCESS', 'Declined', 'failure', 'pending ', 'success,error', 'undefined', 'toString', 'RAW-XYZ']) {
    assert.equal(paymentReturnStatus(s), null, String(s));
  }
});

test('C1 iletileri: belirsiz sonuç yeniden ödeme önermez; geçici durumlar yeni ödeme başlatılmadığını söyler', () => {
  const yeniden = { tr: /tekrar deneyin|tekrar deneyebilirsiniz/i, en: /try again/i, ru: /попробуйте ещё раз|повторите попытку|повторить попытку/i };
  const odemeyin = { tr: /yeniden ödeme yapmayın/i, en: /do not pay again/i, ru: /не оплачивайте повторно/i };
  const baslatilmadi = { tr: /yeni ödeme başlatılmadı/i, en: /no new payment was started/i, ru: /новая оплата не начата/i };
  for (const l of ['tr', 'en', 'ru']) {
    const p = messages[l].corporatePages.payment;
    for (const k of ['checkoutPending', 'checkoutLimit', 'declinedTitle', 'declinedText', 'pendingTitle', 'pendingText']) {
      assert.ok(typeof p[k] === 'string' && p[k].trim().length > 0, `${l}.${k}`);
    }
    // Sonuç belirsiz: yeniden ödeme önerilmez, durumun nerede güncellendiği söylenir.
    assert.doesNotMatch(p.pendingText, yeniden[l], `${l}.pendingText`);
    assert.match(p.pendingText, odemeyin[l], `${l}.pendingText`);
    assert.ok(p.pendingText.includes(p.tabInvoices), `${l}: fatura geçmişi sekmesinin adı iletide geçer`);
    // Geçici kilit ve deneme sınırı: yeni ödeme başlatılmadı; süre vaadi verilmez (C1 penceresi 10–45 dk olabilir).
    for (const k of ['checkoutPending', 'checkoutLimit']) {
      assert.match(p[k], baslatilmadi[l], `${l}.${k}`);
      assert.doesNotMatch(p[k], /\d|dakika|minute|минут/i, `${l}.${k}: süre vaadi`);
    }
    // Kesin ret: yalnız serbest bırakma kesinleşince gönderilir; başka kartla yeniden deneme önerilir.
    assert.match(p.declinedText, yeniden[l], `${l}.declinedText`);
    // Ret ve belirsiz sonuç başlıkları genel hatadan ayrıdır.
    assert.notEqual(p.declinedTitle, p.errorTitle);
    assert.notEqual(p.pendingTitle, p.errorTitle);
  }
});
