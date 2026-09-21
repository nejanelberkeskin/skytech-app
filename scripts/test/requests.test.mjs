import assert from "node:assert/strict";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const S = await import(ROOT + "/lib/requests/schema.ts");
const F = await import(ROOT + "/lib/sites/format.ts");
const L = await import(ROOT + "/lib/requests/labels.ts");

const NBSP = String.fromCharCode(0xa0);
const ctl = (...codes) => String.fromCharCode(...codes);

// ── formatHectares
assert.equal(F.formatHectares(42.5, "tr"), "42,5");
assert.equal(F.formatHectares(42.5, "en"), "42.5");
assert.equal(F.formatHectares(42.5, "ru"), "42,5");
assert.equal(F.formatHectares(1200, "tr"), "1.200");
assert.equal(F.formatHectares(12.34, "tr"), "12,34");
assert.equal(F.formatHectares(12.3, "tr"), "12,3");
assert.equal(F.formatHectares(12.05, "en"), "12.05");
assert.equal(F.formatHectares(0.999, "en"), "1");
assert.equal(F.formatHectares(7, "ru"), "7");
assert.equal(F.formatSiteLocation({ district: "Orhaneli", province: "Bursa" }), "Orhaneli, Bursa");
assert.equal(F.formatSiteLocation({ district: null, province: "Bursa" }), "Bursa");
assert.equal(F.formatSiteLocation({ district: " ", province: null }), null);

// ── şema
const contact = { contactName: "Ayse Yilmaz", email: "ayse@example.com", consent: true, locale: "tr" };
const land = "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b";
const parse = (details) => S.requestPayloadSchema.safeParse({ contact, details });
const errs = (r) => (r.success ? {} : S.issuesToFieldErrors(r.error.issues));

let r = parse({ type: "open_land_seeding", landId: land, quantity: 20 });
assert.ok(r.success, "20 adet kabul edilmeli");
assert.equal(r.data.details.certificateName, undefined);

r = parse({ type: "open_land_seeding", landId: land, quantity: 19 });
assert.deepEqual(errs(r), { "details.quantity": "quantityMin" });
r = parse({ type: "open_land_seeding", landId: land, quantity: 100001 });
assert.deepEqual(errs(r), { "details.quantity": "quantityMax" });
r = parse({ type: "open_land_seeding", landId: land, quantity: 20.5 });
assert.deepEqual(errs(r), { "details.quantity": "quantityInvalid" });
r = parse({ type: "open_land_seeding", landId: land, quantity: NaN });
assert.deepEqual(errs(r), { "details.quantity": "quantityInvalid" });
r = parse({ type: "open_land_seeding", landId: "x", quantity: 50 });
assert.deepEqual(errs(r), { "details.landId": "landInvalid" });

// sertifika adı
const cert = (name) => parse({ type: "open_land_seeding", landId: land, quantity: 50, certificateName: name });
r = cert("  Ayşe   Yılmaz  ");
assert.ok(r.success);
assert.equal(r.data.details.certificateName, "Ayşe Yılmaz");
r = cert("");
assert.ok(r.success);
assert.equal(r.data.details.certificateName, undefined);
r = cert("   ");
assert.ok(r.success);
assert.equal(r.data.details.certificateName, undefined);
assert.deepEqual(errs(cert("A")), { "details.certificateName": "certificateNameShort" });
assert.deepEqual(errs(cert("x".repeat(61))), { "details.certificateName": "certificateNameLong" });
assert.ok(cert("x".repeat(60)).success);
assert.deepEqual(errs(cert("x".repeat(201))), { "details.certificateName": "tooLong" });

const apostrophe = String.fromCharCode(0x2019);
for (const ok of [
  "ABC Lojistik A.Ş.",
  "Иван Петров",
  "O'Brien & Sons (2026)",
  "Ali-Veli Kardeşler",
  "D" + apostrophe + "Artagnan",
  "Müller/Şahin +1",
]) {
  assert.ok(cert(ok).success, "kabul edilmeli: " + ok);
}
const tree = String.fromCodePoint(0x1f332);
for (const bad of ["https://evil.example", "Ayse " + tree, "<b>Ali</b>", "Ali; DROP TABLE", "a@b.com", "Ali_Veli"]) {
  assert.deepEqual(errs(cert(bad)), { "details.certificateName": "certificateNameInvalid" }, "reddedilmeli: " + bad);
}

// kaldırılan tür artık kabul edilmez
r = parse({ type: "seed_purchase", seedItems: [{ slug: "kizilcam", quantity: 5 }], deliveryProvince: "34" });
assert.ok(!r.success, "seed_purchase reddedilmeli");

// kendi arazim başvurusu hâlâ geçerli
r = parse({
  type: "land_application",
  province: "16",
  areaValue: 12,
  areaUnit: "dekar",
  conditions: ["burnt"],
  ownership: "own",
  timing: "this_season",
});
assert.ok(r.success, JSON.stringify(errs(r)));

// kontrol karakterleri temizleniyor (kaçış dizisine çevrilen regex)
assert.equal(S.cleanText("A" + ctl(0) + "li" + ctl(7) + " " + ctl(0x7f) + "Veli"), "Ali Veli");
assert.equal(S.cleanMultiline("a" + ctl(1) + "\r\nb\n\n\n\nc"), "a\nb\n\nc");

// ── etiketler / özet satırları
const rows = L.requestSummaryRows(
  {
    type: "open_land_seeding",
    total_seeds: 500,
    seed_items: [],
    details: {
      quantity: 500,
      certificateName: "Ayşe Yılmaz",
      landName: "Bursa Proje Uygulama Sahası (Bursa)",
      speciesSlugs: ["kizilcam", "bilinmeyen"],
      unitPriceKurus: 1000,
      estimatedTotalKurus: 500000,
    },
  },
  "tr",
  null
);
assert.deepEqual(
  rows.map((x) => [x.label, x.value]),
  [
    ["Proje Uygulama Sahası", "Bursa Proje Uygulama Sahası (Bursa)"],
    ["Bırakılacak tür", "Kızılçam"],
    ["Tohum topu adedi", "500"],
    ["Birim bedel (KDV dâhil)", "10" + NBSP + "TL"],
    ["Tahmini tutar (KDV dâhil)", "5.000" + NBSP + "TL"],
    ["Sertifikadaki ad", "Ayşe Yılmaz"],
  ]
);
const legacy = L.requestSummaryRows(
  { type: "open_land_seeding", total_seeds: 100, seed_items: [], details: { quantity: 100, dedication: "Eski Alan" } },
  "en",
  "Site X"
);
assert.deepEqual(
  legacy.map((x) => [x.label, x.value]),
  [
    ["Project Site", "Site X"],
    ["Seed balls", "100"],
    ["Name on certificate", "Eski Alan"],
  ]
);
console.log("✓ şema, biçim ve etiket testleri geçti");
