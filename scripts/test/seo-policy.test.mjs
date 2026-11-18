import assert from 'node:assert/strict';
import { test } from 'node:test';
import robots from '../../app/robots.ts';
import { buildPageMetadata, localeUrl } from '../../lib/seo.ts';
import { TURKISH_LEGAL_PATHS, canonicalTurkishContentPath } from '../../lib/seo-policy.ts';
import { localizeSiteName } from '../../lib/sites/localization.ts';

test('public rendering resources are crawlable without opening private API/account paths', () => {
  const rule = robots().rules.find(r => r.userAgent === '*');
  for (const resource of ['/_next/static/chunks/app.js', '/_next/static/app.css', '/_next/image?url=logo.webp']) {
    assert.equal(rule.disallow.some(prefix => resource.startsWith(prefix)), false, resource);
  }
  for (const path of ['/api/orders', '/admin', '/hesabim', '/en/hesabim', '/ru/admin']) {
    assert.equal(rule.disallow.some(prefix => path.startsWith(prefix)), true, path);
  }
});

for (const locale of ['tr', 'en', 'ru']) {
  test(`legal documents do not claim nonexistent translations (${locale})`, () => {
    for (const path of TURKISH_LEGAL_PATHS) {
      const meta = buildPageMetadata({ title: 'Belge', description: 'Türkçe belge', path }, locale);
      assert.equal(meta.alternates.canonical, localeUrl(path, 'tr'));
      assert.equal(meta.robots.index, locale === 'tr');
      assert.equal(meta.openGraph.locale, 'tr_TR');
      if (locale === 'tr') assert.deepEqual(Object.keys(meta.alternates.languages), ['tr', 'x-default']);
      else assert.equal(meta.alternates.languages, undefined);
    }
  });
}

test('normal translated pages keep self canonicals and reciprocal alternatives', () => {
  for (const locale of ['tr', 'en', 'ru']) {
    const meta = buildPageMetadata({ title: 'Product', description: 'Service', path: '/kaplamali-tohum' }, locale);
    assert.equal(meta.alternates.canonical, localeUrl('/kaplamali-tohum', locale));
    assert.deepEqual(Object.keys(meta.alternates.languages), ['tr', 'en', 'ru', 'x-default']);
    assert.equal(meta.robots.index, true);
  }
});

test('private flow metadata stays noindex without indexable language alternatives', () => {
  const meta = buildPageMetadata({ title: 'Quote', description: 'Quote', path: '/kurumsal/teklif-al', noindex: true }, 'en');
  assert.equal(meta.robots.index, false);
  assert.equal(meta.alternates.languages, undefined);
  assert.equal(meta.alternates.canonical, localeUrl('/kurumsal/teklif-al', 'en'));
});

test('site-name fallback translates only the known suffix, preserving authored/place names', () => {
  assert.equal(localizeSiteName('Bursa Proje Uygulama Sahası', 'en'), 'Bursa Project Site');
  assert.equal(localizeSiteName('Bursa Proje Uygulama Sahası', 'ru'), 'Bursa проектный участок');
  assert.equal(localizeSiteName('Bursa Proje Uygulama Sahası', 'tr'), 'Bursa Proje Uygulama Sahası');
  assert.equal(localizeSiteName('Gürsu (Dışkaya)', 'en'), 'Gürsu (Dışkaya)');
  assert.equal(localizeSiteName('Bursa — An Authored Name', 'en'), 'Bursa — An Authored Name');
});

test('Turkish canonicalization is limited to content; token/private/API paths stay behind their gates', () => {
  for (const [input, output] of [["/tr", "/"], ["/tr/sahalar", "/sahalar"], ["/tr/sahalar/bursa", "/sahalar/bursa"], ["/tr/kvkk", "/kvkk"]]) assert.equal(canonicalTurkishContentPath(input), output);
  for (const path of ["/tr/siparis/SG1", "/tr/odeme/sonuc/SG1", "/tr/admin", "/tr/hesabim", "/tr/api/orders", "/trouble", "/en/sahalar"]) assert.equal(canonicalTurkishContentPath(path), null);
});
