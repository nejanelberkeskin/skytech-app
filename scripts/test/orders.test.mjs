import assert from "node:assert/strict";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const T = await import(ROOT + "/lib/orders/types.ts");
const St = await import(ROOT + "/lib/orders/state.ts");
const Sc = await import(ROOT + "/lib/orders/schedule.ts");
const Id = await import(ROOT + "/lib/orders/identifiers.ts");
const Tax = await import(ROOT + "/lib/orders/tax-ids.ts");
const S = await import(ROOT + "/lib/orders/schema.ts");
const C = await import(ROOT + "/lib/certificates/types.ts");

/* ── Durum makinesi ───────────────────────────────────────────────────────── */
for (const s of T.ORDER_STATUSES) assert.ok(Array.isArray(St.nextStatuses(s)), "geçiş tablosu eksik: " + s);
for (const s of T.TERMINAL_STATUSES) assert.equal(St.nextStatuses(s).length, 0, "terminal durumdan çıkış olmamalı: " + s);
// her hedef geçerli bir durum olmalı
for (const s of T.ORDER_STATUSES) for (const to of St.nextStatuses(s)) assert.ok(T.ORDER_STATUSES.includes(to));
// her durum (draft hariç) bir yerden erişilebilir olmalı
for (const s of T.ORDER_STATUSES) {
  if (s === "draft") continue;
  assert.ok(T.ORDER_STATUSES.some((from) => St.canTransition(from, s)), "erişilemeyen durum: " + s);
}
assert.ok(St.canTransition("awaiting_payment", "paid"));
assert.ok(St.canTransition("paid", "withdrawal_requested"));
assert.ok(St.canTransition("withdrawal_requested", "refunded"));
assert.ok(!St.canTransition("refunded", "paid"), "iade edilmiş sipariş yeniden ödenmiş olamaz");
assert.ok(!St.canTransition("confirmed", "withdrawal_requested"), "cayma süresi dolduktan sonra müşteri cayması yok");
assert.ok(!St.canTransition("draft", "paid"), "ödeme başlatılmadan ödenmiş olamaz");
assert.ok(!St.canTransition("released", "refunded"), "bırakma sonrası iade akışı yok");
assert.ok(!St.canTransition("expired", "awaiting_payment"));
assert.throws(() => St.assertTransition("refunded", "paid"), St.InvalidTransitionError);
St.assertTransition("paid", "confirmed");

// cayma hakkı
const dl = "2026-11-04T20:59:59.999Z";
assert.ok(St.canWithdraw("paid", dl, new Date("2026-11-04T20:59:59.000Z")));
assert.ok(!St.canWithdraw("paid", dl, new Date("2026-11-04T21:00:00.000Z")));
assert.ok(!St.canWithdraw("confirmed", dl, new Date("2026-10-25T00:00:00Z")));
assert.ok(!St.canWithdraw("paid", null));

/* ── Takvim ───────────────────────────────────────────────────────────────── */
const at = (iso) => new Date(iso);
// sezon sınırları (İstanbul saatiyle)
assert.deepEqual(Sc.seasonFor(at("2026-09-21T09:00:00Z")), { label: "2026-2027", startsOn: "2026-10-01", endsOn: "2027-03-31" });
assert.equal(Sc.seasonFor(at("2026-12-15T09:00:00Z")).label, "2026-2027");
assert.equal(Sc.seasonFor(at("2027-02-10T09:00:00Z")).label, "2026-2027");
assert.equal(Sc.seasonFor(at("2027-04-01T09:00:00Z")).label, "2027-2028");
// 30 Eylül 21:30 UTC = 1 Ekim 00:30 İstanbul → yeni sezon başladı
assert.equal(Sc.trToday(at("2026-09-30T21:30:00Z")), "2026-10-01");
// 31 Mart 20:59 UTC = 31 Mart 23:59 İstanbul → hâlâ eski sezon; 21:00 UTC → 1 Nisan
assert.equal(Sc.seasonFor(at("2027-03-31T20:59:00Z")).label, "2026-2027");
assert.equal(Sc.seasonFor(at("2027-03-31T21:00:00Z")).label, "2027-2028");

// Eylül'de sipariş: sezon 1 Ekim'de başlar; en erken bırakma hazırlık payından sonra
let sch = Sc.scheduleFor(at("2026-09-21T09:00:00Z"));
assert.equal(sch.season.label, "2026-2027");
assert.equal(sch.performanceDeadline, "2027-03-31");
assert.equal(sch.earliestReleaseOn, "2026-10-12"); // 21 Eylül + 21 gün
assert.equal(sch.rolledToNextSeason, false);
// cayma: 21 Eylül + 14 gün = 5 Ekim, İstanbul gün sonu = 5 Ekim 20:59:59.999 UTC
assert.equal(sch.withdrawalDeadline, "2026-10-05T20:59:59.999Z");

// Haziran'da sipariş: en erken bırakma sezon başı
sch = Sc.scheduleFor(at("2026-06-10T09:00:00Z"));
assert.equal(sch.earliestReleaseOn, "2026-10-01");
assert.equal(sch.performanceDeadline, "2027-03-31");

// Sezon sonuna yetişmeyen sipariş sonraki sezona yazılır
sch = Sc.scheduleFor(at("2027-03-10T09:00:00Z")); // +21 = 31 Mart → yetişir (sınırda)
assert.equal(sch.rolledToNextSeason, false);
assert.equal(sch.earliestReleaseOn, "2027-03-31");
sch = Sc.scheduleFor(at("2027-03-11T09:00:00Z")); // +21 = 1 Nisan → yetişmez
assert.equal(sch.rolledToNextSeason, true);
assert.equal(sch.season.label, "2027-2028");
assert.equal(sch.earliestReleaseOn, "2027-10-01");
assert.equal(sch.performanceDeadline, "2028-03-31");

// hazırlık payı cayma süresinden kısa verilemez (en az 15 gün)
sch = Sc.scheduleFor(at("2026-11-01T09:00:00Z"), 5);
assert.equal(sch.earliestReleaseOn, "2026-11-16");
// en erken bırakma her zaman cayma son gününden SONRA
for (const d of ["2026-10-01T00:00:00Z", "2026-12-31T22:30:00Z", "2027-01-15T12:00:00Z", "2027-02-28T21:30:00Z"]) {
  const x = Sc.scheduleFor(at(d));
  assert.ok(new Date(x.earliestReleaseOn + "T00:00:00+03:00").getTime() > new Date(x.withdrawalDeadline).getTime(), d);
  assert.ok(x.earliestReleaseOn <= x.performanceDeadline, d);
}

/* ── Numaralar ────────────────────────────────────────────────────────────── */
const seen = new Set();
for (let i = 0; i < 2000; i++) {
  const no = Id.generateOrderNo(at("2026-12-31T22:00:00Z")); // İstanbul'da 1 Ocak 2027
  assert.match(no, Id.ORDER_NO_RE);
  assert.ok(no.startsWith("SG-2027-"), no);
  assert.ok(!/[01ILO]/.test(no.slice(8)), "karıştırılan karakter: " + no);
  seen.add(no);
  assert.match(Id.generateCertificateCode(), C.CERTIFICATE_CODE_RE);
}
assert.ok(seen.size > 1990, "rastgelelik zayıf");

/* ── TCKN / VKN ───────────────────────────────────────────────────────────── */
assert.ok(Tax.isValidTckn("10000000146"));
assert.ok(!Tax.isValidTckn("10000000147"));
assert.ok(!Tax.isValidTckn("00000000000"));
assert.ok(!Tax.isValidTckn("11111111111"), "e-Arşiv yer tutucusu gerçek TCKN değildir");
assert.ok(!Tax.isValidTckn("1000000014"));
// sağlama algoritmasıyla üretilmiş VKN'ler
const makeVkn = (nine) => {
  const d = [...nine].map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (d[i] + (9 - i)) % 10;
    let v = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && v === 0) v = 9;
    sum += v;
  }
  return nine + String((10 - (sum % 10)) % 10);
};
for (const nine of ["123456789", "001234567", "987654321", "460052021"]) {
  const vkn = makeVkn(nine);
  assert.ok(Tax.isValidVkn(vkn), vkn);
  const wrong = vkn.slice(0, 9) + String((Number(vkn[9]) + 1) % 10);
  assert.ok(!Tax.isValidVkn(wrong), wrong);
}
assert.ok(Tax.isValidTaxId("10000000146") && Tax.isValidTaxId(makeVkn("123456789")) && !Tax.isValidTaxId("12345"));
assert.equal(Tax.maskId("10000000146"), "•••••••0146");
assert.equal(Tax.maskId(null), "");

/* ── Sipariş şeması ───────────────────────────────────────────────────────── */
const address = { province: "17", district: "Eceabat", line: "Kilitbahir Mah. Deniz Sk. No: 4", postalCode: "" };
const base = {
  landId: "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b",
  quantity: 200,
  certificateName: "",
  buyer: { firstName: " Ayşe ", lastName: "Yılmaz", email: " AYSE@Example.com ", phone: "0532 123 45 67" },
  invoice: { type: "individual", address, tckn: "" },
  consents: { preInfo: true, contract: true, kvkkRead: true, marketing: false },
  locale: "tr",
  documentsVersion: "2026-10.1",
  clientToken: "6c1f0e0a-2b3c-4d5e-8f90-a1b2c3d4e5f6",
};
const parse = (patch = {}) => S.orderPayloadSchema.safeParse({ ...base, ...patch });
// Uygulamadaki kuralla aynı: bir alan için İLK hata geçerlidir (issuesToFieldErrors).
const errs = (r) => {
  const out = {};
  if (!r.success) for (const i of r.error.issues) out[i.path.join(".")] ??= i.message;
  return out;
};

let r = parse();
assert.ok(r.success, JSON.stringify(errs(r)));
assert.equal(r.data.buyer.firstName, "Ayşe");
assert.equal(r.data.buyer.email, "ayse@example.com");
assert.equal(r.data.buyer.phone, "+905321234567");
assert.equal(r.data.invoice.tckn, null);
assert.equal(r.data.invoice.address.postalCode, null);
assert.equal(r.data.certificateName, undefined);
assert.equal(S.resolveCertificateName(r.data), "Ayşe Yılmaz");
assert.ok(!("total" in r.data) && !("totalKurus" in r.data), "şemada tutar alanı olmamalı");

// istemciden gelen tutar yok sayılır (şema bilinmeyen alanı atar)
r = parse({ totalKurus: 1, unitPriceKurus: 1 });
assert.ok(r.success && !("totalKurus" in r.data));

assert.deepEqual(errs(parse({ quantity: 19 })), { quantity: "quantityMin" });
assert.deepEqual(errs(parse({ consents: { preInfo: true, contract: false, kvkkRead: true } })), { "consents.contract": "contractRequired" });
assert.deepEqual(errs(parse({ consents: { preInfo: false, contract: true, kvkkRead: true } })), { "consents.preInfo": "preInfoRequired" });
assert.deepEqual(errs(parse({ consents: { preInfo: true, contract: true } })), { "consents.kvkkRead": "kvkkRequired" });
assert.deepEqual(errs(parse({ buyer: { ...base.buyer, email: "" } })), { "buyer.email": "emailRequired" });
assert.deepEqual(errs(parse({ buyer: { ...base.buyer, email: "gecersiz" } })), { "buyer.email": "emailInvalid" });
assert.deepEqual(errs(parse({ buyer: { ...base.buyer, firstName: " " } }))["buyer.firstName"], "firstNameRequired");
assert.equal(errs(parse({ invoice: { type: "individual", address: { ...address, line: "" } } }))["invoice.address.line"], "addressRequired");
assert.deepEqual(errs(parse({ buyer: { ...base.buyer, phone: "" } })), { "buyer.phone": "phoneRequired" });
assert.deepEqual(errs(parse({ buyer: { ...base.buyer, phone: "12345" } })), { "buyer.phone": "phoneInvalid" });
assert.deepEqual(errs(parse({ invoice: { type: "individual", address, tckn: "10000000147" } })), { "invoice.tckn": "tcknInvalid" });
assert.ok(parse({ invoice: { type: "individual", address, tckn: "100 000 001 46" } }).success);
assert.deepEqual(errs(parse({ invoice: { type: "individual", address: { ...address, line: "kısa" } } })), { "invoice.address.line": "addressShort" });
assert.deepEqual(errs(parse({ invoice: { type: "individual", address: { ...address, province: "99" } } })), { "invoice.address.province": "provinceInvalid" });
assert.deepEqual(errs(parse({ invoice: { type: "bagis" } })), { "invoice.type": "invoiceTypeRequired" });

// kurumsal
const corp = {
  type: "corporate",
  companyTitle: "Örnek Lojistik A.Ş.",
  taxId: makeVkn("123456789"),
  taxOffice: "Çanakkale",
  address,
  authorizedPerson: "Ayşe Yılmaz",
  mersis: "",
  kep: "",
  poNumber: "PO-2026-118",
  eInvoiceUser: true,
};
assert.deepEqual(errs(parse({ invoice: corp })), { "consents.corporateAuthority": "corporateAuthorityRequired" });
r = parse({ invoice: corp, consents: { ...base.consents, corporateAuthority: true } });
assert.ok(r.success, JSON.stringify(errs(r)));
assert.equal(r.data.invoice.mersis, null);
assert.equal(r.data.invoice.poNumber, "PO-2026-118");
assert.deepEqual(errs(parse({ invoice: { ...corp, taxId: "1234567891" }, consents: { ...base.consents, corporateAuthority: true } })), { "invoice.taxId": "taxIdInvalid" });
assert.deepEqual(errs(parse({ invoice: { ...corp, kep: "kep-degil" }, consents: { ...base.consents, corporateAuthority: true } })), { "invoice.kep": "kepInvalid" });
assert.deepEqual(errs(parse({ invoice: { ...corp, mersis: "123" }, consents: { ...base.consents, corporateAuthority: true } })), { "invoice.mersis": "mersisInvalid" });

// sertifika adı yedeği karakter kümesine indirgenir
assert.equal(S.resolveCertificateName({ certificateName: undefined, buyer: { firstName: "Ali_Can", lastName: "Öz<b>" } }), "AliCan Özb");
assert.equal(S.resolveCertificateName({ certificateName: "Kızım Elif", buyer: { firstName: "Ali", lastName: "Öz" } }), "Kızım Elif");

/* ── Cayma bildirimi şeması ve sipariş görünümü ───────────────────────────── */
{
  const w = (b) => S.withdrawalRequestSchema.safeParse(b);
  let x = w({ orderNo: " sg-2026-rnek23 ", email: " AYSE@Example.com ", note: "" });
  assert.ok(x.success);
  assert.equal(x.data.orderNo, "SG-2026-RNEK23");
  assert.equal(x.data.email, "ayse@example.com");
  assert.equal(x.data.note, null);
  assert.deepEqual(errs(w({ orderNo: "", email: "" })), { orderNo: "orderNoRequired", email: "emailRequired" });
  assert.deepEqual(errs(w({ orderNo: "SG-2026-0O1ILX", email: "a@b.co" })), { orderNo: "orderNoInvalid" });

  const View = await import(ROOT + "/lib/orders/view.ts");
  const steps = (status) => View.timelineFor(status, {}).map((t) => t.state[0]).join("");
  assert.equal(steps("paid"), "cuuuuu");
  assert.equal(steps("scheduled"), "ddcuuu");
  assert.equal(steps("completed"), "dddddd");
  assert.equal(steps("refunded"), "cuuuuu", "iade/iptal durumlarında çizelge ilk adımda kalır");
  for (const o of View.ORDER_VIEW_FIXTURES) {
    assert.match(o.orderNo, T.ORDER_NO_RE);
    assert.equal(o.canWithdraw, o.status === "paid", o.orderNo + ": cayma yalnız 'paid' durumunda");
    assert.ok(!JSON.stringify(o).match(/tckn|taxId|ip_hash|payment_token|admin_note/i), "görünümde hassas alan olmamalı");
    if (o.certificate) assert.ok(o.releasedOn, "sertifika yalnız bırakmadan sonra");
  }
}

console.log("✓ sipariş çekirdeği testleri geçti");
