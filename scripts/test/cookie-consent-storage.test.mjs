// Çerez tercihi (6 ay), bekleyen talep eşleştirmesi (7 gün), ölçüm dışı yollar ve GA başlangıç betiğinin geçmiş koruması.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  CONSENT_MAX_AGE_MS, CONSENT_STORAGE_KEY, GA_MEASUREMENT_ID, analyticsAllowedPath, parseStoredConsent, serializeConsent, readConsent, writeConsent,
} from '../../lib/analytics.ts';
import { GA_INIT_SCRIPT } from '../../lib/analytics-init.ts';
import {
  PENDING_CLAIM_KEY, PENDING_CLAIM_MAX_AGE_MS, parsePendingClaim, readPendingClaim, savePendingClaim, serializePendingClaim,
} from '../../lib/requests/client.ts';

const DAY = 86400_000;
const NOW = Date.UTC(2026, 9, 12, 12);

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

test('Çerez tercihi 6 ay geçerlidir; süresi dolan, tarihsiz ya da bozuk kayıt yeniden sorulur', () => {
  assert.equal(CONSENT_MAX_AGE_MS, 183 * DAY);
  assert.equal(parseStoredConsent(serializeConsent('granted', NOW), NOW), 'granted');
  assert.equal(parseStoredConsent(serializeConsent('denied', NOW - 182 * DAY), NOW), 'denied');
  assert.equal(parseStoredConsent(serializeConsent('granted', NOW - 183 * DAY), NOW), null, '6 ay dolunca analitik kapalı');
  assert.equal(parseStoredConsent(serializeConsent('granted', NOW + DAY), NOW), null, 'gelecek tarihli kayıt süreyi uzatamaz');
  for (const raw of ['granted', 'denied', '{"c":"granted"}', '{"c":"evet","t":1}', '{bozuk', null, ''])
    assert.equal(parseStoredConsent(raw, NOW), null, String(raw));
});

test('writeConsent tarihli kayıt yazar; readConsent süreyi uygular', () => {
  const ls = memoryStorage();
  globalThis.document = { cookie: '' };
  globalThis.window = { localStorage: ls, location: { hostname: 'localhost', pathname: '/' }, dispatchEvent: () => {} };
  writeConsent('granted');
  const v = JSON.parse(ls.getItem(CONSENT_STORAGE_KEY));
  assert.equal(v.c, 'granted'); assert.ok(Math.abs(v.t - Date.now()) < 5000);
  assert.equal(readConsent(), 'granted');
  ls.setItem(CONSENT_STORAGE_KEY, serializeConsent('granted', Date.now() - 200 * DAY));
  assert.equal(readConsent(), null);
  ls.setItem(CONSENT_STORAGE_KEY, 'granted');
  assert.equal(readConsent(), null, 'eski tarihsiz izin yeniden kullanılmaz');
  delete globalThis.window; delete globalThis.document;
});

test('Fatura ve kurumsal panel/giriş de ölçüm dışıdır; genel kurumsal sayfalar ölçülebilir', () => {
  for (const pre of ['', '/en', '/ru']) {
    for (const p of ['/fatura/30000000-0000-4000-8000-000000000001', '/kurumsal/panel', '/kurumsal/panel/odeme', '/kurumsal/giris'])
      assert.equal(analyticsAllowedPath(pre + p), false, pre + p);
    for (const p of ['/kurumsal', '/kurumsal-cozumler', '/kurumsal/teklif-al', '/sahalar', '/kendi-arazim'])
      assert.equal(analyticsAllowedPath(pre + p), true, pre + p);
  }
});

function runInit({ stored, path = '/sahalar', search = '' }) {
  const ls = memoryStorage(stored === undefined ? {} : { [CONSENT_STORAGE_KEY]: stored });
  const listeners = {};
  const location = { origin: 'https://skytechgreen.com', pathname: path, search, hash: '' };
  const history = {
    pushState(_s, _t, url) { const u = new URL(url, 'https://skytechgreen.com'); location.pathname = u.pathname; location.search = u.search; location.hash = u.hash; },
    replaceState(_s, _t, url) { this.pushState(_s, _t, url); },
  };
  const window = { localStorage: ls, location, addEventListener: (n, f) => { listeners[n] = f; } };
  window.window = window;
  const ctx = vm.createContext({ window, history, Date, JSON, RegExp, dataLayer: undefined });
  // `dataLayer` gtag içinde çıplak adla kullanılır: tarayıcıda window özelliğidir.
  Object.defineProperty(ctx, 'dataLayer', { get: () => window.dataLayer });
  vm.runInContext(GA_INIT_SCRIPT, ctx);
  return { window, history, listeners, location };
}

test('GA başlangıç betiği: izin yoksa/süresi dolmuşsa hiçbir şey kurmaz', () => {
  for (const stored of [undefined, 'granted', serializeConsent('denied'), serializeConsent('granted', Date.now() - 184 * DAY)]) {
    const { window } = runInit({ stored });
    assert.equal(window.dataLayer, undefined, String(stored));
    assert.equal(window.skytechAnalyticsLoaded, undefined);
  }
});

test('GA başlangıç betiği: page_location sorgusuz; ölçüm dışı yola ya da sorgulu adrese geçişte GA aynı anda kapanır', () => {
  const { window, history, listeners, location } = runInit({ stored: serializeConsent('granted'), path: '/sahalar', search: '?t=GIZLI' });
  const flag = `ga-disable-${GA_MEASUREMENT_ID}`;
  const config = window.dataLayer.map((a) => Array.from(a)).find((a) => a[0] === 'config');
  assert.equal(config[2].page_location, 'https://skytechgreen.com/sahalar');
  assert.equal(window[flag], false);
  history.pushState({}, '', '/cayma?no=SG-2026-GIZLI'); assert.equal(window[flag], true, 'cayma');
  history.pushState({}, '', '/sahalar'); assert.equal(window[flag], false);
  history.pushState({}, '', '/en/sertifika/KOD'); assert.equal(window[flag], true, 'sertifika');
  history.replaceState({}, '', '/ru/sahalar'); assert.equal(window[flag], false);
  history.pushState({}, '', '/sahalar?t=GIZLI'); assert.equal(window[flag], true, 'sorgulu genel adres');
  history.pushState({}, '', '/sahalar/izmir/katil'); assert.equal(window[flag], true, 'katil');
  location.pathname = '/hesabim'; location.search = ''; listeners.popstate(); assert.equal(window[flag], true, 'geri tuşu');
});

test('Bekleyen talep eşleştirmesi en çok 7 gün tutulur; tarihsiz eski kayıt 7 günlük ömre bağlanır', () => {
  const id = '40000000-0000-4000-8000-000000000001';
  assert.equal(PENDING_CLAIM_MAX_AGE_MS, 7 * DAY);
  assert.deepEqual(parsePendingClaim(serializePendingClaim(id, NOW - 6 * DAY), NOW), { id });
  assert.deepEqual(parsePendingClaim(serializePendingClaim(id, NOW - 7 * DAY), NOW), { expired: true });
  assert.deepEqual(parsePendingClaim(serializePendingClaim(id, NOW + DAY), NOW), { expired: true });
  assert.deepEqual(parsePendingClaim('{"id":"x","t":1}', NOW), { expired: true });
  assert.deepEqual(parsePendingClaim(id, NOW), { id, legacy: true });
  assert.equal(parsePendingClaim(null, NOW), null);

  const ls = memoryStorage();
  globalThis.localStorage = ls;
  savePendingClaim(id);
  assert.equal(JSON.parse(ls.getItem(PENDING_CLAIM_KEY)).id, id);
  assert.equal(readPendingClaim(), id);
  ls.setItem(PENDING_CLAIM_KEY, serializePendingClaim(id, Date.now() - 8 * DAY));
  assert.equal(readPendingClaim(), null);
  assert.equal(ls.getItem(PENDING_CLAIM_KEY), null, 'süresi dolan kayıt silinir');
  ls.setItem(PENDING_CLAIM_KEY, id);
  assert.equal(readPendingClaim(), id);
  assert.ok(Math.abs(JSON.parse(ls.getItem(PENDING_CLAIM_KEY)).t - Date.now()) < 5000, 'eski kayıt tarihlenir');
  savePendingClaim('gecersiz');
  assert.equal(JSON.parse(ls.getItem(PENDING_CLAIM_KEY)).id, id);
  delete globalThis.localStorage;
});
