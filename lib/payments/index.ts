/**
 * Etkin ödeme sağlayıcısı. PAYMENT_PROVIDER=mock|iyzico (yalnız sunucu).
 *
 *  • mock   → deneme sağlayıcısı; canlı dağıtımda asla seçilmez.
 *  • iyzico → Faz 4'te bağlanacak (başlat / sonucu sorgula / iade). Şimdilik yok.
 *  • (boş)  → sağlayıcı yok: sipariş ucu "closed" döner.
 */
import { mockAllowed, mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider | null {
  const name = process.env.PAYMENT_PROVIDER;
  if (name === "mock" && mockAllowed()) return mockProvider;
  return null;
}

export type { PaymentProvider } from "./types";
