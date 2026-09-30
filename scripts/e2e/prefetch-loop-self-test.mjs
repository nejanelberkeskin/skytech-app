#!/usr/bin/env node
/**
 * prefetch-loop.mjs'in kendi sınaması: denetim yanlış başarı vermiyor mu?
 *
 *   npm run test:prefetch:self
 *
 * Uygulama sunucusu gerekmez. Yerel bir fikstür sunucusu (127.0.0.1, rastgele port) hatalı ve çalışan sayfaları sunar;
 * gerçek runScenario ve report işlevleri bunlara karşı koşulur. Olumsuz örnekler (HTTP 500/404, Next hata ekranı,
 * uygulama hata ekranı, yanlış dil, başlıksız sayfa, RSC döngüsü, hiçbir şey yapmayan router.push, yanlış hedef,
 * hedefte yanlış dil, dil değişiminde yanlış dil) "KALDI"; oturum isteyen hedefin girişe düşmesi "ENGELLENDİ";
 * çalışan sayfa, geçiş ve dil değişimi "geçti" olmalı. Beklenti tutmazsa 1 ile çıkar.
 * Tarayıcı: PLAYWRIGHT_CHROMIUM_EXECUTABLE ya da `npx playwright install chromium`.
 */
import { createServer } from "node:http";
import { chromium } from "playwright";
import { report, runScenario } from "./prefetch-loop.mjs";

const FILLER = "Bu fikstür sayfası denetimin kendi sınaması içindir; uygulama içeriği değildir. ".repeat(4);
const langOf = (path) => (/^\/(en|ru)(?=\/|$)/.exec(path)?.[1] ?? "tr");

/** Fikstür sayfası. router: window.next.router.push davranışı; switcher: dil düğmelerinin davranışı. */
function html({ lang = "tr", h1 = "Fikstür", body = "", router = "yok", switcher = "yok" } = {}) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>fikstür</title></head><body>
${h1 === null ? "" : `<h1>${h1}</h1>`}<main><p>${FILLER}</p>${body}</main>
<div role="group"><button type="button">TR</button><button type="button">EN</button><button type="button">RU</button></div>
<script>
const langOf = (p) => (/^\\/(en|ru)(?=\\/|$)/.exec(p) || [])[1] || "tr";
function render(href, lang) {
  history.pushState({}, "", href);
  document.documentElement.lang = lang;
  document.querySelector("h1") ? (document.querySelector("h1").textContent = "Hedef") : document.body.insertAdjacentHTML("afterbegin", "<h1>Hedef</h1>");
}
const mode = ${JSON.stringify(router)};
window.next = { router: { push(href) {
  if (mode === "calisan") render(href, langOf(href));
  else if (mode === "baska") render("/baska", "tr");
  else if (mode === "dil-bozuk") render(href, "tr");
  else if (mode === "giris") render("/en/auth/login?redirect=" + encodeURIComponent(href), "en");
  /* "noop": hiçbir şey yapmaz */
} } };
const sw = ${JSON.stringify(switcher)};
for (const b of document.querySelectorAll('div[role="group"] button')) b.addEventListener("click", () => {
  const rest = location.pathname.replace(/^\\/(en|ru|tr)(?=\\/|$)/, "") || "/";
  if (sw === "calisan" && b.textContent === "TR") render(rest, "tr");
  if (sw === "bozuk" && b.textContent === "TR") render(rest, document.documentElement.lang);
});
</script></body></html>`;
}

const PAGES = {
  "/tr-calisan": { body: html({ h1: "Çalışan sayfa" }) },
  "/500": { status: 500, body: html({ h1: "Görünüşte normal ama 500" }) },
  "/404": { status: 404, body: html({ h1: "Görünüşte normal ama 404" }) },
  "/next-404": { body: html({ h1: null, body: '<h1 class="next-error-h1">404</h1><h2>This page could not be found.</h2>' }) },
  "/uygulama-hatasi": { body: html({ h1: "Hata", body: "<p>Application error: a client-side exception has occurred (see the browser console for more information).</p>" }) },
  "/en/yanlis-dil": { body: html({ lang: "tr", h1: "Wrong language" }) },
  "/basliksiz": { body: html({ h1: null }) },
  "/dongu": { body: html({ h1: "Döngü", body: '<script>for (let i = 0; i < 20; i++) fetch("/dongu-hedef?_rsc=" + i);</script>' }) },
  "/gecis": { body: html({ h1: "Başlangıç", router: "calisan" }) },
  "/noop": { body: html({ h1: "Başlangıç", router: "noop" }) },
  "/yanlis-hedef": { body: html({ h1: "Başlangıç", router: "baska" }) },
  "/en/gecis-dil": { body: html({ lang: "en", h1: "Start", router: "dil-bozuk" }) },
  "/en/korumali-baslangic": { body: html({ lang: "en", h1: "Start", router: "giris" }) },
  "/en/dil-calisan": { body: html({ lang: "en", h1: "Start", switcher: "calisan" }) },
  "/ru/dil-bozuk": { body: html({ lang: "ru", h1: "Старт", switcher: "bozuk" }) },
};

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.searchParams.has("_rsc")) {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("");
  }
  const page = PAGES[url.pathname] ?? { body: html({ lang: langOf(url.pathname), h1: "Hedef" }) };
  res.writeHead(page.status ?? 200, { "content-type": "text/html; charset=utf-8" });
  res.end(page.body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// [senaryo, beklenen durum]
const CASES = [
  [{ kind: "doğrudan", start: "/tr-calisan" }, "geçti"],
  [{ kind: "doğrudan", start: "/500" }, "KALDI"],
  [{ kind: "doğrudan", start: "/404" }, "KALDI"],
  [{ kind: "doğrudan", start: "/next-404" }, "KALDI"],
  [{ kind: "doğrudan", start: "/uygulama-hatasi" }, "KALDI"],
  [{ kind: "doğrudan", start: "/en/yanlis-dil" }, "KALDI"],
  [{ kind: "doğrudan", start: "/basliksiz" }, "KALDI"],
  [{ kind: "doğrudan", start: "/dongu" }, "KALDI"],
  [{ kind: "geçiş", start: "/gecis", target: "/hedef", hedef: { path: "/hedef" } }, "geçti"],
  [{ kind: "geçiş", start: "/noop", target: "/hedef", hedef: { path: "/hedef" } }, "KALDI"],
  [{ kind: "geçiş", start: "/yanlis-hedef", target: "/hedef", hedef: { path: "/hedef" } }, "KALDI"],
  [{ kind: "geçiş", start: "/en/gecis-dil", target: "/en/hedef", hedef: { path: "/hedef" } }, "KALDI"],
  [{ kind: "geçiş", start: "/en/korumali-baslangic", target: "/en/hesabim", hedef: { path: "/hesabim", oturum: true } }, "ENGELLENDİ"],
  [{ kind: "dil", start: "/en/dil-calisan", locale: "tr" }, "geçti"],
  [{ kind: "dil", start: "/ru/dil-bozuk", locale: "tr" }, "KALDI"],
].map(([scenario, beklenen], id) => [{ ...scenario, id }, beklenen]);

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
);
const options = { base, esik: 8, tavan: 250, bekle: 200, gecisZamanasimi: 3000, cookie: null };
let mismatches = 0;
try {
  const results = [];
  for (const [scenario, beklenen] of CASES) {
    const r = await runScenario(browser, scenario, options);
    const ok = r.durum === beklenen;
    if (!ok) mismatches++;
    results.push({ adres: scenario.target ? `${scenario.start} → ${scenario.target}` : scenario.locale ? `${scenario.start} → [${scenario.locale}]` : scenario.start, beklenen, sonuc: r.durum, sebep: r.sebep, dogru: ok ? "✓" : "✗" });
  }
  console.table(results);
  // Çıkış kodları: kalan varsa 1, yalnız engellenen varsa 3, hepsi geçtiyse 0.
  const quiet = { table: console.table, log: console.log };
  console.table = () => {};
  console.log = () => {};
  const codes = [
    report([{ durum: "geçti" }, { durum: "KALDI" }], options),
    report([{ durum: "geçti" }, { durum: "ENGELLENDİ" }], options),
    report([{ durum: "geçti" }], options),
  ];
  Object.assign(console, quiet);
  const codesOk = codes.join(",") === "1,3,0";
  if (!codesOk) mismatches++;
  console.log(`çıkış kodları (kalan, engellenen, hepsi geçti): ${codes.join(", ")} ${codesOk ? "✓" : "✗ (beklenen 1, 3, 0)"}`);
  console.log(mismatches ? `ÖZ SINAMA BAŞARISIZ: ${mismatches} beklenti tutmadı` : `öz sınama: ${CASES.length} senaryo + çıkış kodları beklendiği gibi`);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
process.exit(mismatches ? 1 : 0);
