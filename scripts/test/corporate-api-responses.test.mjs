// Kurumsal panel yanıt sözleşmeleri (Astra #115 incelemesi, P2). Çalışan tahsisinde yalnız sözleşmeye uyan 2xx başarıdır;
// okunamayan/eksik gövde, 5xx ve ağ hatası "doğrulanamadı" sayılır (tahsis oluşmuş olabilir); e-posta iddiası `email_sent`
// alanına bağlıdır. Ödeme başlatmada `checkout_unavailable` yeniden ödeme önermeyen iletiyi seçer.
// Arayüz davranışının (form korunur, ikinci POST yok, üç dilde ileti) tarayıcı kanıtı: outputs/claude-musteri-dil-kapanis,
// senaryo `kurumsal-tahsis-*` (773821e derlemesinde 0/3, düzeltmeyle 3/3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allocationOutcome, paymentStartErrorKey } from '../../lib/corporate/api-responses.ts';

const ROOT = new URL('../../', import.meta.url).pathname;
const messages = Object.fromEntries(['tr', 'en', 'ru'].map((l) => [l, JSON.parse(readFileSync(join(ROOT, `messages/${l}.json`), 'utf8'))]));

test('çalışan tahsisi: yalnız sözleşmeye uyan 2xx başarı; e-posta durumu yalnız email_sent boole ise bildirilir', () => {
  const ok = { success: true, allocation: { id: 'al-1' } };
  assert.deepEqual(allocationOutcome(200, { ...ok, email_sent: true }), { kind: 'success', emailSent: true });
  assert.deepEqual(allocationOutcome(200, { ...ok, email_sent: false }), { kind: 'success', emailSent: false });
  assert.deepEqual(allocationOutcome(201, ok), { kind: 'success', emailSent: null });
  assert.deepEqual(allocationOutcome(200, { ...ok, email_sent: 'true' }), { kind: 'success', emailSent: null });
});

test('çalışan tahsisi: okunamayan/eksik gövde ve 5xx doğrulanamadı; 4xx kesin ret', () => {
  // `res.json()` kesik gövdede null'a düşer; sözleşmeye uymayan her 2xx gövde de başarı sayılmaz.
  for (const body of [null, undefined, {}, [], 'ok', { success: true }, { success: true, allocation: null }, { success: 'true', allocation: {} }, { success: false, allocation: {} }]) {
    assert.deepEqual(allocationOutcome(200, body), { kind: 'uncertain' }, JSON.stringify(body));
  }
  for (const status of [500, 502, 503, 504, 0]) assert.deepEqual(allocationOutcome(status, { error: 'x' }), { kind: 'uncertain' }, String(status));
  for (const status of [400, 401, 403, 404, 429]) assert.deepEqual(allocationOutcome(status, { error: 'x' }), { kind: 'rejected' }, String(status));
});

test('ödeme başlatma: checkout_unavailable kendi iletisini seçer ve iletiler yeniden ödeme önermez', () => {
  assert.equal(paymentStartErrorKey({ error: 'Teklifin ödeme durumu kontrol edilmelidir.', code: 'checkout_unavailable' }), 'checkoutUnavailable');
  for (const body of [null, undefined, {}, { error: 'Ödeme başlatılamadı.' }, { code: 'other' }, 'checkout_unavailable', { error: 'checkout_unavailable' }]) {
    assert.equal(paymentStartErrorKey(body), 'startError', JSON.stringify(body));
  }
  // Genel başlatma hatası "tekrar deneyin" der; inceleme gerektiren durum bunu demez, ödeme geçmişine ve iletişime yönlendirir.
  const yeniden = { tr: /tekrar deneyin/i, en: /try again/i, ru: /попробуйте ещё раз/i };
  for (const l of ['tr', 'en', 'ru']) {
    const p = messages[l].corporatePages.payment;
    assert.match(p.startError, yeniden[l]);
    assert.ok(p.checkoutUnavailable, `${l} checkoutUnavailable`);
    assert.doesNotMatch(p.checkoutUnavailable, yeniden[l]);
    assert.ok(p.checkoutUnavailable.includes(p.tabInvoices), `${l}: fatura geçmişi sekmesinin adı iletide geçer`);
  }
});

test('çalışan tahsisi: boş, dizi veya kimliksiz allocation başarı değildir', () => {
  for (const allocation of [{}, [], [{id:'fixture'}], {id:''}, {id:'   '}, {id:1}, {id:null}]) {
    assert.deepEqual(allocationOutcome(200, {success:true,allocation,email_sent:true}), {kind:'uncertain'}, JSON.stringify(allocation));
  }
});
