import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { RETIRED_REQUEST_REDIRECTS, isRetiredApi, isSuspendedApi, isSuspendedRoute, isTransactionOnlyAccountRoute } from "@/lib/site-config";

/**
 * ════════════════════════════════════════════════════════════════════════
 * Middleware — Locale routing + Supabase session + Auth + CSRF
 * ════════════════════════════════════════════════════════════════════════
 *
 * Akış:
 *   1. /api/* rotaları için CSRF + public API bypass + auth (mevcut)
 *   2. Sayfa rotaları için önce next-intl ile locale routing
 *   3. Locale prefix'i strip ederek mevcut auth/redirect logic'i uygula
 *   4. Korumalı rotalar (hesabim, kurumsal/panel, admin) auth zorunlu
 */

const intlMiddleware = createIntlMiddleware(routing);

// Locale prefix'i pathname'den kaldır → "/en/hesabim" → "/hesabim"
function stripLocale(pathname: string): string {
  const match = pathname.match(/^\/(tr|en|ru)(\/|$)(.*)$/);
  if (!match) return pathname;
  const rest = match[3] || "";
  return "/" + rest;
}

// Aktif locale'i pathname'den çıkar; default "tr"
function getLocaleFromPath(pathname: string): string {
  const match = pathname.match(/^\/(tr|en|ru)(\/|$)/);
  return match ? match[1] : "tr";
}

// /en/hesabim, /ru/auth/login gibi yolları doğru locale prefix'i ile rebuild
function localePath(path: string, locale: string): string {
  if (locale === "tr") return path;
  return `/${locale}${path}`;
}

/* ── Herkese açık sayfa rotaları (locale prefix'siz canonik form) ────── */
const PUBLIC_PAGE_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/checkout(\/.*)?$/,
  // Ödeme sonucu ve (yalnız deneme kipinde) deneme ödeme sayfası — misafir müşteri de görür
  /^\/odeme(\/.*)?$/,
  /^\/sertifika(\/.*)?$/,
  /^\/siparis(\/.*)?$/,
  /^\/cayma$/,
  /^\/kargo-takip(\/.*)?$/,
  /^\/bireysel\/odeme(\/.*)?$/,
  /^\/davet(\/.*)?$/,
  /^\/fatura(\/.*)?$/,
  /^\/tohum-topu(\/.*)?$/,
  /^\/tohumlarimiz(\/.*)?$/,
  /^\/dron-teknolojisi(\/.*)?$/,
  /^\/karbon-programi(\/.*)?$/,
  /^\/projeler(\/.*)?$/,
  /^\/sahalar(\/.*)?$/,
  /^\/kurumsal-cozumler(\/.*)?$/,
  /^\/hakkimizda(\/.*)?$/,
  /^\/iletisim(\/.*)?$/,
  /^\/bilgi-al(\/.*)?$/,
  /^\/talep(\/.*)?$/,
  /^\/yakinda(\/.*)?$/,
  /^\/gizlilik-politikasi$/,
  // Satış hukuk sayfaları (bayrak kapalıyken sayfanın kendisi 404 döner — lib/legal/visibility.ts)
  /^\/on-bilgilendirme$/,
  /^\/mesafeli-satis-sozlesmesi$/,
  /^\/cayma-ve-iade$/,
  /^\/ifa-kosullari$/,
  /^\/islem-rehberi$/,
  /^\/kullanim-kosullari$/,
  /^\/kvkk$/,
  /^\/cerez-politikasi$/,
];

const PUBLIC_API_PREFIXES: string[] = [
  "/api/payment/callback",
  "/api/payment/donus",
  "/api/payment/guest-checkout",
  "/api/payment/checkout",
  "/api/payment/b2b-checkout",
  "/api/payment/status",
  "/api/public/",
  "/api/auth/",
  // Zamanlanmış işler: oturumla değil CRON_SECRET başlığıyla korunur (uç kendi denetler)
  "/api/cron/",
];

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGE_PATTERNS.some((re) => re.test(pathname));
}
function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Ödeme sağlayıcısının başka kaynaktan POST ettiği dönüş uçları. Güvenlikleri Origin'e değil,
// sonucun sağlayıcıdan sunucu tarafında sorgulanmasına dayanır.
const CSRF_EXEMPT_PREFIXES = ["/api/payment/callback", "/api/payment/donus"] as const;
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ── 1. API rotaları: locale prefix yok, mevcut logic ──────────────── */
  if (pathname.startsWith("/api/")) {
    // Eski satış uçları kalıcı kapalı; B2B uçları B2B sayfalarıyla aynı bayrağa bağlı.
    // Yöntemden ve kimlikten bağımsız, her şeyden ÖNCE uygulanır.
    if (isRetiredApi(pathname)) {
      return NextResponse.json({ error: "gone" }, { status: 410 });
    }
    if (isSuspendedApi(pathname)) {
      return NextResponse.json({ error: "closed" }, { status: 503 });
    }
    // CSRF
    if (
      MUTATION_METHODS.has(request.method) &&
      !CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))
    ) {
      const origin = request.headers.get("origin");
      const appHost = request.nextUrl.origin;
      if (!origin || origin !== appHost) {
        return NextResponse.json(
          { error: "CSRF doğrulaması başarısız. İstek reddedildi." },
          { status: 403 }
        );
      }
    }
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }
    // /api/admin/* için session refresh + downstream guard
    const { response } = await updateSession(request);
    return response;
  }

  /* ── 2. Sayfa rotaları: önce next-intl locale routing ───────────────── */
  const intlResponse = intlMiddleware(request);

  // Locale-aware path normalize: "/en/hesabim" → "/hesabim"
  const cleanPath = stripLocale(pathname);
  const locale = getLocaleFromPath(pathname);

  // next-intl'in internal rewrite header'ı (ör. /admin/giris → /tr/admin/giris)
  // updateSession'ın döndürdüğü response'a taşınmalı; yoksa default-locale
  // (prefix'siz) rotalar 404 verir. Korumalı sayfalar dahil her yerde kullan.
  const withIntl = (response: NextResponse): NextResponse => {
    intlResponse.headers.forEach((value, key) => {
      if (key === "x-middleware-rewrite" || key === "x-middleware-override-headers" || key.startsWith("x-middleware-request")) {
        response.headers.set(key, value);
      }
    });
    return response;
  };

  /* ── 2b. Askıya alınmış akışlar → /yakinda ─────────────────────────────
     Bayraklar lib/site-config.ts'te: ödeme rotaları (bireysel, checkout,
     kurumsal giriş/panel/teklif, lands, kargo-takip) TRANSACTIONS_ENABLED;
     üyelik (auth, hesabim) ACCOUNTS_ENABLED; talep (/talep) REQUESTS_ENABLED.
     Admin paneli bilinçli olarak kapsam DIŞINDA.
     ────────────────────────────────────────────────────────────────────── */
  if (isSuspendedRoute(cleanPath)) {
    return NextResponse.redirect(new URL(localePath("/yakinda", locale), request.url));
  }

  /* ── 2b-ii. Kaldırılan talep adresleri (eski seçim sayfası, tohum talebi, açık arazi
     talep formu) → Proje Uygulama Sahaları. Eski `?saha=<slug>` bağlantıları doğrudan o
     sahanın sihirbazına gider. Geçici (307): tarayıcı önbelleğine yapışmasın. ────────── */
  const retiredTarget = RETIRED_REQUEST_REDIRECTS[cleanPath.replace(/\/+$/, "")];
  if (retiredTarget) {
    const saha = request.nextUrl.searchParams.get("saha");
    const target = saha && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(saha) && saha.length <= 80 ? `/sahalar/${saha}/katil` : retiredTarget;
    return NextResponse.redirect(new URL(localePath(target, locale), request.url), 307);
  }

  /* ── 2c. Üyelik açık, ödeme kapalı: sipariş/sertifika/davet sayfaları
     anlamsız → /hesabim (boş ekran yerine talep özeti). ─────────────── */
  if (isTransactionOnlyAccountRoute(cleanPath)) {
    return NextResponse.redirect(new URL(localePath("/hesabim", locale), request.url));
  }

  /* ── 3. Public sayfa rotaları: auth redirect yok ────────────────────── */
  if (isPublicPage(cleanPath)) {
    // Supabase session refresh yine yapılır (cookie rotation için)
    const { response } = await updateSession(request);
    return withIntl(response);
  }

  /* ── 4. Bakım Modu: /bireysel/* ─────────────────────────────────────── */
  if (cleanPath.startsWith("/bireysel")) {
    try {
      const settingsRes = await fetch(
        `${request.nextUrl.origin}/api/public/settings`,
        { next: { revalidate: 30 } }
      );
      if (settingsRes.ok) {
        const settings = (await settingsRes.json()) as { maintenance_mode?: boolean };
        if (settings.maintenance_mode) {
          return NextResponse.rewrite(new URL(localePath("/bakim", locale), request.url));
        }
      }
    } catch {
      // ignore
    }
  }

  /* ── 5. Auth flow + korumalı rotalar ────────────────────────────────── */
  const { user, response } = await updateSession(request);

  if (cleanPath.startsWith("/hesabim")) {
    if (!user) {
      const loginUrl = new URL(localePath("/auth/login", locale), request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return withIntl(response);
  }

  if (cleanPath.startsWith("/admin") && !cleanPath.startsWith("/admin/giris")) {
    if (!user) {
      return NextResponse.redirect(new URL(localePath("/admin/giris", locale), request.url));
    }
    return withIntl(response);
  }

  if (cleanPath.startsWith("/kurumsal/panel")) {
    if (!user) {
      return NextResponse.redirect(new URL(localePath("/kurumsal/giris", locale), request.url));
    }
    return withIntl(response);
  }

  /* ── 6. Auth yönlendirme sayfaları ──────────────────────────────────── */
  if (cleanPath.startsWith("/auth/login") || cleanPath.startsWith("/auth/register")) {
    if (user) {
      // ?talep=<uuid> (misafir talebini hesaba bağlama) hesabım sayfasına taşınır
      const target = new URL(localePath("/hesabim", locale), request.url);
      const talep = request.nextUrl.searchParams.get("talep");
      if (talep && /^[0-9a-f-]{36}$/i.test(talep)) target.searchParams.set("talep", talep);
      return NextResponse.redirect(target);
    }
    return withIntl(response);
  }
  if (cleanPath === "/admin/giris") {
    if (user) {
      return NextResponse.redirect(new URL(localePath("/admin", locale), request.url));
    }
    return withIntl(response);
  }
  if (cleanPath === "/kurumsal/giris") {
    if (user) {
      return NextResponse.redirect(new URL(localePath("/kurumsal/panel", locale), request.url));
    }
    return withIntl(response);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // Static asset'ler, favicon ve metadata route'larını (sitemap/robots/manifest/
    // llms.txt) hariç tut. Bu dosyalar next-intl locale rewrite'ına girmemeli —
    // aksi halde /tr/sitemap.xml'e yönlenip 404 döner. yandex_*.html: arama motoru
    // mülkiyet doğrulama dosyaları; [32-hex].txt: IndexNow key dosyası (kök dizinde
    // servis edilmeli, locale rewrite'sız).
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest|llms\\.txt|yandex_[^/]+\\.html|[a-f0-9]{32}\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|mp4|webm|mov)$).*)",
  ],
};
