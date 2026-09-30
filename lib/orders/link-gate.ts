/**
 * Sipariş bağlantısı kapısı — middleware (Edge) ve kapı rotasının ortak kuralları. Node API'si kullanmaz.
 *
 * E-postadaki bağlantı `/siparis/<no>?t=<belirteç>`, ödeme dönüşü `/odeme/sonuc/<no>?t=<belirteç>` biçimindedir.
 * middleware bu istekleri sayfa render edilmeden kapı rotasına (`/api/public/siparis/<no>/baglanti`) yeniden yazar;
 * rota belirteci sunucuda doğrular, geçerliyse HttpOnly erişim çerezine yazar ve belirteçsiz, sabit adrese 303 ile
 * yönlendirir. Belirteç böylece HTML'e, satır içi RSC yüküne, Next yönlendirici durumuna, sayfa bağlantılarına ve alt
 * kaynak Referer başlıklarına hiç girmez; JavaScript kapalıyken de aynı çalışır. Adres temizliği istemciye bırakılmaz.
 */
import { ORDER_NO_RE } from "./types";

export type OrderLinkPage = "siparis" | "sonuc";

/** Belirteç taşıyabilen sayfa yolları: isteğe bağlı dil öneki + sipariş ya da ödeme sonucu + tek numara parçası. */
const PAGE_RE = /^\/(?:(tr|en|ru)\/)?(siparis|odeme\/sonuc)\/([^/]+)\/?$/;

/** Kapı yanıtlarının ortak başlıkları: hiçbir isteğe Referer taşınmaz, yanıt paylaşılan önbelleğe girmez. */
export const ORDER_LINK_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

/**
 * middleware → kapı rotası iç istek başlıkları. Belirteç ve hedef yeniden yazma adresinin sorgusunda TAŞINMAZ:
 * Next yeniden yazma hedefini yanıtın `x-middleware-rewrite` başlığında tarayıcıya geri yansıtır ve yeniden yazılan
 * rota sorgu olarak orijinal isteğinkini görür. İstek başlıkları (NextResponse.rewrite `request.headers`) yalnız
 * sunucu içinde iletilir, yanıta yazılmaz.
 */
export const ORDER_LINK_TOKEN_HEADER = "x-siparis-baglanti-belirteci";
export const ORDER_LINK_TARGET_HEADER = "x-siparis-baglanti-hedefi";

export interface OrderLinkRewrite {
  /** Kapı rotasının sorgusuz yolu */
  path: string;
  token: string;
  /** `<sayfa>:<dil>` — ör. `sonuc:en` */
  target: string;
}

/** İmzalı belirtecin biçimi (lib/orders/access.ts: HMAC-SHA256, base64url, ilk 32 karakter). */
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

/**
 * Taşınabilecek belirteç: yalnız imza biçimine uyan değer. Uymayan her değer (Unicode, gömülü satır sonu, aşırı
 * uzunluk, boş) boş dizgiye çevrilir ve kapıda çerezsiz, belirteçsiz aynı 303'ü alır. Ham değer istek başlığına,
 * hata iletisine, günlüğe ya da yanıta HİÇ yazılmaz: `Headers.set` ASCII dışı ve kontrol karakterli değerde
 * değeri iletisine koyarak hata fırlatır.
 */
export function orderLinkToken(raw: string | null | undefined): string {
  return raw && TOKEN_RE.test(raw) ? raw : "";
}

/**
 * Belirteçli sayfa isteği mi? Öyleyse kapıya yeniden yazma bilgisini döner, değilse null.
 * `t` parametresi değeri ne olursa olsun (boş, bozuk, geçersiz) sayfaya ulaşmaz: her durumda kapıdan geçer.
 */
export function orderLinkRewrite(pathname: string, search: URLSearchParams): OrderLinkRewrite | null {
  if (!search.has("t")) return null;
  const m = PAGE_RE.exec(pathname);
  if (!m) return null;
  return {
    path: `/api/public/siparis/${m[3]}/baglanti`,
    token: orderLinkToken(search.get("t")),
    target: `${m[2] === "siparis" ? "siparis" : "sonuc"}:${m[1] ?? "tr"}`,
  };
}

/** Belirteçsiz, sabit sayfa adresi (göreli): yalnız izinli sayfa türü, izinli dil ve sipariş numarasından kurulur. */
export function orderLinkPath(page: OrderLinkPage, orderNo: string, locale: string): string {
  const prefix = locale === "en" || locale === "ru" ? `/${locale}` : "";
  return `${prefix}${page === "sonuc" ? "/odeme/sonuc" : "/siparis"}/${encodeURIComponent(orderNo)}`;
}

/**
 * Kapı rotasının hedefi. İzinli olmayan sayfa türü ve dil varsayılana düşer; istekten adres kopyalanmaz (açık
 * yönlendirme yok). Numara biçimi geçersizse erişim denenmez (`orderNo: null`), yönlendirme yine aynı biçimdedir.
 */
export function orderLinkTarget(no: string, hedef: string | null, dil: string | null): { orderNo: string | null; path: string } {
  const page: OrderLinkPage = hedef === "sonuc" ? "sonuc" : "siparis";
  const canonical = no.trim().toUpperCase();
  const orderNo = ORDER_NO_RE.test(canonical) ? canonical : null;
  return { orderNo, path: orderLinkPath(page, orderNo ?? no.slice(0, 40), dil ?? "tr") };
}
