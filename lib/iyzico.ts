import Iyzipay from "iyzipay";

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

let _iyzico: Iyzipay | null = null;

function getIyzico(): Iyzipay {
  if (_iyzico) return _iyzico;

  const apiKey = process.env.IYZICO_API_KEY;
  const secretKey = process.env.IYZICO_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error(
      "Iyzico env değişkenleri tanımlı değil (IYZICO_API_KEY / IYZICO_SECRET_KEY)."
    );
  }

  _iyzico = new Iyzipay({
    apiKey,
    secretKey,
    uri: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com",
  });
  return _iyzico;
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
