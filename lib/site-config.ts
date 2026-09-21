/**
 * Site genel yapılandırması — özellik bayrakları ve rota yardımcıları.
 *
 * Bağımsız aşamalar:
 *
 *  TRANSACTIONS_ENABLED  Sipariş / ödeme / kurumsal panel. Şu an KAPALI —
 *                        fiyat ve ödeme "çok yakında". Vercel'de
 *                        NEXT_PUBLIC_TRANSACTIONS_ENABLED=true ile açılır.
 *
 *  REQUESTS_ENABLED      Ödeme almadan talep toplama (/talep/*): Proje Uygulama
 *                        Sahasına tohum topu bıraktırma talebi ve kendi arazi
 *                        başvurusu. Varsayılan AÇIK;
 *                        NEXT_PUBLIC_REQUESTS_ENABLED=false ile kapatılır.
 *                        (Doğrudan tohum satışı/talebi 2026-09 itibarıyla yok.)
 *
 *  SALES_ENABLED         Yeni satış modeli: sahaya tohum topu bıraktırma siparişi,
 *                        çevrim içi ödeme, sözleşme ve fatura. Şu an KAPALI; sanal
 *                        POS ve e-fatura hazır olunca NEXT_PUBLIC_SALES_ENABLED=true
 *                        ile açılır. Kapalıyken sipariş sihirbazı aynı arayüzle
 *                        ödeme almadan TALEP toplar (REQUESTS_ENABLED).
 *                        (TRANSACTIONS_ENABLED eski akışa aittir; o akış emekli olacak.)
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

export const SALES_ENABLED = process.env.NEXT_PUBLIC_SALES_ENABLED === "true";

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
 * (`hub` = `openLand`); kendi arazi başvurusu o sayfanın üstündeki küçük
 * bağlantıdan açılır. Ayrı bir seçim sayfası (eski /talep) ve tohum talebi
 * (eski /talep/tohum) kaldırıldı; ikisi de `RETIRED_REQUEST_REDIRECTS` ile
 * sahalara yönlenir.
 */
export const REQUEST_ROUTES = {
  hub: "/talep/acik-arazi",
  land: "/talep/arazime-ekim",
  openLand: "/talep/acik-arazi",
} as const;

/** Kaldırılan talep adresleri → yeni hedef (middleware uygular, dil öneki korunur). */
export const RETIRED_REQUEST_REDIRECTS: Record<string, string> = {
  "/talep": REQUEST_ROUTES.openLand,
  "/talep/tohum": REQUEST_ROUTES.openLand,
};

export type RequestRouteKey = keyof typeof REQUEST_ROUTES;

/**
 * Sipariş niyetli CTA'lar için hedef: talep toplama açıksa /talep/*, kapalıysa
 * /yakinda. Eski satın alma akışına (/bireysel/*) artık HİÇBİR çağrı gitmez —
 * o akış doğrudan tohum satıyordu; yeni sipariş sihirbazı yayına girdiğinde
 * hedef burada tek yerden değişir.
 */
export function orderCtaHref(kind: RequestRouteKey = "hub"): string {
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

/** Bayraklara göre bu yol şu an /yakinda'ya yönlenmeli mi? */
export function isSuspendedRoute(pathname: string): boolean {
  if (!TRANSACTIONS_ENABLED && TRANSACTION_ROUTE_PATTERNS.some((re) => re.test(pathname))) return true;
  if (!ACCOUNTS_ENABLED && ACCOUNT_ROUTE_PATTERNS.some((re) => re.test(pathname))) return true;
  if (!REQUESTS_ENABLED && REQUEST_ROUTE_PATTERNS.some((re) => re.test(pathname))) return true;
  return false;
}

/** Üyelik açık ama ödeme kapalıyken /hesabim'a katlanacak alt sayfalar. */
export function isTransactionOnlyAccountRoute(pathname: string): boolean {
  return !TRANSACTIONS_ENABLED && TRANSACTION_ONLY_ACCOUNT_PATTERNS.some((re) => re.test(pathname));
}
