import assert from "node:assert/strict";

/* Sipariş kaydının veritabanı GEREKTİRMEYEN parçaları: erişim belirteci, deneme ödeme
   sağlayıcısı, tarih yazımı, iade son günü, görünüm çizelgesi. */

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
process.env.ORDER_LINK_SECRET = "test-gizli-anahtar";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
process.env.NEXT_PUBLIC_SALES_ENABLED = "true"; // site-config içe aktarılırken okunur

const Access = await import(ROOT + "/lib/orders/access.ts");
const Dates = await import(ROOT + "/lib/orders/dates.ts");
const Mock = await import(ROOT + "/lib/payments/mock.ts");
const Pay = await import(ROOT + "/lib/payments/index.ts");
const View = await import(ROOT + "/lib/orders/view.ts");
const Sched = await import(ROOT + "/lib/orders/schedule.ts");

/* ── Erişim belirteci ─────────────────────────────────────────────────────── */
const id = "2f1c1e0a-5b7d-4c55-9a70-3a1f0c9d8e11";
const other = "2f1c1e0a-5b7d-4c55-9a70-3a1f0c9d8e12";
const token = Access.signOrderToken(id);
assert.equal(token.length, 32);
assert.match(token, /^[A-Za-z0-9_-]{32}$/, "belirteç URL'de kaçış gerektirmemeli");
assert.equal(Access.signOrderToken(id), token, "aynı sipariş → aynı belirteç");
assert.ok(Access.verifyOrderToken(id, token));
assert.ok(!Access.verifyOrderToken(other, token), "başka siparişin belirteci geçmez");
assert.ok(!Access.verifyOrderToken(id, token.slice(0, 31) + (token.endsWith("A") ? "B" : "A")));
assert.ok(!Access.verifyOrderToken(id, ""));
assert.ok(!Access.verifyOrderToken(id, null));
assert.ok(!Access.verifyOrderToken(id, "ornek"), "geliştirme örnek belirteci gerçek siparişi açmaz");
assert.equal(Access.orderPagePath("SG-2026-ABCDEF", id, "tr"), `/siparis/SG-2026-ABCDEF?t=${token}`);
assert.equal(Access.orderPagePath("SG-2026-ABCDEF", id, "ru"), `/ru/siparis/SG-2026-ABCDEF?t=${token}`);
assert.equal(Access.paymentResultPath("SG-2026-ABCDEF", id, "en"), `/en/odeme/sonuc/SG-2026-ABCDEF?t=${token}`);
// anahtar değişirse eski belirteç geçmez
process.env.ORDER_LINK_SECRET = "baska-anahtar";
assert.ok(!Access.verifyOrderToken(id, token));
process.env.ORDER_LINK_SECRET = "test-gizli-anahtar";

/* ── Deneme ödeme sağlayıcısı ─────────────────────────────────────────────── */
const initInput = {
  orderId: id,
  orderNo: "SG-2026-ABCDEF",
  amountKurus: 200_000,
  locale: "en",
  buyerId: "G-2f1c1e0a-5b7d",
  identityNumber: null,
  billingName: null,
  buyer: { firstName: "A", lastName: "B", email: "a@example.com", phone: "+905000000000", ip: null },
  address: { line: "x", district: "y", province: "06", postalCode: null },
  description: "deneme",
  callbackUrl: "http://localhost/api/payment/donus",
};
delete process.env.VERCEL_ENV;
const init = await Mock.mockProvider.init(initInput);
assert.ok(init.ok);
assert.ok(init.redirectUrl.startsWith("/en/odeme/deneme/"), "dil öneki korunmalı");
assert.equal(encodeURIComponent(init.token), init.token, "belirteç yol parçasında kaçış gerektirmemeli");
assert.deepEqual(Mock.parseMockToken(init.token), { amountKurus: 200_000 });

// tutarı değiştirilmiş belirteç reddedilir
const [nonce, , sig] = init.token.split(".");
assert.equal(Mock.parseMockToken(`${nonce}.100.${sig}`), null);
assert.equal(Mock.parseMockToken("bozuk"), null);

// sonuç imzası: yalnız o belirteç + o sonuç için geçerli
const okSig = Mock.signMockOutcome(init.token, "success");
assert.ok(Mock.verifyMockOutcome(init.token, "success", okSig));
assert.ok(!Mock.verifyMockOutcome(init.token, "failure", okSig), "başarı imzası başarısızlık için geçmez");
assert.ok(!Mock.verifyMockOutcome(init.token, "paid", okSig));
const init2 = await Mock.mockProvider.init(initInput);
assert.notEqual(init2.token, init.token);
assert.ok(!Mock.verifyMockOutcome(init2.token, "success", okSig), "imza başka belirtece taşınamaz");

// sonuç kaydedilmeden "ödendi" denemez; kaydedilen sonuç bir kez okunur
assert.deepEqual(await Mock.mockProvider.retrieve(init.token), { ok: false, error: "no_outcome" });
Mock.recordMockOutcome(init.token, "success");
const paid = await Mock.mockProvider.retrieve(init.token);
assert.ok(paid.ok && paid.status === "success");
assert.equal(paid.paidKurus, 200_000, "tahsil edilen tutar belirteçteki tutardır");
assert.deepEqual(await Mock.mockProvider.retrieve(init.token), { ok: false, error: "no_outcome" });
Mock.recordMockOutcome(init2.token, "failure");
const failed = await Mock.mockProvider.retrieve(init2.token);
assert.ok(failed.ok && failed.status === "failure");

// sağlayıcı seçimi: canlı dağıtımda deneme sağlayıcısı ASLA seçilmez
process.env.PAYMENT_PROVIDER = "mock";
assert.equal(Pay.getPaymentProvider()?.name, "mock");
assert.equal(Pay.getPaymentProvider()?.isTest, true);
process.env.VERCEL_ENV = "production";
assert.equal(Pay.getPaymentProvider(), null);
assert.deepEqual(await Mock.mockProvider.init(initInput), { ok: false, error: "mock_disabled" });
assert.deepEqual(await Mock.mockProvider.retrieve(init.token), { ok: false, error: "mock_disabled" });
process.env.VERCEL_ENV = "preview";
assert.equal(Pay.getPaymentProvider()?.name, "mock");
delete process.env.VERCEL_ENV;
delete process.env.PAYMENT_PROVIDER;
assert.equal(Pay.getPaymentProvider(), null, "sağlayıcı yapılandırılmadıysa satış kapalıdır");
// iyzico: anahtar yoksa seçilmez; deneme (sandbox) adresinde siparişler deneme siparişidir
process.env.PAYMENT_PROVIDER = "iyzico";
const savedKeys = [process.env.IYZICO_API_KEY, process.env.IYZICO_SECRET_KEY, process.env.IYZICO_BASE_URL];
delete process.env.IYZICO_API_KEY;
delete process.env.IYZICO_SECRET_KEY;
assert.equal(Pay.getPaymentProvider(), null, "anahtar yoksa iyzico seçilmez");
process.env.IYZICO_API_KEY = "sandbox-test";
process.env.IYZICO_SECRET_KEY = "sandbox-test";
process.env.IYZICO_BASE_URL = "https://sandbox-api.iyzipay.com";
assert.equal(Pay.getPaymentProvider()?.name, "iyzico");
assert.equal(Pay.getPaymentProvider()?.isTest, true, "sandbox adresi → deneme siparişi");
process.env.IYZICO_BASE_URL = "https://api.iyzipay.com";
assert.equal(Pay.getPaymentProvider()?.isTest, false, "canlı adres → gerçek sipariş");
[process.env.IYZICO_API_KEY, process.env.IYZICO_SECRET_KEY, process.env.IYZICO_BASE_URL] = savedKeys;
for (const k of ["IYZICO_API_KEY", "IYZICO_SECRET_KEY", "IYZICO_BASE_URL"]) if (process.env[k] === undefined) delete process.env[k];
delete process.env.PAYMENT_PROVIDER;

// tutar dönüşümü: kuruş ↔ iyzico ondalık metni (kayan nokta yok)
const Iyz = await import(ROOT + "/lib/payments/iyzico.ts");
assert.equal(Iyz.kurusToPrice(50_000), "500.00");
assert.equal(Iyz.kurusToPrice(20_005), "200.05");
assert.equal(Iyz.kurusToPrice(100_000_000), "1000000.00");
for (const [given, kurus] of [["500.0", 50_000], [500, 50_000], ["500.00", 50_000], [200.05, 20_005], ["0.1", 10], ["1000000", 100_000_000], ["500.10000000", 50_010]]) {
  assert.equal(Iyz.priceToKurus(given), kurus, `priceToKurus(${given})`);
}
for (const bad of ["500.005", "-5", "5e3", "", null, undefined, "abc", "1,50"]) assert.equal(Iyz.priceToKurus(bad), null, `geçersiz tutar: ${bad}`);
for (const k of [1, 99, 100, 101, 1999, 123_456_789]) assert.equal(Iyz.priceToKurus(Iyz.kurusToPrice(k)), k, "gidiş-dönüş");

/* ── Sipariş kapısı ───────────────────────────────────────────────────────── */
const Gate = await import(ROOT + "/lib/orders/gate.ts");
const Legal = await import(ROOT + "/lib/legal/version.ts");
const realProvider = { ...Mock.mockProvider, name: "iyzico", isTest: false };
assert.equal(Gate.ordersClosed(null), true, "sağlayıcı yoksa kapalı");
if (Legal.isDraftLegalVersion()) {
  // Hukuki metinler taslakken: yalnız DENEME siparişi ve yalnız canlı site dışında.
  delete process.env.VERCEL_ENV;
  assert.equal(Gate.ordersClosed(Mock.mockProvider), false, "yerelde deneme sağlayıcısıyla açık");
  process.env.VERCEL_ENV = "preview";
  assert.equal(Gate.ordersClosed(Mock.mockProvider), false, "önizlemede deneme sağlayıcısıyla açık");
  assert.equal(Gate.ordersClosed(realProvider), true, "taslak metinle GERÇEK sipariş alınmaz");
  process.env.VERCEL_ENV = "production";
  assert.equal(Gate.ordersClosed(Mock.mockProvider), true, "canlı sitede taslak metinle sipariş yok");
  assert.equal(Gate.ordersClosed(realProvider), true);
  delete process.env.VERCEL_ENV;
} else {
  assert.equal(Gate.ordersClosed(realProvider), false, "metinler kesinleşince gerçek sağlayıcıyla açık");
}

/* ── Teklif sürümü ────────────────────────────────────────────────────────── */
// (settings.ts service role istemcisini içe aktardığı için burada yalnız biçim sözleşmesi sınanır.)
const quote = `${Legal.LEGAL_DOCUMENTS_VERSION}~1000.20.21`;
assert.ok(quote.length <= 40, "teklif sürümü şemadaki 40 karakter sınırına sığmalı");

/* ── Tarih yazımı ─────────────────────────────────────────────────────────── */
const nb = String.fromCharCode(0xa0);
assert.equal(Dates.formatLongDay("2027-03-31", "tr"), `31${nb}Mart${nb}2027`);
assert.equal(Dates.formatLongDay("2027-03-31", "en"), `31${nb}March${nb}2027`);
assert.equal(Dates.formatLongDay("2027-03-31", "ru"), `31${nb}марта${nb}2027${nb}г.`);
assert.equal(Dates.formatLongDay("2026-11-05", "de"), `5${nb}Kasım${nb}2026`, "bilinmeyen dil Türkçeye düşer");
assert.equal(Dates.formatLongDay("bozuk", "tr"), "bozuk");
assert.equal(Dates.formatTrClock("2026-10-20T11:05:00.000Z"), "14:05");
assert.equal(Dates.formatTrClock("2026-10-20T21:30:00.000Z"), "00:30", "gece yarısını İstanbul saatine göre aşar");

/* ── İadenin en geç yapılacağı gün (bildirim + 14 gün, İstanbul takvimi) ──── */
const W = await import(ROOT + "/lib/orders/withdrawal-dates.ts");
assert.equal(W.refundDueDay(new Date("2026-10-20T10:00:00Z")), "2026-11-03");
assert.equal(W.refundDueDay(new Date("2026-10-20T21:30:00Z")), "2026-11-04", "İstanbul'da gün dönmüşse bir sonraki günden sayılır");
assert.equal(W.refundDueDay(new Date("2027-02-20T09:00:00Z")), "2027-03-06");

/* ── Görünüm çizelgesi ────────────────────────────────────────────────────── */
const tl = View.timelineFor("scheduled", { paid: "2026-10-02", confirmed: "2026-10-17", scheduled: "2026-11-05" });
assert.deepEqual(tl.map((s) => s.state), ["done", "done", "current", "upcoming", "upcoming", "upcoming"]);
assert.equal(tl[0].on, "2026-10-02");
assert.equal(tl[3].on, null);
for (const st of ["withdrawal_requested", "cancelled_by_seller", "refunded"]) {
  assert.equal(View.timelineFor(st, { paid: "2026-10-02" })[0].state, "current", "iade durumlarında çizelge ödeme adımında kalır");
}
assert.ok(View.timelineFor("completed", {}).every((s) => s.state === "done"));
for (const f of View.ORDER_VIEW_FIXTURES) assert.equal(f.isTest, false);

// cayma son günü: ödeme gününe göre 14. günün İstanbul gün sonu
const sch = Sched.scheduleFor(new Date("2026-10-20T10:00:00Z"));
assert.equal(sch.withdrawalDeadline, "2026-11-03T20:59:59.999Z");
assert.equal(Sched.trToday(new Date(sch.withdrawalDeadline)), "2026-11-03");

console.log("✓ order-flow: erişim belirteci, deneme sağlayıcısı, tarih yazımı, iade günü, çizelge");
