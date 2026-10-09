// Sertifika ve izleme teslim ayı: saha başına ay → sözleşmede kesin son tarih (o ayın son günü).
import assert from "node:assert/strict";
import { test } from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const Sc = await import(ROOT + "/lib/orders/schedule.ts");
const D = await import(ROOT + "/lib/legal/documents.ts");
const S = await import(ROOT + "/lib/orders/schema.ts");
const Sample = await import(ROOT + "/lib/legal/sample.ts");
const A = await import(ROOT + "/lib/sites/admin.ts");

test("ay → bırakma son tarihinden sonraki ilk o ayın son günü", () => {
  const d = (m) => Sc.monthDeadlineAfter("2027-03-31", m)?.lastDay ?? null;
  assert.equal(d(4), "2027-04-30");
  assert.equal(d(6), "2027-06-30");
  assert.equal(d(3), "2027-03-31", "aynı ay: son gün bırakma son tarihine eşit olabilir");
  assert.equal(d(2), "2028-02-29", "önceki ay ertesi yıla kayar (artık yıl)");
  assert.equal(d(12), "2027-12-31");
  for (const bad of [null, undefined, 0, 13, 4.5, "4"]) assert.equal(Sc.monthDeadlineAfter("2027-03-31", bad), null);
});

const site = {
  id: "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b", slug: "ornek", name: "Örnek Saha", province: "Çanakkale", district: null,
  areaHectares: null, isFireAffected: false, fireYear: null, workType: "ormanlastirma_genclestirme", species: [],
};
const input = S.orderPreviewSchema.parse({
  landId: site.id, quantity: 100, certificateName: "",
  buyer: { firstName: "Ayşe", lastName: "Örnek", email: "ayse@example.com", phone: "0532 000 00 00" },
  invoice: { type: "individual", address: { province: "17", district: "Eceabat", line: "Örnek Mah. No 1" }, tckn: "10000000146" },
  locale: "tr",
});
const now = new Date("2026-10-20T09:00:00Z");
const build = (s) => D.buildOrderDocuments(D.buildLegalContext({
  input, site: s, totals: { unitPriceKurus: 1000, totalKurus: 100000, vatRate: 20, vatKurus: 16667 },
  schedule: Sc.scheduleFor(now), orderDate: Sc.trToday(now),
}));

test("sözleşme ve ön bilgilendirme: teslim ayı ve kesin son gün yazılır, yer tutucu kalmaz", () => {
  const docs = build({ ...site, certificateMonth: 4, monitoringMonth: 9 });
  for (const kind of ["pre_info", "contract"]) {
    const html = docs.find((x) => x.kind === kind).html;
    assert.match(html, /Katılım Sertifikası teslim ayı \(kesin son tarih\)/);
    assert.match(html, /Nisan 2027 — en geç 30 Nisan 2027/);
    assert.match(html, /Eylül 2027 — en geç 30 Eylül 2027/);
    assert.doesNotMatch(html, /YAYIN ÖNCESİ TAMAMLANACAK: siparişe özgü/);
  }
});

test("örnek metin: ay yerine yer tutucu", () => {
  const docs = D.buildOrderDocuments(Sample.sampleLegalContext(now));
  assert.match(docs.find((x) => x.kind === "contract").html, /\[Sahaya göre belirlenen ay ve yıl/);
});

test("yönetim şeması: ay 1–12 ya da boş; satıra yazılır", () => {
  const base = { name: "Saha", work_type: "ormanlastirma_genclestirme", status: "open", capacity_seeds: 100 };
  const ok = A.siteAdminSchema.parse({ ...base, certificate_month: 4, monitoring_month: 9 });
  assert.deepEqual([A.toLandRow(ok).certificate_month, A.toLandRow(ok).monitoring_month], [4, 9]);
  assert.equal(A.toLandRow(A.siteAdminSchema.parse(base)).certificate_month, null);
  for (const bad of [0, 13, 2.5]) assert.equal(A.siteAdminSchema.safeParse({ ...base, monitoring_month: bad }).success, false);
});
