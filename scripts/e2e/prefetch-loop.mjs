#!/usr/bin/env node
/**
 * Ön yükleme (RSC prefetch) döngüsü denetimi — çalışan bir üretim derlemesine karşı, tarayıcıyla.
 *
 *   BASE=http://localhost:3302 npm run test:prefetch
 *
 * Neyi yakalar: Next 16.3'ün iyimser rota tahmini (experimental.optimisticRouting) /en ve /ru
 * adreslerinden ilk yol parçasının [locale] olduğunu öğrenir. Görünür bir bağlantı dil öneksiz, tek
 * parçalı bir adrese giderse (ör. next/link ile "/cerez-politikasi") istemci onu
 * "/[locale=cerez-politikasi]" ana sayfası sanar; ara katman ise adresi /tr/cerez-politikasi'ye
 * yeniden yazar. Yalnız baş (metadata) eksikken atılan istek bu sapmayı fark etmez: yanıt sunucunun
 * anahtarına yazılır, zamanlayıcı tahmin edilen anahtarı okur, boş bulur ve aynı isteği ara vermeden
 * yineler (yerelde sayfa başına ~200 istek/sn; Vercel'de her biri ara katman + işlev çağrısı).
 *
 * Nasıl: her senaryo taze bir tarayıcı bağlamında açılır (çerez tercihi kayıtlı değil → çerez bandı
 * görünür), sayfa sonuna kadar kaydırılır (görünür her bağlantı ön yüklensin), beklenir ve `_rsc`
 * istekleri yola göre sayılır. Bir yola ESIK'ten fazla ya da senaryo başına TAVAN'dan fazla RSC
 * isteği giderse 1 ile çıkar.
 *   - doğrudan: sitemap.xml'deki her adres (üç dil) ilk yükleme olarak açılır.
 *   - geçiş: /en ve /ru açılır (kalıp öğrenilir), sonra istemci tarafı geçişle uygulama sayfalarına
 *     gidilir; öğrenilen kalıp belge boyunca kalır.
 *
 * Ortam: BASE (zorunlu), ESIK (yol başına, 8), TAVAN (senaryo başına, 250), BEKLE (ms, 2500),
 * ESZAMANLI (3), CEREZ ("ad=değer"; oturum isteyen sayfalar için, ör. sahte Supabase oturumu),
 * YOLLAR (virgüllü; verilirse sitemap yerine bunlar açılır).
 * Tarayıcı: `npx playwright install chromium` (ya da PLAYWRIGHT_CHROMIUM_EXECUTABLE).
 * Dış adreslere giden istekler kesilir; yalnız BASE'e gidilir.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE?.replace(/\/+$/, "");
if (!BASE) {
  console.error("BASE gerekli, ör. BASE=http://localhost:3302 npm run test:prefetch");
  process.exit(2);
}
const ESIK = Number(process.env.ESIK ?? 8);
const TAVAN = Number(process.env.TAVAN ?? 250);
const BEKLE = Number(process.env.BEKLE ?? 2500);
const ESZAMANLI = Number(process.env.ESZAMANLI ?? 3);
const baseHost = new URL(BASE).host;

// Uygulama (üyelik/kurumsal) sayfaları sitemap'te yok; istemci geçişiyle ayrıca denenir.
const GECIS_HEDEFLERI = ["/auth/login", "/hesabim", "/hesabim/taleplerim", "/hesabim/siparisler", "/kurumsal", "/kurumsal/teklif-al"];

async function sitemapPaths() {
  const res = await fetch(`${BASE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml ${res.status}`);
  const xml = await res.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1].trim()).pathname);
  return [...new Set(paths)];
}

function cookieFromEnv() {
  const raw = process.env.CEREZ;
  if (!raw) return null;
  const i = raw.indexOf("=");
  return { name: raw.slice(0, i), value: raw.slice(i + 1), domain: new URL(BASE).hostname, path: "/" };
}

async function scrollToEnd(page) {
  for (let i = 0; i < 60; i++) {
    const atEnd = await page.evaluate(() => {
      window.scrollBy(0, 600);
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    });
    await page.waitForTimeout(120);
    if (atEnd) break;
  }
}

async function runScenario(browser, scenario) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const cookie = cookieFromEnv();
  if (cookie) await context.addCookies([cookie]);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).host === baseHost ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  const counts = new Map();
  let counting = scenario.kind === "doğrudan";
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (!counting || url.host !== baseHost || !url.searchParams.has("_rsc")) return;
    counts.set(url.pathname, (counts.get(url.pathname) ?? 0) + 1);
  });
  try {
    await page.goto(BASE + scenario.start, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    if (scenario.kind === "geçiş") {
      await scrollToEnd(page);
      await page.waitForTimeout(1000);
      const target = scenario.localePrefix + scenario.target;
      // Next'in istemci yönlendiricisi (App Router, window.next.router). Yoksa senaryo koşamaz: sessizce geçme.
      const pushed = await page.evaluate((href) => {
        const router = window.next?.router;
        if (typeof router?.push !== "function") return false;
        router.push(href);
        return true;
      }, target);
      if (!pushed) throw new Error("window.next.router.push yok; istemci geçişi denenemedi");
      counting = true;
      await page.waitForURL((u) => u.pathname !== scenario.start, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    await scrollToEnd(page);
    await page.waitForTimeout(BEKLE);
    const landed = new URL(page.url()).pathname;
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const hot = [...counts].filter(([, n]) => n > ESIK).sort((a, b) => b[1] - a[1]);
    return { ...scenario, landed, total, paths: counts.size, hot, ok: hot.length === 0 && total <= TAVAN };
  } catch (error) {
    return { ...scenario, landed: "-", total: 0, paths: 0, hot: [], ok: false, error: String(error?.message ?? error) };
  } finally {
    await context.close();
  }
}

const directPaths = process.env.YOLLAR ? process.env.YOLLAR.split(",").map((p) => p.trim()).filter(Boolean) : await sitemapPaths();
const scenarios = [
  ...directPaths.map((path) => ({ kind: "doğrudan", start: path })),
  ...GECIS_HEDEFLERI.flatMap((target) =>
    ["/en", "/ru"].map((localePrefix) => ({ kind: "geçiş", start: localePrefix, localePrefix, target })),
  ),
].map((scenario, id) => ({ ...scenario, id }));

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
);
const results = [];
let next = 0;
await Promise.all(
  Array.from({ length: Math.max(1, ESZAMANLI) }, async () => {
    while (next < scenarios.length) {
      const scenario = scenarios[next++];
      results.push(await runScenario(browser, scenario));
    }
  }),
);
await browser.close();

results.sort((a, b) => a.id - b.id);
console.table(
  results.map((r) => ({
    senaryo: r.kind,
    adres: r.kind === "geçiş" ? `${r.start} → ${r.localePrefix}${r.target}` : r.start,
    son: r.landed,
    rsc: r.total,
    yol: r.paths,
    durum: r.ok ? "geçti" : "KALDI",
    ayrinti: r.error ?? (r.hot.map(([p, n]) => `${p}×${n}`).join(" ") || (r.total > TAVAN ? `toplam>${TAVAN}` : "")),
  })),
);
const failed = results.filter((r) => !r.ok);
console.log(`${results.length} senaryo, ${failed.length} kaldı (yol başına eşik ${ESIK}, senaryo tavanı ${TAVAN}).`);
process.exit(failed.length === 0 ? 0 : 1);
