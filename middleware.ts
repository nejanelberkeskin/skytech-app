import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { TRANSACTIONS_ENABLED, isSuspendedRoute } from "@/lib/site-config";

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
  /^\/sertifika(\/.*)?$/,
  /^\/kargo-takip(\/.*)?$/,
  /^\/bireysel\/odeme(\/.*)?$/,
  /^\/davet(\/.*)?$/,
  /^\/fatura(\/.*)?$/,
  /^\/tohum-topu(\/.*)?$/,
  /^\/tohumlarimiz(\/.*)?$/,
  /^\/dron-teknolojisi(\/.*)?$/,
  /^\/karbon-programi(\/.*)?$/,
  /^\/projeler(\/.*)?$/,
  /^\/kurumsal-cozumler(\/.*)?$/,
  /^\/hakkimizda(\/.*)?$/,
  /^\/iletisim(\/.*)?$/,
  /^\/bilgi-al(\/.*)?$/,
  /^\/yakinda(\/.*)?$/,
];

const PUBLIC_API_PREFIXES: string[] = [
  "/api/payment/callback",
  "/api/payment/guest-checkout",
  "/api/payment/checkout",
  "/api/payment/b2b-checkout",
  "/api/payment/status",
  "/api/public/",
  "/api/auth/",
];

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGE_PATTERNS.some((re) => re.test(pathname));
}
function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

const CSRF_EXEMPT_PREFIXES = ["/api/payment/callback"] as const;
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ── 1. API rotaları: locale prefix yok, mevcut logic ──────────────── */
  if (pathname.startsWith("/api/")) {
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

  /* ── 2b. Askıya alınmış akışlar: sipariş / ödeme / hesap → /yakinda ────
     TRANSACTIONS_ENABLED kapalıyken tüm transactional rotalar (bireysel,
     checkout, hesabim, auth, kurumsal giriş/panel/teklif) /yakinda'ya
     yönlendirilir. Admin paneli bilinçli olarak kapsam DIŞINDA.
     ────────────────────────────────────────────────────────────────────── */
  if (!TRANSACTIONS_ENABLED && isSuspendedRoute(cleanPath)) {
    return NextResponse.redirect(new URL(localePath("/yakinda", locale), request.url));
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
      return NextResponse.redirect(new URL(localePath("/hesabim", locale), request.url));
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
    // Static assets ve favicon'u hariç tut
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
