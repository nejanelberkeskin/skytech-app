/**
 * iyzico ödeme sağlayıcısı — Ödeme Formu (Checkout Form), iyzico'nun barındırdığı sayfa.
 *
 * Kart verisi sunucumuza HİÇ gelmez: müşteri `paymentPageUrl`e gider, 3D Secure dâhil her şey
 * iyzico'da olur, sonuç `callbackUrl`e (POST /api/payment/donus) yalnız bir belirteçle bildirilir.
 * O belirteçle sonucu iyzico'dan BİZ sorgularız (`retrieve`); tarayıcıdan gelen hiçbir
 * "başarılı" bilgisine güvenilmez.
 *
 * Ortam: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL. Adres "sandbox" içeriyorsa deneme
 * kipidir → oluşan siparişler `is_test=true` olur (gerçek tahsilat yoktur).
 * Taksit kapalıdır (tek çekim): cayma hâlinde bedel "tek seferde" iade edilir.
 */
import iyzico from "@/lib/iyzico";
import { ilAdi } from "@/lib/tr-iller";
import type { PaymentInitInput, PaymentInitResult, PaymentOutcome, PaymentProvider, RefundInput, RefundResult } from "./types";

const TIMEOUT_MS = 15_000;

export const iyzicoConfigured = () => Boolean(process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY);
const isSandbox = () => (process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com").includes("sandbox");

type IyzicoResult = Record<string, unknown> & { status?: string; errorCode?: string; errorMessage?: string };
type IyzicoCall = (request: Record<string, unknown>, cb: (err: unknown, result: IyzicoResult) => void) => void;

/** SDK geri çağrı tabanlıdır: söze çevir, zaman aşımı ekle, hatayı sonuç biçimine indir. */
function call(resource: string, method: string, request: Record<string, unknown>): Promise<IyzicoResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ status: "failure", errorCode: "timeout", errorMessage: "iyzico yanıt vermedi" }), TIMEOUT_MS);
    try {
      const target = (iyzico as unknown as Record<string, Record<string, IyzicoCall>>)[resource];
      target[method](request, (err, result) => {
        clearTimeout(timer);
        if (err || !result) resolve({ status: "failure", errorCode: "network", errorMessage: err instanceof Error ? err.message : "bağlantı hatası" });
        else resolve(result);
      });
    } catch (e) {
      clearTimeout(timer);
      resolve({ status: "failure", errorCode: "config", errorMessage: e instanceof Error ? e.message : "yapılandırma hatası" });
    }
  });
}

/** Kuruş → iyzico'nun beklediği ondalık metin ("500.00"). Kayan nokta aritmetiği yok. */
export function kurusToPrice(kurus: number): string {
  const whole = Math.trunc(kurus / 100);
  return `${whole}.${String(kurus % 100).padStart(2, "0")}`;
}

/** iyzico'nun ondalık tutarı → kuruş ("500.0", 500, "500.00" → 50000). */
export function priceToKurus(price: unknown): number | null {
  const text = typeof price === "number" ? String(price) : typeof price === "string" ? price.trim() : "";
  const m = /^(\d+)(?:\.(\d{1,8}))?$/.exec(text);
  if (!m) return null;
  const fraction = (m[2] ?? "").padEnd(2, "0");
  // İki haneden fazlası (ör. "500.005") kuruşa sığmaz: eşleşme sayılmasın.
  if (fraction.length > 2 && /[1-9]/.test(fraction.slice(2))) return null;
  return Number(m[1]) * 100 + Number(fraction.slice(0, 2));
}

const errorText = (r: IyzicoResult) => [r.errorCode, r.errorMessage].filter(Boolean).join(": ") || "bilinmeyen hata";

/** Denetim izinde saklanan ödeme özeti — kart numarası/CVV zaten hiç gelmez; yalnız tanılayıcı alanlar. */
function paymentMeta(r: IyzicoResult): Record<string, unknown> {
  const items = Array.isArray(r.itemTransactions) ? (r.itemTransactions as Record<string, unknown>[]) : [];
  return {
    provider: "iyzico",
    sandbox: isSandbox(),
    paymentStatus: r.paymentStatus ?? null,
    fraudStatus: r.fraudStatus ?? null,
    installment: r.installment ?? null,
    cardType: r.cardType ?? null,
    cardAssociation: r.cardAssociation ?? null,
    cardFamily: r.cardFamily ?? null,
    binNumber: r.binNumber ?? null,
    lastFourDigits: r.lastFourDigits ?? null,
    basketId: r.basketId ?? null,
    currency: r.currency ?? null,
    authCode: r.authCode ?? null,
    hostReference: r.hostReference ?? null,
    paymentTransactionIds: items.map((i) => i.paymentTransactionId).filter(Boolean),
  };
}

export const iyzicoProvider: PaymentProvider = {
  name: "iyzico",
  get isTest() {
    return isSandbox();
  },

  async init(input: PaymentInitInput): Promise<PaymentInitResult> {
    const price = kurusToPrice(input.amountKurus);
    const fullName = `${input.buyer.firstName} ${input.buyer.lastName}`.trim();
    const city = ilAdi(input.address.province) ?? input.address.province;
    const today = new Date().toISOString().slice(0, 10) + " 00:00:00";

    const result = await call("checkoutFormInitialize", "create", {
      locale: input.locale === "tr" ? "tr" : "en",
      conversationId: input.orderId,
      price,
      paidPrice: price,
      currency: "TRY",
      basketId: input.orderNo,
      paymentGroup: "PRODUCT",
      callbackUrl: input.callbackUrl,
      enabledInstallments: [1],
      buyer: {
        id: input.buyerId,
        name: input.buyer.firstName,
        surname: input.buyer.lastName,
        gsmNumber: input.buyer.phone,
        email: input.buyer.email,
        // Veri minimizasyonu: T.C. kimlik / vergi numarası ödeme kuruluşuna GÖNDERİLMEZ (yalnız fatura için
        // alınır; aydınlatma metni de böyle söyler). iyzico alanı zorunlu tuttuğu için genel değer yazılır.
        identityNumber: "11111111111",
        lastLoginDate: today,
        registrationDate: today,
        registrationAddress: input.address.line,
        ip: input.buyer.ip ?? "127.0.0.1",
        city,
        country: "Turkey",
        ...(input.address.postalCode ? { zipCode: input.address.postalCode } : {}),
      },
      billingAddress: {
        contactName: input.billingName ?? fullName,
        city,
        country: "Turkey",
        address: `${input.address.line}, ${input.address.district}`,
        ...(input.address.postalCode ? { zipCode: input.address.postalCode } : {}),
      },
      basketItems: [
        {
          id: input.orderNo,
          name: input.description.slice(0, 120),
          category1: "Tohum topu bırakma hizmeti",
          itemType: "VIRTUAL",
          price,
        },
      ],
    });

    const token = typeof result.token === "string" ? result.token : "";
    const url = typeof result.paymentPageUrl === "string" ? result.paymentPageUrl : "";
    if (result.status !== "success" || !token || !/^https:\/\//.test(url)) return { ok: false, error: errorText(result) };
    return { ok: true, token, redirectUrl: url };
  },

  async retrieve(token: string): Promise<PaymentOutcome> {
    const result = await call("checkoutForm", "retrieve", { locale: "tr", token });
    if (result.errorCode === "timeout" || result.errorCode === "network" || result.errorCode === "config") {
      return { ok: false, error: errorText(result) };
    }

    const meta = paymentMeta(result);
    const approved = result.status === "success" && result.paymentStatus === "SUCCESS";
    // fraudStatus: 1 onaylı · 0 iyzico incelemesinde · -1 reddedildi. İncelemedeki ödeme tahsil edilmiştir;
    // hizmet en erken 14 gün sonra ifa edildiği için sipariş alınır, durum denetim izinde görünür.
    if (!approved || result.fraudStatus === -1) {
      return { ok: true, status: "failure", reason: result.fraudStatus === -1 ? "fraud_rejected" : errorText(result), meta };
    }

    const paidKurus = priceToKurus(result.paidPrice);
    const paymentId = typeof result.paymentId === "string" || typeof result.paymentId === "number" ? String(result.paymentId) : "";
    if (paidKurus === null || !paymentId || result.currency !== "TRY") {
      return { ok: false, error: "iyzico yanıtı beklenen biçimde değil" };
    }
    return {
      ok: true,
      status: "success",
      paymentId,
      paidKurus,
      reference: typeof result.basketId === "string" ? result.basketId : undefined,
      meta,
    };
  },

  /**
   * Bedelin TAMAMI iade edilir. Önce ödeme kimliğiyle iade (v2); olmazsa kalem kimliğiyle iade;
   * o da olmazsa aynı gün içindeki ödemeler için iptal (provizyonun geri alınması) denenir.
   */
  async refund(input: RefundInput): Promise<RefundResult> {
    const base = { locale: "tr", conversationId: input.orderNo, ip: input.ip ?? "127.0.0.1" };
    const price = kurusToPrice(input.amountKurus);
    const errors: string[] = [];

    const v2 = await call("refundV2", "create", { ...base, paymentId: input.paymentId, price, currency: "TRY" });
    if (v2.status === "success") return { ok: true, refundId: String(v2.paymentId ?? input.paymentId), method: "refund" };
    errors.push(`v2 ${errorText(v2)}`);

    const ids = Array.isArray(input.meta?.paymentTransactionIds) ? (input.meta.paymentTransactionIds as unknown[]) : [];
    if (ids.length === 1) {
      const classic = await call("refund", "create", { ...base, paymentTransactionId: String(ids[0]), price, currency: "TRY" });
      if (classic.status === "success") return { ok: true, refundId: String(classic.paymentTransactionId ?? ids[0]), method: "refund" };
      errors.push(`kalem ${errorText(classic)}`);
    }

    const cancel = await call("cancel", "create", { ...base, paymentId: input.paymentId });
    if (cancel.status === "success") return { ok: true, refundId: String(cancel.paymentId ?? input.paymentId), method: "cancel" };
    errors.push(`iptal ${errorText(cancel)}`);

    return { ok: false, error: errors.join(" | ").slice(0, 500) };
  },
};
