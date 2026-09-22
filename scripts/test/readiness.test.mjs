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
for (const key of ["email", "cron", "orderLinks", "appUrl"]) assert.equal(levelOf(res, key), "ok", key);
assert.ok(text.includes("https://skytechgreen.com"), "herkese açık site adresi gösterilebilir");

/* ── Eksikler uyarı olarak görünür ───────────────────────────────────────── */
res = R.salesReadiness({ ordersPaused: false }, {});
for (const key of ["email", "cron", "orderLinks", "appUrl"]) assert.equal(levelOf(res, key), "warning", key);
const company = res.items.find((i) => i.key === "company");
assert.equal(company.level, "warning");
assert.match(company.detail, /KEP adresi/);
assert.ok(res.items.every((i) => i.label && i.detail), "her maddenin başlığı ve açıklaması var");

console.log("✓ satışa hazırlık testleri geçti");
