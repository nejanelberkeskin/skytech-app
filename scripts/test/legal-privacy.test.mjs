import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicCertificateName, isOwnCertificateName, HIDDEN_CERTIFICATE_NAME } from '../../lib/certificates/publication.ts';
import { orderPayloadSchema } from '../../lib/orders/schema.ts';
import { ANALYTICS_TRANSFER_READY, analyticsAllowedPath, readConsent, writeConsent, trackEvent, CONSENT_STORAGE_KEY } from '../../lib/analytics.ts';
const person = { firstName: 'Ayşe', lastName: 'Örnek' };
const base = { certificate_name: 'Ayşe Örnek', buyer_first_name: 'Ayşe', buyer_last_name: 'Örnek', consents: {} };
const grant = { granted: true, at: '2026-09-22T10:00:00Z', version: '2026-09.4-taslak', subjectName: base.certificate_name };
test('Eski veya izinsiz sertifikada ad gizli; ayrı kendi-adı izniyle görünür', () => {
  assert.equal(publicCertificateName(base), HIDDEN_CERTIFICATE_NAME);
  assert.equal(publicCertificateName({ ...base, consents: { marketing: grant } }), HIDDEN_CERTIFICATE_NAME);
  assert.equal(publicCertificateName({ ...base, consents: { certificatePublication: { ...grant, granted: false } } }), HIDDEN_CERTIFICATE_NAME);
  assert.equal(publicCertificateName({ ...base, consents: { certificatePublication: grant } }), base.certificate_name);
});
test('Geri alınan, başka ada verilen veya üçüncü kişi için kullanılan rıza adı açmaz', () => {
  for (const consent of [{ ...grant, revokedAt: '2026-09-22T11:00:00Z' }, { ...grant, subjectName: 'Başka Kişi' }])
    assert.equal(publicCertificateName({ ...base, consents: { certificatePublication: consent } }), HIDDEN_CERTIFICATE_NAME);
  assert.equal(publicCertificateName({ ...base, buyer_first_name: 'Ali', consents: { certificatePublication: grant } }), HIDDEN_CERTIFICATE_NAME);
  assert.ok(isOwnCertificateName('  Ayşe   Örnek  ', person));
});
test('Sunucu şeması hediye adı için yayın iznini reddeder; izinsiz hediye siparişini kabul eder', () => {
  const p = { landId: '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b', clientToken: 'a13b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b', quantity: 200, certificateName: 'Başka Kişi', buyer: { ...person, email: 'ayse@example.com', phone: '05320000000' }, invoice: { type: 'individual', address: { province: '17', district: 'Eceabat', line: 'Örnek Mahallesi Örnek Sokak No 1' } }, locale: 'tr', documentsVersion: '2026-09.4-taslak', consents: { preInfo: true, contract: true, kvkkRead: true, certificatePublication: true } };
  const rejected = orderPayloadSchema.safeParse(p);
  assert.equal(rejected.success, false);
  assert.ok(rejected.error.issues.some(i => i.message === 'certificatePublicationSelfOnly'));
  const accepted = orderPayloadSchema.safeParse({ ...p, consents: { ...p.consents, certificatePublication: false } });
  assert.equal(accepted.success, true, JSON.stringify(accepted.error?.issues));
  const defaults = orderPayloadSchema.parse({ ...p, certificateName: '', consents: { preInfo: true, contract: true, kvkkRead: true } });
  assert.equal(defaults.consents.certificatePublication, false);
});
test('Aktarım hazırlığı varsayılan kapalı; özel yollar tüm dillerde ölçüm dışı', () => {
  assert.equal(ANALYTICS_TRANSFER_READY, false);
  for (const locale of ['', '/en', '/ru']) {
    for (const path of ['/siparis/SG-2026-ABCDEF', '/cayma', '/odeme/sonuc/123', '/sertifika/SG-RNEK-2345', '/hesabim', '/admin', '/sahalar/ornek/katil',
      // Personel daveti: adres tek kullanımlık belirteç taşır, ölçüme (GA/Vercel) sızmamalı.
      '/personel-daveti', '/personel-daveti/QmVsaXJ0ZWNfT3JuZWtfMTIzNDU2Nzg', '/personel-daveti/abc/def']) assert.equal(analyticsAllowedPath(locale+path), false, locale+path);
    assert.equal(analyticsAllowedPath(locale+'/sahalar/ornek'), true);
    assert.equal(analyticsAllowedPath(locale+'/personel'), true, 'benzer adlı genel sayfa ölçülebilir kalır');
  }
});
test('İzin geri alınması olay göndermez ve yüklü araçları kaldırmak için yeniler', () => {
  let stored = 'granted'; let sent = 0; let reloads = 0;
  globalThis.document = { cookie: '_ga=123' };
  globalThis.window = { localStorage: { getItem: () => stored, setItem: (key,value) => { assert.equal(key, CONSENT_STORAGE_KEY); stored=value; } }, location: { hostname: 'example.com', pathname: '/sahalar', reload: () => reloads++ }, dispatchEvent: () => {}, gtag: () => sent++, skytechAnalyticsLoaded: true };
  writeConsent('denied'); trackEvent('generate_lead');
  assert.equal(readConsent(), 'denied'); assert.equal(sent, 0); assert.equal(reloads, 1); assert.equal(window.gtag, undefined);
  delete globalThis.window; delete globalThis.document;
});
