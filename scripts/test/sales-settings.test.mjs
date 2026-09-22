import assert from "node:assert/strict";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const P = await import(ROOT + "/lib/pricing.ts");
const S = await import(ROOT + "/lib/orders/settings-schema.ts");
const Sample = await import(ROOT + "/lib/legal/sample.ts");

const base = {
  unitPriceKurus: 1000,
  minQuantity: 20,
  maxQuantity: 100_000,
  quantityPresets: [50, 100, 200, 500, 5000],
  vatRate: 20,
  invoiceTiming: "on_performance",
  prepDays: 21,
  paymentTtlMinutes: 45,
  ordersPaused: false,
};
const check = (patch) => {
  const r = S.salesSettingsSchema.safeParse({ ...base, ...patch });
  return r.success ? {} : S.settingsFieldErrors(r.error);
};

/* ── Kurallar ─────────────────────────────────────────────────────────────── */
assert.deepEqual(check({}), {}, "bugünkü canlı değerler geçerli olmalı");
assert.deepEqual(check({ unitPriceKurus: 99 }), { unitPriceKurus: "range" });
assert.deepEqual(check({ unitPriceKurus: 100_001 }), { unitPriceKurus: "range" });
assert.deepEqual(check({ unitPriceKurus: 10.5 }), { unitPriceKurus: "invalid" }, "kuruş tam sayı olmalı");
assert.deepEqual(check({ unitPriceKurus: Number.NaN }), { unitPriceKurus: "invalid" });
assert.deepEqual(check({ minQuantity: 0 }), { minQuantity: "range" });
assert.deepEqual(check({ minQuantity: 200, maxQuantity: 100 }).maxQuantity, "maxBelowMin");
assert.deepEqual(check({ maxQuantity: 1_000_001 }), { maxQuantity: "range" });
assert.deepEqual(check({ quantityPresets: [] }), { quantityPresets: "presetsCount" });
assert.deepEqual(check({ quantityPresets: [30, 40, 50, 60, 70, 80, 90] }), { quantityPresets: "presetsCount" });
assert.deepEqual(check({ quantityPresets: [10, 100] }), { quantityPresets: "presetOutOfRange" }, "en az adetin altında seçenek olmaz");
assert.deepEqual(check({ quantityPresets: [100, 50] }), { quantityPresets: "presetsOrder" });
assert.deepEqual(check({ quantityPresets: [50, 50] }), { quantityPresets: "presetsOrder" }, "tekrar eden seçenek olmaz");
assert.deepEqual(check({ vatRate: 18.5 }), {});
assert.deepEqual(check({ vatRate: 18.555 }), { vatRate: "vatDecimals" });
assert.deepEqual(check({ vatRate: 100 }), { vatRate: "range" });
assert.deepEqual(check({ invoiceTiming: "later" }), { invoiceTiming: "invalid" });
assert.deepEqual(check({ prepDays: 14 }), { prepDays: "range" }, "hazırlık payı cayma süresinden (14 gün) uzun olmalı");
assert.deepEqual(check({ prepDays: 121 }), { prepDays: "range" });
assert.deepEqual(check({ paymentTtlMinutes: 9 }), { paymentTtlMinutes: "range" });
assert.deepEqual(check({ ordersPaused: true }), {});
assert.deepEqual(check({ ordersPaused: "evet" }), { ordersPaused: "invalid" });
assert.deepEqual(check({ ordersPaused: undefined }), { ordersPaused: "invalid" }, "durdurma alanı zorunlu");
// bir alan hatalıyken de çapraz kurallar çalışır (form bütün hataları tek seferde gösterir)
assert.deepEqual(
  check({ unitPriceKurus: Number.NaN, minQuantity: 200, maxQuantity: 100, quantityPresets: [300, 250] }),
  { unitPriceKurus: "invalid", maxQuantity: "maxBelowMin", quantityPresets: "presetOutOfRange" },
);
assert.deepEqual(check({ unitPriceKurus: Number.NaN, quantityPresets: [100, 50] }), { unitPriceKurus: "invalid", quantityPresets: "presetsOrder" });
assert.equal(S.salesSettingsSchema.safeParse(null).success, false, "nesne değilse çapraz kural çökmemeli");
// bilinmeyen alan yazılmaz (şema atar)
const extra = S.salesSettingsSchema.safeParse({ ...base, discountPct: 10 });
assert.ok(extra.success && !("discountPct" in extra.data));

/* ── Fark ve teklif sürümü alanları ──────────────────────────────────────── */
assert.deepEqual(S.diffSettings(base, { ...base }), []);
assert.deepEqual(S.diffSettings(base, { ...base, quantityPresets: [...base.quantityPresets] }), [], "aynı içerikli dizi değişiklik sayılmaz");
const diff = S.diffSettings(base, { ...base, unitPriceKurus: 1200, quantityPresets: [50, 100] });
assert.deepEqual(diff.map((c) => c.field), ["unitPriceKurus", "quantityPresets"]);
assert.deepEqual(diff[0], { field: "unitPriceKurus", from: 1000, to: 1200 });
assert.deepEqual([...S.QUOTE_FIELDS].sort(), ["prepDays", "unitPriceKurus", "vatRate"], "quoteVersion ile aynı alanlar");
assert.deepEqual(S.diffSettings(base, { ...base, ordersPaused: true }), [{ field: "ordersPaused", from: false, to: true }]);
assert.ok(!S.QUOTE_FIELDS.includes("ordersPaused"), "durdurma teklif sürümünü değiştirmez");

/* ── Sihirbazın gördüğü kurallar ─────────────────────────────────────────── */
const pricing = S.publicPricing({ ...base, unitPriceKurus: 1250, minQuantity: 50, maxQuantity: 400, quantityPresets: [50, 100, 400] });
assert.deepEqual(pricing, { unitPriceKurus: 1250, minQuantity: 50, maxQuantity: 400, quantityPresets: [50, 100, 400] });
assert.equal(P.totalKurus(50, pricing), 62_500);
assert.equal(P.totalKurus(49, pricing), null);
assert.equal(P.totalKurus(401, pricing), null);
assert.equal(P.totalKurus(20), 20_000, "ayar verilmezse varsayılan");
assert.equal(P.quantityRangeError(49, pricing), "quantityMin");
assert.equal(P.quantityRangeError(401, pricing), "quantityMax");
assert.equal(P.quantityRangeError(50, pricing), null);
assert.equal(P.initialQuantity(pricing), 100, "varsayılan 100, sınırlar içinde");
assert.equal(P.initialQuantity({ ...pricing, minQuantity: 250 }), 250, "en az adet 100'den büyükse ondan başlar");
assert.equal(P.initialQuantity({ ...pricing, minQuantity: 1, maxQuantity: 60 }), 60, "en çok adet 100'den küçükse ona çekilir");

/* ── Örnek sözleşme ayardaki bedeli kullanır ─────────────────────────────── */
const now = new Date("2026-09-22T09:00:00Z");
const ctx = Sample.sampleLegalContext(now, { unitPriceKurus: 1200, vatRate: 10, prepDays: 30 });
assert.equal(ctx.unitPriceKurus, 1200);
assert.equal(ctx.totalKurus, 100 * 1200);
assert.equal(ctx.vatRate, 10);
assert.equal(ctx.vatKurus, Math.round((120_000 * 10) / 110));
const fallback = Sample.sampleLegalContext(now);
assert.equal(fallback.unitPriceKurus, P.UNIT_PRICE_KURUS);
assert.equal(fallback.vatRate, 20);

console.log("✓ satış ayarları testleri geçti");
