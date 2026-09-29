import test from "node:test";
import assert from "node:assert/strict";
import { isReceiptTimestamp } from "../../components/vitrin/cayma/receipt-date.ts";

test("withdrawal receipts accept server milliseconds and database microseconds", () => {
  for (const value of ["2026-09-29T12:00:00.000Z", "2026-09-29T12:00:00.123456+00:00",
    "2026-09-29T12:00:00Z", "2026-09-29T12:00:00.1Z", "2026-09-29T12:00:00.123456789Z"])
    assert.equal(isReceiptTimestamp(value), true, value);
});
test("receipt calendar validation respects leap days and timezone day boundaries", () => {
  for (const value of ["2024-02-29T00:00:00.123456+03:00", "2026-12-31T23:59:59.123456-03:00"])
    assert.equal(isReceiptTimestamp(value), true, value);
});
test("invalid dates, clocks, offsets and non-string receipts are rejected", () => {
  for (const value of ["2026-02-29T12:00:00Z", "2026-02-30T12:00:00.123456+00:00",
    "2026-04-31T12:00:00Z", "2026-13-01T12:00:00Z", "2026-09-29T24:00:00Z",
    "2026-09-29T12:60:00Z", "2026-09-29T12:00:60Z", "2026-09-29T12:00:00+24:00",
    "2026-09-29T12:00:00+03:60", "2026-09-29T12:00:00", "2026-09-29",
    "2026-09-29T12:00:00.Z", "invalid", "", null, undefined, 123, {}])
    assert.equal(isReceiptTimestamp(value), false, String(value));
});
