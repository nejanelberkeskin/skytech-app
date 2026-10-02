import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { orderCookieName, orderCookieOptions } from "@/lib/orders/access";
import { ORDER_LINK_HEADERS, ORDER_LINK_TARGET_HEADER, ORDER_LINK_TOKEN_HEADER, orderLinkTarget, orderLinkToken } from "@/lib/orders/link-gate";
import { ORDER_VIEW_FIXTURES, ORDER_VIEW_FIXTURE_TOKEN } from "@/lib/orders/view";
import { getAuthorizedOrder } from "@/lib/orders/view-data";

/**
 * GET /api/public/siparis/[no]/baglanti — sipariş bağlantısı kapısı.
 *
 * middleware `/siparis/<no>?t=` ve `/odeme/sonuc/<no>?t=` isteklerini sayfa render edilmeden buraya yeniden yazar
 * (lib/orders/link-gate.ts); belirteç ve hedef (`<sayfa>:<dil>`) iç istek başlıklarında gelir. Doğrudan çağrıda
 * `?t=&hedef=siparis|sonuc&dil=tr|en|ru` sorgusu da kabul edilir. Yanıt HER durumda belirteçsiz, sabit sayfa adresine 303'tür:
 *  • belirteç doğrulanırsa HttpOnly erişim çerezi yazılır (sayfa, yenileme, dil değişimi ve belgeler bu çerezi okur);
 *  • geçersiz belirteç, başka siparişin belirteci, olmayan sipariş, hız sınırı ve geçici hata çerezsiz AYNI
 *    yönlendirmeyi alır: sipariş numarası tek başına erişim vermez, varlık bilgisi sızmaz.
 * GET yalnız tarayıcı çerezini yazar; sipariş, ödeme ya da iade durumu değişmez (ön yükleme ve bağlantı tarayıcıları güvenli).
 * Belirteç günlüğe, hata iletisine ya da yanıt gövdesine yazılmaz.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const search = req.nextUrl.searchParams;
  const [hedef, dil] = (req.headers.get(ORDER_LINK_TARGET_HEADER) ?? "").split(":");
  const target = orderLinkTarget(no, hedef || search.get("hedef"), dil || search.get("dil"));
  // Göreli Location: hedef istek başlıklarından (Host) değil, yalnız izinli parçalardan kurulur.
  const res = new NextResponse(null, { status: 303, headers: { ...ORDER_LINK_HEADERS, Location: target.path } });

  // Biçime uymayan belirteç boş sayılır: veritabanına gidilmez, ham değer hiçbir yere yazılmaz.
  const token = orderLinkToken(req.headers.get(ORDER_LINK_TOKEN_HEADER) ?? search.get("t"));
  if (!target.orderNo || !token) return res;
  // Geliştirme örnekleri (`?t=ornek`): yalnız geliştirmede ve yalnız bilinen örnek numaralarında çerez yazılır;
  // veritabanına gidilmez (sayfa örneği lib/orders/view.ts'ten okur). Üretimde orderLinkToken bu değeri boşa çevirir.
  if (token === ORDER_VIEW_FIXTURE_TOKEN) {
    if (process.env.NODE_ENV !== "production" && ORDER_VIEW_FIXTURES.some((o) => o.orderNo === target.orderNo)) {
      res.cookies.set(orderCookieName(target.orderNo), token, orderCookieOptions());
    }
    return res;
  }
  if (rateLimit(`siparis-baglanti:${getClientIP(req)}`, 30, 10 * 60_000)) return res;
  try {
    const order = await getAuthorizedOrder(target.orderNo, { token });
    if (order) res.cookies.set(orderCookieName(order.order_no), token, orderCookieOptions());
  } catch {
    // Geçici okuma hatası: çerez yazılmaz; müşteri bağlantıyı yeniden açabilir. Ayrıntı (numara, belirteç) yazılmaz.
    console.error("[siparis-baglanti] sipariş okunamadı");
  }
  return res;
}

export const HEAD = GET;
