// Hukuki sürüm geçişi gerçek yayına bağlıdır: taslakken iç notlar "Taslak notu" önekiyle görünür; sürüm kesinleşirse
// hiçbir müşteri metninde taslak notu ya da ham yer tutucu kalmaz, yürürlük tarihi ve künye eksiksizdir (Astra 2026-10.5).
import assert from "node:assert/strict";
import { test } from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const V = await import(ROOT + "/lib/legal/version.ts");
const B = await import(ROOT + "/lib/legal/release-blockers.ts");
const C = await import(ROOT + "/lib/company.ts");
const D = await import(ROOT + "/lib/legal/documents.ts");
const Sample = await import(ROOT + "/lib/legal/sample.ts");
const P = await import(ROOT + "/lib/legal/templates/site-policies.ts");
const K = await import(ROOT + "/lib/legal/templates/kvkk-notice.ts");
const Sh = await import(ROOT + "/lib/legal/templates/shared.ts");

const allText = () => {
  const docs = D.buildOrderDocuments(Sample.sampleLegalContext(new Date("2026-10-20T09:00:00Z"))).map((d) => d.html).join("\n");
  const blocks = [...P.privacyPolicyBlocks(), ...P.siteTermsBlocks(), ...P.cookiePolicyBlocks(), ...K.kvkkNoticeBlocks()];
  return docs + "\n" + JSON.stringify(blocks);
};

test("ham iç not yer tutucusu müşteri metnine basılmaz ('[YAYIN ÖNCESİ…]' yok)", () => {
  assert.doesNotMatch(allText(), /\[YAYIN ÖNCESİ/);
});

test("taslak sürüm: iç notlar yalnız önekli taslak notu olarak; açık işler listesi dolu", () => {
  if (!V.isDraftLegalVersion()) return;
  assert.match(allText(), new RegExp(Sh.DRAFT_NOTE_PREFIX.replace(/[()]/g, "\\$&")));
  assert.ok(B.LEGAL_RELEASE_BLOCKERS.length > 0, "taslak sürümde açık işler kaydı tutulur");
  assert.equal(V.LEGAL_EFFECTIVE_DATE, "", "otomatik yürürlük tarihi yok");
});

test("kesin sürüm: açık iş, taslak notu, eksik künye ve boş yürürlük tarihi olamaz", () => {
  if (V.isDraftLegalVersion()) return;
  assert.deepEqual(B.LEGAL_RELEASE_BLOCKERS.map((b) => b.key), []);
  assert.ok(!allText().includes(Sh.DRAFT_NOTE_PREFIX));
  assert.notEqual(V.LEGAL_EFFECTIVE_DATE, "");
  assert.deepEqual(C.missingCompanyFields(), []);
});

test("künye: KEP ve tescil tarihi kaynakta; UETS KEP yerine kullanılmaz; 510174 oda sicili diye kopyalanmaz", () => {
  assert.equal(C.COMPANY.kep, "skytechhavacilik@hs01.kep.tr");
  assert.equal(C.COMPANY.registeredOn, "7 Mayıs 2024");
  assert.notEqual(C.COMPANY.kep, C.COMPANY.uets);
  assert.notEqual(C.COMPANY.chamberRegistryNo, C.COMPANY.tradeRegistryNo);
  assert.match(C.COMPANY.address.line, /^Macun Mah\./, "güncel adres Macun");
  assert.ok(!JSON.stringify(C.COMPANY).includes("Saray"), "eski adres yok");
});
