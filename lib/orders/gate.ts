/**
 * Sipariş kapısı — sipariş oluşturan / ödeme başlatan TÜM uçlar aynı kuralı kullanır.
 *
 *  1. Satış bayrağı (NEXT_PUBLIC_SALES_ENABLED) açık olmalı.
 *  2. Bir ödeme sağlayıcısı yapılandırılmış olmalı.
 *  3. Hukuki metinler "-taslak" iken (avukat incelemesi bitmeden) GERÇEK sipariş alınmaz:
 *     yalnız deneme sağlayıcısıyla, o da canlı site DIŞINDA (yerel geliştirme, Vercel
 *     önizlemesi) deneme siparişi oluşturulabilir. Canlı sitede taslak metinle hiçbir
 *     koşulda sipariş açılmaz — bayrak yanlışlıkla açılsa bile.
 */
import { isDraftLegalVersion } from "@/lib/legal/version";
import type { PaymentProvider } from "@/lib/payments/types";
import { SALES_ENABLED } from "@/lib/site-config";

export function ordersClosed(provider: PaymentProvider | null): boolean {
  if (!SALES_ENABLED || !provider) return true;
  if (!isDraftLegalVersion()) return false;
  return process.env.VERCEL_ENV === "production" || !provider.isTest;
}
