/**
 * Etkin ödeme sağlayıcısı. PAYMENT_PROVIDER=mock|iyzico (yalnız sunucu).
 *
 *  • mock   → deneme sağlayıcısı; canlı dağıtımda asla seçilmez.
 *  • iyzico → Ödeme Formu (barındırılan sayfa). Anahtarlar deneme (sandbox) ise siparişler
 *             `is_test=true` olur; anahtar tanımlı değilse seçilmez.
 *  • (boş)  → sağlayıcı yok: sipariş ucu "closed" döner.
 */
import { iyzicoConfigured, iyzicoProvider } from "./iyzico";
import { mockAllowed, mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider | null {
  const name = process.env.PAYMENT_PROVIDER;
  if (name === "mock" && mockAllowed()) return mockProvider;
  if (name === "iyzico" && iyzicoConfigured()) return iyzicoProvider;
  return null;
}

/**
 * Geçmiş bir siparişin ödendiği sağlayıcı (iade için). Etkin sağlayıcıdan farklı olabilir:
 * iade her zaman ödemenin alındığı sağlayıcıdan yapılır.
 */
export function getProviderByName(name: string | null | undefined): PaymentProvider | null {
  if (name === "mock") return mockAllowed() ? mockProvider : null;
  if (name === "iyzico") return iyzicoConfigured() ? iyzicoProvider : null;
  return null;
}

export type { PaymentProvider } from "./types";
