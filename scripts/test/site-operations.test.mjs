import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteOperation, operationClosesParticipation, operationMonth, estimatedSeedTarget } from '../../lib/sites/operations.ts';

test('completed İzmir closes participation; planned sites do not bypass database status', () => {
  assert.equal(operationClosesParticipation('izmir-proje-uygulama-sahasi'), true);
  for (const slug of ['bursa-proje-uygulama-sahasi', 'canakkale-proje-uygulama-sahasi', 'unknown', '__proto__']) {
    assert.equal(operationClosesParticipation(slug), false);
  }
  assert.equal(siteOperation('__proto__'), null);
});
test('operation dates retain month precision and planned monitoring never becomes a result', () => {
  const izmir = siteOperation('izmir-proje-uygulama-sahasi');
  assert.equal(izmir.releaseMonth, '2026-11');
  assert.equal(izmir.releasedSeeds, 14_000_000);
  assert.deepEqual(izmir.monitoringWindow, {from:'2027-05',through:'2027-06'});
  assert.equal(operationMonth('2026-11','tr'), 'Kasım 2026');
  assert.equal(operationMonth('2026-12','en'), 'December 2026');
});
test('only confirmed total area is published; future sales and release totals are not invented', () => {
  assert.equal(siteOperation('bursa-proje-uygulama-sahasi').totalAreaHectares, 400);
  for (const slug of ['izmir-proje-uygulama-sahasi', 'canakkale-proje-uygulama-sahasi']) assert.equal(siteOperation(slug).totalAreaHectares, undefined);
  for (const slug of ['bursa-proje-uygulama-sahasi', 'canakkale-proje-uygulama-sahasi']) {
    assert.equal(siteOperation(slug).releasedSeeds, undefined);
    assert.equal(siteOperation(slug).certificatesDelivered, undefined);
  }
});

test('seed target uses the operator assumption and never conflates released totals with estimates', () => {
  assert.equal(estimatedSeedTarget(92.8), 12992000);
  assert.equal(estimatedSeedTarget(95), 13300000);
  assert.equal(estimatedSeedTarget(93.8), 13132000);
  for (const invalid of [null, 0, -1, NaN, Infinity]) assert.equal(estimatedSeedTarget(invalid), null);
  assert.equal(siteOperation('izmir-proje-uygulama-sahasi').releasedSeeds, 14000000);
});
