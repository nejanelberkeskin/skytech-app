/**
 * Sipariş sayfası erişim belirteci — YALNIZ SUNUCU.
 *
 * Misafir müşteri siparişine e-postadaki bağlantıyla erişir: `/siparis/<no>?t=<belirteç>`.
 * Belirteç, siparişin UUID'sinin gizli anahtarla HMAC-SHA256 imzasıdır; sipariş
 * numarasını bilmek ya da tahmin etmek erişim sağlamaz. Anahtar: ORDER_LINK_SECRET
 * (önerilen); yoksa service role anahtarından türetilir (anahtarın kendisi hiçbir
 * yere yazılmaz). Belirteç süresizdir: sayfa kimlik/vergi no ve ödeme verisi göstermez.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function secret(): string | null {
  if (process.env.ORDER_LINK_SECRET) return process.env.ORDER_LINK_SECRET;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? createHash("sha256").update(`order-link:${key}`).digest("hex") : null;
}

export function signOrderToken(orderId: string): string | null {
  const s = secret();
  if (!s) return null;
  return createHmac("sha256", s).update(`order:${orderId}`).digest("base64url").slice(0, 32);
}

export function verifyOrderToken(orderId: string, token: string | null | undefined): boolean {
  if (!token || token.length !== 32) return false;
  const expected = signOrderToken(orderId);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Dil önekli sipariş sayfası yolu (belirteçli). */
export function orderPagePath(orderNo: string, orderId: string, locale: string): string {
  const prefix = locale === "tr" ? "" : `/${locale}`;
  const token = signOrderToken(orderId);
  return `${prefix}/siparis/${orderNo}${token ? `?t=${token}` : ""}`;
}

/** Ödeme sonucu sayfası (başarılı / başarısız / süresi doldu) — dil önekli, belirteçli. */
export function paymentResultPath(orderNo: string, orderId: string, locale: string): string {
  const prefix = locale === "tr" ? "" : `/${locale}`;
  const token = signOrderToken(orderId);
  return `${prefix}/odeme/sonuc/${orderNo}${token ? `?t=${token}` : ""}`;
}

/* ── Erişim çerezi ────────────────────────────────────────────────────────────
   E-postadaki bağlantı (`?t=`) ilk açılışta doğrulanır, belirteç adres çubuğundan silinir.
   Sayfa yenilendiğinde ya da dil değiştirildiğinde erişim kaybolmasın diye aynı belirteç
   yalnız sunucunun okuyabildiği (HttpOnly) bir çerezde tutulur. Çerez yeni bir yetki
   VERMEZ: değeri yine imza doğrulamasından geçer; çalınması bağlantının çalınmasıyla aynıdır. */
export const orderCookieName = (orderNo: string) => `sgo_${orderNo}`;

export function orderCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  };
}
