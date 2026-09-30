#!/usr/bin/env node
/**
 * Ön yükleme (RSC prefetch) döngüsü denetimi — çalışan bir üretim derlemesine karşı, tarayıcıyla.
 *
 *   BASE=http://localhost:3302 npm run test:prefetch
 *   npm run test:prefetch:self      # betiğin kendi olumlu/olumsuz sınaması (uygulama sunucusu gerekmez)
 *
 * Neyi yakalar: Next 16.3'ün iyimser rota tahmini (experimental.optimisticRouting) /en, /ru ya da
 * /tr adresi görülen belgede ilk yol parçasının [locale] olduğunu öğrenir. Görünür bir bağlantı dil
 * öneksiz, tek parçalı bir adrese giderse (EN/RU'da next/link ile "/cerez-politikasi"; TR'de as-needed
 * gereği bütün bağlantılar) istemci onu "/[locale=cerez-politikasi]" ana sayfası sanar; ara katman
 * ise adresi /tr/cerez-politikasi'ye yeniden yazar. Yalnız baş (metadata) eksikken atılan istek bu
 * sapmayı fark etmez: yanıt sunucunun anahtarına yazılır, zamanlayıcı tahmin edilen anahtarı okur,
 * boş bulur ve aynı isteği ara vermeden yineler (yerelde sayfa başına 150–260 istek/sn; yanıtlar
 * no-store, Vercel'de her biri ara katman + işlev çağrısı). Tahmin next.config.ts'te kapalı; bu
 * denetim hem öneksiz bağlantıları hem tahminin yeniden açılmasını yakalar.
 *
 * Nasıl: her senaryo taze bir tarayıcı bağlamında açılır (çerez tercihi kayıtlı değil → çerez bandı
 * görünür), sayfa sonuna kadar kaydırılır (görünür her bağlantı ön yüklensin), beklenir ve `_rsc`
 * istekleri yola göre sayılır. Bir yola ESIK'ten fazla ya da senaryo başına TAVAN'dan fazla RSC
 * isteği giderse senaryo kalır. Sayım yalnız RSC sayısına bakmaz — senaryo ancak şu koşullarda geçer:
 *   - doğrudan: ilk yanıt 2xx, adres değişmedi, sayfa hazır (aşağıda).
 *   - geçiş / dil: tetikleme (router.push ya da dil düğmesi) sonrası BEKLENEN adrese varıldı (zaman aşımı
 *     yutulmaz), sayfa hazır ve hedef dilde. Sayım tetiklemeden ÖNCE başlar; ilk istekler kaçmaz.
 *   - sayfa hazır: document.readyState "complete", <html lang> beklenen dil, boş olmayan bir h1, anlamlı
 *     içerik ve Next hata ekranı yok (varsayılan 404/500 ".next-error-h1", "Application error").
 *   - oturum isteyen hedef giriş sayfasına, kapalı özellik /yakinda'ya düşerse senaryo GEÇMEZ: "engellendi"
 *     olarak ayrıca raporlanır (hedef sınanmış sayılmaz). Oturumlu koşu için CEREZ verilir.
 *   - doğrudan açılışlar: sitemap.xml'deki her adres (üç dil) ve önekli TR adresleri (/tr).
 *   - geçiş: /en ve /ru açılır (kalıp öğrenilir), sonra istemci tarafı geçişle uygulama sayfalarına
 *     ve öneksiz bir TR adresine gidilir; öğrenilen kalıp belge boyunca kalır.
 *   - dil: dil değiştiriciyle EN/RU → TR ve TR → EN (istemci geçişi; varılan sayfa sayılır).
 * Çıkış kodu: 0 = hepsi geçti · 1 = en az biri kaldı · 3 = kalan yok ama engellenen var (doğrulanmadı) · 2 = kullanım hatası.
 *
 * Ortam: BASE (zorunlu), ESIK (yol başına, 8), TAVAN (senaryo başına, 250), BEKLE (ms, 2500),
 * ESZAMANLI (3), CEREZ ("ad=değer"; oturum isteyen sayfalar için, ör. sahte Supabase oturumu),
 * YOLLAR (virgüllü; verilirse sitemap yerine bunlar açılır), GECIS_ZAMANASIMI (ms, 15000).
 * Tarayıcı: `npx playwright install chromium` (ya da PLAYWRIGHT_CHROMIUM_EXECUTABLE).
 * Dış adreslere giden istekler kesilir ve sayılır; yalnız BASE'e gidilir.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Uygulama (üyelik/kurumsal) sayfaları sitemap'te yok; istemci geçişiyle ayrıca denenir. Her hedefin beklenen sonucu
// açıktır: oturum isteyen sayfa oturumsuz koşuda girişe düşer (engellendi), kurumsal sayfalar B2B bayrağı kapalıysa
// /yakinda'ya düşer (engellendi), oturumlu koşuda giriş sayfası hesaba yönlenir (izinli yönlendirme).
const UYGULAMA = [
  { path: "/auth/login", oturumlaYonlenir: "/hesabim" },
  { path: "/hesabim", oturum: true },
  { path: "/hesabim/taleplerim", oturum: true },
  { path: "/hesabim/siparisler", oturum: true },
  { path: "/kurumsal", b2b: true },
  { path: "/kurumsal/teklif-al", b2b: true },
];
// Son satır: koddaki öneksiz router.push("/…") çağrılarının karşılığı (EN belgesinden TR sayfasına istemci geçişi).
const GECISLER = [
  ...UYGULAMA.flatMap((hedef) => ["/en", "/ru"].map((prefix) => ({ start: prefix, target: prefix + hedef.path, hedef }))),
  { start: "/en", target: "/sahalar", hedef: { path: "/sahalar" } },
];
// Dil değiştirici istemci geçişi yapar: EN/RU'da öğrenilen kalıp varılan TR sayfasına taşınır.
const DIL_DEGISIMLERI = [["/en/sahalar", "tr"], ["/ru/hakkimizda", "tr"], ["/en", "tr"], ["/sahalar", "en"]];
// Sitemap'te yok ama dil değiştirici EN/RU'dan TR'ye bu adreslerle varır; sayfa yenilenince doğrudan açılır.
const EK_DOGRUDAN = ["/tr", "/tr/sahalar"];

/** Adresin dili (as-needed: öneksiz = tr) ve dil öneksiz gövdesi. */
export function localeOf(path) {
  const m = /^\/(tr|en|ru)(?=\/|$)/.exec(path);
  return { locale: m ? m[1] : "tr", rest: m ? path.slice(m[0].length) || "" : path === "/" ? "" : path };
}
const withLocale = (locale, rest) => (locale === "tr" ? rest || "/" : `/${locale}${rest}`);

/**
 * Senaryonun beklenen sonucu: izinli varış yolları, hedef dil, ve (varsa) "engellendi" sayılan varış yolları.
 * Açık `expect` verilmişse (öz sınama) o kullanılır.
 */
export function expectationFor(scenario, { session = false } = {}) {
  if (scenario.expect) return scenario.expect;
  if (scenario.kind === "doğrudan") return { paths: [scenario.start], lang: localeOf(scenario.start).locale, blocked: [] };
  if (scenario.kind === "dil") {
    const { rest } = localeOf(scenario.start);
    const paths = scenario.locale === "tr" ? [withLocale("tr", rest), `/tr${rest}`] : [withLocale(scenario.locale, rest)];
    return { paths: [...new Set(paths)], lang: scenario.locale, blocked: [] };
  }
  // geçiş
  const { locale } = localeOf(scenario.target);
  const hedef = scenario.hedef ?? { path: localeOf(scenario.target).rest };
  const login = withLocale(locale, "/auth/login");
  const blocked = [];
  let paths = [scenario.target];
  if (hedef.oturum && !session) blocked.push({ path: login, reason: "oturum yok: giriş sayfasına yönlendi (hedef sınanmadı)" });
  if (hedef.oturumlaYonlenir && session) paths = [withLocale(locale, hedef.oturumlaYonlenir)];
  if (hedef.b2b) blocked.push({ path: withLocale(locale, "/yakinda"), reason: "B2B bayrağı kapalı: /yakinda (hedef sınanmadı)" });
  return { paths, lang: locale, blocked };
}

async function sitemapPaths(base) {
  const res = await fetch(`${base}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml ${res.status}`);
  const xml = await res.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1].trim()).pathname);
  return [...new Set(paths)];
}

function cookieFromEnv(base) {
  const raw = process.env.CEREZ;
  if (!raw) return null;
  const i = raw.indexOf("=");
  return { name: raw.slice(0, i), value: raw.slice(i + 1), domain: new URL(base).hostname, path: "/" };
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

/** Sayfanın gerçekten hazır olup olmadığı: dil, başlık, içerik, Next hata ekranları. */
async function pageState(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    return {
      ready: document.readyState,
      lang: document.documentElement.lang || "",
      h1: (document.querySelector("h1")?.textContent ?? "").trim().slice(0, 80),
      textLength: text.trim().length,
      nextError: Boolean(document.querySelector(".next-error-h1")),
      appError: /Application error: a (?:client|server)-side exception/i.test(text),
    };
  });
}

function readinessProblem(state, expectedLang) {
  if (state.nextError) return "Next hata ekranı (404/500)";
  if (state.appError) return "uygulama hata ekranı";
  if (state.ready !== "complete") return `sayfa hazır değil (${state.ready})`;
  if (state.lang !== expectedLang) return `dil ${state.lang || "yok"} (beklenen ${expectedLang})`;
  if (!state.h1) return "sayfa başlığı (h1) yok";
  if (state.textLength < 120) return `içerik yok (${state.textLength} karakter)`;
  return null;
}

const matches = (paths, pathname) => paths.includes(pathname);

/**
 * Tek senaryo. Dönüş: { durum: "geçti" | "KALDI" | "ENGELLENDİ", sebep, landed, http, rsc sayıları }.
 * Seçenekler: base (zorunlu), esik, tavan, bekle, gecisZamanasimi, cookie, session.
 */
export async function runScenario(browser, scenario, options) {
  const { base, esik = 8, tavan = 250, bekle = 2500, gecisZamanasimi = 15000, cookie = null } = options;
  const baseHost = new URL(base).host;
  const expect = expectationFor(scenario, { session: Boolean(cookie) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (cookie) await context.addCookies([cookie]);
  let external = 0;
  const externalHosts = new Set();
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === baseHost) return route.continue();
    external++;
    externalHosts.add(url.host);
    return route.abort();
  });
  const page = await context.newPage();
  const counts = new Map();
  let counting = scenario.kind === "doğrudan";
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (!counting || url.host !== baseHost || !url.searchParams.has("_rsc")) return;
    counts.set(url.pathname, (counts.get(url.pathname) ?? 0) + 1);
  });
  const result = (durum, sebep, extra = {}) => {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const hot = [...counts].filter(([, n]) => n > esik).sort((a, b) => b[1] - a[1]);
    return { ...scenario, beklenen: expect.paths.join(" | "), durum, sebep, total, paths: counts.size, hot, external, externalHosts: [...externalHosts], ...extra };
  };
  let http = null;
  try {
    const response = await page.goto(base + scenario.start, { waitUntil: "load" });
    http = response?.status() ?? null;
    if (http === null || http < 200 || http >= 300) {
      if (scenario.kind === "doğrudan") return result("KALDI", `HTTP ${http ?? "yanıt yok"}`, { landed: new URL(page.url()).pathname, http });
      return result("KALDI", `başlangıç sayfası HTTP ${http ?? "yanıt yok"}`, { landed: new URL(page.url()).pathname, http });
    }
    await page.waitForTimeout(1500);
    if (scenario.kind === "geçiş") {
      await scrollToEnd(page);
      await page.waitForTimeout(1000);
      // Sayım tetiklemeden ÖNCE başlar: geçişin ilk istekleri kaçmaz.
      counting = true;
      // Next'in istemci yönlendiricisi (App Router, window.next.router). Yoksa senaryo koşamaz: sessizce geçme.
      const pushed = await page.evaluate((href) => {
        const router = window.next?.router;
        if (typeof router?.push !== "function") return false;
        router.push(href);
        return true;
      }, scenario.target);
      if (!pushed) return result("KALDI", "window.next.router.push yok; istemci geçişi denenemedi", { landed: new URL(page.url()).pathname, http });
    }
    if (scenario.kind === "dil") {
      const button = page
        .locator('div[role="group"] button', { hasText: new RegExp(`^${scenario.locale}$`, "i") })
        .filter({ visible: true })
        .first();
      counting = true;
      await button.click({ timeout: 10000 });
    }
    if (scenario.kind !== "doğrudan") {
      const allowed = [...expect.paths, ...expect.blocked.map((b) => b.path)];
      try {
        // Yalnız adresin değişmesi yetmez: beklenen hedefe ya da açıkça tanımlı yönlendirmeye varılmalı.
        await page.waitForURL((u) => allowed.includes(u.pathname), { timeout: gecisZamanasimi });
      } catch {
        return result("KALDI", `hedefe varılmadı (${gecisZamanasimi} ms): son adres ${new URL(page.url()).pathname}, beklenen ${expect.paths.join(" | ")}`, { landed: new URL(page.url()).pathname, http });
      }
      await page.waitForLoadState("load");
      await page.waitForTimeout(1500);
    }
    const landed = new URL(page.url()).pathname;
    const block = expect.blocked.find((b) => b.path === landed);
    if (block) return result("ENGELLENDİ", block.reason, { landed, http });
    if (!matches(expect.paths, landed)) return result("KALDI", `beklenmeyen adres ${landed} (beklenen ${expect.paths.join(" | ")})`, { landed, http });
    const state = await pageState(page);
    const problem = readinessProblem(state, expect.lang);
    if (problem) return result("KALDI", problem, { landed, http, h1: state.h1 });
    await scrollToEnd(page);
    await page.waitForTimeout(bekle);
    const after = await pageState(page);
    const late = readinessProblem(after, expect.lang);
    if (late) return result("KALDI", `sayfa bozuldu: ${late}`, { landed, http, h1: after.h1 });
    const r = result("geçti", "", { landed, http, h1: state.h1 });
    if (r.hot.length) return { ...r, durum: "KALDI", sebep: r.hot.map(([p, n]) => `${p}×${n}`).join(" ") };
    if (r.total > tavan) return { ...r, durum: "KALDI", sebep: `toplam>${tavan}` };
    return r;
  } catch (error) {
    return result("KALDI", String(error?.message ?? error).split("\n")[0], { landed: new URL(page.url()).pathname, http });
  } finally {
    await context.close();
  }
}

export function buildScenarios(directPaths) {
  return [
    ...directPaths.map((path) => ({ kind: "doğrudan", start: path })),
    ...GECISLER.map((g) => ({ kind: "geçiş", ...g })),
    ...DIL_DEGISIMLERI.map(([start, locale]) => ({ kind: "dil", start, locale })),
  ].map((scenario, id) => ({ ...scenario, id }));
}

export async function runAll(browser, scenarios, options, eszamanli = 3) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, eszamanli) }, async () => {
      while (next < scenarios.length) {
        const scenario = scenarios[next++];
        results.push(await runScenario(browser, scenario, options));
      }
    }),
  );
  return results.sort((a, b) => a.id - b.id);
}

export function report(results, { esik, tavan }) {
  console.table(
    results.map((r) => ({
      senaryo: r.kind,
      adres: r.kind === "geçiş" ? `${r.start} → ${r.target}` : r.kind === "dil" ? `${r.start} → [${r.locale}]` : r.start,
      son: r.landed ?? "-",
      http: r.http ?? "-",
      rsc: r.total,
      yol: r.paths,
      dış: r.external ?? 0,
      durum: r.durum,
      ayrinti: r.sebep,
    })),
  );
  const failed = results.filter((r) => r.durum === "KALDI");
  const blocked = results.filter((r) => r.durum === "ENGELLENDİ");
  const passed = results.length - failed.length - blocked.length;
  const external = results.reduce((a, r) => a + (r.external ?? 0), 0);
  const hosts = [...new Set(results.flatMap((r) => r.externalHosts ?? []))].sort();
  if (hosts.length) console.log(`kesilen dış hostlar: ${hosts.join(", ")}`);
  console.log(
    `${results.length} senaryo: ${passed} geçti, ${failed.length} kaldı, ${blocked.length} engellendi (doğrulanmadı) · dış istek ${external} (kesildi) · yol başına eşik ${esik}, senaryo tavanı ${tavan}.`,
  );
  return failed.length ? 1 : blocked.length ? 3 : 0;
}

async function main() {
  const base = process.env.BASE?.replace(/\/+$/, "");
  if (!base) {
    console.error("BASE gerekli, ör. BASE=http://localhost:3302 npm run test:prefetch");
    process.exit(2);
  }
  const options = {
    base,
    esik: Number(process.env.ESIK ?? 8),
    tavan: Number(process.env.TAVAN ?? 250),
    bekle: Number(process.env.BEKLE ?? 2500),
    gecisZamanasimi: Number(process.env.GECIS_ZAMANASIMI ?? 15000),
    cookie: cookieFromEnv(base),
  };
  const directPaths = process.env.YOLLAR
    ? process.env.YOLLAR.split(",").map((p) => p.trim()).filter(Boolean)
    : [...(await sitemapPaths(base)), ...EK_DOGRUDAN];
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
  );
  const results = await runAll(browser, buildScenarios(directPaths), options, Number(process.env.ESZAMANLI ?? 3));
  await browser.close();
  process.exit(report(results, options));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
