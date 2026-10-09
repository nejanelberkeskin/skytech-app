/**
 * Tipli örnek yanıtlar — saha yönetimi arayüzü gerçek veri olmadan çalışsın diye. Sözleşme: web-brifler/30 §8.
 * Kişisel veri yoktur; sahalar ve sayılar kurgusaldır.
 */
import type { ApiErrorBody } from "@/lib/api/envelope";
import type { SiteAdminItem, SiteAdminListDto, SiteMutationDto } from "../admin-dto";

const SITE_A = "20000000-0000-4000-8000-0000000000aa";
const SITE_B = "20000000-0000-4000-8000-0000000000bb";

const antalya: SiteAdminItem = {
  id: SITE_A,
  slug: "antalya-proje-uygulama-sahasi",
  name: "Antalya Proje Uygulama Sahası",
  region: "Antalya",
  province: "Antalya",
  district: "Manavgat",
  areaHectares: 42.5,
  isFireAffected: true,
  fireYear: 2021,
  certificateMonth: 4,
  monitoringMonth: 9,
  workType: "ormanlastirma_genclestirme",
  speciesSlugs: ["kizilcam"],
  nameI18n: { en: "Antalya Project Site" },
  summaryI18n: { tr: "Yangından etkilenen saha." },
  coverImage: "/images/sahalar/antalya.webp",
  videoUrl: null,
  sortOrder: 10,
  status: "open",
  isPublic: true,
  visibility: { listed: true, acceptsOrders: true },
  capacity: { total: 50000, filled: 1000, reserved: 500, available: 48500 },
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-28T09:00:00.000Z",
  capabilities: { edit: true, publish: false, capacity: true },
};

const mugla: SiteAdminItem = {
  ...antalya,
  id: SITE_B,
  slug: "mugla-proje-uygulama-sahasi",
  name: "Muğla Proje Uygulama Sahası",
  region: "Muğla",
  province: "Muğla",
  district: "Milas",
  status: "scheduled",
  isPublic: false,
  visibility: { listed: false, acceptsOrders: false },
  capacity: { total: 40000, filled: 0, reserved: 0, available: 40000 },
};

/** Mühendis şablonu: düzenleme + kapasite, yayın yok; oturum yeniden doğrulanmamış. */
export const SITE_LIST_ENGINEER: SiteAdminListDto = {
  items: [antalya, mugla],
  species: [{ slug: "kizilcam", name: "Kızılçam", latinName: "Pinus brutia" }],
  scope: { kind: "all" },
  capabilities: { create: true, createPublic: false, delete: false },
  mfa: { enforced: true, satisfied: false, enrolled: true },
};

/** Salt okuma: hiçbir eylem yok. */
export const SITE_LIST_READ_ONLY: SiteAdminListDto = {
  items: [antalya, mugla].map((s) => ({ ...s, capabilities: { edit: false, publish: false, capacity: false } })),
  scope: { kind: "all" },
  capabilities: { create: false, createPublic: false, delete: false },
  mfa: { enforced: true, satisfied: false, enrolled: false },
};

/** Yalnız Antalya'ya yetkili: diğer saha görünmez, yeni saha açamaz. */
export const SITE_LIST_SCOPED: SiteAdminListDto = {
  items: [antalya],
  scope: { kind: "sites", siteIds: [SITE_A] },
  capabilities: { create: false, createPublic: false, delete: false },
  mfa: { enforced: true, satisfied: true, enrolled: true },
};

export const SITE_MUTATION_TEXT: SiteMutationDto = {
  site: { ...antalya, summaryI18n: { tr: "Yangından etkilenen saha; ilk bırakma Kasım'da." }, updatedAt: "2026-09-29T08:00:00.000Z" },
  changed: ["summary_i18n"],
};

/** Form değişmeden gönderildi: yazma ve audit yok. */
export const SITE_MUTATION_UNCHANGED: SiteMutationDto = { site: antalya, changed: [] };

export const SITE_ERRORS: Record<string, ApiErrorBody> = {
  publishMissing: { code: "forbidden", message: "Bu değişiklik için yetkiniz yok.", details: { reason: "missing_permission", permissions: ["sites.publish"] } },
  capacityMissing: { code: "forbidden", message: "Bu değişiklik için yetkiniz yok.", details: { reason: "missing_permission", permissions: ["sites.capacity.manage"] } },
  mfaRequired: {
    code: "mfa_required", message: "Bu değişiklik iki aşamalı doğrulama ister.",
    details: { permissions: ["sites.capacity.manage"], enrolled: true, reason: "stale", freshnessMinutes: 15 },
  },
  outOfScope: { code: "forbidden", message: "Bu kayıt yetkinizin saha kapsamı dışında.", details: { reason: "out_of_scope", permissions: ["sites.edit"] } },
  allScopeRequired: {
    code: "forbidden", message: "Bu işlem bütün kayıtlara yetki ister; saha kapsamlı yetki yeni kayıt açamaz.",
    details: { reason: "all_scope_required", permissions: ["sites.edit", "sites.capacity.manage"] },
  },
  scopeUnsupported: { code: "scope_unsupported", message: "Saha yetkiniz yalnız kişiye atanmış işleri kapsıyor; sahalar için atama modeli yok.", details: { permission: "sites.read", permissions: ["sites.read"] } },
  conflict: { code: "conflict", message: "Saha arada değişti (yayın durumu ya da kapasite sayıları). Güncel kaydı yükleyip yeniden deneyin.", details: { reason: "changed_meanwhile" } },
  capacityBelowUsed: {
    code: "invalid_body", message: "Kapasite 1.500'den az olamaz (bırakılan + ayrılan).",
    details: { fields: { capacity_seeds: "Kapasite 1.500'den az olamaz (bırakılan + ayrılan)." } },
  },
  slugTaken: { code: "slug_taken", message: "Bu adres başka bir sahada kullanılıyor.", details: { fields: { slug: "Bu adres kullanılıyor." } } },
  notFound: { code: "not_found", message: "Saha bulunamadı." },
  deleteForbidden: { code: "forbidden", message: "Saha silme yalnız sahip rolüne açık.", details: { reason: "legacy_role_required", role: "SUPER_ADMIN" } },
  notEmpty: { code: "not_empty", message: "\"Antalya Proje Uygulama Sahası\" sahasında 1000 bırakılmış ve 500 ayrılmış tohum topu kaydı var; silinemez. Yayından almak için \"Yayından al\" düğmesini kullanın.", details: { filled: 1000, reserved: 500 } },
  inUse: { code: "in_use", message: "Sahaya bağlı talep ya da sipariş kaydı var; silinemez. Yayından almak için \"Yayından al\" düğmesini kullanın." },
  unavailable: { code: "unavailable", message: "Veri alınamadı. Lütfen yeniden deneyin." },
};
