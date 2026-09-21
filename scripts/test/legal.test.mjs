import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
process.chdir(ROOT); // render-pdf fontları process.cwd()'ye göre okur
const D = await import(ROOT + "/lib/legal/documents.ts");
const P = await import(ROOT + "/lib/legal/render-pdf.ts");
const V = await import(ROOT + "/lib/legal/version.ts");
const Sc = await import(ROOT + "/lib/orders/schedule.ts");
const S = await import(ROOT + "/lib/orders/schema.ts");

// LEGAL_DRAFTS_DIR verilirse örnek HTML + PDF çıktıları o klasöre yazılır (hukuk incelemesi için).
const OUT = process.env.LEGAL_DRAFTS_DIR ?? "";
const WRITE = OUT !== "";

const site = {
  id: "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b",
  slug: "ornek-proje-uygulama-sahasi",
  name: "ÖRNEK · Çanakkale Proje Uygulama Sahası",
  province: "Çanakkale",
  district: "Eceabat",
  areaHectares: 42.5,
  isFireAffected: true,
  fireYear: 2023,
  workType: "ormanlastirma_genclestirme",
  species: [{ slug: "kizilcam", name: "Kızılçam", latinName: "Pinus brutia" }],
};
const address = { province: "17", district: "Eceabat", line: "Örnek Mah. Deniz Sk. No: 4 D: 2", postalCode: "17900" };
const preview = (patch) =>
  S.orderPreviewSchema.parse({
    landId: site.id,
    quantity: 200,
    certificateName: "",
    buyer: { firstName: "Ayşe", lastName: "Örnek", email: "ayse@example.com", phone: "0532 000 00 00" },
    invoice: { type: "individual", address, tckn: "10000000146" },
    locale: "tr",
    ...patch,
  });
const totals = (q) => ({ unitPriceKurus: 1000, totalKurus: q * 1000, vatRate: 20, vatKurus: Math.round((q * 1000 * 20) / 120) });

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

const cases = {
  bireysel: {
    input: preview({}),
    now: new Date("2026-10-20T09:00:00Z"),
    orderNo: "SG-2026-RNEK23",
  },
  kurumsal: {
    input: preview({
      quantity: 5000,
      certificateName: "Örnek Lojistik A.Ş. Çalışanları",
      invoice: {
        type: "corporate",
        companyTitle: "Örnek Lojistik Anonim Şirketi",
        taxId: makeVkn("123456789"),
        taxOffice: "Çanakkale",
        address,
        authorizedPerson: "Ayşe Örnek",
        poNumber: "PO-2026-118",
        eInvoiceUser: true,
      },
    }),
    now: new Date("2026-10-20T09:00:00Z"),
    orderNo: "SG-2026-RNEK45",
  },
  "sonraki-sezon": { input: preview({}), now: new Date("2027-03-20T09:00:00Z"), orderNo: null },
};

const norm = (s) => s.replace(/\s+/g, " ");
for (const [name, c] of Object.entries(cases)) {
  const schedule = Sc.scheduleFor(c.now);
  const ctx = D.buildLegalContext({
    input: c.input,
    site,
    totals: totals(c.input.quantity),
    schedule,
    orderDate: Sc.trToday(c.now),
    orderNo: c.orderNo,
  });
  const docs = D.buildOrderDocuments(ctx);
  assert.deepEqual(docs.map((d) => d.kind), ["pre_info", "contract", "withdrawal_form"]);

  // deterministik: aynı bağlam → aynı HTML → aynı özet
  const again = D.buildOrderDocuments(ctx);
  docs.forEach((d, i) => {
    assert.equal(d.html, again[i].html);
    assert.equal(d.sha256, again[i].sha256);
    assert.match(d.sha256, /^[0-9a-f]{64}$/);
    assert.equal(d.version, V.LEGAL_DOCUMENTS_VERSION);
    assert.ok(d.html.startsWith("<!doctype html>"));
    assert.ok(!/undefined|null|NaN|\[object/.test(d.html), `${name}/${d.kind}: ham değer sızmış`);
    assert.ok(!/<script|onerror=|javascript:/i.test(d.html));
  });

  const [pre, contract, form] = docs.map((d) => norm(d.html));
  // m.5'teki zorunlu bilgiler (ön bilgilendirme)
  for (const must of [
    "SKYTECH HAVACILIK VE TEKNOLOJİ SANAYİ TİCARET ANONİM ŞİRKETİ",
    "Kahramankazan / 7721661218",
    "Macun Mahallesi",
    "info@skytechgreen.com",
    "tohum topunu insansız hava aracı (dron) ile bırakması",
    "Toplam bedel (tüm vergiler dâhil)",
    "Ek masraf",
    "3D Secure",
    "Hizmetin ifa edileceği son tarih (kesin süre)",
    "14 (on dört) gün içinde, hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin",
    "skytechgreen.com/cayma",
    "tek seferde",
    "cayma süresi dolmadan yapmaz",
    "bağış veya yardım değildir",
    "sonuç taahhüdünde bulunmaz",
  ]) {
    assert.ok(pre.includes(must), `${name}: ön bilgilendirmede eksik → ${must}`);
  }
  assert.ok(contract.includes("Madde 14 — Yürürlük") && contract.includes("Madde 7 — Cayma hakkı"));
  assert.ok(form.includes("cayma hakkımı kullandığımı beyan ederim"));

  // T.C. kimlik no hiçbir belgede yer almaz; kart/ödeme ayrıntısı da
  docs.forEach((d) => assert.ok(!d.html.includes("10000000146"), `${name}/${d.kind}: TCKN belgeye sızmış`));

  // yasaklı dil: ekim/dikim/demo/pilot/karbon nötr/garanti vaadi
  docs.forEach((d) => {
    const t = norm(d.html).toLocaleLowerCase("tr");
    for (const bad of [" ekim ", "dikim", "fidan dik", "demo", "pilot", "karbon nötr", "çimlenme oranı", "garanti ed"]) {
      // "Ekim–Mart" takvim adı meşrudur
      const cleaned = t.replace(/ekim–mart/g, "").replace(/1 ekim/g, "").replace(/ ekim 20\d\d/g, "");
      assert.ok(!cleaned.includes(bad), `${name}/${d.kind}: yasaklı ifade → "${bad}"`);
    }
  });

  if (name === "bireysel") {
    assert.ok(pre.includes("Tüketici Hakem Heyetine") && !pre.includes("Ankara Mahkemeleri"));
    assert.ok(pre.includes("Ayşe Örnek") && pre.includes("2.000") && pre.includes("333,33"));
    assert.ok(pre.includes("3 Kasım 2026 günü sonuna kadar"), "cayma son günü: 20 Ekim + 14");
    assert.ok(pre.includes("31 Mart 2027") && pre.includes("10 Kasım 2026"));
    assert.ok(contract.includes("6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümlerine tabidir"));
    assert.ok(form.includes("SG-2026-RNEK23"));
  }
  if (name === "kurumsal") {
    assert.ok(pre.includes("Ankara Mahkemeleri") && !pre.includes("Tüketici Hakem Heyetine"));
    assert.ok(pre.includes("Örnek Lojistik Anonim Şirketi") && pre.includes("Siparişi veren yetkili") && pre.includes("50.000"));
    assert.ok(contract.includes("ALICI tüketici sıfatı taşımamaktadır") && contract.includes("7.5."));
    assert.ok(pre.includes("Örnek Lojistik A.Ş. Çalışanları"));
  }
  if (name === "sonraki-sezon") {
    assert.ok(pre.includes("2027-2028 sezonuna yazılmıştır") && pre.includes("31 Mart 2028"));
    assert.ok(form.includes("Sipariş onaylandığında atanır"));
  }

  // PDF
  for (const d of docs) {
    const pdf = P.renderLegalPdf(d.document, { sha256: d.sha256, createdAt: c.now });
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 20_000 && pdf.length < 600_000, `${name}/${d.kind}: PDF boyutu ${pdf.length}`);
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.ok(pages >= 1 && pages <= 8, `${name}/${d.kind}: sayfa sayısı ${pages}`);
    if (WRITE) {
      fs.mkdirSync(OUT, { recursive: true });
      const base = path.join(OUT, `${name}--${d.kind.replace(/_/g, "-")}`);
      fs.writeFileSync(base + ".html", d.html);
      fs.writeFileSync(base + ".pdf", pdf);
    }
    console.log(`  ${name.padEnd(14)} ${d.kind.padEnd(16)} html ${String(d.html.length).padStart(6)}  pdf ${String(pdf.length).padStart(7)}  sayfa ${pages}  ${d.sha256.slice(0, 12)}…`);
  }
}

// kaçışlama: kullanıcı girdisi HTML'e ham giremez
{
  const evil = preview({
    certificateName: "Ali & Veli",
    buyer: { firstName: "Ali<b>", lastName: 'Veli"><img src=x>', email: "a@example.com", phone: "05320000000" },
    invoice: { type: "individual", address: { ...address, line: "Sokak <script>alert(1)</script> No: 1" } },
  });
  const now = new Date("2026-10-20T09:00:00Z");
  const ctx = D.buildLegalContext({ input: evil, site, totals: totals(200), schedule: Sc.scheduleFor(now), orderDate: Sc.trToday(now) });
  for (const d of D.buildOrderDocuments(ctx)) {
    assert.ok(!/<script|<img|<b>/i.test(d.html), d.kind + ": kaçışlanmamış girdi");
    assert.ok(d.kind === "withdrawal_form" || d.html.includes("&lt;script&gt;"));
  }
}
console.log("✓ hukuki belge testleri geçti" + (WRITE ? ` — taslaklar yazıldı: ${OUT}` : ""));
