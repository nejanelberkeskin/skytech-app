/**
 * Sipariş görünümü — SUNUCU tarafı veri erişimi.
 *
 * DURUM: sipariş kaydı (Faz 3c) bağlanana kadar yalnız GELİŞTİRME ortamında örnek
 * siparişler döner (`?t=ornek`); canlıda her zaman null → sayfa 404 verir.
 * Gerçek uygulamada erişim iki yoldan doğrulanır: oturumdaki üyenin kendi
 * siparişi ya da e-postadaki imzalı belirteç. Numara tek başına yetmez.
 */
import { ORDER_NO_RE } from "./types";
import { ORDER_VIEW_FIXTURES, ORDER_VIEW_FIXTURE_TOKEN, type PublicOrderView } from "./view";

export interface OrderViewAccess {
  /** E-postadaki bağlantıdan gelen belirteç (`?t=`) */
  token?: string | null;
}

export async function getOrderView(orderNo: string, access: OrderViewAccess = {}): Promise<PublicOrderView | null> {
  const no = orderNo.trim().toUpperCase();
  if (!ORDER_NO_RE.test(no)) return null;
  if (process.env.NODE_ENV === "production") return null;
  if (access.token !== ORDER_VIEW_FIXTURE_TOKEN) return null;
  return ORDER_VIEW_FIXTURES.find((o) => o.orderNo === no) ?? null;
}
