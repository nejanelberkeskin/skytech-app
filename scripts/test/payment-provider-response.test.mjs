import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
const success = { status: 'success', paymentStatus: 'SUCCESS', fraudStatus: 1, paidPrice: '200.00', paymentId: 'P1', currency: 'TRY', basketId: 'SG-2026-ABCDEF' };
function adapter(response) {
  return load('lib/payments/iyzico.ts', { '@/lib/iyzico': { default: { checkoutForm: { retrieve: (_input, cb) => cb(null, response) } } }, '@/lib/tr-iller': {}, './iyzico-config': { iyzicoConfig: () => ({ isTest: true }) } });
}

test('iyzico sorgu: yalnız fraud 1 / "1" ve tam tutar/referans doğrulanan yanıt başarılı', async () => {
  for (const fraudStatus of [1, '1']) {
    const r = await adapter({ ...success, fraudStatus }).iyzicoProvider.retrieve('fake');
    assert.equal(r.ok, true); assert.equal(r.status, 'success');
    assert.equal(r.paidKurus, 20000); assert.equal(r.reference, success.basketId);
  }
});
test('iyzico sorgu: fraud sayı ve metin retleri aynı; incelemedeki/eksik/bilinmeyen fraud başarı sayılmaz', async () => {
  for (const fraudStatus of [-1, '-1']) assert.equal((await adapter({ ...success, fraudStatus }).iyzicoProvider.retrieve('fake')).reason, 'fraud_rejected');
  for (const fraudStatus of [0, '0', null, undefined, true, 2, '', 'yes']) {
    const r = await adapter({ ...success, fraudStatus }).iyzicoProvider.retrieve('fake');
    assert.equal(r.ok, false, String(fraudStatus));
  }
});
test('iyzico sorgu: sorgu/eksik durum hatası ödeme reddi sayılmaz; açık FAILURE reddedilir', async () => {
  for (const response of [{}, { status: 'failure', errorCode: '99999' }, { status: 'success', paymentStatus: 'PENDING' }]) {
    assert.equal((await adapter(response).iyzicoProvider.retrieve('fake')).ok, false);
  }
  const r = await adapter({ status: 'success', paymentStatus: 'FAILURE' }).iyzicoProvider.retrieve('fake');
  assert.equal(r.ok, true); assert.equal(r.status, 'failure');
});
test('iyzico sorgu: eksik referans/para birimi/sıfır veya güvenli aralığı aşan tutar işlenmez', async () => {
  for (const patch of [{ basketId: undefined }, { basketId: '' }, { currency: 'USD' }, { paymentId: ' ' }, { paidPrice: '0' }, { paidPrice: '9007199254740993' }, { paidPrice: '2.001' }]) {
    assert.equal((await adapter({ ...success, ...patch }).iyzicoProvider.retrieve('fake')).ok, false, JSON.stringify(patch));
  }
});
test('iade: ilk veya ikinci adımdaki doğrulanmamış ret / bozuk yanıt şelaleyi hemen durdurur', async () => {
  const mod = adapter(success);
  const input = { paymentId: 'P1', amountKurus: 20000, orderNo: 'SG-2026-ABCDEF', meta: { paymentTransactionIds: ['T1'] }, ip: null };
  for (const unknown of [{ status: 'failure', errorCode: 'UNVERIFIED' }, {}, { status: 'failure', errorCode: 9999 }]) {
    const calls = [];
    const r = await mod.refundWithIyzico(input, async resource => { calls.push(resource); return unknown; });
    assert.equal(r.outcome, 'unknown'); assert.deepEqual(calls, ['refundV2']);
    const nextCalls = [];
    const second = await mod.refundWithIyzico(input, async resource => { nextCalls.push(resource); return resource === 'refundV2' ? { status: 'failure', errorCode: 'KNOWN' } : unknown; }, new Set(['KNOWN']));
    assert.equal(second.outcome, 'unknown'); assert.deepEqual(nextCalls, ['refundV2', 'refund']);
  }
});
