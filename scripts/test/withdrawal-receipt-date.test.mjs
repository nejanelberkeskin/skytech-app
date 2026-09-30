import test from "node:test";
import assert from "node:assert/strict";
import { formatReceiptDates, isCalendarDay, isReceiptTimestamp } from "../../components/vitrin/cayma/receipt-date.ts";

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

// 90-1: the formatting server action uses the same validation as the client (no 3-digit fraction limit).
test("server formatting accepts database microseconds and shows the Istanbul day (midnight boundary)", () => {
  assert.deepEqual(formatReceiptDates("2026-09-29T21:00:00.000001+00:00", "2026-10-14", "tr"),
    { receivedAt: "30 Eylül 2026 00:00 GMT+3", refundDueOn: "14 Ekim 2026" });
  assert.deepEqual(formatReceiptDates("2026-09-29T21:00:00.000001+00:00", "2026-10-14", "en"),
    { receivedAt: "30 September 2026 at 00:00 GMT+3", refundDueOn: "14 October 2026" });
  assert.deepEqual(formatReceiptDates("2026-09-29T21:00:00.000001+00:00", "2026-10-14", "ru"),
    { receivedAt: "30 сентября 2026 г. в 00:00 GMT+3", refundDueOn: "14 октября 2026 г." });
  assert.deepEqual(formatReceiptDates("2028-02-29T00:00:00.123456+03:00", "2028-03-14", "tr"),
    { receivedAt: "29 Şubat 2028 00:00 GMT+3", refundDueOn: "14 Mart 2028" });
  assert.deepEqual(formatReceiptDates("2026-09-29T09:15:00.123Z", "2026-10-13", "tr"),
    { receivedAt: "29 Eylül 2026 12:15 GMT+3", refundDueOn: "13 Ekim 2026" }, "today's server format still works");
});
test("server formatting rejects what the client rejects: invalid clock, day, zone and refund day", () => {
  for (const [receivedAt, refundDueOn] of [["2026-09-29T24:00:00Z", "2026-10-14"], ["2026-02-30T12:00:00Z", "2026-03-14"],
    ["2026-09-29T12:00:00", "2026-10-14"], ["2026-09-29T12:00:00+24:00", "2026-10-14"], ["2026-09-29T12:00:00Z", "2026-02-30"],
    ["2026-09-29T12:00:00Z", "2026-10-1"], [123, "2026-10-14"], ["2026-09-29T12:00:00Z", null]])
    assert.equal(formatReceiptDates(receivedAt, refundDueOn, "tr"), null, `${receivedAt} / ${refundDueOn}`);
  assert.equal(isCalendarDay("2024-02-29"), true);
  assert.equal(isCalendarDay("2026-02-29"), false);
});
test("client and server validators agree on every sample (one shared implementation)", () => {
  for (const value of ["2026-09-29T12:00:00.000Z", "2026-09-29T12:00:00.123456+00:00", "2026-09-29T12:00:00Z",
    "2026-09-29T12:00:00.123456789Z", "2026-02-29T12:00:00Z", "2026-09-29T24:00:00Z", "2026-09-29T12:00:00", "invalid"])
    assert.equal(formatReceiptDates(value, "2026-10-14", "tr") !== null, isReceiptTimestamp(value), value);
});
