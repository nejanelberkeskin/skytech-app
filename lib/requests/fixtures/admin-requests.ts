/**
 * Tipli örnek yanıtlar — talep yönetimi arayüzü gerçek veri olmadan çalışsın diye. Sözleşme: web-brifler/29 §7.
 * Kişisel veri yoktur; e-postalar `example.invalid`, telefonlar kurgusaldır.
 */
import type { ApiErrorBody } from "@/lib/api/envelope";
import type { RequestItem, RequestListDto, RequestStatus } from "../admin-dto";

const SITE_A = "20000000-0000-0000-0000-0000000000aa";
const zeroCounts: Record<RequestStatus, number> = { new: 0, contacted: 0, quoted: 0, converted: 0, closed: 0, spam: 0 };

const seeding: RequestItem = {
  id: "40000000-0000-4000-8000-000000000001",
  requestNo: "TLP-A3K9PX",
  type: "open_land_seeding",
  status: "new",
  locale: "tr",
  createdAt: "2026-09-28T09:00:00.000Z",
  updatedAt: "2026-09-28T09:00:00.000Z",
  site: { id: SITE_A, name: "Antalya Sahası", region: "Antalya" },
  totalSeeds: 500,
  seedItems: [],
  details: { type: "open_land_seeding", quantity: 500 },
  adminNote: null,
  lastHandled: { adminId: null, at: null },
  canUpdate: true,
};

const landApplication: RequestItem = {
  ...seeding,
  id: "40000000-0000-4000-8000-000000000002",
  requestNo: "TLP-B7M2QR",
  type: "land_application",
  site: null,
  totalSeeds: null,
  details: { type: "land_application", province: "07", district: "Manavgat", areaValue: 12, areaUnit: "dekar",
    conditions: ["burnt"], ownership: "own", timing: "this_season" },
};

/** Yalnız `requests.read` (+ update): iletişim alanı yok, iletişimle arama kapalı. */
export const REQUEST_LIST_BASIC: RequestListDto = {
  items: [seeding, landApplication],
  total: 2,
  page: 1,
  pageSize: 25,
  counts: { ...zeroCounts, new: 2 },
  groups: ["request"],
  scope: { kind: "all" },
  search: { contactFields: false },
  capabilities: { update: true },
};

/** `customers.contact.read` ile: iletişim grubu satırda; mesaj ve harita bağlantısı da bu gruptadır. */
export const REQUEST_LIST_CONTACT: RequestListDto = {
  ...REQUEST_LIST_BASIC,
  items: [
    { ...seeding, contact: { name: "Deneme Kişi", email: "kisi@example.invalid", phone: "+905550000000", company: null,
      message: "Sahaya katılmak istiyorum.", consent: { at: "2026-09-28T09:00:00.000Z", version: "2026-09" },
      sourcePath: "/tr/talep/saha", mapLink: null, accessNotes: null, certificateName: "Deneme Kişi", hasAccount: true } },
    { ...landApplication, contact: { name: "Arazi Sahibi", email: "arazi@example.invalid", phone: null, company: "Örnek Tarım",
      message: null, consent: { at: "2026-09-28T09:00:00.000Z", version: "2026-09" }, sourcePath: "/tr/talep/arazim",
      mapLink: "https://maps.example.invalid/?q=37,31", accessNotes: "Köy yolundan girilir.", certificateName: null,
      hasAccount: false } },
  ],
  groups: ["request", "contact"],
  search: { contactFields: true },
};

/** Saha kapsamlı okuyucu: sahasız talep (arazi başvurusu) görünmez, sayaçlar yalnız kapsamda. */
export const REQUEST_LIST_SITE_SCOPED: RequestListDto = {
  ...REQUEST_LIST_BASIC,
  items: [seeding],
  total: 1,
  counts: { ...zeroCounts, new: 1 },
  scope: { kind: "sites", siteIds: [SITE_A] },
};

export const REQUEST_ERRORS: Record<string, ApiErrorBody> = {
  forbidden: { code: "forbidden", message: "Bu işlem için yetkiniz yok." },
  outOfScope: { code: "forbidden", message: "Bu talep güncelleme yetkinizin saha kapsamı dışında.", details: { reason: "out_of_scope" } },
  scopeUnsupported: { code: "scope_unsupported", message: "Talep yetkiniz yalnız kişiye atanmış işleri kapsıyor; talepler için atama modeli henüz yok.", details: { permission: "requests.read" } },
  notFound: { code: "not_found", message: "Talep bulunamadı." },
  invalidBody: { code: "invalid_body", message: "Geçersiz istek: kimlik ve en az bir alan (durum ya da not) gerekli.", details: { fields: ["body"] } },
  unavailable: { code: "unavailable", message: "Veri alınamadı. Lütfen yeniden deneyin." },
};
