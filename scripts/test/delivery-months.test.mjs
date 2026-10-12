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

test("yönetim şeması: ay Nisan–Eylül ya da boş; sertifika izlemeden sonra olamaz; satıra yazılır", () => {
  const base = { name: "Saha", work_type: "ormanlastirma_genclestirme", status: "open", capacity_seeds: 100 };
  const ok = A.siteAdminSchema.parse({ ...base, certificate_month: 4, monitoring_month: 9 });
  assert.deepEqual([A.toLandRow(ok).certificate_month, A.toLandRow(ok).monitoring_month], [4, 9]);
  assert.equal(A.toLandRow(A.siteAdminSchema.parse(base)).certificate_month, null);
  for (const bad of [0, 3, 10, 13, 5.5]) assert.equal(A.siteAdminSchema.safeParse({ ...base, monitoring_month: bad }).success, false);
  assert.equal(A.siteAdminSchema.safeParse({ ...base, certificate_month: 8, monitoring_month: 6 }).success, false);
  assert.equal(A.siteAdminSchema.safeParse({ ...base, permit_decision: "verified" }).success, false, "bilgisiz doğrulama yok");
});

const { loadSource: load } = await import("./load-source.mjs");
const server = { "@/lib/supabase/server": { createServiceRoleClient: () => { throw new Error("veritabanı yok"); } } };
const real = {
  "@/lib/legal/version": await import(ROOT + "/lib/legal/version.ts"),
  "@/lib/pricing": await import(ROOT + "/lib/pricing.ts"),
  "./schedule": Sc,
  "./settings-schema": await import(ROOT + "/lib/orders/settings-schema.ts"),
  "@/lib/legal/documents": D,
};
const St = load("lib/orders/settings.ts", { ...server, ...real });
const Pv = load("lib/orders/preview.ts", { ...server, ...real, "@/lib/sites/data": { getProjectSites: async () => [] }, "./settings": St });

test("satış koşulu: teslim ayı ve doğrulanmış, bırakma son tarihini kapsayan izin olmadan sipariş yok", () => {
  const schedule = Sc.scheduleFor(now); // 2026-2027 sezonu, son tarih 2027-03-31
  const ok = { ...site, certificateMonth: 5, monitoringMonth: 8, permit: { reference: "OBM 2026/14", validUntil: "2027-03-31", verifiedAt: "2026-10-01T09:00:00Z" } };
  assert.equal(Pv.siteTermsProblem(ok, schedule), null);
  assert.equal(Pv.siteTermsProblem({ ...ok, certificateMonth: null }, schedule), "delivery_unset");
  assert.equal(Pv.siteTermsProblem({ ...ok, certificateMonth: 9, monitoringMonth: 6 }, schedule), "delivery_unset");
  assert.equal(Pv.siteTermsProblem({ ...ok, permit: null }, schedule), "permit", "doğrulanmamış izin");
  assert.equal(Pv.siteTermsProblem({ ...ok, permit: { ...ok.permit, validUntil: "2027-03-30" } }, schedule), "permit", "izin sezon sonundan önce bitiyor");
  assert.equal(Pv.siteTermsProblem({ certificateMonth: 5, monitoringMonth: 8, permit: ok.permit }, schedule), null);
});

test("teklif sürümü: fiyat ayarları + sezon + teslim ayları; biri değişirse eski önizleme geçmez", () => {
  const settings = { unitPriceKurus: 1000, vatRate: 20, prepDays: 21 };
  const schedule = Sc.scheduleFor(now);
  const s1 = { ...site, certificateMonth: 5, monitoringMonth: 8 };
  const v = Pv.offerVersion(settings, s1, schedule);
  assert.ok(v.startsWith(`${St.quoteVersion(settings)}~`), "sipariş ucu ön ek denetimi");
  assert.ok(v.endsWith("~2026-2027.5.8"));
  assert.notEqual(Pv.offerVersion(settings, { ...s1, monitoringMonth: 9 }, schedule), v);
  assert.notEqual(Pv.offerVersion(settings, s1, Sc.scheduleFor(new Date("2027-03-20T09:00:00Z"))), v, "sezon değişince");
  assert.ok(v.length <= 80);
});
