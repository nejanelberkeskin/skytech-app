// Ödemede dur kaydı: e-posta ya da telefondan biri yeterli; fatura bilgisi yönetimde okunur satırlara çevrilir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preorderBuyerSchema, buyerSchema } from '../../lib/orders/schema.ts';
import { invoiceRowsOf } from '../../lib/requests/invoice-rows.ts';

const base = { firstName: 'Ayşe', lastName: 'Yılmaz' };

test('ödemede dur: yalnız e-posta ya da yalnız telefon kabul edilir', () => {
  assert.equal(preorderBuyerSchema.safeParse({ ...base, email: 'a@b.com', phone: '' }).success, true);
  assert.equal(preorderBuyerSchema.safeParse({ ...base, email: '', phone: '0532 123 45 67' }).success, true);
});

test('ödemede dur: ikisi de boşsa contactRequired', () => {
  const r = preorderBuyerSchema.safeParse({ ...base, email: '', phone: '' });
  assert.equal(r.success, false);
  assert.equal(r.error.issues[0].message, 'contactRequired');
});

test('gerçek siparişte e-posta hâlâ zorunlu', () => {
  assert.equal(buyerSchema.safeParse({ ...base, email: '', phone: '0532 123 45 67' }).success, false);
});

test('fatura satırları: kurumsal ve bireysel, bozuk girdi boş döner', () => {
  const corp = invoiceRowsOf({ type: 'corporate', companyTitle: 'Örnek A.Ş.', taxId: '1234567890', taxOffice: 'Çankaya',
    authorizedPerson: 'Ali Veli', eInvoiceUser: true, address: { line: 'Atatürk Cad. No 1', district: 'Çankaya', province: '06' } });
  assert.deepEqual(corp.slice(0, 3).map((r) => r.value), ['Kurumsal', 'Örnek A.Ş.', '1234567890']);
  assert.ok(corp.some((r) => r.label === 'e-Fatura mükellefi' && r.value === 'Evet'));
  assert.equal(invoiceRowsOf({ type: 'individual', address: {} })[0].value, 'Bireysel');
  assert.deepEqual(invoiceRowsOf(null), []);
  assert.deepEqual(invoiceRowsOf({ type: 'x' }), []);
});
