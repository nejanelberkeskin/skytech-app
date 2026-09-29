import test from "node:test";
import assert from "node:assert/strict";
import { readPreviewResponse } from "../../components/vitrin/siparis/preview-response.ts";
import { DOCUMENT_KINDS } from "../../lib/orders/types.ts";
const valid = () => ({
  version: "test-version",
  documents: DOCUMENT_KINDS.map((kind) => ({ kind, title: kind, html: "<p>Test document</p>" })),
  totals: { quantity: 100, unitPriceKurus: 1234, totalKurus: 123400, vatKurus: 20567, vatRate: 20 },
  schedule: {
    season: { label: "2026-2027", startsOn: "2026-11-01", endsOn: "2027-03-31" },
    withdrawalDeadline: "2026-10-13T20:59:59.999Z", earliestReleaseOn: "2026-11-01",
    performanceDeadline: "2027-03-31", rolledToNextSeason: false,
  },
});
test("preview retains the server price and document contents without local recalculation", () => {
  const quote = valid();
  assert.deepEqual(readPreviewResponse({ ok: true, ...quote }, 100), quote);
});
test("incomplete or non-object successful JSON cannot become a quote", () => {
  for (const value of [null, undefined, [], true, "ok", { ok: true }, { ...valid(), totals: null }, { ...valid(), schedule: {} }])
    assert.equal(readPreviewResponse(value, 100), null);
});
test("another quantity and invalid monetary values cannot appear in the payment summary", () => {
  assert.equal(readPreviewResponse(valid(), 200), null);
  for (const value of [-1, NaN, Infinity, 1.25, Number.MAX_SAFE_INTEGER + 1, "123400", null]) {
    const quote = valid(); quote.totals.totalKurus = value;
    assert.equal(readPreviewResponse(quote, 100), null);
  }
});
test("missing, duplicate, unknown or empty documents cannot reach consent controls", () => {
  const quote = valid();
  const sets = [[], quote.documents.slice(1), Array(4).fill(quote.documents[0]),
    [{ ...quote.documents[0], kind: "unknown" }, ...quote.documents.slice(1)],
    [{ ...quote.documents[0], html: " " }, ...quote.documents.slice(1)]];
  for (const documents of sets) assert.equal(readPreviewResponse({ ...quote, documents }, 100), null);
});
test("invalid dates, missing schedule fields and empty version are rejected", () => {
  const quote = valid();
  for (const date of ["invalid", "2026-02-30", "2026-13-01", null])
    assert.equal(readPreviewResponse({ ...quote, schedule: { ...quote.schedule, performanceDeadline: date } }, 100), null);
  assert.equal(readPreviewResponse({ ...quote, schedule: { ...quote.schedule, withdrawalDeadline: "tomorrow" } }, 100), null);
  assert.equal(readPreviewResponse({ ...quote, version: " " }, 100), null);
});
