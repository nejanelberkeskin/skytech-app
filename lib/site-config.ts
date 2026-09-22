/**
 * Site genel yapılandırması — özellik bayrakları ve rota yardımcıları.
 *
 * Üç bağımsız aşama var:
 *
 *  TRANSACTIONS_ENABLED  Sipariş / ödeme / kurumsal panel. Şu an KAPALI —
 *                        fiyat ve ödeme "çok yakında". Vercel'de
 *                        NEXT_PUBLIC_TRANSACTIONS_ENABLED=true ile açılır.
 *
 *  REQUESTS_ENABLED      Ödeme almadan talep toplama (/talep/*): tohum talebi,
 *                        arazime ekim başvurusu, açık araziye tohum talebi.
 *                        Varsayılan AÇIK; NEXT_PUBLIC_REQUESTS_ENABLED=false
 *                        ile kapatılır.
 *
 *  ACCOUNTS_ENABLED      Üyelik (kayıt / giriş / hesabım). Varsayılan AÇIK;
 *                        NEXT_PUBLIC_ACCOUNTS_ENABLED=false ile kapatılır.
 *                        Ödemeye bağlı hesap sayfaları (siparişler, sertifikalar,
 *                        davet) TRANSACTIONS_ENABLED açılana kadar gizli kalır.
 */
export const TRANSACTIONS_ENABLED =
  process.env.NEXT_PUBLIC_TRANSACTIONS_ENABLED === "true";

export const REQUESTS_ENABLED =
  process.env.NEXT_PUBLIC_REQUESTS_ENABLED !== "false";

export const ACCOUNTS_ENABLED =
  process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED !== "false";

/**
 * Google ile giriş — Supabase'de Google sağlayıcısı yapılandırılmadan buton
 * gösterilirse "provider is not enabled" hatası verir. Sağlayıcı kurulunca
 * NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true ile açılır.
 */
export const GOOGLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

/** Talep akışı rotaları — tek yerden yönetilir. */
export const REQUEST_ROUTES = {
  hub: "/talep",
  seed: "/talep/tohum",
  land: "/talep/arazime-ekim",
  openLand: "/talep/acik-arazi",
} as const;

export type RequestRouteKey = keyof typeof REQUEST_ROUTES;

/**
 * Sipariş niyetli CTA'lar için hedef: ödeme açıksa eski satın alma akışı,
 * talep toplama açıksa /talep/*, ikisi de kapalıysa /yakinda.
 */
export function orderCtaHref(kind: RequestRouteKey = "hub"): string {
  if (TRANSACTIONS_ENABLED) {
    if (kind === "seed") return "/bireysel/satin-al/siparis";
    if (kind === "openLand") return "/bireysel/satin-al/arazi";
    return "/bireysel/satin-al";
  }
  if (REQUESTS_ENABLED) return REQUEST_ROUTES[kind];
  return "/yakinda";
}

/** CTA'lar "talep" mi "sipariş" mi "yakında" mı diyecek — metin seçimi için. */
export type CtaMode = "order" | "request" | "soon";
export const CTA_MODE: CtaMode = TRANSACTIONS_ENABLED
  ? "order"
  : REQUESTS_ENABLED
    ? "request"
    : "soon";

/* ── Askıya alınmış rotalar ──────────────────────────────────────────────── */

/** Ödeme/sipariş akışları — TRANSACTIONS_ENABLED kapalıyken /yakinda'ya gider. */
const TRANSACTION_ROUTE_PATTERNS: RegExp[] = [
  /^\/bireysel(\/.*)?$/,            // sipariş + ödeme akışı
  /^\/checkout(\/.*)?$/,            // ödeme sonuç ekranları
  /^\/kurumsal$/,                   // kurumsal app girişi
  /^\/kurumsal\/giris(\/.*)?$/,     // kurumsal giriş
  /^\/kurumsal\/panel(\/.*)?$/,     // kurumsal panel (ödeme gerektirir)
  /^\/kurumsal\/teklif-al(\/.*)?$/, // hesap yaratan B2B teklif formu
  /^\/lands(\/.*)?$/,               // arazi rezervasyonu
  /^\/kargo-takip(\/.*)?$/,         // sipariş yoksa kargo da yok
];

/** Üyelik rotaları — ACCOUNTS_ENABLED kapalıyken /yakinda'ya gider. */
const ACCOUNT_ROUTE_PATTERNS: RegExp[] = [
  /^\/hesabim(\/.*)?$/,
  /^\/auth(\/.*)?$/,
];

/**
 * Hesabım altındaki, yalnız ödeme açıkken anlamlı sayfalar. Üyelik açık ama
 * ödeme kapalıyken /hesabim'a yönlendirilir (boş sipariş/sertifika ekranı
 * gösterilmez).
 */
const TRANSACTION_ONLY_ACCOUNT_PATTERNS: RegExp[] = [
  /^\/hesabim\/(siparislerim|rezervasyonlar|sertifikalar|davet-et|davet-et-kazan|telemetri)(\/.*)?$/,
];

/** Talep akışı rotaları — REQUESTS_ENABLED kapalıyken /yakinda'ya gider. */
const REQUEST_ROUTE_PATTERNS: RegExp[] = [/^\/talep(\/.*)?$/];

/** Geriye dönük uyumluluk: eski adıyla dışa açık liste (ödeme rotaları). */
export const SUSPENDED_ROUTE_PATTERNS = TRANSACTION_ROUTE_PATTERNS;

/**
 * B2B'nin (kurumsal teklif → ödeme → çalışan sertifikaları) herkese açık görünen sayfaları —
 * B2B'nin öteki sayfaları gibi TRANSACTIONS_ENABLED kapalıyken /yakinda'ya gider.
 */
const B2B_PAGE_PATTERNS: RegExp[] = [
  /^\/fatura(\/.*)?$/,              // sipariş belgesi (yer tutucu satıcı bilgisi içeriyor)
  /^\/orman(\/.*)?$/,               // şirket ormanı sayfası
];

/** Bayraklara göre bu yol şu an /yakinda'ya yönlenmeli mi? */
export function isSuspendedRoute(pathname: string): boolean {
  if (!TRANSACTIONS_ENABLED && TRANSACTION_ROUTE_PATTERNS.some((re) => re.test(pathname))) return true;
  if (!TRANSACTIONS_ENABLED && B2B_PAGE_PATTERNS.some((re) => re.test(pathname))) return true;
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
