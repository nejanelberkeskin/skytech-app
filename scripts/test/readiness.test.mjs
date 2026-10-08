import assert from "node:assert/strict";

/* Satışa hazırlık (lib/orders/readiness.ts): kararı sipariş kapısıyla aynı, gizli değer sızdırmaz. */

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
process.env.NEXT_PUBLIC_SALES_ENABLED = "true"; // site-config içe aktarılırken okunur
process.env.PAYMENT_PROVIDER = "mock";
delete process.env.VERCEL_ENV;

const R = await import(ROOT + "/lib/orders/readiness.ts");
const Gate = await import(ROOT + "/lib/orders/gate.ts");
const Legal = await import(ROOT + "/lib/legal/version.ts");
const Pay = await import(ROOT + "/lib/payments/index.ts");

const levelOf = (res, key) => res.items.find((i) => i.key === key)?.level;

/* ── Karar, kapıyla aynı ─────────────────────────────────────────────────── */
let res = R.salesReadiness({ ordersPaused: false }, {});
assert.equal(res.environment, "development");
assert.equal(res.accepting, Gate.canAcceptOrders(Pay.getPaymentProvider(), { ordersPaused: false }));
assert.equal(levelOf(res, "salesFlag"), "ok");
assert.equal(levelOf(res, "provider"), "warning", "deneme sağlayıcısı: sipariş alınır ama deneme sayılır");
if (Legal.isDraftLegalVersion()) {
  assert.equal(levelOf(res, "legal"), "warning", "yerelde deneme sağlayıcısıyla taslak metin engel değil");
  assert.equal(res.accepting, true);
}
assert.equal(levelOf(res, "paused"), "ok");

res = R.salesReadiness({ ordersPaused: true }, {});
assert.equal(res.accepting, false, "durdurulunca sipariş alınmaz");
assert.equal(levelOf(res, "paused"), "blocker");

/* ── Canlı sitede deneme sağlayıcısı yok ─────────────────────────────────── */
process.env.VERCEL_ENV = "production";
res = R.salesReadiness({ ordersPaused: false }, { VERCEL_ENV: "production" });
assert.equal(res.environment, "production");
assert.equal(levelOf(res, "provider"), "blocker", "canlıda deneme sağlayıcısı seçilmez");
assert.equal(res.accepting, false);
if (Legal.isDraftLegalVersion()) assert.equal(levelOf(res, "legal"), "blocker", "canlıda taslak metinle sipariş yok");
delete process.env.VERCEL_ENV;

/* ── Gizli değerler yanıtta ASLA yer almaz ───────────────────────────────── */
const secrets = {
  RESEND_API_KEY: "re_GIZLI_resend_4711",
  CRON_SECRET: "GIZLI-cron-9f2c",
  ORDER_LINK_SECRET: "GIZLI-link-77aa",
  NEXT_PUBLIC_APP_URL: "https://skytechgreen.com",
};
res = R.salesReadiness({ ordersPaused: false }, secrets);
const text = JSON.stringify(res);
for (const [name, value] of Object.entries(secrets)) {
  if (name.startsWith("NEXT_PUBLIC_")) continue;
  assert.ok(!text.includes(value), `${name} değeri yanıta sızmamalı`);
}
for (const key of ["orderLinks", "appUrl"]) assert.equal(levelOf(res, key), "ok", key);
assert.ok(text.includes("https://skytechgreen.com"), "herkese açık site adresi gösterilebilir");

/* ── Anahtar var ≠ çalışıyor: yapılandırma, doğrulama ve son sonuç ayrı (32 §5) ── */
const item = (r, key) => r.items.find((i) => i.key === key);
for (const key of ["email", "cron"]) {
  const it = item(res, key);
  assert.equal(it.level, "warning", `${key}: anahtar var diye hazır sayılmaz`);
  assert.equal(it.configured, true);
  assert.equal(it.verification, "unknown", `${key}: kanıt okunmadıysa bilinmiyor`);
  assert.equal(it.lastResult, null);
}
assert.equal(item(res, "salesFlag").verification, null, "yalnız dış işleyişi olan maddelerde doğrulama var");
const now = new Date("2026-09-29T12:00:00Z");
const ev = (over = {}) => ({
  scheduler: { lastCronSuccessAt: null, lastCronFailureAt: null, lastManualSuccessAt: null, ...(over.scheduler ?? {}) },
  email: { lastAcceptedAt: null, lastFailedAt: null, ...(over.email ?? {}) },
});
let r2 = R.salesReadiness({ ordersPaused: false }, secrets, ev(), now);
assert.equal(item(r2, "cron").verification, "not_verified");
assert.match(item(r2, "cron").label, /doğrulanmadı/);
assert.equal(item(r2, "email").verification, "not_verified");
r2 = R.salesReadiness({ ordersPaused: false }, secrets, ev({ scheduler: { lastManualSuccessAt: "2026-09-29T11:00:00.000Z" } }), now);
assert.equal(item(r2, "cron").verification, "not_verified", "elle çalıştırma zamanlayıcıyı kanıtlamaz");
assert.deepEqual(item(r2, "cron").lastResult, { at: "2026-09-29T11:00:00.000Z", ok: true, source: "admin" });
assert.match(item(r2, "cron").detail, /zamanlayıcıyı kanıtlamaz/);
r2 = R.salesReadiness({ ordersPaused: false }, secrets, ev({ scheduler: { lastCronSuccessAt: "2026-09-29T03:00:30.000Z" } }), now);
assert.equal(item(r2, "cron").verification, "verified");
assert.equal(item(r2, "cron").level, "ok", "yalnız zamanlayıcının taze başarılı çalışması yeşil");
assert.deepEqual(item(r2, "cron").lastResult, { at: "2026-09-29T03:00:30.000Z", ok: true, source: "cron" });
r2 = R.salesReadiness({ ordersPaused: false }, secrets, ev({ scheduler: { lastCronSuccessAt: "2026-09-27T03:00:30.000Z" } }), now);
assert.equal(item(r2, "cron").verification, "not_verified", "26 saatten eski başarı doğrulama sayılmaz");
assert.equal(item(r2, "cron").level, "warning");
r2 = R.salesReadiness({ ordersPaused: false }, secrets,
  ev({ scheduler: { lastCronSuccessAt: "2026-09-28T03:00:30.000Z", lastCronFailureAt: "2026-09-29T03:00:30.000Z" } }), now);
assert.equal(item(r2, "cron").verification, "failed");
assert.deepEqual(item(r2, "cron").lastResult, { at: "2026-09-29T03:00:30.000Z", ok: false, source: "cron" });
r2 = R.salesReadiness({ ordersPaused: false }, secrets, ev({ email: { lastAcceptedAt: "2026-09-29T10:00:00.000Z" } }), now);
assert.equal(item(r2, "email").verification, "not_verified", "sağlayıcının kabulü teslim kanıtı değildir");
assert.equal(item(r2, "email").level, "warning");
assert.deepEqual(item(r2, "email").lastResult, { at: "2026-09-29T10:00:00.000Z", ok: true, source: "provider" });
assert.match(item(r2, "email").detail, /teslim edildiği kanıtlanmadı/);
r2 = R.salesReadiness({ ordersPaused: false }, secrets,
  ev({ email: { lastAcceptedAt: "2026-09-29T10:00:00.000Z", lastFailedAt: "2026-09-29T11:00:00.000Z" } }), now);
assert.equal(item(r2, "email").verification, "failed");
r2 = R.salesReadiness({ ordersPaused: false }, secrets, { scheduler: null, email: null }, now);
assert.deepEqual([item(r2, "cron").verification, item(r2, "email").verification], ["unknown", "unknown"], "kayıt okunamadıysa bilinmiyor");
const t2 = JSON.stringify(r2);
for (const [name, value] of Object.entries(secrets)) if (!name.startsWith("NEXT_PUBLIC_")) assert.ok(!t2.includes(value), name);

/* ── Eksikler uyarı olarak görünür ───────────────────────────────────────── */
res = R.salesReadiness({ ordersPaused: false }, {});
for (const key of ["email", "cron", "orderLinks", "appUrl"]) assert.equal(levelOf(res, key), "warning", key);
for (const key of ["email", "cron"]) assert.equal(res.items.find((i) => i.key === key).configured, false, key);
assert.ok(!res.items.find((i) => i.key === "cron").detail.includes("yönetim ekranları açıldıkça"), "liste ekranları artık iş tetiklemiyor");
const company = res.items.find((i) => i.key === "company");
assert.equal(company.level, "warning");
assert.match(company.detail, /KEP adresi/);
assert.ok(res.items.every((i) => i.label && i.detail), "her maddenin başlığı ve açıklaması var");

console.log("✓ satışa hazırlık testleri geçti");
