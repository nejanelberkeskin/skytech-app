import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * ════════════════════════════════════════════════════════════════════════
 * SSR Middleware — Supabase session yönetimi + rota koruma
 * ════════════════════════════════════════════════════════════════════════
 *
 * Akış:
 *   1. API ödeme rotaları → anında NextResponse.next() (Iyzico callback/webhook)
 *   2. updateSession()   → Supabase cookie token yenileme (tüm sayfalar için şart)
 *   3. Herkese açık rotalar → response döner, auth redirect YOK
 *   4. Bakım modu kontrolü (/bireysel/*)
 *   5. Korumalı rotalar → oturum yoksa login'e yönlendir
 *   6. Auth sayfaları → oturum varsa ilgili panele yönlendir
 */

/* ── Herkese açık sayfa rotaları ─────────────────────────────────────────
   Bu kalıplardan birine uyan rota; updateSession() çalıştırılır (cookie
   yenileme), ancak "oturum yok → redirect" kuralı UYGULANMAZ.
   Misafir kullanıcılar bu sayfalara oturumsuz erişebilir.
   ──────────────────────────────────────────────────────────────────────── */
const PUBLIC_PAGE_PATTERNS: RegExp[] = [
  /^\/$/,                          // Vitrin ana sayfa
  /^\/checkout(\/.*)?$/,           // Ödeme başarı / hata ekranları
  /^\/sertifika(\/.*)?$/,          // Herkese açık dinamik sertifika sayfaları
  /^\/kargo-takip(\/.*)?$/,        // Misafir kargo takip portalı (Magic Link)
  /^\/bireysel\/odeme(\/.*)?$/,    // Misafir ödeme formu — Iyzico 3DS geri dönüşü
  /^\/davet(\/.*)?$/,              // Referral / davet landing sayfaları
  /^\/fatura(\/.*)?$/,             // Fatura görüntüleme (auth API route koruyor)
  // Vitrin (pazarlama) sayfaları — herkese açık, auth gerektirmez
  /^\/tohum-topu(\/.*)?$/,
  /^\/dron-teknolojisi(\/.*)?$/,
  /^\/karbon-programi(\/.*)?$/,
  /^\/projeler(\/.*)?$/,
  /^\/kurumsal-cozumler(\/.*)?$/,
  /^\/hakkimizda(\/.*)?$/,
  /^\/iletisim(\/.*)?$/,
  /^\/bilgi-al(\/.*)?$/,
];

/* ── Herkese açık API önekleri ───────────────────────────────────────────
   Bu öneklerle başlayan API istekleri; updateSession() bile çalıştırılmaz,
   doğrudan NextResponse.next() ile geçirilir.
   Kritik: Iyzico 3DS callback ve webhook POST istekleri auth engeline
   çarptırılmamalı; aksi halde 401/500 alınır ve ödeme kaydı oluşmaz.
   ──────────────────────────────────────────────────────────────────────── */
const PUBLIC_API_PREFIXES: string[] = [
  "/api/payment/callback",       // Iyzico 3DS callback/webhook
  "/api/payment/guest-checkout", // Misafir ödeme başlatma
  "/api/payment/checkout",       // Üye ödeme başlatma
  "/api/payment/b2b-checkout",   // B2B ödeme başlatma
  "/api/payment/status",         // Ödeme durum sorgulama
  "/api/public/",                // Herkese açık veri endpoint'leri (ayarlar, referral, track)
  "/api/auth/",                  // claim-order — signUp sonrası session henüz oturmamış olabilir
];

/* ── Yardımcı fonksiyonlar ──────────────────────────────────────────────── */
function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGE_PATTERNS.some((re) => re.test(pathname));
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/* ════════════════════════════════════════════════════════════════════════
   Middleware
   ════════════════════════════════════════════════════════════════════════ */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ── 1. Ödeme API'leri: anında geçiş (session işlemi yok) ───────────────
     Iyzico'nun bize attığı her türlü POST (3DS callback, webhook, guest-checkout)
     hiçbir auth veya cookie katmanına takılmamalı.
     Matcher'a eklenmemiş olsalar da bu katman ek güvence sağlar.
     ────────────────────────────────────────────────────────────────────── */
  if (isPublicApi(pathname)) {
    return NextResponse.next();
  }

  /* ── 1b. CSRF Koruması: Admin API mutation istekleri ────────────────────
     POST/PUT/DELETE isteklerinde Origin header'ı kontrol et.
     Origin, uygulamanın kendi origin'i ile eşleşmeli.
     Iyzico callback'leri yukarıda isPublicApi ile zaten bypass ediliyor.
     ────────────────────────────────────────────────────────────────────── */
  if (
    pathname.startsWith("/api/admin/") &&
    ["POST", "PUT", "DELETE"].includes(request.method)
  ) {
    const origin  = request.headers.get("origin");
    const appHost = request.nextUrl.origin;

    // Origin header yoksa veya eşleşmiyorsa → 403
    if (!origin || origin !== appHost) {
      return NextResponse.json(
        { error: "CSRF doğrulaması başarısız. İstek reddedildi." },
        { status: 403 }
      );
    }
  }

  /* ── 2. Supabase session yenileme ───────────────────────────────────────
     Token rotation için updateSession her rota için çalıştırılmalı.
     "user" null olabilir — aşağıdaki guard'lar buna göre karar verir.
     ────────────────────────────────────────────────────────────────────── */
  const { user, response } = await updateSession(request);

  /* ── 3. Herkese açık sayfa rotaları: auth redirect YOK ─────────────────
     Session yenileme tamamlandı, ancak oturum yoksa bile misafirler geçebilir.
     Örnekler: /checkout/success, /bireysel/odeme, /kargo-takip, /sertifika/xxx
     ────────────────────────────────────────────────────────────────────── */
  if (isPublicPage(pathname)) {
    return response;
  }

  /* ── 4. Bakım Modu: B2C sayfalarını bloke et ────────────────────────────
     /bireysel/* rotaları maintenance_mode aktifse /bakim'e yönlenir.
     Not: /bireysel/odeme yukarıda public olarak yakalanır; buraya ulaşamaz.
     ────────────────────────────────────────────────────────────────────── */
  if (pathname.startsWith("/bireysel")) {
    try {
      const settingsRes = await fetch(
        `${request.nextUrl.origin}/api/public/settings`,
        { next: { revalidate: 30 } }
      );
      if (settingsRes.ok) {
        const settings = (await settingsRes.json()) as { maintenance_mode?: boolean };
        if (settings.maintenance_mode) {
          return NextResponse.rewrite(new URL("/bakim", request.url));
        }
      }
    } catch {
      // Ayarlar çekilemezse geç — siteyi bloke etme
    }
  }

  /* ── 5. Korumalı rotalar ─────────────────────────────────────────────── */

  // /hesabim/* — bireysel üye paneli
  if (pathname.startsWith("/hesabim")) {
    if (!user) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // /admin/* (giriş sayfası hariç) — yönetici paneli
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/giris")) {
    if (!user) {
      return NextResponse.redirect(new URL("/admin/giris", request.url));
    }
    // Rol kontrolü client-side AdminProvider + RoleGuard ile yapılıyor
    return response;
  }

  // /kurumsal/panel/* — kurumsal panel (giriş sayfası bu bloka girmez)
  if (pathname.startsWith("/kurumsal/panel")) {
    if (!user) {
      return NextResponse.redirect(new URL("/kurumsal/giris", request.url));
    }
    return response;
  }

  /* ── 6. Auth yönlendirme sayfaları ──────────────────────────────────────
     Oturum açıksa kullanıcıyı ilgili panele yönlendir.
     ────────────────────────────────────────────────────────────────────── */

  // /auth/login veya /auth/register → hesabim
  if (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register")) {
    if (user) {
      return NextResponse.redirect(new URL("/hesabim", request.url));
    }
    return response;
  }

  // /admin/giris → admin panel
  if (pathname === "/admin/giris") {
    if (user) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return response;
  }

  // /kurumsal/giris → kurumsal panel
  if (pathname === "/kurumsal/giris") {
    if (user) {
      return NextResponse.redirect(new URL("/kurumsal/panel", request.url));
    }
    return response;
  }

  return response;
}

/* ════════════════════════════════════════════════════════════════════════
   Matcher — middleware'in hangi rota kalıplarında çalışacağını belirler.

   KURAL: Matcher'a eklenen rotalar için middleware çalışır.
          Matcher'a EKLENMEYENler için middleware hiç çalışmaz
          (en verimli yol — /sertifika, /kargo-takip, /davet, /api/* bunlarda).
          Yine de PUBLIC_PAGE_PATTERNS ve PUBLIC_API_PREFIXES listeleri
          matcher genişletildiğinde savunma katmanı olarak koruma sağlar.
   ════════════════════════════════════════════════════════════════════════ */
export const config = {
  matcher: [
    /*
     * Şu ön ekleri HARİÇ TUT (Next.js static dosya ve sistem rotaları):
     *   - _next/static  (statik dosyalar)
     *   - _next/image   (resim optimizasyon)
     *   - favicon.ico
     *   - .svg / .png / .jpg gibi statik kaynaklar
     *
     * Sonra aşağıdaki uygulama rotaları için middleware çalıştır:
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
    /*
     * Alternatif: eğer performans kritikse daha dar bir matcher kullanılabilir:
     *
     * "/hesabim/:path*",
     * "/admin/:path*",
     * "/kurumsal/:path*",
     * "/auth/:path*",
     * "/bireysel/:path*",
     * "/checkout/:path*",
     *
     * Dar matcher'da /sertifika, /kargo-takip, /davet, /fatura rotaları
     * matcher dışında kalır (middleware çalışmaz = zaten public).
     * Ancak PUBLIC_PAGE_PATTERNS güvencesi de çalışmaz — iki seçenek de doğru.
     */
  ],
};
