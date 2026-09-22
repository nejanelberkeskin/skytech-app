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

  refund(input: RefundInput): Promise<RefundResult> {
    return refundWithIyzico(input);
  },
};

/**
 * Doğrulanmış kesin ret kodları: iyzico bu kodlarla döndüğünde iade KESİN olarak yapılmamıştır ve
 * yeniden denenebilir. Liste iyzico sandbox kabulünde gözlenen kodlarla doldurulur; o zamana kadar boştur,
 * yani iyzico'nun açık hata yanıtları da "belirsiz" sayılır ve mutabakata gider (web-brifler/17 §3).
 */
export const DEFINITIVE_REFUND_ERROR_CODES: ReadonlySet<string> = new Set<string>();

/** İsteğin iyzico'ya ulaşıp ulaşmadığı bilinmez: bu hatalardan sonra başka yöntem DENENMEZ. */
const UNCERTAIN_CODES = new Set(["timeout", "network"]);
/** İstek hiç gönderilemedi (SDK çağrılamadı). */
const NOT_SENT_CODES = new Set(["config"]);

type Caller = (resource: string, method: string, request: Record<string, unknown>) => Promise<IyzicoResult>;

/**
 * Bedelin TAMAMI iade edilir. Önce ödeme kimliğiyle iade (v2); iyzico AÇIKÇA reddederse kalem kimliğiyle
 * iade; o da açıkça reddedilirse aynı gün içindeki ödemeler için iptal (provizyonun geri alınması).
 * Zaman aşımı ya da bağlantı hatasında şelale DURUR ve sonuç "belirsiz" döner: ilk istek iyzico'da
 * gerçekleşmiş olabilir, ikinci bir para işlemi başlatılmaz.
 */
export async function refundWithIyzico(
  input: RefundInput,
  caller: Caller = call,
  definitive: ReadonlySet<string> = DEFINITIVE_REFUND_ERROR_CODES
): Promise<RefundResult> {
  const base = { locale: "tr", conversationId: input.orderNo, ip: input.ip ?? "127.0.0.1" };
  const price = kurusToPrice(input.amountKurus);
  const ids = Array.isArray(input.meta?.paymentTransactionIds) ? (input.meta.paymentTransactionIds as unknown[]) : [];
  const steps: { label: string; resource: string; request: Record<string, unknown>; method: "refund" | "cancel"; refundId: (r: IyzicoResult) => string }[] = [
    { label: "v2", resource: "refundV2", request: { ...base, paymentId: input.paymentId, price, currency: "TRY" }, method: "refund", refundId: (r) => String(r.paymentId ?? input.paymentId) },
  ];
  if (ids.length === 1) {
    steps.push({ label: "kalem", resource: "refund", request: { ...base, paymentTransactionId: String(ids[0]), price, currency: "TRY" }, method: "refund", refundId: (r) => String(r.paymentTransactionId ?? ids[0]) });
  }
  steps.push({ label: "iptal", resource: "cancel", request: { ...base, paymentId: input.paymentId }, method: "cancel", refundId: (r) => String(r.paymentId ?? input.paymentId) });

  const errors: string[] = [];
  const codes: string[] = [];
  for (const step of steps) {
    const result = await caller(step.resource, "create", step.request);
    if (result.status === "success") return { ok: true, refundId: step.refundId(result), method: step.method };
    errors.push(`${step.label} ${errorText(result)}`);
    const code = typeof result.errorCode === "string" || typeof result.errorCode === "number" ? String(result.errorCode) : "";
    if (UNCERTAIN_CODES.has(code)) return { ok: false, outcome: "unknown", errorCode: code, error: errors.join(" | ").slice(0, 500) };
    codes.push(code);
  }
  const error = errors.join(" | ").slice(0, 500);
  const errorCode = codes[codes.length - 1] || undefined;
  if (codes.every((c) => NOT_SENT_CODES.has(c))) return { ok: false, outcome: "not_sent", errorCode, error };
  const explicit = codes.filter((c) => !NOT_SENT_CODES.has(c));
  return { ok: false, outcome: explicit.every((c) => c !== "" && definitive.has(c)) ? "rejected" : "unknown", errorCode, error };
}
