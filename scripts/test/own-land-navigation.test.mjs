// /kendi-arazim gezinme entegrasyonu: tek kaynak bağlantı, eski adresin kalıcı yönlendirmesi, talep bayrağı ve sitemap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as siteConfig from '../../lib/site-config.ts';
import * as links from '../../lib/sites/links.ts';
import { loadSource } from './load-source.mjs';

const SITE_CONFIG_URL = new URL('../../lib/site-config.ts', import.meta.url).href;
const LINKS_URL = new URL('../../lib/sites/links.ts', import.meta.url).href;
const LOADER_URL = new URL('./alias-loader.mjs', import.meta.url).href;
const LOAD_SOURCE_URL = new URL('./load-source.mjs', import.meta.url).href;

const sitemapUrls = async (config, linkModule, loader = loadSource) => {
  const sitemap = loader('app/sitemap.ts', {
    '@/lib/seo': { localeUrl: (path, locale) => `https://ornek.test${locale === 'tr' ? '' : `/${locale}`}${path === '/' ? '' : path}` },
    '@/lib/sites/data': { getProjectSites: async () => [] },
    '@/lib/sites/links': linkModule,
    '@/lib/site-config': config,
    '@/lib/legal/visibility': { LEGAL_PAGES_ENABLED: false, SALES_LEGAL_PAGES: [] },
    '@/lib/legal/version': { isDraftLegalVersion: () => true },
  }).default;
  return (await sitemap()).map((entry) => entry.url);
};

// Bayraklar modül yüklenirken okunur: kapalı talep akışı ayrı süreçte, ortam değişkeniyle sınanır.
const withRequestsClosed = () => {
  const script = `
    const config = await import(${JSON.stringify(SITE_CONFIG_URL)});
    const links = await import(${JSON.stringify(LINKS_URL)});
    const { loadSource } = await import(${JSON.stringify(LOAD_SOURCE_URL)});
    const sitemap = loadSource('app/sitemap.ts', {
      '@/lib/seo': { localeUrl: (path, locale) => 'https://ornek.test' + (locale === 'tr' ? '' : '/' + locale) + (path === '/' ? '' : path) },
      '@/lib/sites/data': { getProjectSites: async () => [] },
      '@/lib/sites/links': links,
      '@/lib/site-config': config,
      '@/lib/legal/visibility': { LEGAL_PAGES_ENABLED: false, SALES_LEGAL_PAGES: [] },
      '@/lib/legal/version': { isDraftLegalVersion: () => true },
    }).default;
    const urls = (await sitemap()).map((entry) => entry.url);
    console.log(JSON.stringify({
      enabled: config.REQUESTS_ENABLED,
      suspended: config.isSuspendedRoute('/kendi-arazim'),
      redirect: config.retiredPageRedirect('/talep/arazime-ekim'),
      cta: config.orderCtaHref('land'),
      ownLandInSitemap: urls.some((url) => url.includes('kendi-arazim')),
      sitesInSitemap: urls.includes('https://ornek.test/sahalar'),
    }));`;
  const run = spawnSync(process.execPath, [
    '--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--import', LOADER_URL,
    '--input-type=module', '-e', script,
  ], {
    cwd: new URL('../../', import.meta.url).pathname,
    env: { ...process.env, NEXT_PUBLIC_REQUESTS_ENABLED: 'false', NEXT_PUBLIC_SALES_ENABLED: 'false' },
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout.trim().split('\n').pop());
};

test('kendi arazi bağlantısının tek kaynağı /kendi-arazim; bütün çağrılar oraya gider', () => {
  assert.equal(links.OWN_LAND_HREF, '/kendi-arazim');
  assert.equal(siteConfig.REQUEST_ROUTES.land, links.OWN_LAND_HREF);
  assert.equal(siteConfig.REQUESTS_ENABLED, true, 'test ortamında talep akışı varsayılan olarak açık');
  assert.equal(siteConfig.orderCtaHref('land'), '/kendi-arazim');
  assert.equal(siteConfig.orderCtaHref('hub'), '/sahalar', 'genel talep çağrısı değişmedi');
});

test('eski başvuru adresi kalıcı olarak yeni sayfaya yönlenir; komşu adresler etkilenmez', () => {
  assert.equal(siteConfig.retiredPageRedirect('/talep/arazime-ekim'), '/kendi-arazim');
  assert.equal(siteConfig.retiredPageRedirect('/talep/arazime-ekim/'), '/kendi-arazim');
  assert.equal(siteConfig.retiredPageRedirect('/talep/arazime-ekimler'), null);
  assert.equal(siteConfig.retiredPageRedirect('/talep/arazime-ekim/baska'), null);
  assert.equal(siteConfig.retiredPageRedirect('/kendi-arazim'), null, 'yeni sayfa kendine yönlenmez');
  assert.equal(siteConfig.retiredPageRedirect('/talep/tohum'), null, 'kaldırılan talep adresleri ayrı listede (307, sahalara)');
  assert.equal(siteConfig.RETIRED_REQUEST_REDIRECTS['/talep/tohum'], '/sahalar');
  assert.equal(siteConfig.retiredPageRedirect('/bireysel/x'), '/sahalar', 'mevcut kalıcı yönlendirmeler bozulmadı');
});

test('talep akışı açıkken /kendi-arazim askıda değil ve sitemapte üç dilde; eski adres sitemapte yok', async () => {
  assert.equal(siteConfig.isSuspendedRoute('/kendi-arazim'), false);
  const urls = await sitemapUrls(siteConfig, links);
  for (const url of ['https://ornek.test/kendi-arazim', 'https://ornek.test/en/kendi-arazim', 'https://ornek.test/ru/kendi-arazim']) {
    assert.ok(urls.includes(url), url);
  }
  assert.equal(urls.filter((url) => url.includes('arazime-ekim')).length, 0);
  assert.equal(urls.filter((url) => url.endsWith('/kendi-arazim')).length, 3, 'her dilde bir kez');
});

test('talep akışı kapalıyken /kendi-arazim askıya alınır ve sitemapten çıkar; eski adres yine önce yeni adrese gider', () => {
  assert.deepEqual(withRequestsClosed(), {
    enabled: false,
    suspended: true,
    redirect: '/kendi-arazim',
    cta: '/yakinda',
    ownLandInSitemap: false,
    sitesInSitemap: true,
  });
});
