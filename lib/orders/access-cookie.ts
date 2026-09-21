/**
 * Sipariş erişim çerezini okur — YALNIZ sunucu bileşenleri (next/headers).
 * Rota işleyicileri `req.cookies` kullanır; ikisi de aynı adı okur (lib/orders/access.ts).
 */
import { cookies } from "next/headers";
import { orderCookieName } from "./access";

export async function readOrderCookie(orderNo: string): Promise<string | null> {
  try {
    return (await cookies()).get(orderCookieName(orderNo.trim().toUpperCase()))?.value ?? null;
  } catch {
    return null;
  }
}
