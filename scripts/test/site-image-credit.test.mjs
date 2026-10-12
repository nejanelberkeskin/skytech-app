import assert from "node:assert/strict";
import { test } from "node:test";
const { coverImageCredit } = await import("../../lib/sites/image-credit.ts");
test("uydu kapağına Copernicus kaynak notu; diğer görsellere not yok", () => {
  assert.equal(coverImageCredit("/images/sahalar/izmir-karsiyaka-sentinel2-2026-10.webp"), "Contains modified Copernicus Sentinel data 2026");
  assert.equal(coverImageCredit("/images/projeler/izmir-karsiyaka.webp"), null);
  assert.equal(coverImageCredit(null), null);
});
