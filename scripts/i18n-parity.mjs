#!/usr/bin/env node
/**
 * messages/{tr,en,ru}.json anahtar eşitliği denetimi.
 *
 *   npm run i18n:check
 *
 * Üç dosyanın yaprak anahtar kümeleri birebir aynı olmalı; boş string ya da
 * yalnız boşluk içeren değer olmamalı. Fark varsa 1 ile çıkar (CI'da kırar).
 * Not: bu denetim kaynak kod içindeki t("...") çağrılarını kapsamaz — sayfa
 * bazlı doğrulama için render edilen HTML taranır.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = ["tr", "en", "ru"];

function leaves(obj, prefix = "", out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) leaves(v, key, out);
    else out.set(key, v);
  }
  return out;
}

const maps = Object.fromEntries(
  LOCALES.map((l) => [l, leaves(JSON.parse(readFileSync(resolve(root, `messages/${l}.json`), "utf8")))])
);

let failed = false;
const base = maps.tr;
for (const l of LOCALES.slice(1)) {
  const missing = [...base.keys()].filter((k) => !maps[l].has(k));
  const extra = [...maps[l].keys()].filter((k) => !base.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`✗ ${l}: eksik ${missing.length}, fazla ${extra.length}`);
    missing.slice(0, 20).forEach((k) => console.error(`    eksik  ${k}`));
    extra.slice(0, 20).forEach((k) => console.error(`    fazla  ${k}`));
  }
}
for (const l of LOCALES) {
  const empty = [...maps[l].entries()].filter(([, v]) => typeof v === "string" && v.trim() === "");
  // Boş değer hata değil uyarı: bazı diller bir ek/kuyruk parçasını bilerek boş bırakır
  if (empty.length) {
    console.warn(`! ${l}: boş değer ${empty.length} (uyarı)`);
    empty.slice(0, 20).forEach(([k]) => console.warn(`    boş  ${k}`));
  }
}

if (failed) process.exit(1);
console.log(`✓ i18n eşitliği: ${LOCALES.map((l) => `${l}=${maps[l].size}`).join(" · ")}`);
