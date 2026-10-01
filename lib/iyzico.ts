import Iyzipay from "iyzipay";
import { iyzicoConfig } from "./payments/iyzico-config";

/**
 * Iyzipay client — lazy initialized.
 *
 * Module yüklendiği anda env değişkenleri olmayabilir (örn. Vercel build,
 * "Collecting page data" aşaması). Bu yüzden gerçek Iyzipay instance'ını
 * sadece bir property erişimi olduğunda oluşturuyoruz.
 *
 * Kullanım API'si değişmez: `import iyzico from "@/lib/iyzico"` ve
 * `iyzico.checkoutFormInitialize.create(...)` aynı şekilde çalışır.
 */

let cached: { config: NonNullable<ReturnType<typeof iyzicoConfig>>; client: Iyzipay } | null = null;

function getIyzico(): Iyzipay {
  const config = iyzicoConfig();
  if (!config) throw new Error("iyzico anahtarları veya ödeme ortamı yapılandırması geçersiz.");
  // Uzun yaşayan süreçte ortam değişirse eski SDK ile yeni test/canlı işareti karışmaz.
  if (!cached || cached.config.apiKey !== config.apiKey || cached.config.secretKey !== config.secretKey || cached.config.uri !== config.uri) {
    cached = { config, client: new Iyzipay({ apiKey: config.apiKey, secretKey: config.secretKey, uri: config.uri }) };
  }
  return cached.client;
}

const iyzicoProxy = new Proxy({} as Iyzipay, {
  get(_target, prop) {
    const instance = getIyzico() as unknown as Record<string | symbol, unknown>;
    return instance[prop as string];
  },
});

export default iyzicoProxy;

export interface CreatePaymentRequest {
  orderId: string;
  userId: string;
  amount: number;
  email: string;
  fullName: string;
  ipAddress: string;
  description: string;
}

export interface PaymentResponse {
  status: "success" | "failure";
  paymentLink?: string;
  paymentId?: string;
  error?: string;
}
