import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
import { iyzicoConfig } from '../../lib/payments/iyzico-config.ts';
const sandbox = 'https://sandbox-api.iyzipay.com';
const live = 'https://api.iyzipay.com';
const creds = { IYZICO_API_KEY: 'fake-key', IYZICO_SECRET_KEY: 'fake-secret' };

test('iyzico yapılandırması: resmî kökler, varsayılan sandbox, üretimde test kapalı', () => {
  for (const [url, isTest] of [[sandbox, true], [live, false]]) {
    for (const suffix of ['', '/']) {
      const config = iyzicoConfig({ ...creds, IYZICO_BASE_URL: url + suffix });
      assert.equal(config.uri, url);
      assert.equal(config.isTest, isTest);
    }
  }
  assert.equal(iyzicoConfig(creds).isTest, true);
  assert.equal(iyzicoConfig({ ...creds, VERCEL_ENV: 'production' }), null);
  assert.equal(iyzicoConfig({ ...creds, VERCEL_ENV: 'production', IYZICO_BASE_URL: sandbox }), null);
  assert.equal(iyzicoConfig({ ...creds, VERCEL_ENV: 'production', IYZICO_BASE_URL: live }).isTest, false);
});

test('iyzico yapılandırması: şüpheli URL ve eksik anahtar SDK oluşturamaz', () => {
  for (const url of ['http://api.iyzipay.com', live + '.evil.test', live + '/sandbox', live + '?sandbox', live + '#sandbox', 'https://sandbox-api.iyzipay.com@evil.test', 'https://user:pass@api.iyzipay.com', live + ':8443', 'https://other.test', 'not-url', live + '//']) {
    assert.equal(iyzicoConfig({ ...creds, IYZICO_BASE_URL: url }), null, url);
  }
  assert.equal(iyzicoConfig({ IYZICO_BASE_URL: live }), null);
  assert.equal(iyzicoConfig({ ...creds, IYZICO_API_KEY: ' ' }), null);
  assert.equal(iyzicoConfig({ ...creds, IYZICO_SECRET_KEY: '' }), null);
});

test('SDK: geçersiz ortam eski istemciyi kullanamaz; ortam değişince SDK da değişir', () => {
  const constructed = [];
  let config = { apiKey: 'fake', secretKey: 'fake-secret', uri: sandbox, isTest: true };
  class FakeSDK { constructor(c) { constructed.push(c); this.uri = c.uri; } }
  const sdk = load('lib/iyzico.ts', { iyzipay: { default: FakeSDK }, './payments/iyzico-config': { iyzicoConfig: () => config } }).default;
  assert.equal(sdk.uri, sandbox);
  assert.equal(sdk.uri, sandbox);
  assert.equal(constructed.length, 1);
  config = null;
  assert.throws(() => sdk.uri, /geçersiz/);
  config = { apiKey: 'other', secretKey: 'other-secret', uri: live, isTest: false };
  assert.equal(sdk.uri, live);
  assert.equal(constructed.length, 2);
});

test('sipariş kapısı: kesin hukuk metni bile üretimde test ödemesini açmaz', () => {
  const old = process.env.VERCEL_ENV;
  const gate = load('lib/orders/gate.ts', {
    '@/lib/legal/version': { isDraftLegalVersion: () => false },
    '@/lib/site-config': { SALES_ENABLED: true },
  });
  try {
    process.env.VERCEL_ENV = 'production';
    assert.equal(gate.ordersClosed({ isTest: true }), true);
    assert.equal(gate.ordersClosed({ isTest: false }), false);
    process.env.VERCEL_ENV = 'preview';
    assert.equal(gate.ordersClosed({ isTest: true }), false);
  } finally {
    if (old === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = old;
  }
});
