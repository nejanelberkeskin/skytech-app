/** Matched local lab comparison. Not field Core Web Vitals or a Lighthouse score. */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const out=process.env.OUTPUT||'/tmp/skytech-seo-performance.json';
const origins={before:'http://localhost:3349',after:'http://localhost:3348'};
const browser=await chromium.launch({channel:'chrome'}), results=[];
try {
  for (const path of (process.env.PATHS || '/').split(',')) for (let run=1;run<=Number(process.env.RUNS || 3);run++) for (const variant of ['before','after']) {
    const base=origins[variant];
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await context.route('**/*',r=>new URL(r.request().url()).origin===base && ['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
    const page=await context.newPage();
    await page.addInitScript(()=>{
      window.__seoVitals={lcp:0,cls:0,lcpElement:'',longTasks:[]};
      new PerformanceObserver(list=>{for(const e of list.getEntries()){window.__seoVitals.lcp=e.startTime;window.__seoVitals.lcpElement=e.element?.outerHTML?.slice(0,250)||'';}}).observe({type:'largest-contentful-paint',buffered:true});
      new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__seoVitals.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
      new PerformanceObserver(list=>{for(const e of list.getEntries())window.__seoVitals.longTasks.push(e.duration);}).observe({type:'longtask',buffered:true});
    });
    const cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8,connectionType:'cellular4g'});
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await page.goto(base+path,{waitUntil:'load',timeout:90000});
    await page.waitForTimeout(4000);
    const r=await page.evaluate(()=>({...window.__seoVitals,fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,ttfb:performance.getEntriesByType('navigation')[0]?.responseStart,resources:performance.getEntriesByType('resource').length}));
    results.push({path,run,variant,...r}); console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
}finally{await browser.close();await writeFile(out,JSON.stringify({conditions:{viewport:'390x844',latencyMs:150,downloadMbps:1.6,cpuSlowdown:4,coldCache:true,note:'Local production builds, same dependencies and read-only fixture; not real-user metrics.'},results},null,2));}
