import assert from "node:assert/strict";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const A = await import(ROOT + "/lib/sites/admin.ts");
const { slugify, SLUG_RE } = await import(ROOT + "/lib/sites/slug.ts");

const base = {
  name: "  Çanakkale   Proje Uygulama Sahası ",
  slug: "",
  province: "Çanakkale",
  district: " Eceabat ",
  area_hectares: 42.456,
  is_fire_affected: true,
  fire_year: 2023,
  work_type: "ormanlastirma_genclestirme",
  species_slugs: ["kizilcam", "kizilcam", "karacam"],
  name_en: "Çanakkale Project Site",
  name_ru: "",
  summary_tr: "Yangından etkilenen saha.",
  summary_en: "",
  summary_ru: "",
  cover_image: "",
  video_url: "",
  sort_order: 10,
  status: "open",
  is_public: true,
  capacity_seeds: 50000,
};
const parse = (patch = {}) => A.siteAdminSchema.safeParse({ ...base, ...patch });
const errs = (r) => (r.success ? {} : A.siteFieldErrors(r.error.issues));

// ── geçerli kayıt + dönüşümler
let r = parse();
assert.ok(r.success, JSON.stringify(errs(r)));
assert.equal(r.data.name, "Çanakkale Proje Uygulama Sahası");
assert.equal(r.data.slug, null);
assert.equal(r.data.district, "Eceabat");
assert.equal(r.data.area_hectares, 42.46);
assert.deepEqual(r.data.species_slugs, ["kizilcam", "karacam"]);
assert.equal(r.data.name_ru, null);
assert.equal(r.data.cover_image, null);

const row = A.toLandRow(r.data);
assert.deepEqual(row.name_i18n, { en: "Çanakkale Project Site" });
assert.deepEqual(row.summary_i18n, { tr: "Yangından etkilenen saha." });
assert.equal(row.region, "Çanakkale");
assert.equal(row.fire_year, 2023);
assert.ok(!("filled_seeds" in row) && !("slug" in row), "kapasite sayaçları ve slug çağıranda belirlenir");

// ── alan kuralları
assert.deepEqual(errs(parse({ name: "A" })), { name: "Saha adı en az 2 karakter olmalı." });
assert.deepEqual(errs(parse({ slug: "Geçersiz Adres" })), { slug: "Adres yalnız küçük harf, rakam ve tire içerebilir." });
assert.ok(parse({ slug: "canakkale-eceabat-2" }).success);
assert.equal(parse({ slug: "  Canakkale-Saha " }).data.slug, "canakkale-saha");
assert.deepEqual(errs(parse({ area_hectares: 0 })), { area_hectares: "Hektar 0'dan büyük olmalı." });
assert.deepEqual(errs(parse({ area_hectares: NaN })), { area_hectares: "Hektar sayı olmalı." });
assert.equal(parse({ area_hectares: null }).data.area_hectares, null);
assert.deepEqual(errs(parse({ fire_year: 1979 })), { fire_year: "Yangın yılı 1980 ve sonrası olmalı." });
assert.deepEqual(errs(parse({ fire_year: new Date().getFullYear() + 1 })), { fire_year: "Yangın yılı gelecekte olamaz." });
assert.deepEqual(errs(parse({ is_fire_affected: false, fire_year: 2023 })), { fire_year: "Yangın yılı yalnız yangın sahalarında girilir." });
assert.equal(A.toLandRow(parse({ is_fire_affected: false, fire_year: null }).data).fire_year, null);
assert.deepEqual(errs(parse({ work_type: "ekim" })), { work_type: "Çalışma türü seçin." });
assert.deepEqual(errs(parse({ status: "bakim" })), { status: "Durum seçin." });
assert.deepEqual(errs(parse({ capacity_seeds: 0 })), { capacity_seeds: "Kapasite 0'dan büyük olmalı." });
assert.deepEqual(errs(parse({ capacity_seeds: 12.5 })), { capacity_seeds: "Kapasite tam sayı olmalı." });
assert.deepEqual(errs(parse({ species_slugs: ["a", "b", "c", "d", "e", "f", "g"].map((x) => x + "x") })), {
  species_slugs: "En çok 6 tür seçilebilir.",
});
assert.deepEqual(errs(parse({ summary_tr: "x".repeat(801) })), { summary_tr: "Türkçe tanıtım çok uzun." });

// kapak ve video
assert.ok(parse({ cover_image: "/images/sahalar/canakkale.webp" }).success);
assert.ok(parse({ cover_image: "https://cdn.example.com/a.jpg" }).success);
assert.deepEqual(errs(parse({ cover_image: "javascript:alert(1)" })), { cover_image: "Kapak: /images/… yolu ya da https:// adresi olmalı." });
assert.deepEqual(errs(parse({ cover_image: "http://example.com/a.jpg" })), { cover_image: "Kapak: /images/… yolu ya da https:// adresi olmalı." });
assert.deepEqual(errs(parse({ cover_image: "/images/../../etc/passwd.png" })), { cover_image: "Kapak: /images/… yolu ya da https:// adresi olmalı." });
assert.ok(parse({ video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }).success);
assert.ok(parse({ video_url: "https://youtu.be/dQw4w9WgXcQ" }).success);
assert.deepEqual(errs(parse({ video_url: "https://vimeo.com/123456" })), { video_url: "Video: https:// ile başlayan bir YouTube bağlantısı olmalı." });
assert.deepEqual(errs(parse({ video_url: "http://youtube.com/watch?v=abcdefg" })), { video_url: "Video: https:// ile başlayan bir YouTube bağlantısı olmalı." });

// ── slugify
assert.equal(slugify("Çanakkale Proje Uygulama Sahası"), "canakkale-proje-uygulama-sahasi");
assert.equal(slugify("  İzmir / Şirince — Ğ "), "izmir-sirince-g");
assert.ok(SLUG_RE.test(slugify("Iğdır Sahası 2")));
assert.equal(slugify("!!!"), "");

console.log("✓ yönetim şeması testleri geçti");
