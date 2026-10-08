import { OWN_LAND_HREF } from "@/lib/sites/links";

/**
 * Site genel yapılandırması — özellik bayrakları ve rota yardımcıları.
 *
 * Bağımsız aşamalar:
 *
 *  TRANSACTIONS_ENABLED  B2B: kurumsal teklif → ödeme → çalışan sertifikaları (sayfalar ve
 *                        API uçları). Şu an KAPALI; NEXT_PUBLIC_TRANSACTIONS_ENABLED=true
 *                        ile açılır — açmadan önce devir notundaki "B2B'yi açmadan önce"
 *                        listesi tamamlanmalı. (Eski bireysel tohum satışı Faz 8'de
 *                        kaldırıldı; bu bayrak artık yalnız B2B'yi açar.)
 *
 *  REQUESTS_ENABLED      Ödeme almadan talep toplama: Proje Uygulama Sahasına tohum
 *                        topu bıraktırma talebi ve kendi arazi başvurusu
 *                        (/kendi-arazim). Varsayılan AÇIK;
 *                        NEXT_PUBLIC_REQUESTS_ENABLED=false ile kapatılır.
 *                        (Doğrudan tohum satışı/talebi 2026-09 itibarıyla yok.)
 *
 *  SALES_ENABLED         Yeni satış modeli: sahaya tohum topu bıraktırma siparişi,
 *                        çevrim içi ödeme, sözleşme ve fatura. Şu an KAPALI; sanal
 *                        POS ve e-fatura hazır olunca NEXT_PUBLIC_SALES_ENABLED=true
 *                        ile açılır. Kapalıyken sipariş sihirbazı aynı arayüzle
 *                        ödeme almadan TALEP toplar (REQUESTS_ENABLED).
 *                        (TRANSACTIONS_ENABLED yalnız B2B'yi açar.)
 *
 *  PAYMENT_SOON          "Ödemede dur" kipi: satış kapalıyken (sipariş kapısı kapalı) sihirbaz dört adımla
 *                        sipariş özetine ve tahmini bedele kadar ilerler; ilk adımdan "şu anda sipariş ve
 *                        ödeme alınmıyor" notu görünür. 3. adım iletişim formudur (talep şeması; fatura,
 *                        adres ve kimlik/vergi no istenmez). Son düğme sipariş OLUŞTURMAZ, ödeme almaz;
 *                        "çevrim içi ödeme henüz açık değil" ekranını açar, müşteri isterse KVKK aydınlatma
 *                        onayıyla talep bırakır. Bu yüzden REQUESTS_ENABLED de açık olmalı. Çağrı metinleri
 *                        talep kipindeki gibi kalır ("Talep Oluştur"): satın alma henüz sunulmuyor.
 *                        Varsayılan KAPALI; NEXT_PUBLIC_PAYMENT_SOON=true ile açılır.
 *
 *  ACCOUNTS_ENABLED      Üyelik (kayıt / giriş / hesabım). Varsayılan AÇIK;
 *                        NEXT_PUBLIC_ACCOUNTS_ENABLED=false ile kapatılır.
 *                        B2B'ye bağlı hesap sayfası (sertifikalar)
 *                        TRANSACTIONS_ENABLED açılana kadar gizli kalır.
 */
export const TRANSACTIONS_ENABLED =
  process.env.NEXT_PUBLIC_TRANSACTIONS_ENABLED === "true";

export const REQUESTS_ENABLED =
  process.env.NEXT_PUBLIC_REQUESTS_ENABLED !== "false";

export const SALES_ENABLED = process.env.NEXT_PUBLIC_SALES_ENABLED === "true";

export const PAYMENT_SOON =
  process.env.NEXT_PUBLIC_PAYMENT_SOON === "true" && REQUESTS_ENABLED;

export const ACCOUNTS_ENABLED =
  process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED !== "false";

/**
 * Google ile giriş — Supabase'de Google sağlayıcısı yapılandırılmadan buton
 * gösterilirse "provider is not enabled" hatası verir. Sağlayıcı kurulunca
 * NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true ile açılır.
 */
export const GOOGLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

/**
 * Talep akışı rotaları — tek yerden yönetilir.
 *
 * "Satın Al / Talep Oluştur" çağrıları doğrudan Proje Uygulama Sahalarına gider
 * (`hub` = `openLand`); kendi arazi başvurusu `/kendi-arazim` sayfasındadır (tek kaynak:
 * `OWN_LAND_HREF`). Ayrı bir seçim sayfası (eski /talep) ve tohum talebi (eski
 * /talep/tohum) kaldırıldı; ikisi de `RETIRED_REQUEST_REDIRECTS` ile sahalara yönlenir.
 * Eski başvuru adresi /talep/arazime-ekim `RETIRED_PAGE_REDIRECTS` ile kalıcı olarak
 * /kendi-arazim'e yönlenir.
 */
export const REQUEST_ROUTES = {
  hub: "/sahalar",
  land: OWN_LAND_HREF,
  openLand: "/sahalar",
} as const;

/**
 * Kaldırılan talep adresleri → yeni hedef (middleware uygular, dil öneki korunur).
 * `/talep/acik-arazi?saha=<slug>` doğrudan o sahanın sihirbazına gider (middleware).
 */
export const RETIRED_REQUEST_REDIRECTS: Record<string, string> = {
  "/talep": REQUEST_ROUTES.openLand,
  "/talep/tohum": REQUEST_ROUTES.openLand,
  "/talep/acik-arazi": REQUEST_ROUTES.openLand,
};

export type RequestRouteKey = keyof typeof REQUEST_ROUTES;

/**
 * Sipariş niyetli CTA'lar için hedef: Proje Uygulama Sahaları (oradan sahanın sihirbazı
 * `/sahalar/<slug>/katil` açılır — satış açıksa sipariş, değilse talep kipinde). Talep de
 * satış da kapalıysa /yakinda. Eski satın alma akışına (/bireysel/*) HİÇBİR çağrı gitmez.
 */
export function orderCtaHref(kind: RequestRouteKey = "hub"): string {
  if (REQUESTS_ENABLED || SALES_ENABLED) return REQUEST_ROUTES[kind];
  return "/yakinda";
}

/**
 * CTA'lar "satın al" mı "talep oluştur" mu "yakında" mı diyecek — metin seçimi için.
 * "order" yeni satış modelinin bayrağına (SALES_ENABLED) bağlıdır; eski tohum satışı bayrağı
 * (TRANSACTIONS_ENABLED) çağrı metnini etkilemez. Çağrıların hedefi her kipte aynıdır: /sahalar
 * (sahanın sihirbazı, sipariş alınamıyorsa talep kipinde açılır). PAYMENT_SOON çağrı metnini değiştirmez:
 * ödeme açık olmadığı için "Satın Al" denmez.
 */
export type CtaMode = "order" | "request" | "soon";
export const CTA_MODE: CtaMode = SALES_ENABLED
  ? "order"
  : REQUESTS_ENABLED
    ? "request"
    : "soon";

/* ── Askıya alınmış rotalar ──────────────────────────────────────────────── */

/** B2B sayfaları (kurumsal teklif → ödeme → çalışan sertifikaları) — TRANSACTIONS_ENABLED kapalıyken /yakinda'ya gider. */
const TRANSACTION_ROUTE_PATTERNS: RegExp[] = [
  /^\/kurumsal$/,                   // kurumsal app girişi
  /^\/kurumsal\/giris(\/.*)?$/,     // kurumsal giriş
  /^\/kurumsal\/panel(\/.*)?$/,     // kurumsal panel (ödeme gerektirir)
  /^\/kurumsal\/teklif-al(\/.*)?$/, // hesap yaratan B2B teklif formu
  /^\/fatura(\/.*)?$/,              // sipariş belgesi (B2B; resmî e-Arşiv faturası değil)
  /^\/orman(\/.*)?$/,               // şirket ormanı sayfası
];

/**
 * KALDIRILAN ya da TAŞINAN sayfalar → yeni karşılıkları: eski bireysel tohum satışı (Faz 8) ve
 * eski kendi arazi başvuru adresi. Middleware kalıcı (308) yönlendirir, dil öneki korunur: eski
 * yer imleri ve arama sonuçları 404'e düşmesin. Bayrak denetiminden ÖNCE uygulanır; talep kapalıysa
 * yeni adres ayrıca /yakinda'ya gider.
 */
const RETIRED_PAGE_REDIRECTS: [RegExp, string][] = [
  [/^\/talep\/arazime-ekim\/?$/, OWN_LAND_HREF],
  [/^\/bireysel(\/.*)?$/, "/sahalar"],
  [/^\/lands(\/.*)?$/, "/sahalar"],
  [/^\/checkout(\/.*)?$/, "/"],
  [/^\/kargo-takip(\/.*)?$/, "/"],
  [/^\/davet(\/.*)?$/, "/"],
  [/^\/bakim\/?$/, "/"],
  [/^\/hesabim\/(siparislerim|rezervasyonlar|davet-et|davet-et-kazan|telemetri)(\/.*)?$/, "/hesabim"],
];

/** Kaldırılmış eski sayfaysa yeni hedefi, değilse null. */
export function retiredPageRedirect(pathname: string): string | null {
  return RETIRED_PAGE_REDIRECTS.find(([re]) => re.test(pathname))?.[1] ?? null;
}

/** Üyelik rotaları — ACCOUNTS_ENABLED kapalıyken /yakinda'ya gider. */
const ACCOUNT_ROUTE_PATTERNS: RegExp[] = [
  /^\/hesabim(\/.*)?$/,
  /^\/auth(\/.*)?$/,
];

/**
 * Hesabım altındaki, yalnız B2B açıkken anlamlı sayfa (çalışan sertifikaları). Üyelik açık ama
 * B2B kapalıyken /hesabim'a yönlendirilir (boş sertifika ekranı gösterilmez).
 */
const TRANSACTION_ONLY_ACCOUNT_PATTERNS: RegExp[] = [/^\/hesabim\/sertifikalar(\/.*)?$/];

/** Talep akışı rotaları — REQUESTS_ENABLED kapalıyken /yakinda'ya gider ve sitemap'e girmez. */
const REQUEST_ROUTE_PATTERNS: RegExp[] = [/^\/talep(\/.*)?$/, /^\/kendi-arazim$/];


/** Bayraklara göre bu yol şu an /yakinda'ya yönlenmeli mi? */
export function isSuspendedRoute(pathname: string): boolean {
  if (!TRANSACTIONS_ENABLED && TRANSACTION_ROUTE_PATTERNS.some((re) => re.test(pathname))) return true;
  if (!ACCOUNTS_ENABLED && ACCOUNT_ROUTE_PATTERNS.some((re) => re.test(pathname))) return true;
  if (!REQUESTS_ENABLED && REQUEST_ROUTE_PATTERNS.some((re) => re.test(pathname))) return true;
  return false;
}

/* ── API uçları (middleware, sayfa kontrollerinden ÖNCE uygular) ─────────── */

/**
 * Eski bireysel tohum satışının API uçları — KALICI OLARAK KAPALI (410 Gone).
 * Sayfaları /yakinda'ya gidiyordu ama uçları bayrağa bakmadan herkese açıktı: kimliksiz
 * çağrıyla sahalarda kapasite ayrılabiliyor, sipariş/ödeme kaydı açılabiliyor, bir saha
 * "dolu" yapılabiliyordu. Kodları Faz 8 temizliğinde silinir.
 */
const RETIRED_API_PATTERNS: RegExp[] = [
  /^\/api\/payment\/guest-checkout\/?$/,
  /^\/api\/payment\/checkout\/?$/,
  /^\/api\/payment\/status\/?$/,
  /^\/api\/auth\/claim-order\/?$/,           // tekil; yeni modelin claim-orders ucu açık kalır
  /^\/api\/orders\/(reserve|release)\/?$/,
  /^\/api\/public\/orders\/track\/?$/,
  /^\/api\/public\/referral(\/.*)?$/,
  /^\/api\/public\/settings\/?$/,
  /^\/api\/public\/catalog\/?$/,
];

/**
 * B2B API uçları — B2B sayfalarıyla aynı bayrağa bağlı: TRANSACTIONS_ENABLED kapalıyken
 * 503 "closed". B2B akışı korunuyor; açılmadan önce veritabanı politikaları (kurumsal teklif
 * ekleme, sertifika okuma) sıkılaştırılmalı.
 */
const B2B_API_PATTERNS: RegExp[] = [
  /^\/api\/payment\/b2b-checkout\/?$/,
  /^\/api\/payment\/callback\/?$/,
  /^\/api\/kurumsal(\/.*)?$/,
  /^\/api\/orders\/invoice(\/.*)?$/,
  /^\/api\/public\/sertifika(\/.*)?$/,
  /^\/api\/public\/orman(\/.*)?$/,
  /^\/api\/embed\/rozet(\/.*)?$/,
];

/** Kalıcı olarak kapatılmış eski API ucu mu? (410) */
export function isRetiredApi(pathname: string): boolean {
  return RETIRED_API_PATTERNS.some((re) => re.test(pathname));
}

/** Bayrak kapalıyken kapalı olan B2B API ucu mu? (503) */
export function isSuspendedApi(pathname: string): boolean {
  return !TRANSACTIONS_ENABLED && B2B_API_PATTERNS.some((re) => re.test(pathname));
}

/** Üyelik açık ama ödeme kapalıyken /hesabim'a katlanacak alt sayfalar. */
export function isTransactionOnlyAccountRoute(pathname: string): boolean {
  return !TRANSACTIONS_ENABLED && TRANSACTION_ONLY_ACCOUNT_PATTERNS.some((re) => re.test(pathname));
}
