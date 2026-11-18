/** Production-build SEO acceptance. Read-only local fixture; aborts external and mutation requests. */
import { chromium } from 'playwright';
import http from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { runScenario } from './prefetch-loop.mjs';
const base = process.env.BASE || 'http://127.0.0.1:3348';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local fixture only');
const out = process.env.OUTPUT || '/tmp/skytech-seo-acceptance';
await mkdir(out, { recursive: true });
const results = [], network = [], errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); if (!ok) console.log('FAIL', name, detail); };
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route('**/*', route => {
  const req = route.request(), url = new URL(req.url());
  const allowed = url.origin === base && ['GET', 'HEAD'].includes(req.method());
  network.push({ method: req.method(), url: req.url(), allowed });
  return allowed ? route.continue() : route.abort();
});
const page = await context.newPage();
page.on('pageerror', e => errors.push(String(e)));
const parser = await browser.newPage();
const parse = html => parser.evaluate(html => {
  const d = new DOMParser().parseFromString(html, 'text/html');
  return {
    title: d.title, h1: [...d.querySelectorAll('h1')].map(e => e.textContent),
    canonical: d.querySelector('link[rel=canonical]')?.getAttribute('href'),
    robots: d.querySelector('meta[name=robots]')?.content,
    googlebot: d.querySelector('meta[name=googlebot]')?.content,
    alternates: [...d.querySelectorAll('link[hreflang]')].map(e => [e.hreflang, e.href]),
    schemas: [...d.querySelectorAll('script[type="application/ld+json"]')].map(e => JSON.parse(e.textContent)),
    contentLang: [...d.querySelectorAll('[lang=tr]')].map(e => e.tagName),
    text: d.body.textContent,
  };
}, html);
const rawGet = (path, headers = {}) => new Promise((resolve,reject)=>{http.get(base+path,{headers},r=>{r.resume();resolve({status:r.statusCode,location:r.headers.location});}).on('error',reject);});
const get = async path => { const r = await fetch(base + path); return { status: r.status, path: new URL(r.url).pathname, headers: Object.fromEntries(r.headers), meta: await parse(await r.text()) }; };
try {
  const robots = await (await fetch(base + '/robots.txt')).text();
  check('robots permits rendering resources', !/^Disallow: \/_next\//m.test(robots));
  check('robots retains API/admin restrictions', robots.includes('Disallow: /api/') && robots.includes('Disallow: /admin'));
  const sitemap = await (await fetch(base + '/sitemap.xml')).text();
  const paths = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => new URL(m[1]).pathname);
  check('no fabricated lastmod', !sitemap.includes('<lastmod>'));
  check('private quote absent', !paths.some(p => p.endsWith('/kurumsal/teklif-al')));
  check('coated seed indexed in three languages', ['','/en','/ru'].every(p => paths.includes(p + '/kaplamali-tohum')));
  check('legal alternate copies absent', !paths.some(p => /^\/(en|ru)\/(kvkk|cerez-politikasi|gizlilik-politikasi|kullanim-kosullari|on-bilgilendirme|mesafeli-satis-sozlesmesi|cayma-ve-iade|ifa-kosullari|islem-rehberi)$/.test(p)));
  const crawl = [];
  for (const path of paths) {
    const r = await get(path); crawl.push({ requested: path, ...r });
    check(`crawl ${path}`, r.status === 200 && r.path === path && r.meta.h1.length === 1 && r.meta.h1[0].trim() && !r.meta.robots?.includes('noindex'), { status:r.status, path:r.path, h1:r.meta.h1, robots:r.meta.robots });
    check(`canonical ${path}`, new URL(r.meta.canonical).href === new URL(`https://skytechgreen.com${path}`).href, r.meta.canonical);
    const locale = /^\/(en|ru)(?:\/|$)/.exec(path)?.[1] || 'tr';
    const flatten = s => Array.isArray(s) ? s.flatMap(flatten) : s?.['@graph'] ? flatten(s['@graph']) : [s];
    for (const s of r.meta.schemas.flatMap(flatten)) {
      if (s?.['@type'] === 'Service') check(`service locale ${path}`, s.url === `https://skytechgreen.com${path}`, s.url);
      if (s?.['@type'] === 'BreadcrumbList') check(`breadcrumbs locale ${path}`, (s.itemListElement || []).every(i => !i.item || (locale === 'tr' ? !/^https:\/\/skytechgreen.com\/(en|ru)(?:\/|$)/.test(i.item) : i.item.startsWith(`https://skytechgreen.com/${locale}`))), s.itemListElement);
    }
  }
  await writeFile(out + '/crawl.json', JSON.stringify(crawl, null, 2));
  for (const l of ['en', 'ru']) {
    for (const path of ['/kvkk','/cerez-politikasi','/gizlilik-politikasi','/kullanim-kosullari','/on-bilgilendirme','/mesafeli-satis-sozlesmesi','/cayma-ve-iade','/ifa-kosullari','/islem-rehberi']) {
      const r = await get(`/${l}${path}`);
      check(`legal honest language ${l}${path}`, r.status === 200 && new URL(r.meta.canonical).href === new URL(`https://skytechgreen.com${path}`).href && r.meta.robots?.includes('noindex') && (!r.meta.googlebot || r.meta.googlebot.includes('noindex')) && !r.meta.alternates.length && !r.headers.link?.includes("hreflang") && r.meta.contentLang.includes('H1'), { canonical:r.meta.canonical, robots:r.meta.robots, googlebot:r.meta.googlebot, alternates:r.meta.alternates, link:r.headers.link, langs:r.meta.contentLang });
    }
    const quote = await get(`/${l}/kurumsal/teklif-al`);
    check(`private quote noindex ${l}`, quote.meta.robots?.includes('noindex') && quote.meta.canonical === `https://skytechgreen.com/${l}/kurumsal/teklif-al`, quote.meta.canonical);
  }
  for (const path of ['/tr', '/tr/sahalar', '/tr/kaplamali-tohum?utm_source=test']) {
    const r = await rawGet(path);
    check(`canonical redirect ${path}`, r.status === 308 && r.location?.endsWith(path.replace(/^\/tr/, '') || '/'), r);
  }
  // Node fetch normalizes Host; use raw HTTP to exercise virtual-host routing.
  const host = await rawGet('/tr/sahalar?utm_source=test',{host:'www.skytechgreen.com'});
  check('www and /tr normalize in one hop', host.status===308 && host.location==='https://skytechgreen.com/sahalar?utm_source=test', host.location);
  for (const prefix of ['', '/en', '/ru']) {
    const retired = await get(prefix+'/kurumsal');
    check(`old corporate demo retired ${prefix}`, retired.status===200 && retired.path===prefix+'/kurumsal-cozumler', retired.path);
  }
  // Public HTML is useful even when JavaScript cannot run.
  const nojs = await browser.newContext({ javaScriptEnabled:false, viewport:{width:390,height:844} });
  await nojs.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
  const np = await nojs.newPage(); await np.goto(base, {waitUntil:'load'});
  const visible = await np.locator('h1').evaluate(el => {
    const hidden = e => { for (let n=e; n; n=n.parentElement) { const s=getComputedStyle(n); if(s.opacity==='0'||s.visibility==='hidden'||s.display==='none') return true; } return false; };
    return [...el.querySelectorAll('span')].every(e=>!hidden(e)) && el.getBoundingClientRect().top < innerHeight;
  });
  check('no-JS mobile headline actually visible', visible);
  const heroLinks = np.locator('main section').first().locator('a');
  check('no-JS hero links rendered', await heroLinks.count() >= 2 && await heroLinks.first().isVisible());
  await np.screenshot({path:out+'/home-nojs-390.png'}); await nojs.close();
  for (const l of ['tr','en','ru']) {
    const prefix = l==='tr'?'':`/${l}`;
    for (const slug of ['bursa','canakkale','izmir']) {
      await page.goto(base+prefix+`/sahalar/${slug}-proje-uygulama-sahasi`, {waitUntil:'load'});
      await page.waitForTimeout(350);
      const title = await page.locator('h1').innerText();
      check(`site title ${l}/${slug}`, l==='tr' || !title.includes('Proje Uygulama Sahası'), title);
      check(`no mobile overflow ${l}/${slug}`, await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1));
      check(`method link ${l}/${slug}`, await page.locator(`main a[href="${prefix}/${slug==='canakkale'?'tohum-topu':'kaplamali-tohum'}"]`).count()>0);
    }
    await page.goto(base+prefix+'/kaplamali-tohum');
    check(`coated page ${l}`, await page.locator('h1').isVisible() && await page.locator('main h2').count()>=6);
    await page.screenshot({path:out+`/coated-${l}-390.png`,fullPage:true,animations:"disabled"});
  }
  await page.goto(base+'/sahalar/bursa-proje-uygulama-sahasi');
  await page.locator('[data-cookie-banner]').waitFor();
  check('mobile cookie does not stack with CTA', !(await page.locator('[data-sticky-cta]').isVisible()));
  const buttons=page.locator('[data-cookie-banner] button');
  check('equal cookie choice styles', await buttons.nth(0).getAttribute('class')===await buttons.nth(1).getAttribute('class'));
  await page.screenshot({path:out+'/site-cookie-390.png',animations:'disabled'});
  await buttons.nth(0).click();
  check('CTA returns after essential-only choice', await page.locator('[data-sticky-cta]').isVisible());
  await page.evaluate(()=>window.dispatchEvent(new Event('open-cookie-preferences')));
  await page.locator('[data-cookie-banner]').waitFor({state:'visible'});
  check('preferences reopen and CTA clears', await page.locator('[data-cookie-banner]').isVisible() && !(await page.locator('[data-sticky-cta]').isVisible()));
  await page.goto(base+'/en/kurumsal-cozumler');
  check('demo wrapper excluded from snippet', await page.locator('[data-nosnippet]').count()>0);
  check('demo label visible in rendered document', (await page.locator('body').innerText()).includes('Example screen — illustrative data'));
  await page.goto(base+'/ru/hakkimizda');
  check('about mobile overflow', await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check('no browser execution errors', errors.length===0, errors);
  check('no mutation requests', !network.some(r=>!['GET','HEAD'].includes(r.method)), network.filter(r=>!['GET','HEAD'].includes(r.method)));
  // Exercise client navigation and language switching with the existing prefetch regression detector.
  const prefetch=[];
  for (const scenario of [
    {kind:'doğrudan',start:'/tr/sahalar'}, {kind:'doğrudan',start:'/en/kaplamali-tohum'}, {kind:'doğrudan',start:'/ru'},
    {kind:'geçiş',start:'/en',target:'/sahalar',hedef:{path:'/sahalar'}},
    {kind:'dil',start:'/ru/hakkimizda',locale:'tr'}, {kind:'dil',start:'/sahalar',locale:'en'},
  ]) { const r=await runScenario(browser,scenario,{base,bekle:800});prefetch.push(r);check(`prefetch ${scenario.start} ${scenario.kind}`,r.durum==='geçti',r); }
  await writeFile(out+'/prefetch.json',JSON.stringify(prefetch,null,2));
} catch(e) { check('acceptance completed',false,String(e.stack)); }
finally {
  await writeFile(out+'/acceptance.json',JSON.stringify({results,errors,passed:results.filter(r=>r.ok).length,total:results.length},null,2));
  await writeFile(out+'/network.json',JSON.stringify(network,null,2));
  await browser.close();
}
console.log(`${results.filter(r=>r.ok).length}/${results.length} passed`);
process.exitCode=results.every(r=>r.ok)?0:1;
