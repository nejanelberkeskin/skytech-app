import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.BASE || 'http://127.0.0.1:3352';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('Local only');
const out=process.env.OUTPUT || '../outputs/astra-saha-kasim-2026';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const results=[],network=[],errors=[];
const check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)console.log('FAIL',name,detail||'');};
for(const locale of ['tr','en','ru']) for(const width of [390,1440]) {
 const context=await browser.newContext({viewport:{width,height:900}});
 let stage='before';
 await context.route('**/*',route=>{
  const r=route.request(),allowed=new URL(r.url()).origin===base && ['GET','HEAD'].includes(r.method());
  network.push({locale,width,stage,url:r.url(),method:r.method(),allowed});
  return allowed?route.continue():route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 const prefix=locale==='tr'?'':'/'+locale;
 await page.goto(base+prefix+'/sahalar/izmir-proje-uygulama-sahasi');
 await page.locator('#operation-title').waitFor();
 const reject=page.getByRole('button',{name:{tr:'Yalnız zorunlu',en:'Essential only',ru:'Только необходимые'}[locale],exact:true});
 if(await reject.isVisible()) await reject.click();
 await page.locator('#operation-title').scrollIntoViewIfNeeded();
 const label={tr:'Videoyu oynat',en:'Play video',ru:'Воспроизвести видео'}[locale];
 const play=page.getByRole('button',{name:label,exact:true});
 await play.scrollIntoViewIfNeeded();
 check(`${locale}-${width}: completed seed count`,(await page.locator('body').innerText()).includes(new Intl.NumberFormat(locale).format(14000000)));
 check(`${locale}-${width}: sourced regional fire area`,await page.locator('a[href*="ogm.gov.tr/izmirobm"]').count()===1);
 check(`${locale}-${width}: closed CTA`,await page.locator('a[href*="izmir-proje-uygulama-sahasi/katil"]').count()===0);
 check(`${locale}-${width}: no video element before click`,await page.locator('video').count()===0);
 check(`${locale}-${width}: no media request before click`,!network.some(n=>n.locale===locale&&n.width===width&&n.stage==='before'&&n.url.includes('/videos/sahalar/')));
 check(`${locale}-${width}: no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 for(const img of await page.locator('img').all()) { if(!await img.isVisible()) continue; await img.scrollIntoViewIfNeeded(); await img.evaluate(i=>i.decode().catch(()=>{})); }
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:`${out}/izmir-${locale}-${width}.png`,fullPage:true});
 stage='after';await play.click();
 await page.locator('video').evaluate(v=>new Promise((resolve,reject)=>{if(v.readyState>=1)return resolve();v.addEventListener('loadedmetadata',resolve,{once:true});v.addEventListener('error',()=>reject(Error('video error')),{once:true});}));
 check(`${locale}-${width}: local video loads`,network.some(n=>n.locale===locale&&n.width===width&&n.stage==='after'&&n.url.includes('/videos/sahalar/')));
 check(`${locale}-${width}: keyboard focus retained`,await page.locator('video').evaluate(v=>document.activeElement===v));
 await page.goto(base+prefix+'/sahalar/izmir-proje-uygulama-sahasi/katil');
 check(`${locale}-${width}: closed wizard redirects`,!new URL(page.url()).pathname.endsWith('/katil'));
 for(const slug of ['bursa','canakkale']) {
  await page.goto(base+prefix+`/sahalar/${slug}-proje-uygulama-sahasi`);
  await page.locator('#operation-title').waitFor();
  const body=await page.locator('body').innerText();
  check(`${locale}-${width}-${slug}: no made-up sales`,!/%\s*(21|34)|(21|34)\s*%/.test(body));
  check(`${locale}-${width}-${slug}: participation link`,await page.locator(`a[href*="${slug}-proje-uygulama-sahasi/katil"]`).count()>0);
  check(`${locale}-${width}-${slug}: no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check(`${locale}-${width}-${slug}: estimated seed target`,body.includes(new Intl.NumberFormat(locale).format(slug==='bursa'?12992000:13300000)));
  if(slug==='bursa') {
   check(`${locale}-${width}: separate total and seeded areas`,body.includes('400')&&body.includes(new Intl.NumberFormat(locale).format(92.8)));
   await page.screenshot({path:`${out}/bursa-${locale}-${width}.png`,fullPage:true});
  }
 }
 await context.close();
}
check('no page errors',errors.length===0,errors);
check('no external or mutation requests',network.every(n=>n.allowed));
await writeFile(`${out}/browser.json`,JSON.stringify({results,errors},null,2));
await writeFile(`${out}/network.json`,JSON.stringify(network,null,2));
await browser.close();
console.log(`${results.filter(r=>r.ok).length}/${results.length}`);
if(results.some(r=>!r.ok))process.exitCode=1;
